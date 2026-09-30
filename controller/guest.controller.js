import {
  Event,
  GameTable,
  TableGuest,
  sequelize,
} from '../models/index.js';
import { setFlash } from './access.controller.js';
import { recordAdminAction } from '../services/audit-log.service.js';

function redirectToTables(res, eventId) {
  return res.redirect(`/admindashboard/events/${eventId}/tables`);
}

function redirectToBooking(res, eventId, error) {
  return res.redirect(`/booking?event=${eventId}&error=${error}`);
}

function isAdmin(req) {
  return req.currentUser?.role?.name === 'Admin';
}

function canManageGuests(req, gameTable) {
  return isAdmin(req) || gameTable.hostPlayerId === req.currentUser?.id;
}

export async function addTableGuest(req, res, next) {
  const tableId = Number(req.params.tableId);
  const nickname = String(req.body.nickname || '').trim();

  let eventId;

  try {
    await sequelize.transaction(async (transaction) => {
      const gameTable = await GameTable.findByPk(tableId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!gameTable) {
        throw new Error('TABLE_NOT_FOUND');
      }

      eventId = gameTable.eventId;

      if (!canManageGuests(req, gameTable)) {
        throw new Error('NOT_TABLE_HOST');
      }

      if (gameTable.status !== 'open') {
        throw new Error('TABLE_NOT_OPEN');
      }

      const event = await Event.findByPk(gameTable.eventId, {
        transaction,
        lock: transaction.LOCK.SHARE,
      });

      if (
        !event
        || !['upcoming', 'ongoing'].includes(event.status)
        || !event.reservable
      ) {
        throw new Error('EVENT_NOT_AVAILABLE');
      }

      if (!nickname || nickname.length > 80) {
        throw new Error('INVALID_GUEST_NAME');
      }

      const playerCount = await gameTable.countReservations({
        where: {
          status: 'confirmed',
        },
        transaction,
      });

      const guestCount = await gameTable.countGuests({
        transaction,
      });

      if (playerCount + guestCount >= gameTable.maxPlayers) {
        throw new Error('TABLE_FULL');
      }

      const existingGuest = await TableGuest.findOne({
        where: {
          gameTableId: tableId,
          nickname,
        },
        transaction,
      });

      if (existingGuest) {
        throw new Error('GUEST_ALREADY_EXISTS');
      }

      const guest = await TableGuest.create({
        gameTableId: tableId,
        nickname,
      }, {
        transaction,
      });

      if (isAdmin(req)) {
        await recordAdminAction({
          admin: req.currentUser,
          category: 'game_tables',
          action: 'guest_added',
          targetType: 'table_guest',
          targetId: guest.id,
          targetLabel: nickname,
          description:
            `Invité « ${nickname} » ajouté à la table ${gameTable.tableNumber}.`,
          transaction,
        });
      }
    });

    if (isAdmin(req)) {
      setFlash(req, 'success', 'L’invité a été ajouté à la table.');
      return redirectToTables(res, eventId);
    }

    return redirectToBooking(res, eventId, 'guest-added');
  } catch (error) {
    if (
      [
        'TABLE_NOT_FOUND',
        'NOT_TABLE_HOST',
        'TABLE_NOT_OPEN',
        'EVENT_NOT_AVAILABLE',
        'INVALID_GUEST_NAME',
        'TABLE_FULL',
        'GUEST_ALREADY_EXISTS',
      ].includes(error.message)
    ) {
      if (isAdmin(req)) {
        setFlash(
          req,
          'error',
          {
            TABLE_NOT_FOUND: 'Cette table est introuvable.',
            NOT_TABLE_HOST: 'Vous n’êtes pas autorisé à gérer les invités de cette table.',
            TABLE_NOT_OPEN: 'Cette table n’accepte plus de nouveaux participants.',
            EVENT_NOT_AVAILABLE: 'Cette rencontre ne permet plus de modifier cette table.',
            INVALID_GUEST_NAME: 'Le nom de l’invité est invalide.',
            TABLE_FULL: 'Cette table est complète.',
            GUEST_ALREADY_EXISTS: 'Cet invité est déjà présent à cette table.',
          }[error.message],
        );

        return redirectToTables(res, eventId);
      }

      return redirectToBooking(
        res,
        eventId,
        error.message.toLowerCase(),
      );
    }

    return next(error);
  }
}

export async function removeTableGuest(req, res, next) {
  const tableId = Number(req.params.tableId);
  const guestId = Number(req.params.guestId);

  let eventId;

  try {
    await sequelize.transaction(async (transaction) => {
      const gameTable = await GameTable.findByPk(tableId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!gameTable) {
        throw new Error('TABLE_NOT_FOUND');
      }

      eventId = gameTable.eventId;

      if (!canManageGuests(req, gameTable)) {
        throw new Error('NOT_TABLE_HOST');
      }

      const guest = await TableGuest.findOne({
        where: {
          id: guestId,
          gameTableId: tableId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!guest) {
        throw new Error('GUEST_NOT_FOUND');
      }

      await guest.destroy({ transaction });

      if (isAdmin(req)) {
        await recordAdminAction({
          admin: req.currentUser,
          category: 'game_tables',
          action: 'guest_removed',
          targetType: 'table_guest',
          targetId: guest.id,
          targetLabel: guest.nickname,
          description:
            `Invité « ${guest.nickname} » retiré de la table ${gameTable.tableNumber}.`,
          transaction,
        });
      }
    });

    if (isAdmin(req)) {
      setFlash(req, 'success', 'L’invité a été retiré de la table.');
      return redirectToTables(res, eventId);
    }

    return redirectToBooking(res, eventId, 'guest-removed');
  } catch (error) {
    if (
      [
        'TABLE_NOT_FOUND',
        'NOT_TABLE_HOST',
        'GUEST_NOT_FOUND',
      ].includes(error.message)
    ) {
      if (isAdmin(req)) {
        setFlash(
          req,
          'error',
          'Cet invité ne peut plus être retiré de la table.',
        );

        return redirectToTables(res, eventId);
      }

      return redirectToBooking(
        res,
        eventId,
        error.message.toLowerCase(),
      );
    }

    return next(error);
  }
}