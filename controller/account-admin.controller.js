import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { Op } from 'sequelize';
import {
  Player,
  Role,
  sequelize,
} from '../models/index.js';
import { reactivateExpiredSuspension, setFlash } from './access.controller.js';
import { recordAdminAction, targetDisplayName } from '../services/audit-log.service.js';
import { invalidatePlayerSessions } from '../services/session-security.service.js';
import { deleteUploadedImage } from '../services/upload-storage.service.js';


function memberRedirect() {
  return '/admindashboard/members';
}

export async function showMemberList(req, res, next) {
  try {
    const players = await Player.findAll({
      where: {
        moderationStatus: {
          [Op.ne]: 'deleted',
        },
      },
      include: [
        { association: 'role' },
        { association: 'moderator', required: false },
        {
          association: 'favoriteGames',
          through: { attributes: ['position'] },
        },
        {
          association: 'reservations',
          required: false,
          where: { status: 'confirmed' },
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    await Promise.all(players.map(reactivateExpiredSuspension));
    players.forEach((player) => {
      player.favoriteGames.sort((first, second) => first.PlayerGame.position - second.PlayerGame.position);
    });
    const roles = await Role.findAll({ order: [['name', 'ASC']] });
    return res.render('layouts/admin/member-list', { players, roles });
  } catch (error) {
    return next(error);
  }
}

export async function updateAccountRole(req, res, next) {
  try {
    const player = await Player.findByPk(Number(req.params.playerId), {
      include: [{ association: 'role' }],
    });
    const role = await Role.findOne({ where: { name: req.body.role } });
    if (!player || !role) return res.status(404).send('Compte ou rôle introuvable.');
    if (player.moderationStatus === 'deleted') {
      setFlash(req, 'error', 'Un compte anonymisé ne peut plus être modifié.');
      return res.redirect(memberRedirect());
    }
    if (player.id === req.currentUser.id && role.name !== 'Admin') {
      setFlash(req, 'error', 'Vous ne pouvez pas retirer votre propre rôle administrateur.');
      return res.redirect(memberRedirect());
    }
    const previousRole = player.role.name;
    await sequelize.transaction(async (transaction) => {
      await player.update({ roleId: role.id }, { transaction });
      await recordAdminAction({
        admin: req.currentUser,
        category: 'members',
        action: 'role_updated',
        targetType: 'member',
        targetId: player.id,
        targetLabel: targetDisplayName(player),
        description: `Rôle modifié de « ${previousRole} » vers « ${role.name} ».`,
        transaction,
      });
    });
    await invalidatePlayerSessions(
      player.id,
      player.id === req.currentUser.id ? req.sessionID : null,
    );
    setFlash(req, 'success', 'Le rôle du compte a été mis à jour.');
    return res.redirect(memberRedirect());
  } catch (error) {
    return next(error);
  }
}

export async function updateMemberModeration(req, res, next) {
  const playerId = Number(req.params.playerId);
  const action = req.body.action;
  const reason = req.body.reason?.trim();

  try {
    const player = await Player.findByPk(playerId);
    if (!player) return res.status(404).send('Compte introuvable.');
    if (player.moderationStatus === 'deleted') {
      setFlash(req, 'error', 'Un compte anonymisé ne peut pas être réactivé.');
      return res.redirect('/admindashboard/members');
    }
    if (player.id === req.currentUser.id && action !== 'reactivate') {
      setFlash(req, 'error', 'Vous ne pouvez pas suspendre votre propre compte.');
      return res.redirect('/admindashboard/members');
    }

    if (action === 'reactivate') {
      await sequelize.transaction(async (transaction) => {
        await player.update({
          isActive: true,
          moderationStatus: 'active',
          suspendedUntil: null,
          moderationReason: null,
          moderatedAt: null,
          moderatedBy: null,
        }, { transaction });
        await recordAdminAction({
          admin: req.currentUser,
          category: 'members',
          action: 'member_reactivated',
          targetType: 'member',
          targetId: player.id,
          targetLabel: targetDisplayName(player),
          description: 'Compte réactivé.',
          transaction,
        });
      });
      setFlash(req, 'success', 'Le compte a été réactivé.');
      return res.redirect('/admindashboard/members');
    }

    if (!reason || reason.length < 5 || reason.length > 500) {
      setFlash(req, 'error', 'Le motif doit contenir entre 5 et 500 caractères.');
      return res.redirect('/admindashboard/members');
    }

    if (action === 'temporary_suspend') {
      const durationDays = Number(req.body.durationDays);
      if (![7, 30, 90].includes(durationDays)) {
        setFlash(req, 'error', 'La durée de suspension est invalide.');
        return res.redirect('/admindashboard/members');
      }
      const suspendedUntil = new Date();
      suspendedUntil.setDate(suspendedUntil.getDate() + durationDays);
      await sequelize.transaction(async (transaction) => {
        await player.update({
          isActive: false,
          moderationStatus: 'temporarily_suspended',
          suspendedUntil,
          moderationReason: reason,
          moderatedAt: new Date(),
          moderatedBy: req.currentUser.id,
        }, { transaction });
        await recordAdminAction({
          admin: req.currentUser,
          category: 'members',
          action: 'member_suspended_temporarily',
          targetType: 'member',
          targetId: player.id,
          targetLabel: targetDisplayName(player),
          description: `Compte suspendu temporairement pendant ${durationDays} jours. Motif : ${reason}`,
          transaction,
        });
      });
      await invalidatePlayerSessions(player.id);
      setFlash(req, 'success', `Le compte est suspendu pendant ${durationDays} jours.`);
      return res.redirect('/admindashboard/members');
    }

    if (action === 'permanent_suspend') {
      await sequelize.transaction(async (transaction) => {
        await player.update({
          isActive: false,
          moderationStatus: 'permanently_suspended',
          suspendedUntil: null,
          moderationReason: reason,
          moderatedAt: new Date(),
          moderatedBy: req.currentUser.id,
        }, { transaction });
        await recordAdminAction({
          admin: req.currentUser,
          category: 'members',
          action: 'member_suspended_permanently',
          targetType: 'member',
          targetId: player.id,
          targetLabel: targetDisplayName(player),
          description: `Compte suspendu définitivement. Motif : ${reason}`,
          transaction,
        });
      });
      await invalidatePlayerSessions(player.id);
      setFlash(req, 'success', 'Le compte est suspendu définitivement.');
      return res.redirect('/admindashboard/members');
    }

    

    return res.status(400).send('Action de modération invalide.');
  } catch (error) {
    return next(error);
  }
}

export async function deleteMemberAccount(req, res, next) {
  const playerId = Number(req.params.playerId);

  try {
    if (!Number.isInteger(playerId)) {
      return res.status(400).send('Compte invalide.');
    }

    if (playerId === req.currentUser.id) {
      setFlash(req, 'error', 'Vous ne pouvez pas anonymiser votre propre compte administrateur.');
      return res.redirect(memberRedirect());
    }

    const player = await Player.findByPk(playerId);

    if (!player) {
      return res.status(404).send('Compte introuvable.');
    }

    if (player.moderationStatus === 'deleted') {
      setFlash(req, 'error', 'Ce compte est déjà anonymisé.');
      return res.redirect(memberRedirect());
    }

    const targetLabel = targetDisplayName(player);
    const avatarUrl = player.avatarUrl;
    const deletedEmail = `deleted-${player.id}-${crypto.randomUUID()}@anonymized.invalid`;
    const deletedPassword = await bcrypt.hash(
      crypto.randomBytes(48).toString('hex'),
      12,
    );
    const anonymizedAt = new Date();

    await sequelize.transaction(async (transaction) => {
      const lockedPlayer = await Player.findByPk(playerId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!lockedPlayer || lockedPlayer.moderationStatus === 'deleted') {
        throw new Error('ACCOUNT_NOT_AVAILABLE');
      }

      await lockedPlayer.update({
        firstname: 'Utilisateur',
        lastname: 'supprimé',
        nickname: 'Utilisateur supprimé',
        email: deletedEmail,
        password: deletedPassword,
        avatarUrl: null,
        biography: null,
        isProfilePublic: false,
        isActive: false,
        moderationStatus: 'deleted',
        suspendedUntil: null,
        moderationReason: null,
        moderatedAt: new Date(),
        moderatedBy: req.currentUser.id,
        membershipExpiresAt: null,
        acceptedTermsAt: null,
        acceptedTermsVersion: null,
        anonymizedAt,
      }, { transaction });

      await recordAdminAction({
        admin: req.currentUser,
        category: 'members',
        action: 'member_deleted',
        targetType: 'member',
        targetId: lockedPlayer.id,
        targetLabel,
        description: `Compte anonymisé par un administrateur. Identité initiale : ${targetLabel}.`,
        transaction,
      });
    });

    await invalidatePlayerSessions(playerId);

    if (avatarUrl) {
      await deleteUploadedImage(avatarUrl, 'avatars');
    }

    setFlash(req, 'success', 'Le compte a été anonymisé. Il n’apparaît plus dans les listes administratives.');
    return res.redirect(memberRedirect());
  } catch (error) {
    if (error.message === 'ACCOUNT_NOT_AVAILABLE') {
      setFlash(req, 'error', 'Ce compte a déjà été anonymisé ou est indisponible.');
      return res.redirect(memberRedirect());
    }

    return next(error);
  }
}
