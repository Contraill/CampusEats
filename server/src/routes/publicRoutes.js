import express from 'express';
import { z } from 'zod';
import { db, getFullOrder, now, randomToken } from '../database.js';
import { validate } from '../validation.js';

const router = express.Router();
const TAX_RATE = 0.10;

function getRestaurantAndTable(slug, token) {
  return db.prepare(`
    SELECT r.id AS restaurant_id, r.name AS restaurant_name, r.slug, r.address, r.phone,
           t.id AS table_id, t.table_number, t.table_token, t.is_active, t.current_order_id
    FROM restaurants r
    JOIN dining_tables t ON t.restaurant_id = r.id
    WHERE r.slug = ? AND t.table_token = ?
  `).get(slug, token);
}

function publicMenu(restaurantId) {
  const categories = db.prepare(`
    SELECT id, name, sort_order
    FROM categories
    WHERE restaurant_id = ? AND is_active = 1
    ORDER BY sort_order, name
  `).all(restaurantId);

  const items = db.prepare(`
    SELECT id, category_id, name, description, price, image_url, emoji, is_available
    FROM menu_items
    WHERE restaurant_id = ? AND is_available = 1
    ORDER BY name
  `).all(restaurantId);

  return { categories, items };
}

function normalizeOrderItems(restaurantId, requestedItems) {
  const itemIds = requestedItems.map((item) => item.menu_item_id);
  const placeholders = itemIds.map(() => '?').join(',');
  const menuItems = db.prepare(`
    SELECT id, name, price, is_available
    FROM menu_items
    WHERE restaurant_id = ? AND id IN (${placeholders})
  `).all(restaurantId, ...itemIds);

  const menuById = new Map(menuItems.map((item) => [item.id, item]));
  const normalizedItems = [];
  let subtotal = 0;

  for (const requested of requestedItems) {
    const menuItem = menuById.get(requested.menu_item_id);
    if (!menuItem || !menuItem.is_available) {
      const error = new Error(`Menu item ${requested.menu_item_id} is not available.`);
      error.statusCode = 400;
      throw error;
    }
    const lineTotal = Number(menuItem.price) * Number(requested.quantity);
    subtotal += lineTotal;
    normalizedItems.push({ ...requested, menuItem });
  }

  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  return { normalizedItems, subtotal, tax, total };
}

