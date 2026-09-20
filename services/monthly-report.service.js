import fs from 'node:fs/promises';
import path from 'node:path';
import { Op } from 'sequelize';
import {
  BookingArchive,
  Event,
  Membership,
  NewsPost,
  Player,
  Role,
} from '../models/index.js';
import { ARCHIVE_DIRECTORY } from '../models/booking-archive.js';
import { sendEmail } from './mail.service.js';
import { renderMonthlyReportEmail } from '../templates/email/monthly-report.template.js';

const PARIS_TIME_ZONE = 'Europe/Paris';
const STATE_FILE = path.join(ARCHIVE_DIRECTORY, 'system', 'monthly-report-state.json');
const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: PARIS_TIME_ZONE });
const MONTH_FORMAT = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: PARIS_TIME_ZONE });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: PARIS_TIME_ZONE });

function parisParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: PARIS_TIME_ZONE,
  }).formatToParts(date);
  const value = (type) => Number(parts.find((part) => part.type === type).value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

function timeZoneOffset(date) {
  const name = new Intl.DateTimeFormat('en', {
    timeZone: PARIS_TIME_ZONE,
    timeZoneName: 'longOffset',
  }).formatToParts(date).find((part) => part.type === 'timeZoneName').value;
  const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3])) * 60 * 1000;
}

function parisMonthStart(year, zeroBasedMonth) {
  const approximate = new Date(Date.UTC(year, zeroBasedMonth, 1));
  return new Date(approximate.getTime() - timeZoneOffset(approximate));
}

export function previousMonthPeriod(now = new Date()) {
  const current = parisParts(now);
  const currentMonthIndex = current.month - 1;
  const start = parisMonthStart(current.year, currentMonthIndex - 1);
  const end = parisMonthStart(current.year, currentMonthIndex);
  const keyParts = parisParts(new Date(start.getTime() + 12 * 60 * 60 * 1000));
  const key = `${keyParts.year}-${String(keyParts.month).padStart(2, '0')}`;
  return {
    key,
    start,
    end,
    label: MONTH_FORMAT.format(start),
    startLabel: DATE_FORMAT.format(start),
    endLabel: DATE_FORMAT.format(new Date(end.getTime() - 1)),
  };
}

function summarizeArchives(archives) {
  const gameCounts = new Map();
  const playerIds = new Set();
  let tables = 0;
  let registrations = 0;

  for (const archive of archives) {
    const archivedTables = Array.isArray(archive.snapshot?.tables) ? archive.snapshot.tables : [];
    tables += archivedTables.length;
    for (const table of archivedTables) {
      const gameName = table.game?.name || 'Jeu non renseigné';
      gameCounts.set(gameName, (gameCounts.get(gameName) || 0) + 1);
      const participants = Array.isArray(table.participants) ? table.participants : [];
      registrations += participants.length;
      participants.forEach((participant) => {
        if (participant.playerId != null) playerIds.add(participant.playerId);
      });
    }
  }

  const games = [...gameCounts.entries()]
    .map(([name, tableCount]) => ({ name, tables: tableCount }))
    .sort((first, second) => second.tables - first.tables || first.name.localeCompare(second.name, 'fr'));

  return { tables, registrations, uniquePlayers: playerIds.size, games };
}

export async function buildMonthlyReport(now = new Date()) {
  const period = previousMonthPeriod(now);
  const range = { [Op.gte]: period.start, [Op.lt]: period.end };
  const today = `${parisParts(now).year}-${String(parisParts(now).month).padStart(2, '0')}-${String(parisParts(now).day).padStart(2, '0')}`;
  const activeMembershipRange = {
    seasonStart: { [Op.lte]: today },
    seasonEnd: { [Op.gte]: today },
  };

  const [
    activeMembers,
    newMembers,
    allowedMembers,
    adminRole,
    membershipsUpToDate,
    membershipsPending,
    cancelledEvenings,
    archives,
    newsPosts,
  ] = await Promise.all([
    Player.count({ where: { isActive: true, moderationStatus: 'active' } }),
    Player.count({ where: { createdAt: range } }),
    Player.count({ where: { isActive: true, moderationStatus: 'active', canBookTables: true } }),
    Role.findOne({ where: { name: 'Admin' }, attributes: ['id'] }),
    Membership.count({
      distinct: true,
      col: 'playerId',
      where: { ...activeMembershipRange, status: { [Op.in]: ['paid', 'exempted'] } },
    }),
    Membership.count({ distinct: true, col: 'playerId', where: { ...activeMembershipRange, status: 'unpaid' } }),
    Event.count({ where: { date: range, status: 'cancelled' } }),
    BookingArchive.findAll({ where: { eventDate: range }, attributes: ['snapshot'] }),
    NewsPost.findAll({
      where: { publishedAt: range },
      attributes: ['title', 'publishedAt'],
      order: [['publishedAt', 'ASC']],
    }),
  ]);

  const adminCount = adminRole
    ? await Player.count({ where: { isActive: true, moderationStatus: 'active', roleId: adminRole.id, canBookTables: false } })
    : 0;
  const archiveSummary = summarizeArchives(archives);
  const averagePlayers = archives.length ? (archiveSummary.registrations / archives.length).toFixed(1).replace('.', ',') : '0';
  const siteUrl = process.env.SITE_URL?.replace(/\/$/, '');

  return {
    period,
    members: {
      active: activeMembers,
      newThisMonth: newMembers,
      allowedToBook: allowedMembers + adminCount,
      membershipsUpToDate,
      membershipsPending,
    },
    evenings: {
      held: archives.length,
      cancelled: cancelledEvenings,
      tables: archiveSummary.tables,
      registrations: archiveSummary.registrations,
      uniquePlayers: archiveSummary.uniquePlayers,
      averagePlayers,
    },
    games: archiveSummary.games,
    news: newsPosts.map((post) => ({ title: post.title, publishedAt: DATE_FORMAT.format(post.publishedAt) })),
    generatedAt: DATE_TIME_FORMAT.format(now),
    adminUrl: siteUrl ? `${siteUrl}/admindashboard` : null,
  };
}

async function readState() {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function saveState(periodKey, sentAt) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  const temporaryFile = `${STATE_FILE}.tmp-${process.pid}`;
  await fs.writeFile(temporaryFile, `${JSON.stringify({ lastSentPeriod: periodKey, sentAt }, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await fs.rename(temporaryFile, STATE_FILE);
}

function assertMailConfiguration() {
  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM_ADDRESS', 'MONTHLY_REPORT_RECIPIENT'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Configuration du rapport mensuel incomplète : ${missing.join(', ')}`);
}

export async function sendMonthlyReport(now = new Date()) {
  assertMailConfiguration();
  const report = await buildMonthlyReport(now);
  const email = renderMonthlyReportEmail(report);
  await sendEmail({
    to: process.env.MONTHLY_REPORT_RECIPIENT,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  await saveState(report.period.key, now.toISOString());
  return report;
}

export async function sendMonthlyReportIfDue(now = new Date()) {
  if (process.env.MONTHLY_REPORT_ENABLED !== 'true') return { status: 'disabled' };
  if (parisParts(now).day !== 1) return { status: 'not-due' };
  const period = previousMonthPeriod(now);
  const state = await readState();
  if (state.lastSentPeriod === period.key) return { status: 'already-sent', period: period.key };
  const report = await sendMonthlyReport(now);
  return { status: 'sent', period: report.period.key };
}
