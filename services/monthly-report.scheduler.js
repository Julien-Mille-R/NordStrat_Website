import { sendMonthlyReportIfDue } from './monthly-report.service.js';

const CHECK_INTERVAL = 60 * 60 * 1000;
let reportCheckRunning = false;

export async function runMonthlyReportAutomation(now = new Date()) {
  if (reportCheckRunning) return;
  reportCheckRunning = true;
  try {
    const result = await sendMonthlyReportIfDue(now);
    if (result.status === 'sent') {
      console.log(`Rapport mensuel ${result.period} envoyé.`);
    }
  } catch (error) {
    console.error("Échec de l'envoi du rapport mensuel.", error);
  } finally {
    reportCheckRunning = false;
  }
}

export function startMonthlyReportScheduler() {
  runMonthlyReportAutomation();
  return setInterval(runMonthlyReportAutomation, CHECK_INTERVAL).unref();
}
