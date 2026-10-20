import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import jwt from 'jsonwebtoken';
import { db, startApp, nextEvent, record } from './helpers.js';

let app;
let call;
let managerToken;
let restaurantId;
let slug;
let menuItemId;

async function placeOrder(tableNumber) {
  const { table_token } = db.prepare('SELECT table_token FROM dining_tables WHERE restaurant_id = ? AND table_number = ?').get(restaurantId, tableNumber);
  const res = await call('/api/public/orders', { method: 'POST', body: { restaurant_slug: slug, table_token, items: [{ menu_item_id: menuItemId, quantity: 1 }] } });
  assert.equal(res.status, 201);
  return res.body.order;
}

before(async () => {
  app = await startApp();
  ({ call } = app);
  const manager = await app.login('manager@local.test', 'manager123!');
  managerToken = manager.token;
  restaurantId = manager.user.restaurant_id;
  slug = db.prepare('SELECT slug FROM restaurants WHERE id = ?').get(restaurantId).slug;
  menuItemId = db.prepare('SELECT id FROM menu_items WHERE restaurant_id = ? LIMIT 1').get(restaurantId).id;
});

after(() => app.close());

test('bad or forged tokens are rejected at the socket handshake', async () => {
  await assert.rejects(app.socket('not-a-jwt'), /Invalid or expired token/);
  await assert.rejects(app.socket(jwt.sign({ id: 1, role: 'ADMIN' }, 'local-development-secret')), /Invalid or expired token/);
  await assert.rejects(app.socket(jwt.sign({ id: 99999 }, process.env.JWT_SECRET)), /Invalid user/);
});

test('an anonymous socket cannot join a restaurant room', async () => {
  const anonymous = await app.socket();
  const manager = await app.socket(managerToken);
  assert.deepEqual(await anonymous.emitWithAck('joinRestaurant', restaurantId), { ok: false });
  assert.deepEqual(await manager.emitWithAck('joinRestaurant', restaurantId), { ok: true });

  const leaked = record(anonymous, 'orders:changed');
  const managerSees = nextEvent(manager, 'orders:changed');
  await placeOrder('5');
  await managerSees;
  await delay(150);
  assert.equal(leaked.length, 0);
});

test('admins cannot join restaurant rooms', async () => {
  const admin = await app.socket((await app.login('admin@local.test', 'admin123!')).token);
  assert.deepEqual(await admin.emitWithAck('joinRestaurant', restaurantId), { ok: false });
});

test('manager A cannot join manager B\'s restaurant room', async () => {
  const { token: adminToken } = await app.login('admin@local.test', 'admin123!');
  const created = await call('/api/admin/restaurants', { token: adminToken, method: 'POST', body: { name: 'Second Cafe', address: 'Campus B', phone: '+90 555 111 2233' } });
  assert.equal(created.status, 201);
  const otherId = created.body.restaurant.id;
  const managerB = await call('/api/admin/managers', { token: adminToken, method: 'POST', body: { name: 'Manager B', email: 'b@local.test', password: 'manager-b1!', restaurant_id: otherId } });
  assert.equal(managerB.status, 201);
  const { token: managerBToken } = await app.login('b@local.test', 'manager-b1!');

  const socketA = await app.socket(managerToken);
  const socketB = await app.socket(managerBToken);
  assert.deepEqual(await socketA.emitWithAck('joinRestaurant', otherId), { ok: false });
  assert.deepEqual(await socketA.emitWithAck('joinRestaurant', restaurantId), { ok: true });
  assert.deepEqual(await socketB.emitWithAck('joinRestaurant', otherId), { ok: true });

  const leaked = record(socketA, 'tables:changed');
  const managerBSees = nextEvent(socketB, 'tables:changed');
  const table = await call('/api/manager/tables', { token: managerBToken, method: 'POST', body: { table_number: '1', capacity: 2 } });
  assert.equal(table.status, 201);
  await managerBSees;
  await delay(150);
  assert.equal(leaked.length, 0);
});

test('a customer only receives updates for their own order, without internal fields', async () => {
  const orderA = await placeOrder('6');
  const orderB = await placeOrder('7');
  const customerA = await app.socket();
  const customerB = await app.socket();
  assert.deepEqual(await customerA.emitWithAck('joinOrder', orderA.public_id), { ok: true });
  assert.deepEqual(await customerB.emitWithAck('joinOrder', orderB.public_id), { ok: true });
  assert.deepEqual(await customerB.emitWithAck('joinOrder', 'guessed-order-id'), { ok: false });

  const leaked = record(customerB, 'order:updated');
  const update = nextEvent(customerA, 'order:updated');
  const res = await call(`/api/manager/orders/${orderA.id}/status`, { token: managerToken, method: 'PATCH', body: { status: 'PREPARING' } });
  assert.equal(res.status, 200);

  const payload = await update;
  assert.equal(payload.public_id, orderA.public_id);
  assert.equal(payload.status, 'PREPARING');
  for (const field of ['id', 'restaurant_id', 'table_id', 'payment', 'restaurant_name', 'created_at']) {
    assert.equal(field in payload, false, `socket payload leaks ${field}`);
  }
  await delay(150);
  assert.equal(leaked.length, 0);
});
