import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import connectPgSimple from 'connect-pg-simple';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
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
import { showNotFound, showServerError } from './controller/error.controller.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

function productionConfiguration(app) {
  if (!isProduction) return null;
  if (process.env.TRUST_PROXY !== '1') {
    throw new Error('TRUST_PROXY=1 doit être défini en production derrière le proxy HTTPS.');
  }
  if (!process.env.SITE_URL) throw new Error('SITE_URL doit être défini en production.');

  const siteUrl = new URL(process.env.SITE_URL);
  if (siteUrl.protocol !== 'https:') throw new Error('SITE_URL doit utiliser HTTPS en production.');
  app.set('trust proxy', 1);
  return siteUrl;
}

export function createApp() {
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET doit être défini dans le fichier .env.');
  }

  const app = express();
  const productionSiteUrl = productionConfiguration(app);
  const PgSession = connectPgSimple(session);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
  });
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
    frameguard: { action: 'deny' },
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
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

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.static(path.join(__dirname, 'public')));
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
  app.use('/', router);
  app.use(showNotFound);
  app.use(showServerError);
  return app;
}

export default createApp();
