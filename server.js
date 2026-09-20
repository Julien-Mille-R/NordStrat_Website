import 'dotenv/config';
import app from './app.js';
import { BookingArchive, sequelize } from './models/index.js';
import { cleanupExpiredRateLimits } from './services/postgres-rate-limit-store.js';

const PORT = Number(process.env.PORT || 3000);
const ARCHIVE_CHECK_INTERVAL = 60 * 1000;
const RATE_LIMIT_CLEANUP_INTERVAL = 60 * 60 * 1000;
let archiveCheckRunning = false;

export async function runArchiveAutomation() {
  if (archiveCheckRunning) return;
  archiveCheckRunning = true;
  try {
    const archivedEvents = await BookingArchive.archiveDueEvents();
    if (archivedEvents.length) {
      console.log(`${archivedEvents.length} événement(s) archivé(s) automatiquement.`);
    }
    await BookingArchive.exportMissingFiles();
  } catch (error) {
    console.error("Échec de l'automatisation des archives.", error);
  } finally {
    archiveCheckRunning = false;
  }
}

const server = app.listen(PORT, (error) => {
  if (error) {
    console.error(`Impossible de démarrer le serveur sur le port ${PORT}.`, error);
    return;
  }
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  runArchiveAutomation();
  setInterval(runArchiveAutomation, ARCHIVE_CHECK_INTERVAL).unref();
  cleanupExpiredRateLimits().catch((error) => console.error('Échec du nettoyage des compteurs.', error));
  setInterval(() => {
    cleanupExpiredRateLimits().catch((error) => console.error('Échec du nettoyage des compteurs.', error));
  }, RATE_LIMIT_CLEANUP_INTERVAL).unref();
});

async function shutdown(signal) {
  console.log(`${signal} reçu, arrêt du serveur…`);
  server.close(async () => {
    await sequelize.close().catch((error) => console.error('Échec de la fermeture PostgreSQL.', error));
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
