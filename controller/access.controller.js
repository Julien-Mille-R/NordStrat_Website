import crypto from 'node:crypto';
import { Player } from '../models/index.js';

export function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

export async function reactivateExpiredSuspension(player) {
  if (player?.moderationStatus === 'temporarily_suspended'
    && player.suspendedUntil
    && player.suspendedUntil <= new Date()) {
    await player.update({
      isActive: true,
      moderationStatus: 'active',
      suspendedUntil: null,
      moderationReason: null,
      moderatedAt: null,
      moderatedBy: null,
    });
  }
  return player;
}

export async function loadCurrentUser(req, res, next) {
  try {
    res.locals.currentPath = req.path;
    res.locals.currentUser = null;
    res.locals.flash = req.session.flash || null;
    delete req.session.flash;

    if (!req.session.userId) return next();

    const player = await Player.findByPk(req.session.userId, {
      include: [{ association: 'role' }],
    });

    await reactivateExpiredSuspension(player);
    if (!player || !player.isActive) {
      delete req.session.userId;
      return next();
    }

    req.currentUser = player;
    res.locals.currentUser = player;
    return next();
  } catch (error) {
    return next(error);
  }
}

export function provideCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  return next();
}

function csrfTokenIsValid(req) {
  const expected = req.session.csrfToken;
  const received = req.body?._csrf;
  if (!expected || !received) return false;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function rejectInvalidCsrfToken(req, res, next) {
  if (!csrfTokenIsValid(req)) {
    return res.status(403).send('Jeton de sécurité invalide. Rechargez la page.');
  }
  return next();
}

export function rejectCrossSiteUnsafeRequest(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite === 'cross-site') {
    return res.status(403).send('Origine de la requête interdite.');
  }

  const origin = req.get('origin');
  if (origin) {
    const expectedOrigin = `${req.protocol}://${req.get('host')}`;
    if (origin !== expectedOrigin) {
      return res.status(403).send('Origine de la requête interdite.');
    }
  }

  return next();
}

export function validateCsrfToken(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (isMultipartCsrfRoute(req.path) && req.is('multipart/form-data')) return next();

  return rejectInvalidCsrfToken(req, res, next);
}

const MULTIPART_CSRF_ROUTE_PATTERNS = [
  /^\/account\/avatar$/,
  /^\/admindashboard\/assaut-de-bruay\/save$/,
  /^\/admindashboard\/games\/create$/,
  /^\/admindashboard\/games\/\d+\/update$/,
  /^\/admindashboard\/news\/create$/,
  /^\/admindashboard\/news\/\d+\/update$/,
];

export function isMultipartCsrfRoute(pathname) {
  return MULTIPART_CSRF_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function validateMultipartCsrfToken(req, res, next) {
  return rejectInvalidCsrfToken(req, res, next);
}

export function requireUser(req, res, next) {
  if (!req.currentUser) {
    setFlash(req, 'error', 'Vous devez être connecté pour effectuer cette action.');
    return res.redirect('/?auth=login');
  }
  return next();
}

export function requireGuest(req, res, next) {
  if (req.currentUser) return res.redirect('/account');
  return next();
}

export function requireAdmin(req, res, next) {
  if (!req.currentUser) {
    setFlash(req, 'error', 'Vous devez être connecté.');
    return res.redirect('/?auth=login');
  }
  if (req.currentUser.role.name !== 'Admin') return res.status(403).send('Accès interdit.');
  return next();
}
