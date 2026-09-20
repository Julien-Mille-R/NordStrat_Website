import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import 'dotenv/config';

const MIGRATION_DIRECTORY = path.join(process.cwd(), 'database', 'migrations');
const LOCK_NAME = 'nordstrat_schema_migrations';

function databaseConfiguration() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
}

function checksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function migrationFiles() {
  return (await fs.readdir(MIGRATION_DIRECTORY))
    .filter((filename) => filename.endsWith('.sql'))
    .sort((first, second) => first.localeCompare(second));
}

const client = new pg.Client(databaseConfiguration());

try {
  await client.connect();
  await client.query('SELECT pg_advisory_lock(hashtext($1))', [LOCK_NAME]);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migration (
    filename TEXT PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  for (const filename of await migrationFiles()) {
    const sql = await fs.readFile(path.join(MIGRATION_DIRECTORY, filename), 'utf8');
    const fileChecksum = checksum(sql);
    const compatibleChecksums = new Set([
      fileChecksum,
      checksum(sql.replace(/\r?\n$/, '')),
    ]);
    const applied = await client.query(
      'SELECT checksum FROM schema_migration WHERE filename = $1',
      [filename],
    );
    if (applied.rowCount) {
      if (!compatibleChecksums.has(applied.rows[0].checksum.trim())) {
        throw new Error(`La migration déjà appliquée ${filename} a été modifiée.`);
      }
      console.log(`Migration déjà appliquée : ${filename}`);
      continue;
    }

    console.log(`Application de la migration : ${filename}`);
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migration (filename, checksum) VALUES ($1, $2)',
      [filename, fileChecksum],
    );
  }
  console.log('Migrations terminées.');
} catch (error) {
  console.error('Échec des migrations.', error);
  process.exitCode = 1;
} finally {
  await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_NAME]).catch(() => {});
  await client.end().catch(() => {});
}
