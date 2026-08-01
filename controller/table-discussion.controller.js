import {
  Event,
  GameTable,
  Player,
  TableComment,
  TableDiscussionRead,
  sequelize,
} from '../models/index.js';
import { Op } from 'sequelize';
import { setFlash } from './access.controller.js';
import { recordAdminAction } from '../services/audit-log.service.js';

const BOOKING_PATH = '/booking';

function discussionPath(tableId, suffix = '') {
  return `${BOOKING_PATH}?discussion=${tableId}${suffix}#table-${tableId}`;
}

export async function openTableDiscussion(req, res, next) {
  const tableId = Number(req.params.tableId);

  try {
    if (!Number.isInteger(tableId)) return res.status(400).send('Table invalide.');
    const gameTable = await GameTable.findOne({
      where: { id: tableId, status: { [Op.ne]: 'cancelled' } },
      include: [{
        association: 'event',
        required: true,
        where: {
          status: { [Op.in]: ['upcoming', 'ongoing'] },
          date: { [Op.gte]: new Date() },
        },
        attributes: ['id'],
      }],
    });
    if (!gameTable) {
      setFlash(req, 'error', 'Cette discussion n’existe plus.');
      return res.redirect(BOOKING_PATH);
    }

    const newestComment = await TableComment.findOne({
      where: { gameTableId: tableId },
      order: [['createdAt', 'DESC']],
    });
    await TableDiscussionRead.upsert({
      gameTableId: tableId,
      playerId: req.currentUser.id,
      lastReadAt: newestComment?.createdAt || new Date(),
    });

    return res.redirect(discussionPath(tableId));
  } catch (error) {
    return next(error);
  }
}

export async function createTableComment(req, res, next) {
  const tableId = Number(req.params.tableId);
  const content = String(req.body.content || '').trim();

  try {
    if (!Number.isInteger(tableId) || content.length < 1 || content.length > 500) {
      setFlash(req, 'error', 'Le message doit contenir entre 1 et 500 caractères.');
      return res.redirect(Number.isInteger(tableId) ? discussionPath(tableId) : BOOKING_PATH);
    }

    await sequelize.transaction(async (transaction) => {
      const gameTable = await GameTable.findByPk(tableId, {
        transaction,
        lock: transaction.LOCK.SHARE,
      });
      if (!gameTable || gameTable.status === 'cancelled') throw new Error('TABLE_NOT_FOUND');
      const event = await Event.findOne({
        where: {
          id: gameTable.eventId,
          status: { [Op.in]: ['upcoming', 'ongoing'] },
          date: { [Op.gte]: new Date() },
        },
        transaction,
      });
      if (!event) throw new Error('TABLE_NOT_FOUND');

      const comment = await TableComment.create({
        gameTableId: tableId,
        playerId: req.currentUser.id,
        content,
      }, { transaction });
      await TableDiscussionRead.upsert({
        gameTableId: tableId,
        playerId: req.currentUser.id,
        lastReadAt: comment.createdAt,
      }, { transaction });
    });

    setFlash(req, 'success', 'Votre message a été publié.');
    return res.redirect(discussionPath(tableId));
  } catch (error) {
    if (error.message === 'TABLE_NOT_FOUND') {
      setFlash(req, 'error', 'Cette table n’existe plus.');
      return res.redirect(BOOKING_PATH);
    }
    if (error.name === 'SequelizeValidationError') {
      setFlash(req, 'error', 'Le message doit contenir entre 1 et 500 caractères.');
      return res.redirect(discussionPath(tableId));
    }
    return next(error);
  }
}

export async function deleteTableComment(req, res, next) {
  const tableId = Number(req.params.tableId);
  const commentId = Number(req.params.commentId);
  const reason = req.body.reason?.trim();

  try {
    if (!Number.isInteger(tableId) || !Number.isInteger(commentId)) {
      return res.status(400).send('Message invalide.');
    }
    if (!reason || reason.length < 5 || reason.length > 500) {
      setFlash(req, 'error', 'Le motif de modération doit contenir entre 5 et 500 caractères.');
      return res.redirect(discussionPath(tableId));
    }

    await sequelize.transaction(async (transaction) => {
      const gameTable = await GameTable.findByPk(tableId, { transaction });
      if (!gameTable) throw new Error('COMMENT_NOT_FOUND');
      const comment = await TableComment.findOne({
        where: { id: commentId, gameTableId: tableId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!comment) throw new Error('COMMENT_NOT_FOUND');
      const author = await Player.findByPk(comment.playerId, {
        attributes: ['id', 'nickname', 'firstname', 'lastname'],
        transaction,
      });
      const authorLabel = author?.nickname || `${author?.firstname || ''} ${author?.lastname || ''}`.trim() || `Membre #${comment.playerId}`;
      const excerpt = comment.content.length > 200
        ? `${comment.content.slice(0, 197).trimEnd()}...`
        : comment.content;
      await recordAdminAction({
        admin: req.currentUser,
        category: 'game_tables',
        action: 'table_comment_deleted',
        targetType: 'game_table',
        targetId: tableId,
        targetLabel: `Table ${gameTable.tableNumber}`,
        description: `Message #${comment.id} de ${authorLabel} supprimé. Motif : ${reason}. Message concerné : « ${excerpt} »`,
        transaction,
      });
      await comment.destroy({ transaction });
    });

    setFlash(req, 'success', 'Le message a été supprimé.');
    return res.redirect(discussionPath(tableId));
  } catch (error) {
    if (error.message === 'COMMENT_NOT_FOUND') {
      setFlash(req, 'error', 'Ce message n’existe plus.');
      return res.redirect(discussionPath(tableId));
    }
    return next(error);
  }
}
