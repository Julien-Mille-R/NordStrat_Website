import 'dotenv/config';
import { sequelize } from '../models/index.js';
import { sendMonthlyReportTest } from '../services/monthly-report.service.js';

try {
  const report = await sendMonthlyReportTest();
  console.log(`Mail de test envoyé pour la période ${report.period.label}.`);
  console.log(`Destinataire : ${process.env.MONTHLY_REPORT_RECIPIENT}`);
  console.log("Le marqueur d'envoi automatique n'a pas été modifié.");
} catch (error) {
  console.error('Envoi du mail de test impossible :', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close().catch(() => {});
}
