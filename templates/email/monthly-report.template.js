const NUMBER_FORMAT = new Intl.NumberFormat('fr-FR');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function number(value) {
  return NUMBER_FORMAT.format(value || 0);
}

function newsHtml(newsPosts) {
  if (!newsPosts.length) return '<p style="margin:0;color:#5f6368;">Aucune actualité publiée ce mois-ci.</p>';
  return `<ul style="margin:0;padding-left:20px;">${newsPosts.map((post) => (
    `<li style="margin:0 0 8px;"><strong>${escapeHtml(post.title)}</strong> — ${escapeHtml(post.publishedAt)}</li>`
  )).join('')}</ul>`;
}

function gamesHtml(games) {
  if (!games.length) return '<p style="margin:0;color:#5f6368;">Aucun jeu archivé ce mois-ci.</p>';
  return `<ol style="margin:0;padding-left:22px;">${games.map((game) => (
    `<li style="margin:0 0 8px;"><strong>${escapeHtml(game.name)}</strong> — ${number(game.tables)} table${game.tables > 1 ? 's' : ''}</li>`
  )).join('')}</ol>`;
}

function textList(items, emptyMessage, formatter) {
  return items.length ? items.map((item, index) => formatter(item, index)).join('\n') : emptyMessage;
}

export function renderMonthlyReportEmail(report) {
  const { period, members, evenings, games, news, generatedAt, adminUrl } = report;
  const subject = `Nord Stratégie — Bilan mensuel de ${period.label}`;
  const summary = `${number(evenings.uniquePlayers)} joueur(s), ${number(evenings.tables)} table(s) et ${number(games.length)} jeu(x) différent(s).`;
  const button = adminUrl
    ? `<p style="margin:28px 0 8px;text-align:center;"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:12px 20px;border-radius:6px;background:#a31515;color:#ffffff;text-decoration:none;font-weight:700;">Accéder au panneau d’administration</a></p>`
    : '';

  const html = `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f3f3f3;color:#1d1d1f;font-family:Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Membres, soirées, jeux et actualités : le résumé du mois.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f3f3;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #dedede;">
        <tr><td style="padding:28px;background:#171717;border-top:6px solid #b31b1b;color:#ffffff;">
          <p style="margin:0 0 6px;color:#efb1b1;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Nord Stratégie</p>
          <h1 style="margin:0;font-size:27px;line-height:1.25;">Le rapport mensuel</h1>
          <p style="margin:8px 0 0;color:#dddddd;">${escapeHtml(period.label)} · Les dés ont parlé, place aux chiffres !</p>
        </td></tr>
        <tr><td style="padding:26px;">
          <h2 style="margin:0 0 14px;color:#a31515;font-size:20px;">Les membres</h2>
          <p style="margin:0 0 7px;"><strong>${number(members.active)}</strong> comptes actifs au total</p>
          <p style="margin:0 0 7px;"><strong>${number(members.newThisMonth)}</strong> nouvelles inscriptions ce mois-ci</p>
          <p style="margin:0 0 7px;"><strong>${number(members.allowedToBook)}</strong> membres autorisés à réserver</p>
          <p style="margin:0 0 7px;"><strong>${number(members.membershipsUpToDate)}</strong> adhésions à jour</p>
          <p style="margin:0 0 24px;"><strong>${number(members.membershipsPending)}</strong> cotisations en attente</p>

          <h2 style="margin:0 0 14px;color:#a31515;font-size:20px;">Les soirées jeux</h2>
          <p style="margin:0 0 7px;"><strong>${number(evenings.held)}</strong> soirées organisées</p>
          <p style="margin:0 0 7px;"><strong>${number(evenings.cancelled)}</strong> soirées annulées</p>
          <p style="margin:0 0 7px;"><strong>${number(evenings.tables)}</strong> tables réservées</p>
          <p style="margin:0 0 7px;"><strong>${number(evenings.registrations)}</strong> inscriptions aux tables</p>
          <p style="margin:0 0 7px;"><strong>${number(evenings.uniquePlayers)}</strong> joueurs différents</p>
          <p style="margin:0 0 24px;">Moyenne de <strong>${escapeHtml(evenings.averagePlayers)}</strong> joueur(s) par soirée</p>

          <h2 style="margin:0 0 14px;color:#a31515;font-size:20px;">Les jeux du mois</h2>
          <p style="margin:0 0 12px;"><strong>${number(games.length)}</strong> jeux différents ont été joués.</p>
          ${gamesHtml(games)}

          <h2 style="margin:24px 0 14px;color:#a31515;font-size:20px;">Les actualités</h2>
          <p style="margin:0 0 12px;"><strong>${number(news.length)}</strong> actualités publiées ce mois-ci.</p>
          ${newsHtml(news)}

          <div style="margin:26px 0 0;padding:16px;border-left:4px solid #b31b1b;background:#f7f2f2;">
            <strong>En bref :</strong> ${escapeHtml(summary)}
          </div>
          ${button}
        </td></tr>
        <tr><td style="padding:18px 26px;background:#eeeeee;color:#5f6368;font-size:12px;line-height:1.5;">
          Rapport généré automatiquement le ${escapeHtml(generatedAt)}.<br>
          Période analysée : du ${escapeHtml(period.startLabel)} au ${escapeHtml(period.endLabel)}.<br>
          Nord Stratégie · Des figurines, des dés et des statistiques étonnamment sérieuses.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `NORD STRATÉGIE — RAPPORT MENSUEL DE ${period.label.toUpperCase()}

LES MEMBRES
- ${number(members.active)} comptes actifs au total
- ${number(members.newThisMonth)} nouvelles inscriptions ce mois-ci
- ${number(members.allowedToBook)} membres autorisés à réserver
- ${number(members.membershipsUpToDate)} adhésions à jour
- ${number(members.membershipsPending)} cotisations en attente

LES SOIRÉES JEUX
- ${number(evenings.held)} soirées organisées
- ${number(evenings.cancelled)} soirées annulées
- ${number(evenings.tables)} tables réservées
- ${number(evenings.registrations)} inscriptions aux tables
- ${number(evenings.uniquePlayers)} joueurs différents
- Moyenne : ${evenings.averagePlayers} joueur(s) par soirée

LES JEUX DU MOIS
${textList(games, 'Aucun jeu archivé ce mois-ci.', (game, index) => `${index + 1}. ${game.name} — ${number(game.tables)} table(s)`)}

LES ACTUALITÉS
${textList(news, 'Aucune actualité publiée ce mois-ci.', (post) => `- ${post.title} — ${post.publishedAt}`)}

EN BREF
${summary}
${adminUrl ? `\nPanneau d’administration : ${adminUrl}\n` : ''}
Rapport généré automatiquement le ${generatedAt}.
Période analysée : du ${period.startLabel} au ${period.endLabel}.`;

  return { subject, html, text };
}
