import { Op, Transaction } from 'sequelize';
import {
  Event,
  EventTableClosure,
  Game,
  GameTable,
  Reservation,
  TableDiscussionRead,
  sequelize,
} from '../models/index.js';
import { recordAdminAction } from '../services/audit-log.service.js';

function redirectWithError(res, code) {
  return res.redirect(`/booking?error=${code}`);
}

function isAdmin(req) {
  return req.currentUser?.role?.name === 'Admin';
}

function tableLabel(gameTable) {
  return `Table ${gameTable.tableNumber}`;
}

export async function createTable(req, res, next) {
  const eventId = Number(req.body.eventId);
  const gameId = Number(req.body.gameId);
  const maxPlayers = Number(req.body.maxPlayers);
  const tableNumber = Number(req.body.tableNumber);
  const playerId = req.currentUser.id;

  try {
    await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
      const event = await Event.findByPk(eventId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!event || !event.reservable || event.status !== 'upcoming' || event.registrationDeadline < new Date()) {
        throw new Error('EVENT_NOT_RESERVABLE');
      }

      const activeReservation = await Reservation.findOne({
        where: { eventId, playerId, status: 'confirmed' },
        transaction,
      });
      if (activeReservation) throw new Error('PLAYER_ALREADY_REGISTERED');

      const game = await Game.findOne({ where: { id: gameId, isAvailable: true }, transaction });
      const invalidCapacity = !Number.isInteger(maxPlayers)
        || maxPlayers < 1
        || maxPlayers > 10
        || (game?.minPlayers != null && maxPlayers < game.minPlayers)
        || (game?.maxPlayers != null && maxPlayers > game.maxPlayers);
      if (!game || invalidCapacity) throw new Error('INVALID_GAME_CAPACITY');

      const existingTables = await GameTable.findAll({
        where: { eventId, status: { [Op.ne]: 'cancelled' } },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const usedNumbers = new Set(existingTables.map((gameTable) => gameTable.tableNumber));
      const tableClosure = await EventTableClosure.findOne({
        where: { eventId, tableNumber },
        transaction,
        lock: transaction.LOCK.SHARE,
      });
      const invalidTableNumber = !Number.isInteger(tableNumber)
        || tableNumber < 1
        || tableNumber > event.maxTable;
      if (invalidTableNumber || usedNumbers.has(tableNumber) || tableClosure) throw new Error('TABLE_UNAVAILABLE');

      const gameTable = await GameTable.create({
        eventId,
        tableNumber,
        gameId,
        maxPlayers,
        hostPlayerId: playerId,
      }, { transaction });

      await Reservation.create({ playerId, eventId, gameTableId: gameTable.id }, { transaction });
      await TableDiscussionRead.create({
        gameTableId: gameTable.id,
        playerId,
        lastReadAt: new Date(),
      }, { transaction });
      if (isAdmin(req)) {
        await recordAdminAction({
          admin: req.currentUser,
          category: 'game_tables',
          action: 'table_created',
          targetType: 'game_table',
          targetId: gameTable.id,
          targetLabel: tableLabel(gameTable),
          description: `Table créée pour « ${game.name} » avec ${maxPlayers} places.`,
          transaction,
        });
      }
    });

    return res.redirect('/booking?message=table-created');
  } catch (error) {
    const knownErrors = ['EVENT_NOT_RESERVABLE', 'PLAYER_ALREADY_REGISTERED', 'INVALID_GAME_CAPACITY', 'TABLE_UNAVAILABLE'];
    if (knownErrors.includes(error.message)) return redirectWithError(res, error.message.toLowerCase());
    return next(error);
  }
}

