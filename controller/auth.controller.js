import bcrypt from 'bcrypt';
import { Player } from '../models/index.js';
import { reactivateExpiredSuspension, setFlash } from './access.controller.js';
import { regenerateSession } from '../services/session-security.service.js';
import { createPasswordResetToken } from '../services/password-reset.service.js';
import { sendEmail } from '../services/mail.service.js';

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

export async function requestPasswordReset(req, res, next) {
  const email = req.body.email?.trim().toLowerCase();

  try {
    if (email) {
      const player = await Player.unscoped().findOne({
        where: {
          email,
          isActive: true,
          moderationStatus: 'active',
        },
      });

      if (player) {
        const token = await createPasswordResetToken(player.id);
        const resetUrl = `${process.env.SITE_URL}/reset-password?token=${encodeURIComponent(token)}`;

        await sendEmail({
          to: player.email,
          subject: 'Réinitialisation de votre mot de passe - Nord Stratégie',
          text: [
            'Bonjour,',
            '',
            'Une demande de réinitialisation du mot de passe de votre compte Nord Stratégie a été effectuée.',
            '',
            `Pour choisir un nouveau mot de passe, utilisez ce lien : ${resetUrl}`,
            '',
            'Ce lien est valable pendant 1 heure et ne peut être utilisé qu’une seule fois.',
            '',
            'Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet e-mail.',
            '',
            'Nord Stratégie',
          ].join('\n'),
          html: `
            <p>Bonjour,</p>

            <p>
              Une demande de réinitialisation du mot de passe de votre compte
              <strong>Nord Stratégie</strong> a été effectuée.
            </p>

            <p>
              <a href="${resetUrl}">
                Réinitialiser mon mot de passe
              </a>
            </p>

            <p>
              Ce lien est valable pendant 1 heure et ne peut être utilisé
              qu’une seule fois.
            </p>

            <p>
              Si vous n’êtes pas à l’origine de cette demande,
              vous pouvez ignorer cet e-mail.
            </p>

            <p>Nord Stratégie</p>
          `,
        });
      }
    }

    // Réponse volontairement identique que l'adresse existe ou non.
    setFlash(
      req,
      'success',
      'Si cette adresse correspond à un compte actif, un e-mail de réinitialisation vous a été envoyé.',
    );

    return res.redirect('/?auth=login');
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
