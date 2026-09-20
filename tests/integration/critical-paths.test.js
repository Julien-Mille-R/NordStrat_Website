import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import bcrypt from 'bcrypt';
import pg from 'pg';
import request from 'supertest';
import 'dotenv/config';

function databaseUrlFromLocalConfiguration(databaseName, schemaName = null) {
  const url = new URL('postgres://localhost');
  url.username = process.env.DB_USER || 'postgres';
  url.password = process.env.DB_PASSWORD || '';
  url.hostname = process.env.DB_HOST || '127.0.0.1';
  url.port = process.env.DB_PORT || '5432';
  url.pathname = `/${databaseName}`;
  if (schemaName) url.searchParams.set('options', `-c search_path=${schemaName}`);
  return url.toString();
}

function configuredTestTarget() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (process.env.TEST_DB_NAME) return databaseUrlFromLocalConfiguration(process.env.TEST_DB_NAME);
  if (process.env.TEST_DATABASE_SCHEMA) {
    return databaseUrlFromLocalConfiguration(process.env.DB_NAME, process.env.TEST_DATABASE_SCHEMA);
  }
  return null;
}

const testDatabaseUrl = configuredTestTarget();
const testSchema = process.env.TEST_DATABASE_SCHEMA || null;

function csrfToken(response) {
  const match = response.text.match(/name="_csrf" value="([^"]+)"/);
  assert.ok(match, 'Un jeton CSRF doit être présent dans la page.');
  return match[1];
}

