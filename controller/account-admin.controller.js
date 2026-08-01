import {
  Player,
  Role,
  sequelize,
} from '../models/index.js';
import { reactivateExpiredSuspension, setFlash } from './access.controller.js';
import { recordAdminAction, targetDisplayName } from '../services/audit-log.service.js';
import { invalidatePlayerSessions } from '../services/session-security.service.js';

function memberRedirect() {
  return '/admindashboard/members';
}

export async function showMemberList(req, res, next) {
  try {
    const players = await Player.findAll({
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