function insertOrderItems(orderId, normalizedItems) {
  const itemStmt = db.prepare(`
    INSERT INTO order_items (order_id, menu_item_id, name_snapshot, quantity, unit_price, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const item of normalizedItems) {
    itemStmt.run(orderId, item.menu_item_id, item.menuItem.name, item.quantity, item.menuItem.price, item.note || '');
  }
}

function findRestaurantForHelp(slug) {
  if (slug) {
    const exact = db.prepare('SELECT * FROM restaurants WHERE slug = ?').get(slug);
    if (exact) return exact;
  }
  return db.prepare('SELECT * FROM restaurants ORDER BY id LIMIT 1').get();
}

function createServiceRequest({ app, restaurant, tableToken = '', tableNumber = '', type = 'WAITER', message = '' }) {
  let table = null;
  if (tableToken) {
    table = db.prepare('SELECT id, table_number FROM dining_tables WHERE restaurant_id = ? AND table_token = ?').get(restaurant.id, tableToken);
  }
  if (!table && tableNumber) {
    table = db.prepare('SELECT id, table_number FROM dining_tables WHERE restaurant_id = ? AND table_number = ?').get(restaurant.id, tableNumber);
  }

  if (table) {
    const open = db.prepare(`
      SELECT * FROM service_requests
      WHERE restaurant_id = ? AND table_id = ? AND type = ? AND status = 'OPEN'
      ORDER BY created_at DESC LIMIT 1
    `).get(restaurant.id, table.id, type);
    if (open) return { request: open, duplicated: true };
  }

  const info = db.prepare(`
    INSERT INTO service_requests (restaurant_id, table_id, table_number, type, message, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'OPEN', ?)
  `).run(
    restaurant.id,
    table?.id || null,
    table?.table_number || tableNumber || '',
    type,
    message,
    now()
  );

  const request = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(info.lastInsertRowid);
  app.get('io')?.to(`restaurant:${restaurant.id}`).emit('support:changed', { request });
  return { request, duplicated: false };
}

router.get('/restaurants/:slug/tables/:token/bootstrap', (req, res) => {
  const table = getRestaurantAndTable(req.params.slug, req.params.token);
  if (!table) return res.status(404).json({ message: 'QR code is not valid.' });
  if (!table.is_active) return res.status(403).json({ message: 'This table is not active.' });

  const restaurant = { id: table.restaurant_id, name: table.restaurant_name, slug: table.slug, address: table.address, phone: table.phone };
  const active_order = table.current_order_id ? getFullOrder(table.current_order_id) : null;
  res.json({ restaurant, table, active_order, menu: publicMenu(table.restaurant_id), tax_rate: TAX_RATE });
});

router.get('/restaurants/:slug/menu', (req, res) => {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE slug = ?').get(req.params.slug);
  if (!restaurant) return res.status(404).json({ message: 'Restaurant not found.' });
  res.json({ restaurant, menu: publicMenu(restaurant.id), tax_rate: TAX_RATE });
});

router.post('/orders', validate(z.object({
  restaurant_slug: z.string().min(1),
  table_token: z.string().min(8),
  append_to_active: z.boolean().optional().default(false),
  items: z.array(z.object({
    menu_item_id: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(20),
    note: z.string().max(200).optional().default('')
  })).min(1)
})), (req, res, next) => {
  try {
    const table = getRestaurantAndTable(req.body.restaurant_slug, req.body.table_token);
    if (!table) return res.status(404).json({ message: 'QR code is not valid.' });
    if (!table.is_active) return res.status(403).json({ message: 'This table is not active.' });

    const activeOrder = table.current_order_id ? getFullOrder(table.current_order_id) : null;
    const { normalizedItems, total } = normalizeOrderItems(table.restaurant_id, req.body.items);
    const createdAt = now();

    if (activeOrder && !['COMPLETED', 'CANCELLED'].includes(activeOrder.status)) {
      if (!req.body.append_to_active) return res.status(409).json({ message: 'This table already has an active order.', active_order: activeOrder });
      if (activeOrder.payment_status !== 'NOT_REQUESTED') return res.status(409).json({ message: 'This order is already in payment process.', active_order: activeOrder });

      db.transaction(() => {
        insertOrderItems(activeOrder.id, normalizedItems);
        db.prepare('UPDATE orders SET total_price = ROUND(total_price + ?, 2), updated_at = ? WHERE id = ?')
          .run(Number(total.toFixed(2)), createdAt, activeOrder.id);
      })();

      const full = getFullOrder(activeOrder.id);
      req.app.get('io')?.to(`restaurant:${table.restaurant_id}`).emit('orders:changed', { order: full });
      req.app.get('io')?.to(`order:${full.public_id}`).emit('order:updated', full);
      return res.status(200).json({ order: full, appended: true });
    }

    const publicId = randomToken(12);
    const createOrder = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO orders (public_id, restaurant_id, table_id, order_number, status, total_price, payment_status, created_at, updated_at)
        VALUES (?, ?, ?, 'TEMP', 'PENDING', ?, 'NOT_REQUESTED', ?, ?)
      `).run(publicId, table.restaurant_id, table.table_id, Number(total.toFixed(2)), createdAt, createdAt);

      const orderId = Number(info.lastInsertRowid);
      const orderNumber = `#${String(orderId).padStart(5, '0')}`;
      db.prepare('UPDATE orders SET order_number = ? WHERE id = ?').run(orderNumber, orderId);
      insertOrderItems(orderId, normalizedItems);
      db.prepare('UPDATE dining_tables SET current_order_id = ? WHERE id = ?').run(orderId, table.table_id);
      return orderId;
    });

    const orderId = createOrder();
    const full = getFullOrder(orderId);
    req.app.get('io')?.to(`restaurant:${table.restaurant_id}`).emit('orders:changed', { order: full });
    req.app.get('io')?.to(`restaurant:${table.restaurant_id}`).emit('tables:changed', { table_id: table.table_id });
    res.status(201).json({ order: full });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  }
});

