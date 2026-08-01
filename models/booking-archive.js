import fs from 'node:fs/promises';
import path from 'node:path';
import { DataTypes, Op } from 'sequelize';

const PARIS_TIME_ZONE = 'Europe/Paris';
const ARCHIVE_DIRECTORY = process.env.ARCHIVE_DIRECTORY || path.join(process.cwd(), 'archives');

function archiveDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: PARIS_TIME_ZONE,
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type).value;
  return { year: value('year'), date: `${value('year')}-${value('month')}-${value('day')}` };
}

function nextWeeklyDate(date) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 7);
  return nextDate;
}

function eventClosingDate(date) {
  const closingDate = new Date(date);
  closingDate.setHours(23, 59, 0, 0);
  return closingDate;
}

export default function defineBookingArchive(sequelize) {
  const BookingArchive = sequelize.define('BookingArchive', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    eventId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'event_id' },
    eventDate: { type: DataTypes.DATE, allowNull: false, field: 'event_date' },
    schemaVersion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'schema_version',
      validate: { min: 1 },
    },
    snapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isObject(value) {
          if (value == null || Array.isArray(value) || typeof value !== 'object') {
            throw new Error("L'instantané d'archive doit être un objet JSON.");
          }
        },
      },
    },
    archivedAt: { type: DataTypes.DATE, allowNull: false, field: 'archived_at', defaultValue: DataTypes.NOW },
  }, {
    tableName: 'booking_archive',
    timestamps: false,
    indexes: [
      { fields: ['event_date'] },
      { fields: ['archived_at'] },
      { fields: ['snapshot'], using: 'gin' },
    ],
  });

  BookingArchive.prototype.getFilename = function getFilename() {
    const { date } = archiveDateParts(this.eventDate);
    return `reservations-${date}-event-${this.eventId}.json`;
  };

  BookingArchive.prototype.getFilePath = function getFilePath() {
    const { year } = archiveDateParts(this.eventDate);
    return path.join(ARCHIVE_DIRECTORY, year, this.getFilename());
  };

  BookingArchive.prototype.exportToFile = async function exportToFile() {
    const destination = this.getFilePath();
    const directory = path.dirname(destination);
    const temporaryFile = `${destination}.tmp-${process.pid}`;

    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(temporaryFile, `${JSON.stringify(this.snapshot, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporaryFile, destination);
    return destination;
  };

  BookingArchive.archiveEvent = async function archiveEvent(eventId) {
    let archive;
    let nextEvent;

    await sequelize.transaction(async (transaction) => {
      const {
        Event,
        EventAttendance,
        EventTableClosure,
        GameTable,
      } = sequelize.models;
      const lockedEvent = await Event.findByPk(eventId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!lockedEvent) throw new Error('EVENT_NOT_FOUND');
      if (!['upcoming', 'ongoing'].includes(lockedEvent.status)) throw new Error('EVENT_NOT_ARCHIVABLE');

      const existingArchive = await BookingArchive.findOne({ where: { eventId }, transaction });
      if (existingArchive) {
        archive = existingArchive;
        return;
      }

      const event = await Event.findByPk(eventId, {
        include: [
          {
            association: 'gameTables',
            include: [
              { association: 'game' },
              { association: 'host' },
              {
                association: 'reservations',
                where: { status: 'confirmed' },
                required: false,
                include: [{ association: 'player' }],
              },
            ],
          },
          { association: 'attendances', required: false },
        ],
        transaction,
      });

      const attendanceByPlayer = new Map(event.attendances.map((item) => [item.playerId, item.attended]));
      const tables = event.gameTables.map((gameTable) => ({
        number: gameTable.tableNumber,
        game: { id: gameTable.game.id, name: gameTable.game.name },
        maximumPlayers: gameTable.maxPlayers,
        participants: gameTable.reservations.map((reservation) => ({
          playerId: reservation.playerId,
          nickname: reservation.player.nickname || reservation.player.firstname,
          wasHost: reservation.playerId === gameTable.hostPlayerId,
          attended: attendanceByPlayer.has(reservation.playerId)
            ? attendanceByPlayer.get(reservation.playerId)
            : true,
        })),
      }));
      const participants = tables.flatMap((table) => table.participants);
      const snapshot = {
        schemaVersion: 1,
        event: { id: event.id, title: event.title, date: event.date },
        statistics: {
          registeredPlayers: participants.length,
          attendanceRecorded: true,
          attendedPlayers: participants.filter((participant) => participant.attended).length,
          tablesUsed: tables.length,
          gamesUsed: new Set(tables.map((table) => table.game.id)).size,
        },
        tables,
        archivedAt: new Date(),
      };

      archive = await BookingArchive.create({
        eventId: event.id,
        eventDate: event.date,
        schemaVersion: 1,
        snapshot,
      }, { transaction });

      await EventAttendance.destroy({ where: { eventId }, transaction });
      await EventTableClosure.destroy({ where: { eventId }, transaction });
      await GameTable.destroy({ where: { eventId }, transaction });
      await lockedEvent.update({ status: 'completed', reservable: false }, { transaction });

      const nextDate = nextWeeklyDate(event.date);
      nextEvent = await Event.findOne({ where: { date: nextDate }, transaction });
      if (!nextEvent) {
        const deadlineOffset = event.date.getTime() - event.registrationDeadline.getTime();
        const formattedDate = new Intl.DateTimeFormat('fr-FR', {
          dateStyle: 'long',
          timeZone: PARIS_TIME_ZONE,
        }).format(nextDate);
        nextEvent = await Event.create({
          title: `Soirée jeux du ${formattedDate}`,
          date: nextDate,
          status: 'upcoming',
          maxTable: event.maxTable,
          registrationDeadline: new Date(nextDate.getTime() - deadlineOffset),
          isPaid: event.isPaid,
          price: event.price,
          reservable: true,
          createdBy: event.createdBy,
        }, { transaction });
      }
    });

    await archive.exportToFile();
    return { archive, nextEvent };
  };

  BookingArchive.archiveDueEvents = async function archiveDueEvents(now = new Date()) {
    const { Event } = sequelize.models;
    const events = await Event.findAll({
      where: { status: { [Op.in]: ['upcoming', 'ongoing'] } },
      order: [['date', 'ASC']],
    });
    const results = [];

    for (const event of events) {
      const isFriday = event.date.getDay() === 5;
      if (isFriday && now >= eventClosingDate(event.date)) {
        results.push(await BookingArchive.archiveEvent(event.id));
      }
    }
    return results;
  };

  BookingArchive.exportMissingFiles = async function exportMissingFiles() {
    const archives = await BookingArchive.findAll();
    return Promise.all(archives.map(async (archiveItem) => {
      try {
        await fs.access(archiveItem.getFilePath());
        return null;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return archiveItem.exportToFile();
      }
    }));
  };

  return BookingArchive;
}
