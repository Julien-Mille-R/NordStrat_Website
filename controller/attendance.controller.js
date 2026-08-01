import { Event, EventAttendance, Reservation, sequelize } from '../models/index.js';
import { currentMembershipSeason } from './membership.controller.js';

async function saveOwnAttendance(req, res, next, attended) {
  const eventId = Number(req.params.eventId);
  const playerId = req.currentUser.id;

  try {
    if (!Number.isInteger(eventId)) return res.status(400).send('Identifiant d’événement invalide.');

    await sequelize.transaction(async (transaction) => {
      const event = await Event.findByPk(eventId, {
        transaction,
        lock: transaction.LOCK.SHARE,
      });
      if (!event || !['upcoming', 'ongoing'].includes(event.status)) {
        throw new Error('EVENT_NOT_AVAILABLE');
      }

      const reservation = await Reservation.findOne({
        where: { eventId, playerId, status: 'confirmed' },
        include: [{ association: 'gameTable', include: [{ association: 'game' }] }],
        transaction,
      });
      if (!reservation) throw new Error('RESERVATION_NOT_FOUND');

      await EventAttendance.upsert({
        eventId,
        playerId,
        gameTableId: reservation.gameTableId,
        tableNumber: reservation.gameTable.tableNumber,
        gameId: reservation.gameTable.gameId,
        gameName: reservation.gameTable.game.name,
        attended,
      }, { transaction });
    });

    const message = attended ? 'attendance-confirmed' : 'attendance-cancelled';
    return res.redirect(`/booking?message=${message}`);
  } catch (error) {
    if (['EVENT_NOT_AVAILABLE', 'RESERVATION_NOT_FOUND'].includes(error.message)) {
      return res.redirect(`/booking?error=${error.message.toLowerCase()}`);
    }
    return next(error);
  }
}

export function cancelOwnAttendance(req, res, next) {
  return saveOwnAttendance(req, res, next, false);
}

export function confirmOwnAttendance(req, res, next) {
  return saveOwnAttendance(req, res, next, true);
}

export async function showAttendancePage(req, res, next) {
  try {
    const currentSeason = currentMembershipSeason();
    const event = await Event.findByPk(Number(req.params.eventId), {
      include: [{
        association: 'reservations',
        required: false,
        where: { status: 'confirmed' },
        include: [
          {
            association: 'player',
            include: [{
              association: 'memberships',
              required: false,
              where: { seasonStart: currentSeason.start },
            }],
          },
          { association: 'gameTable', include: [{ association: 'game' }] },
        ],
      }],
    });
    if (!event) return res.status(404).send('Événement introuvable.');

    const attendances = await EventAttendance.findAll({ where: { eventId: event.id } });
    const attendanceByPlayer = new Map(attendances.map((item) => [item.playerId, item.attended]));

    return res.render('layouts/admin/attendance', {
      event,
      attendanceByPlayer,
      currentSeason,
    });
  } catch (error) {
    return next(error);
  }
}

export async function saveAttendance(req, res, next) {
  const eventId = Number(req.params.eventId);
  const attendedPlayerIds = new Set(
    (Array.isArray(req.body.attendedPlayerIds)
      ? req.body.attendedPlayerIds
      : [req.body.attendedPlayerIds]
    ).filter(Boolean).map(Number),
  );

  try {
    await sequelize.transaction(async (transaction) => {
      const reservations = await Reservation.findAll({
        where: { eventId, status: 'confirmed' },
        include: [{ association: 'gameTable', include: [{ association: 'game' }] }],
        transaction,
      });

      for (const reservation of reservations) {
        await EventAttendance.upsert({
          eventId,
          playerId: reservation.playerId,
          gameTableId: reservation.gameTableId,
          tableNumber: reservation.gameTable.tableNumber,
          gameId: reservation.gameTable.gameId,
          gameName: reservation.gameTable.game.name,
          attended: attendedPlayerIds.has(reservation.playerId),
        }, { transaction });
      }
    });

    return res.redirect(`/admindashboard/events/${eventId}/attendance`);
  } catch (error) {
    return next(error);
  }
}
