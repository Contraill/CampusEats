import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-0123456789abcdef0123456789abcdef';
delete process.env.NODE_ENV;
delete process.env.PUBLIC_APP_URL;

const { default: express } = await import('express');
const { default: jwt } = await import('jsonwebtoken');
const { db, initDb, now } = await import('../src/database.js');
const { resolveJwtSecret } = await import('../src/auth.js');
const { default: authRoutes } = await import('../src/routes/authRoutes.js');
const { default: adminRoutes } = await import('../src/routes/adminRoutes.js');
const { default: managerRoutes } = await import('../src/routes/managerRoutes.js');

let server;
let base;
let adminToken;
let managerToken;
let manager;

async function call(path, { token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function login(email, password) {
  const res = await call('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(res.status, 200);
  return res.body;
}

before(async () => {
  initDb();
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/manager', managerRoutes);
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  adminToken = (await login('admin@local.test', 'admin123!')).token;
  ({ token: managerToken, user: manager } = await login('manager@local.test', 'manager123!'));
});

after(() => server.close());

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
