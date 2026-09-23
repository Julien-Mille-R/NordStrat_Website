import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import {
  col,
  fn,
  Op,
  where,
} from 'sequelize';
import {
  createEmailVerificationToken,
} from '../services/email-verification.service.js';
import { sendEmail } from '../services/mail.service.js';
import {
  BookingArchive,
  ContactMessage,
  EventAttendance,
  Game,
  GameTable,
  Player,
  PlayerGame,
  Reservation,
  Role,
  sequelize,
} from '../models/index.js';
import { setFlash } from './access.controller.js';
import {
  destroySession,
  invalidatePlayerSessions,
  regenerateSession,
  renewAuthenticatedSession,
} from '../services/session-security.service.js';
import { DEFAULT_AVATARS } from '../services/default-avatar.service.js';
import { deleteUploadedImage } from '../services/upload-storage.service.js';

function normalizedText(value) {
  return value?.trim();
}

async function removeLocalAvatar(avatarUrl) {
  return deleteUploadedImage(avatarUrl, 'avatars');
}

export async function register(req, res, next) {
  const firstname = normalizedText(req.body.firstname);
  const lastname = normalizedText(req.body.lastname);
  const nickname = normalizedText(req.body.nickname);
  const email = normalizedText(req.body.email)?.toLowerCase();
  const password = req.body.password || '';
  const passwordConfirmation = req.body.passwordConfirmation || '';

  try {
    if (
      !firstname
      || !lastname
      || !nickname
      || !email
      || firstname.length > 100
      || lastname.length > 100
      || nickname.length > 50
    ) {
      setFlash(
        req,
        'error',
        'Le prénom, le nom et le pseudonyme sont obligatoires et doivent respecter les longueurs autorisées.',
      );
      return res.redirect('/?auth=register');
    }

    if (password.length < 10 || password.length > 128) {
      setFlash(
        req,
        'error',
        'Le mot de passe doit contenir entre 10 et 128 caractères.',
      );
      return res.redirect('/?auth=register');
    }

    if (password !== passwordConfirmation) {
      setFlash(req, 'error', 'Les mots de passe ne correspondent pas.');
      return res.redirect('/?auth=register');
    }

    if (req.body.acceptTerms !== 'on') {
      setFlash(
        req,
        'error',
        "Vous devez accepter les conditions générales d'utilisation.",
      );
      return res.redirect('/?auth=register');
    }

    const existingPlayer = await Player.unscoped().findOne({
      where: where(fn('LOWER', col('email')), email),
    });

    if (existingPlayer) {
      setFlash(req, 'error', 'Cette adresse email est déjà utilisée.');
      return res.redirect('/?auth=register');
    }

    const userRole = await Role.findOne({ where: { name: 'User' } });

    if (!userRole) {
      throw new Error('Le rôle User est absent de la base.');
    }

    const player = await Player.create({
      firstname,
      lastname,
      nickname,
      email,
      password: await bcrypt.hash(password, 12),
      roleId: userRole.id,
      canBookTables: false,
      acceptedTermsAt: new Date(),
      acceptedTermsVersion: '2026-07',
    });

    const verificationToken = await createEmailVerificationToken(
      player.id,
      player.email,
    );

    const verificationUrl = `${process.env.SITE_URL}/verify-email?token=${encodeURIComponent(verificationToken)}`;

    await sendEmail({
      to: player.email,
      subject: 'Validez votre adresse e-mail - Nord Stratégie',
      text: [
        'Bonjour,',
        '',
        'Votre compte Nord Stratégie vient d’être créé.',
        '',
        `Pour valider votre adresse e-mail, utilisez ce lien : ${verificationUrl}`,
        '',
        'Ce lien est valable pendant 1 heure et ne peut être utilisé qu’une seule fois.',
        '',
        'Nord Stratégie',
      ].join('\n'),
      html: `
        <p>Bonjour,</p>

        <p>
          Votre compte <strong>Nord Stratégie</strong> vient d’être créé.
        </p>

        <p>
          <a href="${verificationUrl}">
            Valider mon adresse e-mail
          </a>
        </p>

        <p>
          Ce lien est valable pendant 1 heure et ne peut être utilisé
          qu’une seule fois.
        </p>

        <p>Nord Stratégie</p>
      `,
    });

    setFlash(
      req,
      'success',
      'Votre compte a été créé. Un e-mail de validation vient de vous être envoyé.',
    );

    return res.redirect('/?auth=login');
  } catch (error) {
    if (
      error.name === 'SequelizeUniqueConstraintError'
      || error.name === 'SequelizeValidationError'
    ) {
      setFlash(
        req,
        'error',
        'Impossible de créer ce compte. Vérifiez les informations saisies.',
      );
      return res.redirect('/?auth=register');
    }

    return next(error);
  }
}

