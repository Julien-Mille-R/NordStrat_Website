import { Op } from 'sequelize';
import {
  Event,
  Game,
  Membership,
} from '../models/index.js';
import { currentMembershipSeason } from './membership.controller.js';
import { attachGameImageUrl } from '../services/game-image.service.js';

export async function showBookingPage(req, res, next) {
  try {
    const event = await Event.findOne({
      where: {
        status: { [Op.in]: ['upcoming', 'ongoing', 'cancelled'] },
        date: { [Op.gte]: new Date() },
      },
      include: [{
        association: 'gameTables',
        required: false,
        where: { status: { [Op.ne]: 'cancelled' } },
        include: [
          { association: 'game' },
          { association: 'host' },
          {
            association: 'reservations',
            required: false,
            where: { status: 'confirmed' },
            include: [{ association: 'player' }],
          },
          {
            association: 'comments',
            required: false,
            include: [{
              association: 'author',
              attributes: ['id', 'nickname', 'firstname', 'avatarUrl'],
            }],
          },
          ...(req.currentUser ? [{
            association: 'discussionReads',
            required: false,
            where: { playerId: req.currentUser.id },
            attributes: ['gameTableId', 'playerId', 'lastReadAt'],
          }] : []),
        ],
      }, {
        association: 'tableClosures',
        required: false,
      }],
      order: [['date', 'ASC']],
    });

    const games = await Game.findAll({
      where: { isAvailable: true },
      order: [['name', 'ASC']],
    });

    const gameTables = event?.gameTables || [];
    games.forEach(attachGameImageUrl);
    gameTables.forEach((gameTable) => attachGameImageUrl(gameTable.game));
    const tableByNumber = new Map(gameTables.map((gameTable) => [gameTable.tableNumber, gameTable]));
    const closedTableNumbers = new Set((event?.tableClosures || []).map((closure) => closure.tableNumber));
    const tableSlots = Array.from({ length: 8 }, (_, index) => {
      const number = index + 1;
      const gameTable = tableByNumber.get(number) || null;
      const isClosed = closedTableNumbers.has(number) || gameTable?.status === 'closed';
      return {
        number,
        gameTable,
        isClosed,
        enabled: Boolean(
          event
          && event.status !== 'cancelled'
          && event.reservable
          && number <= event.maxTable
          && !isClosed,
        ),
      };
    });

    const currentUser = req.currentUser || null;
    const currentReservation = currentUser
      ? gameTables
        .flatMap((gameTable) => gameTable.reservations || [])
        .find((reservation) => reservation.playerId === currentUser.id) || null
      : null;
    const currentMembership = currentUser
      ? await Membership.findOne({
        where: {
          playerId: currentUser.id,
          seasonStart: currentMembershipSeason().start,
        },
      })
      : null;
    const hasMembershipPriority = ['paid', 'exempted'].includes(currentMembership?.status);
    const discussionByTableId = new Map(gameTables.map((gameTable) => {
      const comments = [...(gameTable.comments || [])]
        .sort((first, second) => first.createdAt - second.createdAt);
      const lastReadAt = gameTable.discussionReads?.[0]?.lastReadAt || null;
      const unreadCount = currentUser
        ? comments.filter((comment) => (
          comment.playerId !== currentUser.id
          && (!lastReadAt || comment.createdAt > lastReadAt)
        )).length
        : 0;
      return [gameTable.id, {
        comments,
        totalCount: comments.length,
        unreadCount,
        canPost: Boolean(currentUser),
      }];
    }));
    const requestedDiscussionId = Number(req.query.discussion);
    const openDiscussionId = Number.isInteger(requestedDiscussionId)
      && discussionByTableId.has(requestedDiscussionId)
      && currentUser
      ? requestedDiscussionId
      : null;

    return res.render('layouts/booking', {
      event,
      games,
      tableSlots,
      currentUser,
      currentReservation,
      hasMembershipPriority,
      discussionByTableId,
      openDiscussionId,
      message: req.query.message || null,
      error: req.query.error || null,
    });
  } catch (error) {
    return next(error);
  }
}
