import {
  Event,
  EventAttendance,
  GameTable,
  Player,
  Reservation,
  TableDiscussionRead,
  sequelize,
} from '../models/index.js';
import { setFlash } from './access.controller.js';
import { recordAdminAction } from '../services/audit-log.service.js';

function redirectWithError(res, code) {
  return res.redirect(`/booking?error=${code}`);
}

export async function joinTable(req, res, next) {
  const tableId = Number(req.params.tableId);
  const playerId = req.currentUser.id;

  try {
    await sequelize.transaction(async (transaction) => {
      const gameTable = await GameTable.findByPk(tableId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!gameTable || gameTable.status !== 'open') throw new Error('TABLE_UNAVAILABLE');

      const event = await Event.findByPk(gameTable.eventId, { transaction, lock: transaction.LOCK.SHARE });
      if (!event || !event.reservable || event.status !== 'upcoming' || event.registrationDeadline < new Date()) {
        throw new Error('EVENT_NOT_RESERVABLE');
      }

      const existingReservation = await Reservation.findOne({
        where: { playerId, eventId: event.id, status: 'confirmed' },
        transaction,
      });
      if (existingReservation) throw new Error('PLAYER_ALREADY_REGISTERED');

      const playerCount = await Reservation.count({
        where: { gameTableId: tableId, status: 'confirmed' },
        transaction,
      });
      if (playerCount >= gameTable.maxPlayers) throw new Error('TABLE_FULL');

      await Reservation.create({ playerId, eventId: event.id, gameTableId: tableId }, { transaction });
      await TableDiscussionRead.upsert({
        gameTableId: tableId,
        playerId,
        lastReadAt: new Date(),
      }, { transaction });
    });

    return res.redirect('/booking?message=table-joined');
  } catch (error) {
    const knownErrors = ['TABLE_UNAVAILABLE', 'EVENT_NOT_RESERVABLE', 'PLAYER_ALREADY_REGISTERED', 'TABLE_FULL'];
    if (knownErrors.includes(error.message)) return redirectWithError(res, error.message.toLowerCase());
    return next(error);
  }
}

export async function leaveTable(req, res, next) {
  const tableId = Number(req.params.tableId);
  const playerId = req.currentUser.id;

  try {
    await sequelize.transaction(async (transaction) => {
      const gameTable = await GameTable.findByPk(tableId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!gameTable) throw new Error('TABLE_NOT_FOUND');

      const reservation = await Reservation.findOne({
        where: { gameTableId: tableId, playerId, status: 'confirmed' },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!reservation) throw new Error('RESERVATION_NOT_FOUND');

      const remainingReservations = await Reservation.findAll({
        where: { gameTableId: tableId, status: 'confirmed' },
        order: [['createdAt', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const nextHostReservation = remainingReservations.find((item) => item.playerId !== playerId);

      if (!nextHostReservation) {
        await gameTable.destroy({ transaction });
        return;
      }

      await reservation.update({ status: 'cancelled', cancelledAt: new Date() }, { transaction });
      await TableDiscussionRead.destroy({ where: { gameTableId: tableId, playerId }, transaction });
      if (gameTable.hostPlayerId === playerId) {
        await gameTable.update({ hostPlayerId: nextHostReservation.playerId }, { transaction });
      }
    });

    return res.redirect('/booking?message=table-left');
  } catch (error) {
    if (['TABLE_NOT_FOUND', 'RESERVATION_NOT_FOUND'].includes(error.message)) {
      return redirectWithError(res, error.message.toLowerCase());
    }
    return next(error);
  }
}

export async function cancelPlayerReservationByAdmin(req, res, next) {
  const eventId = Number(req.params.eventId);
  const playerId = Number(req.params.playerId);
  let playerIdentity;

  try {
    if (!Number.isInteger(eventId) || !Number.isInteger(playerId)) {
      return res.status(400).send('Événement ou joueur invalide.');
    }

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
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!reservation) throw new Error('RESERVATION_NOT_FOUND');
      const player = await Player.findByPk(playerId, { transaction });
      if (!player) throw new Error('PLAYER_NOT_FOUND');
      playerIdentity = {
        label: player.nickname || `${player.firstname} ${player.lastname}`,
        email: player.email,
      };

      const gameTable = await GameTable.findByPk(reservation.gameTableId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!gameTable) throw new Error('TABLE_NOT_FOUND');

      const remainingReservations = await Reservation.findAll({
        where: { gameTableId: gameTable.id, status: 'confirmed' },
        order: [['createdAt', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const nextHostReservation = remainingReservations.find((item) => item.playerId !== playerId);

      await EventAttendance.destroy({ where: { eventId, playerId }, transaction });
      await recordAdminAction({
        admin: req.currentUser,
        category: 'game_tables',
        action: 'player_reservation_cancelled',
        targetType: 'member',
        targetId: player.id,
        targetLabel: playerIdentity.label,
        description: `Inscription administrative annulée sur la table ${gameTable.tableNumber}.`,
        transaction,
      });
      if (!nextHostReservation) {
        await gameTable.destroy({ transaction });
        return;
      }

      await reservation.update({
        status: 'cancelled',
        cancelledAt: new Date(),
      }, { transaction });
      await TableDiscussionRead.destroy({
        where: { gameTableId: gameTable.id, playerId },
        transaction,
      });
      if (gameTable.hostPlayerId === playerId) {
        await gameTable.update({ hostPlayerId: nextHostReservation.playerId }, { transaction });
      }
    });

    setFlash(
      req,
      'success',
      `L’inscription de ${playerIdentity.label} a été annulée. Pensez à prévenir cette personne à l’adresse ${playerIdentity.email}.`,
    );
    return res.redirect(`/admindashboard/events/${eventId}/attendance`);
  } catch (error) {
    if (['EVENT_NOT_AVAILABLE', 'RESERVATION_NOT_FOUND', 'PLAYER_NOT_FOUND', 'TABLE_NOT_FOUND'].includes(error.message)) {
      setFlash(req, 'error', 'Cette inscription ne peut plus être annulée.');
      return res.redirect(`/admindashboard/events/${eventId}/attendance`);
    }
    return next(error);
  }
}
