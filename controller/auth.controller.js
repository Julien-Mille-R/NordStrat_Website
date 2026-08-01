import bcrypt from 'bcrypt';
import { Player } from '../models/index.js';
import { reactivateExpiredSuspension, setFlash } from './access.controller.js';
import { regenerateSession } from '../services/session-security.service.js';

export async function login(req, res, next) {
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password || '';

  try {
    if (!email || !password) {
      setFlash(req, 'error', 'Adresse email ou mot de passe incorrect.');
      return res.redirect('/?auth=login');
    }
    const player = await Player.scope('withPassword').findOne({
      where: { email },
      include: [{ association: 'role' }],
    });
    await reactivateExpiredSuspension(player);
    const passwordMatches = player ? await bcrypt.compare(password, player.password) : false;

    if (!player || !player.isActive || !passwordMatches) {
      setFlash(req, 'error', 'Adresse email ou mot de passe incorrect.');
      return res.redirect('/?auth=login');
    }

    const rememberMe = req.body.rememberMe === 'on';
    await regenerateSession(req);
    req.session.userId = player.id;
    req.session.cookie.maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
    setFlash(req, 'success', `Bienvenue ${player.nickname || player.firstname}.`);
    return res.redirect('/');
  } catch (error) {
    return next(error);
  }
}

export function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('nordstrat.sid');
    return res.redirect('/');
  });
}