export async function showAccount(req, res, next) {
  try {
    const player = await Player.findByPk(req.currentUser.id, {
      include: [
        { association: 'role' },
        {
          association: 'reservations',
          required: false,
          where: { status: 'confirmed' },
          include: [{
            association: 'gameTable',
            include: [{ association: 'game' }, { association: 'event' }],
          }],
        },
        {
          association: 'favoriteGames',
          through: { attributes: ['position'] },
        },
      ],
    });

    player.favoriteGames.sort(
      (first, second) => first.PlayerGame.position - second.PlayerGame.position,
    );

    const games = await Game.findAll({
      where: { isAvailable: true },
      order: [['name', 'ASC']],
    });

    return res.render('layouts/account', {
      player,
      games,
      defaultAvatars: DEFAULT_AVATARS,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const firstname = normalizedText(req.body.firstname);
    const lastname = normalizedText(req.body.lastname);
    const nickname = normalizedText(req.body.nickname);

    if (
      !firstname
      || !lastname
      || !nickname
      || firstname.length > 100
      || lastname.length > 100
      || nickname.length > 50
    ) {
      setFlash(
        req,
        'error',
        'Le prénom, le nom et le pseudonyme sont obligatoires et doivent respecter les longueurs autorisées.',
      );
      return res.redirect('/account');
    }

    await req.currentUser.update({
      firstname,
      lastname,
      nickname,
    });

    setFlash(req, 'success', 'Votre profil a été mis à jour.');
    return res.redirect('/account');
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      setFlash(
        req,
        'error',
        'Ce pseudonyme est déjà utilisé par un autre membre.',
      );
      return res.redirect('/account');
    }

    if (error.name === 'SequelizeValidationError') {
      setFlash(
        req,
        'error',
        'Les informations du profil sont invalides.',
      );
      return res.redirect('/account');
    }

    return next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    const currentPassword = req.body.currentPassword || '';
    const newPassword = req.body.newPassword || '';
    const confirmation = req.body.passwordConfirmation || '';
    const player = await Player.scope('withPassword').findByPk(req.currentUser.id);

    if (!await bcrypt.compare(currentPassword, player.password)) {
      setFlash(req, 'error', 'Le mot de passe actuel est incorrect.');
      return res.redirect('/account');
    }

    if (
      newPassword.length < 10
      || newPassword.length > 128
      || newPassword !== confirmation
    ) {
      setFlash(
        req,
        'error',
        'Le nouveau mot de passe est invalide ou sa confirmation ne correspond pas.',
      );
      return res.redirect('/account');
    }

    await player.update({
      password: await bcrypt.hash(newPassword, 12),
    });

    await renewAuthenticatedSession(req, player.id);

    setFlash(req, 'success', 'Votre mot de passe a été modifié.');
    return res.redirect('/account');
  } catch (error) {
    return next(error);
  }
}

export async function changeEmail(req, res, next) {
  const email = normalizedText(req.body.email)?.toLowerCase();
  const emailConfirmation = normalizedText(req.body.emailConfirmation)?.toLowerCase();
  const password = req.body.password || '';

  try {
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');

    if (!emailIsValid || email !== emailConfirmation) {
      setFlash(
        req,
        'error',
        'La nouvelle adresse e-mail est invalide ou sa confirmation ne correspond pas.',
      );
      return res.redirect('/account');
    }

    const player = await Player.scope('withPassword').findByPk(req.currentUser.id);

    if (!player || player.moderationStatus === 'deleted' || !player.isActive) {
      return res.redirect('/');
    }

    if (!await bcrypt.compare(password, player.password)) {
      setFlash(req, 'error', 'Le mot de passe est incorrect.');
      return res.redirect('/account');
    }

    if (email === player.email.toLowerCase()) {
      setFlash(
        req,
        'error',
        'Cette adresse e-mail est déjà associée à votre compte.',
      );
      return res.redirect('/account');
    }

    if (player.pendingEmail?.toLowerCase() === email) {
      setFlash(
        req,
        'error',
        'Cette adresse e-mail est déjà en attente de validation.',
      );
      return res.redirect('/account');
    }

    const existingPlayer = await Player.unscoped().findOne({
      where: where(fn('LOWER', col('email')), email),
    });

    if (existingPlayer && existingPlayer.id !== player.id) {
      setFlash(req, 'error', 'Cette adresse e-mail est déjà utilisée.');
      return res.redirect('/account');
    }

    const verificationToken = await createEmailVerificationToken(
      player.id,
      email,
    );

    await player.update({
      pendingEmail: email,
    });

    const verificationUrl =
      `${process.env.SITE_URL}/verify-email?token=${encodeURIComponent(verificationToken)}`;

    await sendEmail({
      to: email,
      subject: 'Validez votre nouvelle adresse e-mail - Nord Stratégie',
      text: [
        'Bonjour,',
        '',
        'Vous avez demandé à modifier l’adresse e-mail de votre compte Nord Stratégie.',
        '',
        `Pour confirmer cette nouvelle adresse, utilisez ce lien : ${verificationUrl}`,
        '',
        'Ce lien est valable pendant 1 heure et ne peut être utilisé qu’une seule fois.',
        '',
        'Votre adresse e-mail actuelle reste inchangée tant que cette nouvelle adresse n’est pas validée.',
        '',
        'Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet e-mail.',
        '',
        'Nord Stratégie',
      ].join('\n'),
      html: `
        <p>Bonjour,</p>

        <p>
          Vous avez demandé à modifier l’adresse e-mail de votre compte
          <strong>Nord Stratégie</strong>.
        </p>

        <p>
          <a href="${verificationUrl}">
            Valider ma nouvelle adresse e-mail
          </a>
        </p>

        <p>
          Ce lien est valable pendant 1 heure et ne peut être utilisé
          qu’une seule fois.
        </p>

        <p>
          Votre adresse e-mail actuelle reste inchangée tant que cette
          nouvelle adresse n’est pas validée.
        </p>

        <p>
          Si vous n’êtes pas à l’origine de cette demande,
          vous pouvez ignorer cet e-mail.
        </p>

        <p>Nord Stratégie</p>
      `,
    });

    setFlash(
      req,
      'success',
      'Votre nouvelle adresse e-mail est enregistrée. Un e-mail de validation vient de vous être envoyé.',
    );

    return res.redirect('/account');
  } catch (error) {
    if (
      error.name === 'SequelizeUniqueConstraintError'
      || error.name === 'SequelizeValidationError'
    ) {
      setFlash(req, 'error', 'Impossible de modifier cette adresse e-mail.');
      return res.redirect('/account');
    }

    return next(error);
  }
}

export async function deleteAccount(req, res, next) {
  const password = req.body.password || '';
  const confirmation = req.body.confirmation?.trim();
  const playerId = req.currentUser.id;
  const avatarUrl = req.currentUser.avatarUrl;
  const changedArchives = [];

  try {
    if (confirmation !== 'SUPPRIMER') {
      setFlash(
        req,
        'error',
        'Saisissez SUPPRIMER pour confirmer l’anonymisation de votre compte.',
      );
      return res.redirect('/account');
    }

    const playerWithPassword = await Player.scope('withPassword').findByPk(playerId);

    if (!await bcrypt.compare(password, playerWithPassword.password)) {
      setFlash(req, 'error', 'Le mot de passe est incorrect.');
      return res.redirect('/account');
    }

    if (req.currentUser.role.name === 'Admin') {
      const activeAdminCount = await Player.count({
        where: {
          roleId: req.currentUser.roleId,
          isActive: true,
        },
      });

      if (activeAdminCount <= 1) {
        setFlash(
          req,
          'error',
          'Vous êtes le dernier administrateur actif. Attribuez d’abord ce rôle à un autre compte.',
        );
        return res.redirect('/account');
      }
    }

    const deletedEmail =
      `deleted-${playerId}-${crypto.randomUUID()}@anonymized.invalid`;

    const deletedPassword =
      await bcrypt.hash(crypto.randomBytes(48).toString('hex'), 12);

    const anonymizedAt = new Date();

    await sequelize.transaction(async (transaction) => {
      const player = await Player.scope('withPassword').findByPk(playerId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!player || player.moderationStatus === 'deleted') {
        throw new Error('ACCOUNT_NOT_AVAILABLE');
      }

      const hostedTables = await GameTable.findAll({
        where: { hostPlayerId: playerId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      for (const gameTable of hostedTables) {
        const nextReservation = await Reservation.findOne({
          where: {
            gameTableId: gameTable.id,
            playerId: { [Op.ne]: playerId },
            status: 'confirmed',
          },
          order: [['createdAt', 'ASC']],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (nextReservation) {
          await gameTable.update(
            { hostPlayerId: nextReservation.playerId },
            { transaction },
          );
        } else {
          await gameTable.destroy({ transaction });
        }
      }

      await Reservation.destroy({
        where: { playerId },
        transaction,
      });

      await EventAttendance.destroy({
        where: { playerId },
        transaction,
      });

      await PlayerGame.destroy({
        where: { playerId },
        transaction,
      });

      await ContactMessage.destroy({
        where: { playerId },
        transaction,
      });

      const archives = await BookingArchive.findAll({ transaction });

      for (const archive of archives) {
        const snapshot = structuredClone(archive.snapshot);
        let changed = false;

        for (const table of snapshot.tables || []) {
          for (const participant of table.participants || []) {
            if (participant.playerId === playerId) {
              participant.playerId = null;
              participant.nickname = 'Utilisateur supprimé';
              changed = true;
            }
          }
        }

        if (changed) {
          await archive.update({ snapshot }, { transaction });
          changedArchives.push(archive);
        }
      }

      await player.update({
        firstname: 'Utilisateur',
        lastname: 'supprimé',
        nickname: 'Utilisateur supprimé',
        email: deletedEmail,
        password: deletedPassword,
        pendingEmail: null,
        emailVerifiedAt: null,
        avatarUrl: null,
        biography: null,
        isProfilePublic: false,
        isActive: false,
        moderationStatus: 'deleted',
        suspendedUntil: null,
        moderationReason: null,
        moderatedAt: null,
        moderatedBy: null,
        membershipExpiresAt: null,
        acceptedTermsAt: null,
        acceptedTermsVersion: null,
        anonymizedAt,
      }, { transaction });
    });

    await Promise.all(
      changedArchives.map((archive) => archive.exportToFile()),
    );

    await destroySession(req);
    await invalidatePlayerSessions(playerId);
    await removeLocalAvatar(avatarUrl);

    res.clearCookie('nordstrat.sid');

    return res.redirect('/');
  } catch (error) {
    if (error.message === 'ACCOUNT_NOT_AVAILABLE') {
      return res.redirect('/');
    }

    return next(error);
  }
}