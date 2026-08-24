import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import 'dotenv/config';

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

const seedFile = path.join(process.cwd(), 'database', 'seeds', 'games.sql');
const client = new pg.Client(databaseConfiguration());

try {
  const sql = await fs.readFile(seedFile, 'utf8');
  await client.connect();
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('Catalogue initial des jeux synchronisé.');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Échec de la synchronisation du catalogue de jeux.', error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
