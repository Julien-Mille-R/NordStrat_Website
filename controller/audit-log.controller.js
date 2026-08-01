import { Op } from 'sequelize';
import { AuditLog } from '../models/index.js';
import { AUDIT_CATEGORIES } from '../models/audit-log.js';

const PAGE_SIZE = 30;
const ACTION_FILTERS = {
  memberships: { category: 'memberships' },
  roles: { action: 'role_updated' },
  suspensions: {
    action: {
      [Op.in]: [
        'member_suspended_temporarily',
        'member_suspended_permanently',
      ],
    },
  },
  reactivations: { action: 'member_reactivated' },
};

export const AUDIT_CATEGORY_LABELS = {
  game_tables: 'Soirées et tables',
  members: 'Membres',
  memberships: 'Cotisations',
  news: 'Actualités',
  public_events: 'Assaut de Bruay',
};

export const AUDIT_ACTION_FILTER_LABELS = {
  memberships: 'Cotisations',
  roles: 'Changements de rôle',
  suspensions: 'Suspensions de compte',
  reactivations: 'Réactivations de compte',
};

const AUDIT_ACTION_LABELS = {
  event_archived_manually: 'Soirée archivée manuellement',
  event_cancelled: 'Soirée annulée',
  event_created: 'Soirée créée',
  event_reopened: 'Soirée rouverte',
  event_updated: 'Soirée modifiée',
  member_reactivated: 'Compte réactivé',
  member_suspended_permanently: 'Compte suspendu définitivement',
  member_suspended_temporarily: 'Compte suspendu temporairement',
  membership_updated: 'Cotisation mise à jour',
  news_created: 'Actualité publiée',
  news_deleted: 'Actualité supprimée',
  news_updated: 'Actualité modifiée',
  player_reservation_cancelled: 'Inscription à une table annulée',
  public_event_application_updated: 'Demande de participation mise à jour',
  public_event_created: 'Édition de l’Assaut de Bruay créée',
  public_event_updated: 'Assaut de Bruay mis à jour',
  role_updated: 'Rôle du compte modifié',
  table_cancelled: 'Table annulée',
  table_capacity_updated: 'Capacité de la table modifiée',
  table_updated: 'Jeu ou capacité de la table modifiés',
  table_closed: 'Inscriptions à la table fermées',
  table_reopened: 'Table rouverte aux inscriptions',
  table_comment_deleted: 'Message de discussion modéré',
  table_created: 'Table créée',
};

const AUDIT_TARGET_LABELS = {
  event: 'Soirée concernée',
  event_table_slot: 'Table concernée',
  game_table: 'Table concernée',
  member: 'Membre concerné',
  news_post: 'Actualité concernée',
  public_event: 'Événement concerné',
  public_event_application: 'Demande concernée',
};

function humanizeIdentifier(value) {
  const words = String(value || '')
    .replaceAll('_', ' ')
    .trim();
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : 'Action administrative';
}

function presentAuditLog(log) {
  const plainLog = log.get({ plain: true });
  return {
    ...plainLog,
    actionLabel: AUDIT_ACTION_LABELS[plainLog.action] || humanizeIdentifier(plainLog.action),
    targetTypeLabel: AUDIT_TARGET_LABELS[plainLog.targetType] || 'Élément concerné',
  };
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function showAuditLog(req, res, next) {
  try {
    const page = positiveInteger(req.query.page, 1);
    const category = AUDIT_CATEGORIES.includes(req.query.category) ? req.query.category : '';
    const admin = req.query.admin?.trim().slice(0, 100) || '';
    const targetMember = req.query.targetMember?.trim().slice(0, 255) || '';
    const actionType = Object.hasOwn(ACTION_FILTERS, req.query.actionType)
      ? req.query.actionType
      : '';
    const where = {};

    if (category) where.category = category;
    if (admin) where.adminNickname = { [Op.iLike]: `%${admin}%` };
    if (targetMember) {
      where.targetType = 'member';
      where.targetLabel = { [Op.iLike]: `%${targetMember}%` };
    }
    if (actionType) where[Op.and] = [ACTION_FILTERS[actionType]];

    const { count, rows: auditLogs } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    const totalPages = Math.max(Math.ceil(count / PAGE_SIZE), 1);

    return res.render('layouts/admin/audit-log', {
      auditLogs: auditLogs.map(presentAuditLog),
      categoryLabels: AUDIT_CATEGORY_LABELS,
      actionFilterLabels: AUDIT_ACTION_FILTER_LABELS,
      filters: {
        category,
        admin,
        targetMember,
        actionType,
      },
      pagination: {
        page: Math.min(page, totalPages),
        totalPages,
        totalItems: count,
      },
    });
  } catch (error) {
    return next(error);
  }
}
