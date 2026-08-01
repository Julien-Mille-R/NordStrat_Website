import assert from 'node:assert/strict';
import test from 'node:test';
import { isMultipartCsrfRoute, requireAdmin, requireUser } from '../../controller/access.controller.js';

test('les seules routes multipart attendues délèguent le CSRF à Multer', () => {
  const allowed = [
    '/account/avatar',
    '/admindashboard/assaut-de-bruay/save',
    '/admindashboard/games/create',
    '/admindashboard/games/42/update',
    '/admindashboard/news/create',
    '/admindashboard/news/42/update',
  ];
  allowed.forEach((pathname) => assert.equal(isMultipartCsrfRoute(pathname), true, pathname));
  assert.equal(isMultipartCsrfRoute('/admindashboard/games/not-a-number/update'), false);
  assert.equal(isMultipartCsrfRoute('/admindashboard/members'), false);
  assert.equal(isMultipartCsrfRoute('/tables/create'), false);
});

test('requireUser refuse un visiteur et conserve un message explicite', () => {
  const req = { currentUser: null, session: {} };
  const res = { redirectPath: null, redirect(pathname) { this.redirectPath = pathname; } };
  requireUser(req, res, () => assert.fail('next ne doit pas être appelé'));
  assert.equal(res.redirectPath, '/?auth=login');
  assert.equal(req.session.flash.type, 'error');
});

test('requireAdmin renvoie 403 à un membre non administrateur', () => {
  const req = { currentUser: { role: { name: 'User' } }, session: {} };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; },
  };
  requireAdmin(req, res, () => assert.fail('next ne doit pas être appelé'));
  assert.equal(res.statusCode, 403);
  assert.equal(res.body, 'Accès interdit.');
});
