import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { db, now, startApp } from './helpers.js';
import { resolveJwtSecret } from '../src/auth.js';

let app;
let call;
let adminToken;
let managerToken;
let manager;

before(async () => {
  app = await startApp();
  ({ call } = app);
  adminToken = (await app.login('admin@local.test', 'admin123!')).token;
  ({ token: managerToken, user: manager } = await app.login('manager@local.test', 'manager123!'));
});

after(() => app.close());

test('JWT secret: local demo without a secret falls back to a generated one', () => {
  assert.equal(resolveJwtSecret({}), null);
  assert.equal(resolveJwtSecret({ JWT_SECRET: 'change-this-local-secret' }), null);
  assert.equal(resolveJwtSecret({ PUBLIC_APP_URL: 'http://192.168.1.20:5173' }), null);
  assert.equal(resolveJwtSecret({ JWT_SECRET: 'short-but-chosen' }), 'short-but-chosen');
});

test('JWT secret: production or public URL refuses to start without a strong secret', () => {
  const strong = 'a'.repeat(32);
  for (const env of [
    { NODE_ENV: 'production' },
    { NODE_ENV: 'production', JWT_SECRET: 'local-development-secret' },
    { NODE_ENV: 'production', JWT_SECRET: 'too-short' },
    { PUBLIC_APP_URL: 'https://campuseats.trycloudflare.com' }
  ]) {
    assert.throws(() => resolveJwtSecret(env), /JWT_SECRET must be/, JSON.stringify(env));
  }
  assert.equal(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: strong }), strong);
  assert.equal(resolveJwtSecret({ PUBLIC_APP_URL: 'https://example.com', JWT_SECRET: strong }), strong);
});

test('protected routes reject missing, forged, expired and orphaned tokens', async () => {
  const secret = process.env.JWT_SECRET;
  const forged = jwt.sign({ id: 1, role: 'ADMIN' }, 'local-development-secret');
  const expired = jwt.sign({ id: 1, role: 'ADMIN', exp: Math.floor(Date.now() / 1000) - 60 }, secret);
  const deletedUser = jwt.sign({ id: 99999, role: 'ADMIN' }, secret);
  for (const token of [undefined, 'not-a-jwt', forged, expired, deletedUser]) {
    assert.equal((await call('/api/admin/restaurants', { token })).status, 401);
    assert.equal((await call('/api/manager/tables', { token })).status, 401);
  }
});

test('roles are enforced from the database, not the token claims', async () => {
  assert.equal((await call('/api/admin/restaurants', { token: adminToken })).status, 200);
  assert.equal((await call('/api/manager/tables', { token: managerToken })).status, 200);
  assert.equal((await call('/api/admin/managers', { token: managerToken })).status, 403);
  assert.equal((await call('/api/manager/dashboard', { token: adminToken })).status, 403);

  const claimsAdmin = jwt.sign({ id: manager.id, role: 'ADMIN' }, process.env.JWT_SECRET);
  assert.equal((await call('/api/admin/restaurants', { token: claimsAdmin })).status, 403);
});

test('a manager cannot touch another restaurant\'s tables', async () => {
  const rid = db.prepare('INSERT INTO restaurants (name, slug, created_at) VALUES (?, ?, ?)').run('Other', 'other', now()).lastInsertRowid;
  const tid = db.prepare('INSERT INTO dining_tables (restaurant_id, table_number, table_token, created_at) VALUES (?, ?, ?, ?)').run(rid, '1', 'other-token', now()).lastInsertRowid;

  const res = await call(`/api/manager/tables/${tid}`, { token: managerToken, method: 'PATCH', body: { capacity: 9 } });
  assert.equal(res.status, 404);
  assert.equal((await call(`/api/manager/tables/${tid}`, { token: managerToken, method: 'DELETE' })).status, 404);
  assert.equal(db.prepare('SELECT capacity FROM dining_tables WHERE id = ?').get(tid).capacity, 4);
});
