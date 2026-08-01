import { Membership, Player, sequelize } from '../models/index.js';
import { setFlash } from './access.controller.js';
import { recordAdminAction, targetDisplayName } from '../services/audit-log.service.js';

const ALLOWED_STATUSES = new Set(['unpaid', 'paid', 'exempted', 'cancelled']);
const ALLOWED_PAYMENT_METHODS = new Set(['cash', 'check', 'bank_transfer', 'card', 'other']);
const PARIS_TIME_ZONE = 'Europe/Paris';
const STATUS_LABELS = {
  unpaid: 'non réglée',
  paid: 'réglée',
  exempted: 'exonérée',
  cancelled: 'annulée',
};

export function membershipSeasonForYear(year) {
  return {
    year,
    start: `${year}-09-01`,
    end: `${year + 1}-08-31`,
    label: `${year}–${year + 1}`,
  };
}

export function currentMembershipSeason(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: PARIS_TIME_ZONE,
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year').value);
  const month = Number(parts.find((part) => part.type === 'month').value);
  return membershipSeasonForYear(month >= 9 ? year : year - 1);
}

function requestedSeason(value) {
  const currentSeason = currentMembershipSeason();
  const year = value === undefined ? currentSeason.year : Number(value);
  if (!Number.isInteger(year) || year < 2020 || year > currentSeason.year + 1) return null;
  return membershipSeasonForYear(year);
}

export async function showMembershipList(req, res, next) {
  try {
    const selectedSeason = requestedSeason(req.query.season);
    if (!selectedSeason) return res.status(400).send('Saison invalide.');

    const currentSeason = currentMembershipSeason();
    const seasons = Array.from(
      { length: 5 },
      (_, index) => membershipSeasonForYear(currentSeason.year + 1 - index),
    );
    const players = await Player.findAll({
      include: [{
        association: 'memberships',
        required: false,
        where: { seasonStart: selectedSeason.start },
        include: [{ association: 'recorder' }],
      }],
      order: [
        ['nickname', 'ASC'],
        ['email', 'ASC'],
      ],
    });

    const summary = {
      total: players.length,
      paid: 0,
      unpaid: 0,
      exempted: 0,
      cancelled: 0,
    };
    players.forEach((player) => {
      const status = player.memberships[0]?.status || 'unpaid';
      summary[status] += 1;
    });

    return res.render('layouts/admin/membership-list', {
      players,
      seasons,
      selectedSeason,
      summary,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateMembership(req, res, next) {
  const playerId = Number(req.params.playerId);
  const status = req.body.status;
  const paymentMethod = req.body.paymentMethod || null;
  const season = requestedSeason(req.body.season);

  try {
    if (!Number.isInteger(playerId)) return res.status(400).send('Membre invalide.');
    if (!season || !ALLOWED_STATUSES.has(status)) {
      setFlash(req, 'error', 'La saison ou l’état de cotisation est invalide.');
      return res.redirect('/admindashboard/memberships');
    }
    if (status === 'paid' && !ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
      setFlash(req, 'error', 'Sélectionnez le mode de paiement utilisé.');
      return res.redirect(`/admindashboard/memberships?season=${season.year}`);
    }

    const player = await Player.findByPk(playerId);
    if (!player) return res.status(404).send('Membre introuvable.');

    await sequelize.transaction(async (transaction) => {
      const existingMembership = await Membership.findOne({
        where: { playerId, seasonStart: season.start },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const previousStatus = existingMembership?.status || 'unpaid';
      const paidAt = status === 'paid'
        ? existingMembership?.paidAt || new Date()
        : null;
      const values = {
        playerId,
        seasonStart: season.start,
        seasonEnd: season.end,
        status,
        paidAt,
        amountCents: null,
        paymentMethod: status === 'paid' ? paymentMethod : null,
        source: 'manual',
        externalReference: null,
        recordedBy: req.currentUser.id,
      };

      if (existingMembership) {
        await existingMembership.update(values, { transaction });
      } else {
        await Membership.create(values, { transaction });
      }
      await recordAdminAction({
        admin: req.currentUser,
        category: 'memberships',
        action: 'membership_updated',
        targetType: 'member',
        targetId: player.id,
        targetLabel: targetDisplayName(player),
        description: `Cotisation ${season.label} passée de « ${STATUS_LABELS[previousStatus]} » à « ${STATUS_LABELS[status]} ».`,
        transaction,
      });
    });

    setFlash(req, 'success', `La cotisation de ${player.nickname || player.firstname} a été mise à jour.`);
    return res.redirect(`/admindashboard/memberships?season=${season.year}`);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError' || error.name === 'SequelizeValidationError') {
      setFlash(req, 'error', 'Impossible de mettre à jour cette cotisation.');
      return res.redirect(`/admindashboard/memberships?season=${season?.year || ''}`);
    }
    return next(error);
  }
}