export async function closeEventTableSlotByAdmin(req, res, next) {
  const eventId = Number(req.params.eventId);
  const tableNumber = Number(req.params.tableNumber);

  try {
    if (!Number.isInteger(eventId) || eventId < 1
      || !Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 8) {
      return res.status(400).send('Soirée ou table invalide.');
    }

    await sequelize.transaction(async (transaction) => {
      const event = await Event.findByPk(eventId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!event || !['upcoming', 'ongoing'].includes(event.status)) {
        throw new Error('EVENT_NOT_AVAILABLE');
      }
      if (tableNumber > event.maxTable) throw new Error('TABLE_NOT_FOUND');

      const existingClosure = await EventTableClosure.findOne({
        where: { eventId, tableNumber },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existingClosure) throw new Error('TABLE_ALREADY_CLOSED');

      const gameTable = await GameTable.findOne({
        where: { eventId, tableNumber, status: { [Op.ne]: 'cancelled' } },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (gameTable?.status === 'closed') throw new Error('TABLE_ALREADY_CLOSED');

      const reservationCount = gameTable
        ? await Reservation.count({
          where: { gameTableId: gameTable.id, status: 'confirmed' },
          transaction,
        })
        : 0;

      await EventTableClosure.create({
        eventId,
        tableNumber,
        closedBy: req.currentUser.id,
      }, { transaction });
      if (gameTable) await gameTable.update({ status: 'closed' }, { transaction });

      await recordAdminAction({
        admin: req.currentUser,
        category: 'game_tables',
        action: 'table_closed',
        targetType: 'event_table_slot',
        targetId: `${event.id}:${tableNumber}`,
        targetLabel: `Table ${tableNumber}`,
        description: reservationCount
          ? `Table fermée aux nouvelles inscriptions ; ${reservationCount} réservation(s) conservée(s).`
          : 'Table libre fermée afin d’empêcher toute réservation.',
        transaction,
      });
    });

    return res.redirect('/booking?message=table-closed');
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return redirectWithError(res, 'table_already_closed');
    }
    if (['EVENT_NOT_AVAILABLE', 'TABLE_NOT_FOUND', 'TABLE_ALREADY_CLOSED'].includes(error.message)) {
      return redirectWithError(res, error.message.toLowerCase());
    }
    return next(error);
  }
}

export async function reopenEventTableSlotByAdmin(req, res, next) {
  const eventId = Number(req.params.eventId);
  const tableNumber = Number(req.params.tableNumber);

  try {
    if (!Number.isInteger(eventId) || eventId < 1
      || !Number.isInteger(tableNumber) || tableNumber < 1 || tableNumber > 8) {
      return res.status(400).send('Soirée ou table invalide.');
    }

    await sequelize.transaction(async (transaction) => {
      const event = await Event.findByPk(eventId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!event || event.status !== 'upcoming' || !event.reservable
        || event.registrationDeadline < new Date()) {
        throw new Error('EVENT_NOT_RESERVABLE');
      }
      if (tableNumber > event.maxTable) throw new Error('TABLE_NOT_FOUND');

      const closure = await EventTableClosure.findOne({
        where: { eventId, tableNumber },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const gameTable = await GameTable.findOne({
        where: { eventId, tableNumber, status: { [Op.ne]: 'cancelled' } },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!closure && gameTable?.status !== 'closed') throw new Error('TABLE_ALREADY_OPEN');

      if (closure) await closure.destroy({ transaction });
      if (gameTable) await gameTable.update({ status: 'open' }, { transaction });

      await recordAdminAction({
        admin: req.currentUser,
        category: 'game_tables',
        action: 'table_reopened',
        targetType: 'event_table_slot',
        targetId: `${event.id}:${tableNumber}`,
        targetLabel: `Table ${tableNumber}`,
        description: gameTable
          ? 'Table rouverte aux nouvelles inscriptions ; réservations existantes conservées.'
          : 'Table libre rendue de nouveau disponible à la réservation.',
        transaction,
      });
    });

    return res.redirect('/booking?message=table-reopened');
  } catch (error) {
    if (['EVENT_NOT_RESERVABLE', 'TABLE_NOT_FOUND', 'TABLE_ALREADY_OPEN'].includes(error.message)) {
      return redirectWithError(res, error.message.toLowerCase());
    }
    return next(error);
  }
}

export async function updateTable(req, res, next) {
  const tableId = Number(req.params.tableId);
  const gameId = Number(req.body.gameId);
  const maxPlayers = Number(req.body.maxPlayers);

  try {
    await sequelize.transaction(async (transaction) => {
      const gameTable = await GameTable.findByPk(tableId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!gameTable) throw new Error('TABLE_NOT_FOUND');
      if (gameTable.hostPlayerId !== req.currentUser.id && !isAdmin(req)) throw new Error('NOT_TABLE_HOST');

      const event = await Event.findByPk(gameTable.eventId, {
        transaction,
        lock: transaction.LOCK.SHARE,
      });
      if (!event || event.status !== 'upcoming' || !event.reservable
        || event.registrationDeadline < new Date()) {
        throw new Error('EVENT_NOT_RESERVABLE');
      }

      const previousGame = await Game.findByPk(gameTable.gameId, { transaction });
      const game = Number.isInteger(gameId)
        ? await Game.findByPk(gameId, { transaction })
        : null;
      const changesToUnavailableGame = game?.id !== previousGame?.id && !game?.isAvailable;
      if (!previousGame || !game || changesToUnavailableGame) throw new Error('INVALID_GAME_CAPACITY');

      const playerCount = await Reservation.count({
        where: { gameTableId: tableId, status: 'confirmed' },
        transaction,
      });
      const invalidCapacity = !Number.isInteger(maxPlayers)
        || maxPlayers < playerCount
        || maxPlayers > 10
        || (game.minPlayers != null && maxPlayers < game.minPlayers)
        || (game.maxPlayers != null && maxPlayers > game.maxPlayers);
      if (invalidCapacity) throw new Error('INVALID_GAME_CAPACITY');

      const previousCapacity = gameTable.maxPlayers;
      const changes = [];
      if (previousGame.id !== game.id) changes.push(`jeu modifié de « ${previousGame.name} » à « ${game.name} »`);
      if (previousCapacity !== maxPlayers) changes.push(`capacité modifiée de ${previousCapacity} à ${maxPlayers} joueurs`);
      await gameTable.update({ gameId: game.id, maxPlayers }, { transaction });
      if (isAdmin(req)) {
        await recordAdminAction({
          admin: req.currentUser,
          category: 'game_tables',
          action: 'table_updated',
          targetType: 'game_table',
          targetId: gameTable.id,
          targetLabel: tableLabel(gameTable),
          description: changes.length ? `${changes.join(' ; ')}.` : 'Paramètres de la table enregistrés sans changement.',
          transaction,
        });
      }
    });

    return res.redirect('/booking?message=table-updated');
  } catch (error) {
    if (['TABLE_NOT_FOUND', 'NOT_TABLE_HOST', 'INVALID_GAME_CAPACITY', 'EVENT_NOT_RESERVABLE'].includes(error.message)) {
      return redirectWithError(res, error.message.toLowerCase());
    }
    return next(error);
  }
}

export async function closeTable(req, res, next) {
  const tableId = Number(req.params.tableId);

  try {
    if (!Number.isInteger(tableId) || tableId < 1) {
      return res.status(400).send('Table invalide.');
    }

    await sequelize.transaction(async (transaction) => {
      const gameTable = await GameTable.findByPk(tableId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!gameTable) throw new Error('TABLE_NOT_FOUND');
      if (gameTable.hostPlayerId !== req.currentUser.id && !isAdmin(req)) throw new Error('NOT_TABLE_HOST');
      if (gameTable.status === 'closed') throw new Error('TABLE_ALREADY_CLOSED');
      if (gameTable.status !== 'open') throw new Error('TABLE_NOT_FOUND');

      const event = await Event.findByPk(gameTable.eventId, {
        transaction,
        lock: transaction.LOCK.SHARE,
      });
      if (!event || !['upcoming', 'ongoing'].includes(event.status)) {
        throw new Error('EVENT_NOT_AVAILABLE');
      }

      await gameTable.update({ status: 'closed' }, { transaction });
      if (isAdmin(req)) {
        await recordAdminAction({
          admin: req.currentUser,
          category: 'game_tables',
          action: 'table_closed',
          targetType: 'game_table',
          targetId: gameTable.id,
          targetLabel: tableLabel(gameTable),
          description: 'Inscriptions à la table fermées.',
          transaction,
        });
      }
    });
    return res.redirect('/booking?message=table-closed');
  } catch (error) {
    if (['TABLE_NOT_FOUND', 'NOT_TABLE_HOST', 'TABLE_ALREADY_CLOSED', 'EVENT_NOT_AVAILABLE'].includes(error.message)) {
      return redirectWithError(res, error.message.toLowerCase());
    }
    return next(error);
  }
}

export async function cancelTable(req, res, next) {
  try {
    await sequelize.transaction(async (transaction) => {
      const gameTable = await GameTable.findByPk(Number(req.params.tableId), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!gameTable) throw new Error('TABLE_NOT_FOUND');
      if (gameTable.hostPlayerId !== req.currentUser.id && !isAdmin(req)) throw new Error('NOT_TABLE_HOST');
      if (isAdmin(req)) {
        await recordAdminAction({
          admin: req.currentUser,
          category: 'game_tables',
          action: 'table_cancelled',
          targetType: 'game_table',
          targetId: gameTable.id,
          targetLabel: tableLabel(gameTable),
          description: 'Table annulée et inscriptions associées supprimées.',
          transaction,
        });
      }
      await gameTable.destroy({ transaction });
    });

    return res.redirect('/booking?message=table-cancelled');
  } catch (error) {
    if (['TABLE_NOT_FOUND', 'NOT_TABLE_HOST'].includes(error.message)) {
      return redirectWithError(res, error.message.toLowerCase());
    }
    return next(error);
  }
}
