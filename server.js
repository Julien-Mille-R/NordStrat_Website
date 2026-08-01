import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import crypto from 'node:crypto';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import router from './router/routes.js';
import {
  loadCurrentUser,
  provideCsrfToken,
  rejectCrossSiteUnsafeRequest,
  validateCsrfToken,
} from './controller/access.controller.js';
import { providePublicEventNavigation } from './controller/public-event.controller.js';
import { provideSeo } from './controller/seo.controller.js';
import { showNotFound } from './controller/error.controller.js';
import { BookingArchive } from './models/index.js';
import { cleanupExpiredRateLimits } from './services/postgres-rate-limit-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const PgSession = connectPgSimple(session);
const ARCHIVE_CHECK_INTERVAL = 60 * 1000;
const RATE_LIMIT_CLEANUP_INTERVAL = 60 * 60 * 1000;
let archiveCheckRunning = false;
const isProduction = process.env.NODE_ENV === 'production';
let productionSiteUrl = null;

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET doit être défini dans le fichier .env.');
}

if (isProduction && process.env.TRUST_PROXY !== '1') {
  throw new Error('TRUST_PROXY=1 doit être défini en production derrière le proxy HTTPS.');
}

if (isProduction) {
  if (!process.env.SITE_URL) {
    throw new Error('SITE_URL doit être défini en production.');
  }
  productionSiteUrl = new URL(process.env.SITE_URL);
  if (productionSiteUrl.protocol !== 'https:') {
    throw new Error('SITE_URL doit utiliser HTTPS en production.');
  }
  app.set('trust proxy', 1);
}
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

const contentSecurityPolicyDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    (req, res) => `'nonce-${res.locals.cspNonce}'`,
  ],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:'],
  fontSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  upgradeInsecureRequests: isProduction ? [] : null,
};

app.use(helmet({
  contentSecurityPolicy: {
    directives: contentSecurityPolicyDirectives,
  },
  frameguard: { action: 'deny' },
  hsts: isProduction
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=(), usb=()');
  next();
});

if (isProduction) {
  app.use((req, res, next) => {
    if (req.secure) return next();
    return res.redirect(308, new URL(req.originalUrl, productionSiteUrl).toString());
  });
}

// Configuration du moteur de templates
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Middleware pour parser les données
app.use(rejectCrossSiteUnsafeRequest);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  store: new PgSession({
    conObject: process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      },
    tableName: 'session',
    createTableIfMissing: true,
  }),
  name: 'nordstrat.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

app.use(loadCurrentUser);
app.use(provideSeo);
app.use(providePublicEventNavigation);
app.use(provideCsrfToken);
app.use(validateCsrfToken);

// Route de test simple
app.use('/', router);
app.use(showNotFound);

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).send('Une erreur interne est survenue.');
});

async function runArchiveAutomation() {
  if (archiveCheckRunning) return;
  archiveCheckRunning = true;

  try {
    const archivedEvents = await BookingArchive.archiveDueEvents();
    if (archivedEvents.length > 0) {
      console.log(`${archivedEvents.length} événement(s) archivé(s) automatiquement.`);
    }
  } catch (error) {
    console.error("Échec de la vérification automatique de l'archivage.", error);
  }

  try {
    await BookingArchive.exportMissingFiles();
  } catch (error) {
    console.error("Échec de l'export des fichiers JSON d'archive.", error);
  } finally {
    archiveCheckRunning = false;
  }
}

// Démarrage du serveur
app.listen(PORT, (error) => {
  if (error) {
    console.error(`Impossible de démarrer le serveur sur le port ${PORT}.`, error);
    return;
  }
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  runArchiveAutomation();
  setInterval(runArchiveAutomation, ARCHIVE_CHECK_INTERVAL).unref();
  cleanupExpiredRateLimits().catch((error) => {
    console.error('Échec du nettoyage des compteurs de limitation.', error);
  });
  setInterval(() => {
    cleanupExpiredRateLimits().catch((error) => {
      console.error('Échec du nettoyage des compteurs de limitation.', error);
    });
  }, RATE_LIMIT_CLEANUP_INTERVAL).unref();
});
