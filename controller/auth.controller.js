import bcrypt from 'bcrypt';
import { Player, sequelize } from '../models/index.js';
import { reactivateExpiredSuspension, setFlash } from './access.controller.js';
import { regenerateSession, invalidatePlayerSessions } from '../services/session-security.service.js';
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

export function showForgotPassword(req, res) {
  return res.render('layouts/forgot-password');
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

export async function showResetPassword(req, res, next) {
  const token = req.query.token;

  try {
    const resetToken = await findValidPasswordResetToken(token);

    if (!resetToken) {
      setFlash(
        req,
        'error',
        'Ce lien de réinitialisation est invalide ou a expiré.',
      );
      return res.redirect('/forgot-password');
    }

    return res.render('layouts/reset-password', { token });
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(req, res, next) {
  const token = req.body.token;
  const newPassword = req.body.newPassword || '';
  const passwordConfirmation = req.body.passwordConfirmation || '';

  if (
    newPassword.length < 10
    || newPassword.length > 128
    || newPassword !== passwordConfirmation
  ) {
    setFlash(
      req,
      'error',
      'Le mot de passe doit contenir entre 10 et 128 caractères et les deux saisies doivent être identiques.',
    );
    return res.redirect(`/reset-password?token=${encodeURIComponent(token || '')}`);
  }

  let playerId;

  try {
    await sequelize.transaction(async (transaction) => {
      const resetToken = await consumePasswordResetToken(token, transaction);

      if (!resetToken) {
        const error = new Error('Invalid or expired password reset token.');
        error.code = 'PASSWORD_RESET_TOKEN_INVALID';
        throw error;
      }

      playerId = resetToken.playerId;

      const player = await Player.unscoped().findByPk(
        playerId,
        { transaction },
      );

      if (!player || !player.isActive || player.moderationStatus !== 'active') {
        const error = new Error('Password reset account is not active.');
        error.code = 'PASSWORD_RESET_ACCOUNT_INVALID';
        throw error;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await player.update({
        password: hashedPassword,
      }, { transaction });
    });

    await invalidatePlayerSessions(playerId);
  } catch (error) {
    if (
      error.code === 'PASSWORD_RESET_TOKEN_INVALID'
      || error.code === 'PASSWORD_RESET_ACCOUNT_INVALID'
    ) {
      setFlash(
        req,
        'error',
        'Ce lien de réinitialisation est invalide ou a expiré.',
      );
      return res.redirect('/forgot-password');
    }

    return next(error);
  }

  setFlash(
    req,
    'success',
    'Votre mot de passe a été réinitialisé. Vous pouvez maintenant vous connecter.',
  );

  return res.redirect('/?auth=login');
}

export function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('nordstrat.sid');
    return res.redirect('/');
  });
}
