import { Op } from 'sequelize';
import { ContactMessage } from '../models/index.js';
import { setFlash } from './access.controller.js';

export async function showMessageList(req, res, next) {
  try {
    const selectedView = req.query.view === 'archived' ? 'archived' : 'inbox';
    const statusFilter = selectedView === 'archived'
      ? 'archived'
      : { [Op.in]: ['unread', 'read'] };
    const [messages, unreadCount, archivedCount] = await Promise.all([
      ContactMessage.findAll({
        where: { status: statusFilter },
        include: [
          { association: 'player', required: false },
          { association: 'reader', required: false },
        ],
        order: [
          ['status', 'DESC'],
          ['createdAt', 'DESC'],
        ],
      }),
      ContactMessage.count({ where: { status: 'unread' } }),
      ContactMessage.count({ where: { status: 'archived' } }),
    ]);
    return res.render('layouts/admin/message-list', {
      messages,
      unreadCount,
      archivedCount,
      selectedView,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateMessageStatus(req, res, next) {
  const action = req.body.action;

  try {
    const contactMessage = await ContactMessage.findByPk(Number(req.params.messageId));
    if (!contactMessage) return res.status(404).send('Message introuvable.');

    if (action === 'unread') {
      await contactMessage.update({ status: 'unread', readAt: null, readBy: null });
    } else if (action === 'read') {
      await contactMessage.update({
        status: 'read',
        readAt: contactMessage.readAt || new Date(),
        readBy: contactMessage.readBy || req.currentUser.id,
      });
    } else if (action === 'archive') {
      await contactMessage.update({
        status: 'archived',
        readAt: contactMessage.readAt || new Date(),
        readBy: contactMessage.readBy || req.currentUser.id,
      });
    } else {
      return res.status(400).send('Action invalide.');
    }

    setFlash(req, 'success', 'L’état du message a été mis à jour.');
    const selectedView = req.body.returnView === 'archived' ? 'archived' : 'inbox';
    return res.redirect(`/admindashboard/inbox?view=${selectedView}`);
  } catch (error) {
    return next(error);
  }
}
