import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderMonthlyReportEmail } from '../../templates/email/monthly-report.template.js';

function sampleReport() {
  return {
    period: {
      label: 'août 2026',
      startLabel: '1 août 2026',
      endLabel: '31 août 2026',
    },
    members: {
      active: 42,
      newThisMonth: 3,
      allowedToBook: 18,
      membershipsUpToDate: 21,
      membershipsPending: 4,
    },
    evenings: {
      held: 4,
      cancelled: 1,
      tables: 17,
      registrations: 48,
      uniquePlayers: 25,
      averagePlayers: '12',
    },
    games: [{ name: 'Frostgrave', tables: 5 }],
    news: [{ title: '<script>alert("test")</script>', publishedAt: '15 août 2026' }],
    generatedAt: '1 septembre 2026 à 08:00',
    adminUrl: 'https://nord-strategie.fr/admindashboard',
  };
}

test('le rapport mensuel fournit les versions HTML et texte attendues', () => {
  const email = renderMonthlyReportEmail(sampleReport());
  assert.equal(email.subject, 'Nord Stratégie — Bilan mensuel de août 2026');
  assert.match(email.html, /Frostgrave/);
  assert.match(email.text, /42 comptes actifs/);
  assert.match(email.text, /Panneau d’administration/);
});

test("le template neutralise le HTML provenant d'une actualité", () => {
  const email = renderMonthlyReportEmail(sampleReport());
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
});