router.get('/orders/:publicId', (req, res) => {
  const order = db.prepare('SELECT id FROM orders WHERE public_id = ?').get(req.params.publicId);
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  res.json({ order: getFullOrder(order.id) });
});

router.post('/orders/:publicId/payment-request', validate(z.object({
  payment_method: z.enum(['CASH', 'CARD', 'TRANSFER']).default('CASH')
})), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE public_id = ?').get(req.params.publicId);
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  if (['COMPLETED', 'CANCELLED'].includes(order.status)) return res.status(409).json({ message: 'This order is already closed.' });
  if (order.status !== 'SERVED' && order.status !== 'PAYMENT_REJECTED') return res.status(409).json({ message: 'Payment can be requested after the order is served.' });

  const fullBefore = getFullOrder(order.id);
  const templateData = JSON.stringify({
    title: 'Payment Confirmation', restaurant: fullBefore.restaurant_name, table: fullBefore.table_number,
    orderNumber: fullBefore.order_number, totalAmount: fullBefore.total_price, method: req.body.payment_method, status: 'Waiting for Approval'
  });

  const createdAt = now();
  const existingPayment = db.prepare('SELECT id FROM payments WHERE order_id = ?').get(order.id);
  if (existingPayment) {
    db.prepare(`UPDATE payments SET payment_method = ?, amount = ?, status = 'WAITING_APPROVAL', template_data = ?, rejection_reason = NULL WHERE order_id = ?`)
      .run(req.body.payment_method, order.total_price, templateData, order.id);
  } else {
    db.prepare(`INSERT INTO payments (order_id, payment_method, amount, status, template_data, created_at) VALUES (?, ?, ?, 'WAITING_APPROVAL', ?, ?)`)
      .run(order.id, req.body.payment_method, order.total_price, templateData, createdAt);
  }

  db.prepare(`UPDATE orders SET status = 'PAYMENT_WAITING', payment_status = 'WAITING_APPROVAL', updated_at = ? WHERE id = ?`).run(createdAt, order.id);

  const full = getFullOrder(order.id);
  req.app.get('io')?.to(`restaurant:${order.restaurant_id}`).emit('orders:changed', { order: full });
  req.app.get('io')?.to(`order:${full.public_id}`).emit('order:updated', full);
  res.json({ order: full });
});

router.post('/restaurants/:slug/service-requests', validate(z.object({
  table_token: z.string().optional().default(''),
  table_number: z.string().trim().max(30).optional().default(''),
  type: z.enum(['WAITER', 'QR_HELP']).default('WAITER'),
  message: z.string().trim().max(250).optional().default('')
})), (req, res) => {
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE slug = ?').get(req.params.slug);
  if (!restaurant) return res.status(404).json({ message: 'Restaurant not found.' });
  const result = createServiceRequest({ app: req.app, restaurant, tableToken: req.body.table_token, tableNumber: req.body.table_number, type: req.body.type, message: req.body.message });
  res.status(result.duplicated ? 200 : 201).json(result);
});

router.post('/qr-help', validate(z.object({
  restaurant_slug: z.string().trim().optional().default(''),
  table_number: z.string().trim().min(1).max(30),
  message: z.string().trim().max(250).optional().default('QR code problem.')
})), (req, res) => {
  const restaurant = findRestaurantForHelp(req.body.restaurant_slug);
  if (!restaurant) return res.status(404).json({ message: 'Restaurant not found.' });
  const result = createServiceRequest({ app: req.app, restaurant, tableNumber: req.body.table_number, type: 'QR_HELP', message: req.body.message });
  res.status(result.duplicated ? 200 : 201).json({ ...result, restaurant_slug: restaurant.slug });
});

export default router;
