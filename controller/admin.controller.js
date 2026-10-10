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
    const isNewsManager = req.currentUser.role.name === 'NewsManager';

    if (isNewsManager) {
      const newsPostCount = await NewsPost.count();

      return res.render('layouts/admin/adminDashboard', {
        dashboardStats: {
          newsPostCount,
        },
      });
    }

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
        membershipMissingCount: Math.max(
          activeMemberCount - membershipUpToDateCount,
          0,
        ),
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

// -----------------------------------------------------------------------------
// Statistiques des rencontres : lecture seule à partir des archives JSONB.
// -----------------------------------------------------------------------------

const EVENT_STATISTICS_PERIODS = new Set([1, 3, 6, 12]);
const EVENT_STATISTICS_TIME_ZONE = 'Europe/Paris';

function getParisMonthKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_STATISTICS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}`;
}

function getParisYearMonth(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: EVENT_STATISTICS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === 'year').value),
    month: Number(parts.find((part) => part.type === 'month').value),
  };
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: EVENT_STATISTICS_TIME_ZONE,
    month: 'short',
    year: '2-digit',
  }).format(date);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

async function buildEventStatistics(rawPeriod) {
  const parsedPeriod = Number.parseInt(rawPeriod, 10);
  const period = EVENT_STATISTICS_PERIODS.has(parsedPeriod)
    ? parsedPeriod
    : 3;

  const now = new Date();
  const startDate = new Date(now);
  const originalDay = startDate.getDate();

  // Évite les décalages de date lorsqu'on remonte depuis un 29, 30 ou 31.
  startDate.setDate(1);
  startDate.setMonth(startDate.getMonth() - period);
  const lastDayOfMonth = new Date(
    startDate.getFullYear(),
    startDate.getMonth() + 1,
    0,
  ).getDate();
  startDate.setDate(Math.min(originalDay, lastDayOfMonth));

  const archives = await BookingArchive.findAll({
    where: {
      eventDate: {
        [Op.gte]: startDate,
        [Op.lte]: now,
      },
    },
    order: [['eventDate', 'ASC']],
  });

  const playerAttendance = new Map();
  const games = new Map();
  const monthlyMap = new Map();

  let tableCount = 0;
  let guestCount = 0;
  let playerParticipations = 0;
  let registeredPlayerParticipations = 0;

  // Initialise les mois civils traversés par la période.
  const startParts = getParisYearMonth(startDate);
  const endParts = getParisYearMonth(now);

  let cursor = new Date(
    Date.UTC(startParts.year, startParts.month - 1, 1, 12),
  );
  const lastMonth = new Date(
    Date.UTC(endParts.year, endParts.month - 1, 1, 12),
  );

  while (cursor <= lastMonth) {
    const key = getParisMonthKey(cursor);

    monthlyMap.set(key, {
      key,
      label: formatMonthLabel(cursor),
      events: 0,
      playerParticipations: 0,
      guests: 0,
      participants: 0,
    });

    cursor = new Date(
      Date.UTC(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth() + 1,
        1,
        12,
      ),
    );
  }

  for (const archiveRecord of archives) {
    const snapshot = archiveRecord.snapshot || {};
    const tables = Array.isArray(snapshot.tables)
      ? snapshot.tables
      : [];

    const month = monthlyMap.get(
      getParisMonthKey(new Date(archiveRecord.eventDate)),
    );

    if (month) month.events += 1;

    for (const table of tables) {
      // Les anciens instantanés ne conservent pas le statut de la table.
      // On compte donc les tables présentes dans l'archive.
      tableCount += 1;

      const gameName = table.game?.name || 'Jeu non renseigné';
      games.set(gameName, (games.get(gameName) || 0) + 1);

      const guestsOnTable = Number.isFinite(Number(table.guestCount))
        ? Math.max(0, Number(table.guestCount))
        : 0;

      guestCount += guestsOnTable;
      if (month) month.guests += guestsOnTable;

      const participants = Array.isArray(table.participants)
        ? table.participants
        : [];

      for (const participant of participants) {
        registeredPlayerParticipations += 1;

        // Une absence explicitement enregistrée n'est pas une présence.
        // Si le champ est absent, on conserve la convention de l'archive
        // actuelle : présence présumée.
        if (participant.attended === false) continue;

        playerParticipations += 1;
        if (month) month.playerParticipations += 1;

        // L'identifiant, et non le pseudonyme, permet de compter les
        // joueurs uniques même s'ils changent de pseudonyme.
        if (participant.playerId != null) {
          const playerId = String(participant.playerId);

          const existing = playerAttendance.get(playerId) || {
            playerId,
            nickname: participant.nickname || 'Joueur anonymisé',
            count: 0,
          };

          existing.count += 1;

          if (
            (!existing.nickname || existing.nickname === 'Joueur anonymisé')
            && participant.nickname
          ) {
            existing.nickname = participant.nickname;
          }

          playerAttendance.set(playerId, existing);
        }
      }
    }
  }

  for (const month of monthlyMap.values()) {
    month.participants =
      month.playerParticipations + month.guests;
  }

  const gameBreakdown = [...games.entries()]
    .map(([name, tables]) => ({ name, tables }))
    .sort(
      (a, b) =>
        b.tables - a.tables ||
        a.name.localeCompare(b.name, 'fr'),
    );

  const topPlayers = [...playerAttendance.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.nickname.localeCompare(b.nickname, 'fr'),
    )
    .slice(0, 5);

  const monthlyTrend = [...monthlyMap.values()];

  return {
    period,
    startDate,
    endDate: now,

    eventCount: archives.length,
    tableCount,
    averageTables: archives.length
      ? tableCount / archives.length
      : 0,

    // Participations = présences effectives cumulées, pas joueurs uniques.
    playerParticipations,
    registeredPlayerParticipations,
    attendanceRate: registeredPlayerParticipations
      ? (playerParticipations / registeredPlayerParticipations) * 100
      : 0,

    averagePlayers: archives.length
      ? playerParticipations / archives.length
      : 0,

    uniquePlayers: playerAttendance.size,
    guestCount,
    totalParticipants: playerParticipations + guestCount,

    gameBreakdown,
    topPlayers,
    monthlyTrend,

    maxGameTables: Math.max(
      1,
      ...gameBreakdown.map((game) => game.tables),
    ),
    maxMonthlyParticipants: Math.max(
      1,
      ...monthlyTrend.map((month) => month.participants),
    ),
  };
}

export async function showEventStatistics(req, res, next) {
  try {
    const statistics = await buildEventStatistics(req.query.period);

    return res.render('layouts/admin/event-statistics', {
      statistics,
    });
  } catch (error) {
    return next(error);
  }
}

export async function exportEventStatisticsCsv(req, res, next) {
  try {
    const statistics = await buildEventStatistics(req.query.period);

    const rows = [
      ['Section', 'Indicateur', 'Valeur'],
      ['Synthèse', 'Période (mois)', statistics.period],
      ['Synthèse', 'Début de période', statistics.startDate.toISOString()],
      ['Synthèse', 'Fin de période', statistics.endDate.toISOString()],
      ['Synthèse', 'Rencontres archivées', statistics.eventCount],
      ['Synthèse', 'Tables archivées', statistics.tableCount],
      [
        'Synthèse',
        'Moyenne de tables par rencontre',
        statistics.averageTables.toFixed(2),
      ],
      [
        'Synthèse',
        'Participations effectives des joueurs',
        statistics.playerParticipations,
      ],
      ['Synthèse', 'Joueurs uniques présents', statistics.uniquePlayers],
      [
        'Synthèse',
        'Moyenne de joueurs présents par rencontre',
        statistics.averagePlayers.toFixed(2),
      ],
      [
        'Synthèse',
        'Taux de présence sur les inscriptions archivées (%)',
        statistics.attendanceRate.toFixed(2),
      ],
      ['Synthèse', 'Invités', statistics.guestCount],
      [
        'Synthèse',
        'Participants totaux (joueurs présents + invités)',
        statistics.totalParticipants,
      ],
      ...statistics.gameBreakdown.map(
        (game) => ['Jeux', game.name, game.tables],
      ),
      ...statistics.topPlayers.map(
        (player, index) => [
          'Top 5 joueurs',
          `${index + 1}. ${player.nickname}`,
          player.count,
        ],
      ),
      ...statistics.monthlyTrend.map(
        (month) => [
          'Évolution mensuelle',
          month.label,
          `Rencontres : ${month.events}; participations : ${month.playerParticipations}; invités : ${month.guests}`,
        ],
      ),
    ];

    const csv =
      `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nord-strategie-statistiques-rencontres-${statistics.period}-mois.csv"`,
    );
    res.setHeader('Cache-Control', 'no-store');

    return res.send(csv);
  } catch (error) {
    return next(error);
  }
}