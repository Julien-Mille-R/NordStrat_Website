import { Op } from 'sequelize';
import fs from 'node:fs/promises';
import path from 'node:path';
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

const GOACCESS_REPORT_PATH = '/app/data/stats/index.html';

export async function showStatistics(req, res, next) {
  try {
    await fs.access(GOACCESS_REPORT_PATH);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    // Le rapport GoAccess contient son propre HTML/CSS/JS.
    // Il doit pouvoir exécuter ses scripts lorsqu'il est affiché
    // dans l'iframe de la page d'administration.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'self';",
    );
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    return res.sendFile(path.resolve(GOACCESS_REPORT_PATH));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(503).send('Le rapport de statistiques n’est pas encore disponible.');
    }

    return next(error);
  }
}