import fs from 'node:fs';
import path from 'node:path';

const filename = path.resolve(process.argv[2] || '.env.production');
const required = [
  'NODE_ENV', 'SITE_URL', 'TRUST_PROXY', 'SESSION_SECRET', 'RATE_LIMIT_SECRET',
  'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'DB_HOST', 'DB_PORT',
  'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'UPLOAD_ROOT', 'ARCHIVE_DIRECTORY',
  'APP_BIND_ADDRESS', 'APP_PORT', 'APP_IMAGE',
];

function parseEnvironment(content) {
  return Object.fromEntries(content.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }));
}

function fail(message) {
  console.error(`Configuration de production invalide : ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(filename)) {
  fail(`${filename} est introuvable.`);
} else {
  const environment = parseEnvironment(fs.readFileSync(filename, 'utf8'));
  const missing = required.filter((name) => !environment[name]);
  if (missing.length) fail(`variables absentes : ${missing.join(', ')}.`);

  if (environment.NODE_ENV !== 'production') fail('NODE_ENV doit valoir production.');
  if (environment.TRUST_PROXY !== '1') fail('TRUST_PROXY doit valoir 1 derrière Nginx.');
  try {
    const siteUrl = new URL(environment.SITE_URL);
    if (siteUrl.protocol !== 'https:') fail('SITE_URL doit utiliser HTTPS.');
    if (siteUrl.hostname === 'example.org') fail('SITE_URL doit contenir le domaine réel.');
  } catch {
    fail('SITE_URL n’est pas une URL valide.');
  }

  for (const secretName of ['SESSION_SECRET', 'RATE_LIMIT_SECRET', 'POSTGRES_PASSWORD']) {
    const value = environment[secretName] || '';
    if (value.length < 32 || /replace|example|change/i.test(value)) {
      fail(`${secretName} doit être un secret réel d’au moins 32 caractères.`);
    }
  }
  if (environment.POSTGRES_PASSWORD !== environment.DB_PASSWORD) {
    fail('POSTGRES_PASSWORD et DB_PASSWORD doivent être identiques.');
  }
  if (environment.SESSION_SECRET === environment.RATE_LIMIT_SECRET) {
    fail('SESSION_SECRET et RATE_LIMIT_SECRET doivent être différents.');
  }
  if (/replace|example/i.test(environment.APP_IMAGE)) {
    fail('APP_IMAGE doit désigner une image réellement versionnée.');
  }
  if (environment.POSTGRES_DB !== environment.DB_NAME
    || environment.POSTGRES_USER !== environment.DB_USER) {
    fail('les noms de base et d’utilisateur PostgreSQL doivent correspondre aux variables DB_*.');
  }
  if (!['127.0.0.1', '::1'].includes(environment.APP_BIND_ADDRESS)) {
    fail('APP_BIND_ADDRESS doit rester local afin de ne pas contourner Nginx.');
  }

  if (process.platform !== 'win32') {
    const permissions = fs.statSync(filename).mode & 0o777;
    if ((permissions & 0o077) !== 0) fail('le fichier doit être privé (chmod 600).');
  }

  if (!process.exitCode) console.log('Configuration de production valide.');
}