describe('parcours HTTP critiques', { skip: !testDatabaseUrl }, () => {
  let app;
  let models;
  let sequelize;
  let temporaryDirectory;
  let admin;
  let firstUser;
  let secondUser;
  let event;
  let game;

  before(async () => {
    const databaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.slice(1));
    const isolatedDatabase = databaseName.endsWith('_test');
    const isolatedSchema = testSchema?.endsWith('_test');
    if (!isolatedDatabase && !isolatedSchema) {
      throw new Error('REFUS_DETRUIRE_BASE_NON_TEST : TEST_DATABASE_URL doit cibler une base terminant par _test.');
    }

    if (testSchema) {
      if (!/^[a-z][a-z0-9_]*_test$/.test(testSchema)) {
        throw new Error('REFUS_SCHEMA_NON_TEST : nom de schéma de test invalide.');
      }
      const client = new pg.Client({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      });
      await client.connect();
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${testSchema}"`);
      await client.end();
    }

    temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'nordstrat-tests-'));
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = testDatabaseUrl;
    if (testSchema) process.env.DB_SCHEMA = testSchema;
    process.env.SESSION_SECRET = 'integration-test-session-secret-with-sufficient-length';
    process.env.RATE_LIMIT_SECRET = 'integration-test-rate-limit-secret-with-sufficient-length';
    process.env.UPLOAD_ROOT = path.join(temporaryDirectory, 'uploads');
    process.env.ARCHIVE_DIRECTORY = path.join(temporaryDirectory, 'archives');

    ({ default: app } = await import('../../app.js'));
    ({ sequelize, ...models } = await import('../../models/index.js'));
    const [schemaRows] = await sequelize.query('SELECT current_schema() AS name');
    if (testSchema && schemaRows[0].name !== testSchema) {
      throw new Error('REFUS_DETRUIRE_SCHEMA_PUBLIC : search_path de test incorrect.');
    }
    await sequelize.query('DROP TABLE IF EXISTS session');
    await sequelize.query('DROP TABLE IF EXISTS rate_limit_counter');
    await sequelize.sync({ force: true });
    await sequelize.query(`CREATE TABLE rate_limit_counter (
      key_hash CHAR(64) PRIMARY KEY,
      hits INTEGER NOT NULL DEFAULT 1 CHECK (hits >= 0),
      reset_at TIMESTAMPTZ NOT NULL
    )`);

    const [adminRole, userRole] = await Promise.all([
      models.Role.create({ name: 'Admin' }),
      models.Role.create({ name: 'User' }),
    ]);
    const password = await bcrypt.hash('Test-password-123!', 4);
    [admin, firstUser, secondUser] = await Promise.all([
      models.Player.create({ firstname: 'Ada', lastname: 'Min', nickname: 'AdminTest', email: 'admin@test.invalid', password, roleId: adminRole.id }),
      models.Player.create({ firstname: 'Jean', lastname: 'Test', nickname: 'JoueurUn', email: 'user1@test.invalid', password, roleId: userRole.id }),
      models.Player.create({ firstname: 'Jeanne', lastname: 'Test', nickname: 'JoueurDeux', email: 'user2@test.invalid', password, roleId: userRole.id }),
    ]);
    game = await models.Game.create({ name: 'Frostgrave', minPlayers: 1, maxPlayers: 10 });
    const eventDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    event = await models.Event.create({
      title: 'Soirée de test',
      date: eventDate,
      registrationDeadline: new Date(eventDate.getTime() - 24 * 60 * 60 * 1000),
      createdBy: admin.id,
    });
  });

  after(async () => {
    if (sequelize) await sequelize.close();
    if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  async function login(agent, email, password = 'Test-password-123!') {
    const home = await agent.get('/').expect(200);
    return agent.post('/auth/login')
      .type('form')
      .send({ _csrf: csrfToken(home), email, password })
      .expect(302);
  }

  test('le contrôle de santé confirme la base et les stockages persistants', async () => {
    const response = await request(app).get('/health').expect(200);
    assert.equal(response.body.status, 'healthy');
  });

  test('la connexion échoue explicitement avec un mauvais mot de passe', async () => {
    const agent = request.agent(app);
    const loginResponse = await login(agent, firstUser.email, 'mauvais-mot-de-passe');
    assert.equal(loginResponse.headers.location, '/?auth=login');
    const response = await agent.get('/?auth=login').expect(200);
    assert.match(response.text, /Adresse email ou mot de passe incorrect/);
  });

  test('un membre connecté reste exclu de l’administration', async () => {
    const agent = request.agent(app);
    await login(agent, firstUser.email);
    await agent.get('/booking').expect(200);
    await agent.get('/admindashboard').expect(403);
  });

  test('la création d’une soirée affiche une erreur utile si la clôture est trop tardive', async () => {
    const agent = request.agent(app);
    await login(agent, admin.email);
    const form = await agent.get('/admindashboard/events/create').expect(200);
    const response = await agent.post('/admindashboard/events/create')
      .type('form')
      .send({
        _csrf: csrfToken(form),
        title: 'Soirée invalide',
        date: '2030-09-06T20:30',
        registrationDeadline: '2030-09-06T21:00',
        maxTable: '8',
        reservable: 'on',
      })
      .expect(422);
    assert.match(response.text, /La fin des inscriptions doit être antérieure/);
    assert.equal(await models.Event.count({ where: { title: 'Soirée invalide' } }), 0);
  });

  test('un administrateur attribue manuellement le droit de réserver', async () => {
    const unauthorizedAgent = request.agent(app);
    await login(unauthorizedAgent, firstUser.email);
    const bookingPage = await unauthorizedAgent.get('/booking').expect(200);
    await unauthorizedAgent.post('/tables/create')
      .type('form')
      .send({
        _csrf: csrfToken(bookingPage),
        eventId: event.id,
        tableNumber: 1,
        gameId: game.id,
        maxPlayers: 4,
      })
      .expect(302)
      .expect('Location', '/booking?error=table-booking-not-authorized');

    const adminAgent = request.agent(app);
    await login(adminAgent, admin.email);
    const memberList = await adminAgent.get('/admindashboard/members').expect(200);
    await adminAgent
      .post(`/admindashboard/members/${firstUser.id}/table-booking-permission`)
      .type('form')
      .send({ _csrf: csrfToken(memberList), canBookTables: 'on' })
      .expect(302)
      .expect('Location', '/admindashboard/members');

    await firstUser.reload();
    assert.equal(firstUser.canBookTables, true);
  });

  test('une réservation peut être créée puis discutée par un autre membre', async () => {
    const hostAgent = request.agent(app);
    await login(hostAgent, firstUser.email);
    const bookingPage = await hostAgent.get('/booking').expect(200);
    await hostAgent.post('/tables/create')
      .type('form')
      .send({
        _csrf: csrfToken(bookingPage),
        eventId: event.id,
        tableNumber: 1,
        gameId: game.id,
        maxPlayers: 4,
      })
      .expect(302)
      .expect('Location', '/booking?message=table-created');

    const gameTable = await models.GameTable.findOne({ where: { eventId: event.id, tableNumber: 1 } });
    assert.ok(gameTable);

    const visitorAgent = request.agent(app);
    await login(visitorAgent, secondUser.email);
    const visitorBooking = await visitorAgent.get('/booking').expect(200);
    await visitorAgent.post(`/tables/${gameTable.id}/comments`)
      .type('form')
      .send({ _csrf: csrfToken(visitorBooking), content: 'Je suis intéressée, quel format prévoyez-vous ?' })
      .expect(302);
    assert.equal(await models.TableComment.count({ where: { gameTableId: gameTable.id, playerId: secondUser.id } }), 1);
  });

  test('un admin peut importer un logo avec CSRF multipart', async () => {
    const agent = request.agent(app);
    await login(agent, admin.email);
    const form = await agent.get('/admindashboard/games/create').expect(200);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    await agent.post('/admindashboard/games/create')
      .field('_csrf', csrfToken(form))
      .field('name', 'Jeu avec logo')
      .field('minPlayers', '1')
      .field('maxPlayers', '4')
      .attach('image', png, { filename: 'logo.png', contentType: 'image/png' })
      .expect(302);

    const createdGame = await models.Game.findOne({ where: { name: 'Jeu Avec Logo' } });
    assert.match(createdGame.imageUrl, /^\/uploads\/games\/[0-9a-f-]+\.png$/);
    const storedFiles = await fs.readdir(path.join(process.env.UPLOAD_ROOT, 'games'));
    assert.equal(storedFiles.length, 1);
    await agent.get(createdGame.imageUrl).expect(200).expect('Content-Type', /image\/png/);
  });

  test('l’archivage conserve les données finales et produit le JSON', async () => {
    const result = await models.BookingArchive.archiveEvent(event.id);
    assert.equal(result.archive.snapshot.statistics.tablesUsed, 1);
    assert.equal(result.archive.snapshot.statistics.registeredPlayers, 1);
    const archiveContents = JSON.parse(await fs.readFile(result.archive.getFilePath(), 'utf8'));
    assert.equal(archiveContents.event.id, event.id);
    assert.equal(await models.GameTable.count({ where: { eventId: event.id } }), 0);
  });
});
