import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { db, startApp, nextEvent } from './helpers.js';

let app;
let call;
let managerToken;
let restaurantId;
let slug;
let menuItemId;

function tableOf(tableNumber) {
  return db.prepare('SELECT id, table_token, current_order_id FROM dining_tables WHERE restaurant_id = ? AND table_number = ?').get(restaurantId, tableNumber);
}

async function placeOrder(tableNumber) {
  const res = await call('/api/public/orders', { method: 'POST', body: { restaurant_slug: slug, table_token: tableOf(tableNumber).table_token, items: [{ menu_item_id: menuItemId, quantity: 2 }] } });
  assert.equal(res.status, 201);
  assert.equal(res.body.order.status, 'PENDING');
  return res.body.order;
}

function setStatus(orderId, status) {
  return call(`/api/manager/orders/${orderId}/status`, { token: managerToken, method: 'PATCH', body: { status } });
}

async function serve(orderId) {
  for (const status of ['PREPARING', 'READY', 'SERVED']) assert.equal((await setStatus(orderId, status)).status, 200);
}

function requestPayment(order, method) {
  return call(`/api/public/orders/${order.public_id}/payment-request`, { method: 'POST', body: { payment_method: method } });
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

test('order flow: Pending → Preparing → Ready → Served → Payment, seen live by the customer', async () => {
  const order = await placeOrder('1');
  const customer = await app.socket();
  assert.deepEqual(await customer.emitWithAck('joinOrder', order.public_id), { ok: true });

  assert.equal((await requestPayment(order, 'CASH')).status, 409, 'payment before serving must be refused');

  for (const status of ['PREPARING', 'READY', 'SERVED']) {
    const update = nextEvent(customer, 'order:updated');
    assert.equal((await setStatus(order.id, status)).status, 200);
    assert.equal((await update).status, status);
  }

  const update = nextEvent(customer, 'order:updated');
  const paid = await requestPayment(order, 'CASH');
  assert.equal(paid.status, 200);
  assert.equal(paid.body.order.status, 'PAYMENT_WAITING');
  assert.equal((await update).payment_status, 'WAITING_APPROVAL');
});

test('card and IBAN transfer payments are approved automatically', async () => {
  for (const [tableNumber, method] of [['2', 'CARD'], ['3', 'TRANSFER']]) {
    const order = await placeOrder(tableNumber);
    await serve(order.id);
    const res = await requestPayment(order, method);
    assert.equal(res.status, 200, method);
    assert.equal(res.body.auto_approved, true, method);
    assert.equal(res.body.order.status, 'COMPLETED', method);
    assert.equal(res.body.order.payment_status, 'APPROVED', method);
    assert.equal(tableOf(tableNumber).current_order_id, null, `${method}: table session should be cleared`);
  }
});

test('cash payment waits for manual manager approval', async () => {
  const order = await placeOrder('4');
  await serve(order.id);
  const res = await requestPayment(order, 'CASH');
  assert.equal(res.status, 200);
  assert.equal(res.body.auto_approved, false);
  assert.equal(res.body.order.status, 'PAYMENT_WAITING');
  assert.equal(tableOf('4').current_order_id, order.id, 'table stays open until approval');

  assert.equal((await setStatus(order.id, 'COMPLETED')).status, 409, 'cannot skip approval via status change');
  assert.equal((await call(`/api/manager/orders/${order.id}/payment/approve`, { method: 'POST' })).status, 401);

  const approved = await call(`/api/manager/orders/${order.id}/payment/approve`, { token: managerToken, method: 'POST' });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.order.status, 'COMPLETED');
  assert.equal(approved.body.order.payment_status, 'APPROVED');
  assert.equal(approved.body.table_cleared, true);
  assert.equal(tableOf('4').current_order_id, null);
});
