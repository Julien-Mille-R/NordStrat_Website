import {
  Event,
  EventAttendance,
  Game,
  GameTable,
  Player,
  Reservation,
  TableDiscussionRead,
  sequelize,
} from '../models/index.js';
import { setFlash } from './access.controller.js';
import { recordAdminAction } from '../services/audit-log.service.js';
import { sendEmail } from '../services/mail.service.js';

function redirectWithError(res, code) {
  return res.redirect(`/booking?error=${code}`);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function notifyTableHost({
  action,
  tableId,
  tableNumber,
  event,
  game,
  host,
  player,
}) {
  // Pas d'email si :
  // - le créateur n'a pas d'adresse email ;
  // - le joueur n'existe pas ;
  // - le joueur est lui-même le créateur de la table.
  if (!host?.email || !player?.id || host.id === player.id) {
    return;
  }

  const actionLabel = action === 'join' ? 'inscrit' : 'désinscrit';

  const hostName = host.nickname
    || `${host.firstname || ''} ${host.lastname || ''}`.trim()
    || 'Bonjour';

  const playerName = player.nickname
    || `${player.firstname || ''} ${player.lastname || ''}`.trim()
    || 'Un joueur';

  const eventTitle = event?.title || 'Rencontre';
  const gameName = game?.name || 'Jeu non renseigné';

  const bookingBaseUrl = process.env.SITE_URL || '';
  const bookingUrl = bookingBaseUrl
    ? `${bookingBaseUrl.replace(/\/$/, '')}/booking?event=${encodeURIComponent(event.id)}&discussion=${encodeURIComponent(tableId)}`
    : null;

  const textLines = [
    `Bonjour ${hostName},`,
    '',
    `${playerName} s'est ${actionLabel} de votre table n°${tableNumber}.`,
    '',
    `Rencontre : ${eventTitle}`,
    `Table : n°${tableNumber}`,
    `Jeu : ${gameName}`,
  ];

  if (bookingUrl) {
    textLines.push('', `Voir la table : ${bookingUrl}`);
  }

  textLines.push('', 'Nord Stratégie');

  try {
    await sendEmail({
      to: host.email,
      subject: `Table n°${tableNumber} - ${playerName} s'est ${actionLabel}`,
      text: textLines.join('\n'),
      html: `
        <p>Bonjour ${escapeHtml(hostName)},</p>

        <p>
          <strong>${escapeHtml(playerName)}</strong>
          s'est ${actionLabel} de votre table.
        </p>

        <ul>
          <li><strong>Rencontre :</strong> ${escapeHtml(eventTitle)}</li>
          <li><strong>Table :</strong> n°${escapeHtml(tableNumber)}</li>
          <li><strong>Jeu :</strong> ${escapeHtml(gameName)}</li>
        </ul>

        ${
          bookingUrl
            ? `<p><a href="${escapeHtml(bookingUrl)}">Voir la table sur Nord Stratégie</a></p>`
            : ''
        }

        <p>Nord Stratégie</p>
      `,
    });
  } catch (error) {
    // L'envoi d'un email ne doit jamais empêcher
    // l'inscription ou la désinscription d'un joueur.
    console.error(
      `Échec de l'envoi de la notification de table (${action}).`,
      error,
    );
  }
}

export async function joinTable(req, res, next) {
  const tableId = Number(req.params.tableId);
  const playerId = req.currentUser.id;

  let eventId;
  let tableNotification = null;

  try {
    await sequelize.transaction(async (transaction) => {
      const gameTable = await GameTable.findByPk(tableId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!gameTable || gameTable.status !== 'open') {
        throw new Error('TABLE_UNAVAILABLE');
      }

      const event = await Event.findByPk(gameTable.eventId, {
        transaction,
        lock: transaction.LOCK.SHARE,
      });

      if (
        !event
        || !event.reservable
        || event.status !== 'upcoming'
        || event.registrationDeadline < new Date()
      ) {
        throw new Error('EVENT_NOT_RESERVABLE');
      }

      eventId = event.id;

      const existingReservation = await Reservation.findOne({
        where: {
          playerId,
          eventId: event.id,
          status: 'confirmed',
        },
        transaction,
      });

      if (existingReservation) {
        throw new Error('PLAYER_ALREADY_REGISTERED');
      }

      const playerCount = await Reservation.count({
        where: {
          gameTableId: tableId,
          status: 'confirmed',
        },
        transaction,
      });

      if (playerCount >= gameTable.maxPlayers) {
        throw new Error('TABLE_FULL');
      }

      await Reservation.create({
        playerId,
        eventId: event.id,
        gameTableId: tableId,
      }, {
        transaction,
      });

      /*
       * On prépare la notification pendant la transaction,
       * mais l'email ne sera envoyé qu'après le COMMIT.
       */
      const [host, player, game] = await Promise.all([
        Player.findByPk(gameTable.hostPlayerId, { transaction }),
        Player.findByPk(playerId, { transaction }),
        Game.findByPk(gameTable.gameId, { transaction }),
      ]);

      if (host && player && host.id !== player.id) {
        tableNotification = {
          action: 'join',
          tableId,
          tableNumber: gameTable.tableNumber,
          event,
          game,
          host,
          player,
        };
      }

      await TableDiscussionRead.upsert({
        gameTableId: tableId,
        playerId,
        lastReadAt: new Date(),
      }, {
        transaction,
      });
    });

    if (tableNotification) {
      await notifyTableHost(tableNotification);
    }

    return res.redirect(
      `/booking?event=${eventId}&message=table-joined`,
    );
  } catch (error) {
    const knownErrors = [
      'TABLE_UNAVAILABLE',
      'EVENT_NOT_RESERVABLE',
      'PLAYER_ALREADY_REGISTERED',
      'TABLE_FULL',
    ];

    if (knownErrors.includes(error.message)) {
      return redirectWithError(
        res,
        error.message.toLowerCase(),
      );
    }

    return next(error);
  }
}

export async function leaveTable(req, res, next) {
  const tableId = Number(req.params.tableId);
  const playerId = req.currentUser.id;

  let eventId;
  let tableNotification = null;

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

      /*
       * On récupère ces informations avant de modifier la table,
       * afin de pouvoir notifier correctement l'ancien créateur.
       */
      const [event, game, host, player] = await Promise.all([
        Event.findByPk(gameTable.eventId, {
          transaction,
        }),
        Game.findByPk(gameTable.gameId, {
          transaction,
        }),
        Player.findByPk(gameTable.hostPlayerId, {
          transaction,
        }),
        Player.findByPk(playerId, {
          transaction,
        }),
      ]);

      const reservation = await Reservation.findOne({
        where: {
          gameTableId: tableId,
          playerId,
          status: 'confirmed',
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!reservation) {
        throw new Error('RESERVATION_NOT_FOUND');
      }

      const remainingReservations = await Reservation.findAll({
        where: {
          gameTableId: tableId,
          status: 'confirmed',
        },
        order: [['createdAt', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const nextHostReservation = remainingReservations.find(
        (item) => item.playerId !== playerId,
      );

      /*
       * Si le joueur était seul à la table, la table est supprimée.
       * Il n'y a alors plus de créateur à notifier.
       */
      if (!nextHostReservation) {
        await gameTable.destroy({ transaction });
        return;
      }

      await reservation.update({
        status: 'cancelled',
        cancelledAt: new Date(),
      }, {
        transaction,
      });

      await TableDiscussionRead.destroy({
        where: {
          gameTableId: tableId,
          playerId,
        },
        transaction,
      });

      /*
       * Si le créateur quitte la table, le premier joueur restant
       * devient le nouveau créateur.
       *
       * Dans ce cas, on ne notifie PAS l'ancien créateur :
       * il est lui-même la personne qui vient de quitter la table.
       */
      if (gameTable.hostPlayerId === playerId) {
        await gameTable.update({
          hostPlayerId: nextHostReservation.playerId,
        }, {
          transaction,
        });
      } else if (host && player && event) {
        /*
         * Un participant normal quitte la table :
         * le créateur doit être averti.
         */
        tableNotification = {
          action: 'leave',
          tableId,
          tableNumber: gameTable.tableNumber,
          event,
          game,
          host,
          player,
        };
      }
    });

    if (tableNotification) {
      await notifyTableHost(tableNotification);
    }

    return res.redirect(
      `/booking?event=${eventId}&message=table-left`,
    );
  } catch (error) {
    if (
      ['TABLE_NOT_FOUND', 'RESERVATION_NOT_FOUND']
        .includes(error.message)
    ) {
      return redirectWithError(
        res,
        error.message.toLowerCase(),
      );
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
      return res.status(400).send(
        'Événement ou joueur invalide.',
      );
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
        where: {
          eventId,
          playerId,
          status: 'confirmed',
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!reservation) {
        throw new Error('RESERVATION_NOT_FOUND');
      }

      const player = await Player.findByPk(playerId, {
        transaction,
      });

      if (!player) {
        throw new Error('PLAYER_NOT_FOUND');
      }

      playerIdentity = {
        label: player.nickname
          || `${player.firstname} ${player.lastname}`,
        email: player.email,
      };

      const gameTable = await GameTable.findByPk(
        reservation.gameTableId,
        {
          transaction,
          lock: transaction.LOCK.UPDATE,
        },
      );

      if (!gameTable) {
        throw new Error('TABLE_NOT_FOUND');
      }

      const remainingReservations = await Reservation.findAll({
        where: {
          gameTableId: gameTable.id,
          status: 'confirmed',
        },
        order: [['createdAt', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const nextHostReservation = remainingReservations.find(
        (item) => item.playerId !== playerId,
      );

      await EventAttendance.destroy({
        where: {
          eventId,
          playerId,
        },
        transaction,
      });

      await recordAdminAction({
        admin: req.currentUser,
        category: 'game_tables',
        action: 'player_reservation_cancelled',
        targetType: 'member',
        targetId: player.id,
        targetLabel: playerIdentity.label,
        description:
          `Inscription administrative annulée sur la table ${gameTable.tableNumber}.`,
        transaction,
      });

      if (!nextHostReservation) {
        await gameTable.destroy({ transaction });
        return;
      }

      await reservation.update({
        status: 'cancelled',
        cancelledAt: new Date(),
      }, {
        transaction,
      });

      await TableDiscussionRead.destroy({
        where: {
          gameTableId: gameTable.id,
          playerId,
        },
        transaction,
      });

      if (gameTable.hostPlayerId === playerId) {
        await gameTable.update({
          hostPlayerId: nextHostReservation.playerId,
        }, {
          transaction,
        });
      }
    });

    setFlash(
      req,
      'success',
      `L’inscription de ${playerIdentity.label} a été annulée. Pensez à prévenir cette personne à l’adresse ${playerIdentity.email}.`,
    );

    return res.redirect(
      `/admindashboard/events/${eventId}/attendance`,
    );
  } catch (error) {
    if (
      [
        'EVENT_NOT_AVAILABLE',
        'RESERVATION_NOT_FOUND',
        'PLAYER_NOT_FOUND',
        'TABLE_NOT_FOUND',
      ].includes(error.message)
    ) {
      setFlash(
        req,
        'error',
        'Cette inscription ne peut plus être annulée.',
      );

      return res.redirect(
        `/admindashboard/events/${eventId}/attendance`,
      );
    }

    return next(error);
  }
}