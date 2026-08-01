import { Op } from 'sequelize';
import {
  BookingArchive,
  AuditLog,
  ContactMessage,
  Event,
  Game,
  Membership,
  NewsPost,
  Player,
  PublicEventApplication,
} from '../models/index.js';
import { currentMembershipSeason } from './membership.controller.js';

export async function showDashboard(req, res, next) {
  try {
    const currentSeason = currentMembershipSeason();
    const [
      nextEvent,
      activeMemberCount,
      membershipUpToDateCount,
      unreadMessageCount,
      availableGameCount,
      archiveCount,
      newsPostCount,
      auditLogCount,
      newPublicEventApplicationCount,
    ] = await Promise.all([
      Event.findOne({
        where: {
          date: { [Op.gte]: new Date() },
          status: { [Op.in]: ['upcoming', 'ongoing'] },
          reservable: true,
        },
        order: [['date', 'ASC']],
      }),
      Player.count({ where: { isActive: true } }),
      Membership.count({
        where: {
          seasonStart: currentSeason.start,
          status: { [Op.in]: ['paid', 'exempted'] },
        },
      }),
      ContactMessage.count({ where: { status: 'unread' } }),
      Game.count({ where: { isAvailable: true } }),
      BookingArchive.count(),
      NewsPost.count(),
      AuditLog.count(),
      PublicEventApplication.count({ where: { status: 'new' } }),
    ]);

    return res.render('layouts/admin/adminDashboard', {
      dashboardStats: {
        nextEvent,
        activeMemberCount,
        membershipUpToDateCount,
        membershipMissingCount: Math.max(activeMemberCount - membershipUpToDateCount, 0),
        membershipSeason: currentSeason.label,
        unreadMessageCount,
        availableGameCount,
        archiveCount,
        newsPostCount,
        auditLogCount,
        newPublicEventApplicationCount,
      },
    });
  } catch (error) {
    return next(error);
  }
}
