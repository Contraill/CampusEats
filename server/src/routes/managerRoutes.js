import express from 'express';
import QRCode from 'qrcode';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { db, getActiveOrdersForTable, getFullOrder, now, randomToken, setTableCurrentOrderToLatestActive, uploadDir } from '../database.js';
import { authRequired, requireManagerRestaurant, requireRole } from '../auth.js';
import { validate, localizedError } from '../validation.js';

const router = express.Router();
const TAX_RATE = 0.10;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  }
});

router.use(authRequired, requireRole('RESTAURANT_MANAGER'), requireManagerRestaurant);

function restaurantId(req) {
  return Number(req.user.restaurant_id);
}

function assertOwnTable(req, tableId) {
  return db.prepare('SELECT * FROM dining_tables WHERE id = ? AND restaurant_id = ?').get(tableId, restaurantId(req));
}

function assertOwnOrder(req, orderId) {
  return db.prepare('SELECT * FROM orders WHERE id = ? AND restaurant_id = ?').get(orderId, restaurantId(req));
}

function emitRestaurant(req, event, payload) {
  req.app.get('io')?.to(`restaurant:${restaurantId(req)}`).emit(event, payload);
}

function deleteMenuImage(imageUrl) {
  if (!imageUrl || !String(imageUrl).startsWith('/uploads/menu/')) return;
  const file = path.basename(imageUrl);
  const target = path.join(uploadDir, file);
  fs.promises.unlink(target).catch(() => undefined);
}

async function saveMenuImage(file) {
  if (!file) return null;
  const filename = `${Date.now()}-${randomToken(8)}.webp`;
  const target = path.join(uploadDir, filename);
  try {
    await sharp(file.buffer, { failOn: 'warning' })
      .rotate()
      .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88, effort: 5 })
      .toFile(target);
    return `/uploads/menu/${filename}`;
  } catch (error) {
    const uploadError = new Error('Uploaded file is not a valid image.');
    uploadError.statusCode = 400;
    throw uploadError;
  }
}

function paymentTemplateFor(order, method = 'TEMPLATE') {
  const full = getFullOrder(order.id);
  return JSON.stringify({
    title: 'Payment Confirmation',
    restaurant: full.restaurant_name,
    table: full.table_number,
    orderNumber: full.order_number,
    totalAmount: full.total_price,
    method,
    status: 'Waiting for Approval'
  });
}

router.get('/dashboard', (req, res) => {
  const rid = restaurantId(req);
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const restaurant = db.prepare('SELECT id, name, slug, address, phone FROM restaurants WHERE id = ?').get(rid);

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN payment_status = 'APPROVED' THEN total_price ELSE 0 END), 0) AS approved_revenue,
      COUNT(*) AS total_orders,
      SUM(CASE WHEN status IN ('PENDING', 'PREPARING', 'READY', 'SERVED') THEN 1 ELSE 0 END) AS active_orders,
      SUM(CASE WHEN payment_status = 'WAITING_APPROVAL' THEN 1 ELSE 0 END) AS waiting_payments,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_orders
    FROM orders
    WHERE restaurant_id = ?
  `).get(rid);

  const today = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN payment_status = 'APPROVED' THEN total_price ELSE 0 END), 0) AS revenue,
      COUNT(*) AS orders
    FROM orders
    WHERE restaurant_id = ? AND substr(created_at, 1, 10) = ?
  `).get(rid, todayPrefix);

  const bestSellers = db.prepare(`
    SELECT oi.name_snapshot AS name, SUM(oi.quantity) AS quantity, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.restaurant_id = ?
    GROUP BY oi.name_snapshot
    ORDER BY quantity DESC
    LIMIT 5
  `).all(rid);

  const tableStats = db.prepare(`
    SELECT t.table_number, COUNT(o.id) AS order_count, COALESCE(SUM(o.total_price), 0) AS total
    FROM dining_tables t
    LEFT JOIN orders o ON o.table_id = t.id
    WHERE t.restaurant_id = ?
    GROUP BY t.id
    ORDER BY CAST(t.table_number AS INTEGER), t.table_number
  `).all(rid);

  const dailyRevenue = db.prepare(`
    SELECT substr(created_at, 1, 10) AS day, ROUND(SUM(CASE WHEN payment_status = 'APPROVED' THEN total_price ELSE 0 END), 2) AS revenue, COUNT(*) AS orders
    FROM orders
    WHERE restaurant_id = ?
    GROUP BY substr(created_at, 1, 10)
    ORDER BY day DESC
    LIMIT 7
  `).all(rid).reverse();

  res.json({ restaurant, totals, today, bestSellers, tableStats, dailyRevenue });
});

router.get('/tables', (req, res) => {
  const rid = restaurantId(req);
  const appUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
  const restaurant = db.prepare('SELECT slug FROM restaurants WHERE id = ?').get(rid);
  const tables = db.prepare(`
    SELECT t.*, o.order_number AS current_order_number, o.status AS current_order_status, o.payment_status AS current_payment_status
    FROM dining_tables t
    LEFT JOIN orders o ON o.id = t.current_order_id
    WHERE t.restaurant_id = ?
    ORDER BY CAST(t.table_number AS INTEGER), t.table_number
  `).all(rid).map((table) => ({
    ...table,
    qr_url: `${appUrl}/r/${restaurant.slug}/table/${table.table_token}`
  }));

  res.json({ tables });
});

router.post('/tables', validate(z.object({
  table_number: z.string().trim().min(1),
  capacity: z.coerce.number().int().min(1).max(50).default(4)
})), (req, res) => {
  const rid = restaurantId(req);
  try {
    const info = db.prepare(`
      INSERT INTO dining_tables (restaurant_id, table_number, table_token, capacity, is_active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(rid, req.body.table_number, randomToken(12), req.body.capacity, now());

    const table = db.prepare('SELECT * FROM dining_tables WHERE id = ?').get(info.lastInsertRowid);
    emitRestaurant(req, 'tables:changed', { table });
    res.status(201).json({ table });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ message: 'This table number already exists.' });
    }
    throw error;
  }
});

router.patch('/tables/:id', validate(z.object({
  table_number: z.string().trim().min(1).optional(),
  capacity: z.coerce.number().int().min(1).max(50).optional(),
  is_active: z.boolean().optional()
})), (req, res) => {
  const table = assertOwnTable(req, Number(req.params.id));
  if (!table) return res.status(404).json({ message: 'Table not found.' });

  db.prepare(`
    UPDATE dining_tables
    SET table_number = COALESCE(?, table_number),
        capacity = COALESCE(?, capacity),
        is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    req.body.table_number ?? null,
    req.body.capacity ?? null,
    typeof req.body.is_active === 'boolean' ? Number(req.body.is_active) : null,
    table.id
  );

  const updated = db.prepare('SELECT * FROM dining_tables WHERE id = ?').get(table.id);
  emitRestaurant(req, 'tables:changed', { table: updated });
  res.json({ table: updated });
});

router.post('/tables/:id/clear', (req, res) => {
  const table = assertOwnTable(req, Number(req.params.id));
  if (!table) return res.status(404).json({ message: 'Table not found.' });

  const activeOrders = getActiveOrdersForTable(table.id);
  const clearedAt = now();
  db.transaction(() => {
    db.prepare(`
      UPDATE orders
      SET status = 'CANCELLED', updated_at = ?, completed_at = COALESCE(completed_at, ?)
      WHERE table_id = ? AND restaurant_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')
    `).run(clearedAt, clearedAt, table.id, restaurantId(req));
    db.prepare('UPDATE dining_tables SET current_order_id = NULL WHERE id = ?').run(table.id);
  })();

  emitRestaurant(req, 'tables:changed', { table_id: table.id });
  for (const active of activeOrders) {
    const full = getFullOrder(active.id);
    if (full) {
      emitRestaurant(req, 'orders:changed', { order: full });
      req.app.get('io')?.to(`order:${full.public_id}`).emit('order:updated', full);
    }
  }
  res.json({ ok: true, cancelled_order_ids: activeOrders.map((order) => order.id) });
});

router.post('/tables/:id/regenerate-qr', (req, res) => {
  const table = assertOwnTable(req, Number(req.params.id));
  if (!table) return res.status(404).json({ message: 'Table not found.' });
  if (getActiveOrdersForTable(table.id).length) return res.status(409).json({ message: 'Clear the table before regenerating QR.' });
  const token = randomToken(12);
  db.prepare('UPDATE dining_tables SET table_token = ? WHERE id = ?').run(token, table.id);
  const updated = db.prepare('SELECT * FROM dining_tables WHERE id = ?').get(table.id);
  emitRestaurant(req, 'tables:changed', { table: updated });
  res.json({ table: updated });
});

router.delete('/tables/:id', (req, res) => {
  const table = assertOwnTable(req, Number(req.params.id));
  if (!table) return res.status(404).json({ message: 'Table not found.' });
  if (getActiveOrdersForTable(table.id).length) return res.status(409).json({ message: 'Clear the active orders before deleting this table.' });
  db.prepare('DELETE FROM dining_tables WHERE id = ?').run(table.id);
  emitRestaurant(req, 'tables:changed', { table_id: table.id });
  res.json({ ok: true });
});

router.get('/tables/:id/qr', async (req, res, next) => {
  try {
    const table = assertOwnTable(req, Number(req.params.id));
    if (!table) return res.status(404).json({ message: 'Table not found.' });

    const appUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
    const restaurant = db.prepare('SELECT slug FROM restaurants WHERE id = ?').get(restaurantId(req));
    const qr_url = `${appUrl}/r/${restaurant.slug}/table/${table.table_token}`;
    const qr_data_url = await QRCode.toDataURL(qr_url, { margin: 2, width: 480 });
    res.json({ table, qr_url, qr_data_url });
  } catch (error) {
    next(error);
  }
});

router.get('/menu', (req, res) => {
  const rid = restaurantId(req);
  const categories = db.prepare(`
    SELECT * FROM categories WHERE restaurant_id = ? ORDER BY sort_order, name
  `).all(rid);
  const items = db.prepare(`
    SELECT mi.*, c.name AS category_name
    FROM menu_items mi
    JOIN categories c ON c.id = mi.category_id
    WHERE mi.restaurant_id = ?
    ORDER BY c.sort_order, mi.name
  `).all(rid);
  res.json({ categories, items });
});

router.post('/categories', validate(z.object({
  name: z.string().trim().min(2),
  sort_order: z.coerce.number().int().default(0)
})), (req, res) => {
  const info = db.prepare(`
    INSERT INTO categories (restaurant_id, name, sort_order, is_active)
    VALUES (?, ?, ?, 1)
  `).run(restaurantId(req), req.body.name, req.body.sort_order);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
  emitRestaurant(req, 'menu:changed', { category });
  res.status(201).json({ category });
});


router.patch('/categories/:id', validate(z.object({
  name: z.string().trim().min(2).optional(),
  sort_order: z.coerce.number().int().optional(),
  is_active: z.boolean().optional()
})), (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE id = ? AND restaurant_id = ?').get(Number(req.params.id), restaurantId(req));
  if (!category) return res.status(404).json({ message: 'Category not found.' });
  db.prepare(`
    UPDATE categories
    SET name = COALESCE(?, name),
        sort_order = COALESCE(?, sort_order),
        is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(
    req.body.name ?? null,
    req.body.sort_order ?? null,
    typeof req.body.is_active === 'boolean' ? Number(req.body.is_active) : null,
    category.id
  );
  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(category.id);
  emitRestaurant(req, 'menu:changed', { category: updated });
  res.json({ category: updated });
});

router.delete('/categories/:id', (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE id = ? AND restaurant_id = ?').get(Number(req.params.id), restaurantId(req));
  if (!category) return res.status(404).json({ message: 'Category not found.' });
  const itemCount = db.prepare('SELECT COUNT(*) AS count FROM menu_items WHERE category_id = ?').get(category.id).count;
  if (itemCount > 0) return res.status(409).json({ message: 'Move or delete the items in this category first.' });
  db.prepare('DELETE FROM categories WHERE id = ?').run(category.id);
  emitRestaurant(req, 'menu:changed', { category_id: category.id });
  res.json({ ok: true });
});

router.post('/menu-items', upload.single('image'), async (req, res, next) => {
  try {
    const body = z.object({
      category_id: z.coerce.number().int().positive(),
      name: z.string().trim().min(2),
      description: z.string().optional().default(''),
      price: z.coerce.number().positive(),
      emoji: z.string().optional().default('🍽️'),
      is_available: z.coerce.boolean().optional().default(true)
    }).parse(req.body);

    const category = db.prepare('SELECT id FROM categories WHERE id = ? AND restaurant_id = ?').get(body.category_id, restaurantId(req));
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    const imageUrl = await saveMenuImage(req.file);

    const info = db.prepare(`
      INSERT INTO menu_items (restaurant_id, category_id, name, description, price, emoji, image_url, is_available, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      restaurantId(req), body.category_id, body.name, body.description, body.price, body.emoji,
      imageUrl, Number(body.is_available), now()
    );
    const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(info.lastInsertRowid);
    emitRestaurant(req, 'menu:changed', { item });
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

router.patch('/menu-items/:id', upload.single('image'), async (req, res, next) => {
  try {
    const item = db.prepare('SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?').get(Number(req.params.id), restaurantId(req));
    if (!item) return res.status(404).json({ message: 'Menu item not found.' });

    const body = z.object({
      category_id: z.coerce.number().int().positive().optional(),
      name: z.string().trim().min(2).optional(),
      description: z.string().optional(),
      price: z.coerce.number().positive().optional(),
      emoji: z.string().optional(),
      is_available: z.coerce.boolean().optional()
    }).parse(req.body);

    if (body.category_id) {
      const category = db.prepare('SELECT id FROM categories WHERE id = ? AND restaurant_id = ?').get(body.category_id, restaurantId(req));
      if (!category) return res.status(404).json({ message: 'Category not found.' });
    }
    const imageUrl = await saveMenuImage(req.file);

    db.prepare(`
      UPDATE menu_items
      SET category_id = COALESCE(?, category_id),
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          price = COALESCE(?, price),
          emoji = COALESCE(?, emoji),
          image_url = COALESCE(?, image_url),
          is_available = COALESCE(?, is_available)
      WHERE id = ?
    `).run(
      body.category_id ?? null,
      body.name ?? null,
      body.description ?? null,
      body.price ?? null,
      body.emoji ?? null,
      imageUrl ?? null,
      typeof body.is_available === 'boolean' ? Number(body.is_available) : null,
      item.id
    );

    const updated = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(item.id);
    if (imageUrl && item.image_url && item.image_url !== imageUrl) deleteMenuImage(item.image_url);
    emitRestaurant(req, 'menu:changed', { item: updated });
    res.json({ item: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/menu-items/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?').get(Number(req.params.id), restaurantId(req));
  if (!item) return res.status(404).json({ message: 'Menu item not found.' });
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(item.id);
  deleteMenuImage(item.image_url);
  emitRestaurant(req, 'menu:changed', { item_id: item.id });
  res.json({ ok: true });
});

router.get('/orders', (req, res) => {
  const rid = restaurantId(req);
  const orders = db.prepare(`
    SELECT o.*, t.table_number,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
    FROM orders o
    JOIN dining_tables t ON t.id = o.table_id
    WHERE o.restaurant_id = ?
    ORDER BY o.created_at DESC
    LIMIT 100
  `).all(rid).map((order) => ({ ...order, full: getFullOrder(order.id) }));
  res.json({ orders });
});


router.post('/orders/bulk/status', validate(z.object({
  status: z.enum(['PREPARING', 'READY', 'SERVED'])
})), (req, res) => {
  const rid = restaurantId(req);
  const updatedAt = now();
  const targets = db.prepare(`
    SELECT id, public_id
    FROM orders
    WHERE restaurant_id = ?
      AND status NOT IN ('COMPLETED', 'CANCELLED', 'PAYMENT_WAITING')
      AND payment_status = 'NOT_REQUESTED'
  `).all(rid);

  db.prepare(`
    UPDATE orders
    SET status = ?, updated_at = ?
    WHERE restaurant_id = ?
      AND status NOT IN ('COMPLETED', 'CANCELLED', 'PAYMENT_WAITING')
      AND payment_status = 'NOT_REQUESTED'
  `).run(req.body.status, updatedAt, rid);

  for (const target of targets) {
    const full = getFullOrder(target.id);
    emitRestaurant(req, 'orders:changed', { order: full });
    req.app.get('io')?.to(`order:${target.public_id}`).emit('order:updated', full);
  }
  emitRestaurant(req, 'tables:changed', { bulk: true });
  res.json({ ok: true, updated_count: targets.length });
});

router.post('/orders/bulk/payment/approve', (req, res, next) => {
  const rid = restaurantId(req);
  const targets = db.prepare(`
    SELECT o.*
    FROM orders o
    JOIN payments p ON p.order_id = o.id AND p.status = 'WAITING_APPROVAL'
    WHERE o.restaurant_id = ? AND o.payment_status = 'WAITING_APPROVAL' AND o.status = 'PAYMENT_WAITING'
  `).all(rid);

  if (!targets.length) return next(localizedError(req, 'There are no waiting payment requests.', 409));

  const approvedAt = now();
  const tableIds = new Set(targets.map((order) => order.table_id));
  db.transaction(() => {
    for (const order of targets) {
      db.prepare(`
        UPDATE payments
        SET status = 'APPROVED', approved_by = ?, approved_at = ?, rejection_reason = NULL
        WHERE order_id = ? AND status = 'WAITING_APPROVAL'
      `).run(req.user.id, approvedAt, order.id);
      db.prepare(`
        UPDATE orders
        SET status = 'COMPLETED', payment_status = 'APPROVED', updated_at = ?, completed_at = ?
        WHERE id = ?
      `).run(approvedAt, approvedAt, order.id);
    }
    for (const tableId of tableIds) setTableCurrentOrderToLatestActive(tableId);
  })();

  for (const order of targets) {
    const full = getFullOrder(order.id);
    emitRestaurant(req, 'orders:changed', { order: full });
    req.app.get('io')?.to(`order:${full.public_id}`).emit('order:updated', full);
  }
  for (const tableId of tableIds) emitRestaurant(req, 'tables:changed', { table_id: tableId });
  res.json({ ok: true, approved_count: targets.length });
});

router.get('/orders/:id', (req, res) => {
  const order = assertOwnOrder(req, Number(req.params.id));
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  res.json({ order: getFullOrder(order.id) });
});

router.patch('/orders/:id/status', validate(z.object({
  status: z.enum(['PENDING', 'PREPARING', 'READY', 'SERVED', 'PAYMENT_WAITING', 'COMPLETED', 'CANCELLED'])
})), (req, res, next) => {
  const order = assertOwnOrder(req, Number(req.params.id));
  if (!order) return res.status(404).json({ message: 'Order not found.' });

  if (req.body.status === 'PAYMENT_WAITING') {
    return next(localizedError(req, 'Payment waiting can only be started by the customer after payment.', 409));
  }

  if (req.body.status === 'COMPLETED' && order.payment_status !== 'APPROVED') {
    return next(localizedError(req, 'An order can be completed only after payment approval.', 409));
  }

  const updatedAt = now();
  db.transaction(() => {
    const completedAt = ['COMPLETED', 'CANCELLED'].includes(req.body.status) ? updatedAt : order.completed_at;
    db.prepare('UPDATE orders SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?')
      .run(req.body.status, updatedAt, completedAt, order.id);

    if (['COMPLETED', 'CANCELLED'].includes(req.body.status)) {
      setTableCurrentOrderToLatestActive(order.table_id);
    }
  })();

  const full = getFullOrder(order.id);
  emitRestaurant(req, 'orders:changed', { order: full });
  if (['COMPLETED', 'CANCELLED'].includes(req.body.status)) emitRestaurant(req, 'tables:changed', { table_id: order.table_id });
  req.app.get('io')?.to(`order:${full.public_id}`).emit('order:updated', full);
  res.json({ order: full });
});

router.post('/orders/:id/payment/approve', (req, res, next) => {
  const order = assertOwnOrder(req, Number(req.params.id));
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  const payment = db.prepare("SELECT * FROM payments WHERE order_id = ? AND status = 'WAITING_APPROVAL'").get(order.id);
  if (!payment || order.payment_status !== 'WAITING_APPROVAL' || order.status !== 'PAYMENT_WAITING') {
    return next(localizedError(req, 'This order does not have a waiting payment request.', 409));
  }
  if (!['CASH', 'CARD', 'TRANSFER'].includes(payment.payment_method)) {
    return next(localizedError(req, 'Payment must be requested by the customer before approval.', 409));
  }

  const approvedAt = now();
  db.transaction(() => {
    db.prepare(`
      UPDATE payments
      SET status = 'APPROVED', approved_by = ?, approved_at = ?, rejection_reason = NULL
      WHERE order_id = ? AND status = 'WAITING_APPROVAL'
    `).run(req.user.id, approvedAt, order.id);

    db.prepare(`
      UPDATE orders
      SET status = 'COMPLETED', payment_status = 'APPROVED', updated_at = ?, completed_at = ?
      WHERE id = ?
    `).run(approvedAt, approvedAt, order.id);

    setTableCurrentOrderToLatestActive(order.table_id);
  })();

  const full = getFullOrder(order.id);
  emitRestaurant(req, 'orders:changed', { order: full });
  emitRestaurant(req, 'tables:changed', { table_id: order.table_id });
  req.app.get('io')?.to(`order:${full.public_id}`).emit('order:updated', full);
  res.json({ order: full, table_cleared: getActiveOrdersForTable(order.table_id).length === 0 });
});

router.post('/orders/:id/payment/reject', validate(z.object({
  reason: z.string().min(2).max(250).default('Payment could not be confirmed.')
})), (req, res) => {
  const order = assertOwnOrder(req, Number(req.params.id));
  if (!order) return res.status(404).json({ message: 'Order not found.' });

  db.prepare(`
    UPDATE payments
    SET status = 'REJECTED', rejection_reason = ?
    WHERE order_id = ?
  `).run(req.body.reason, order.id);

  db.prepare(`
    UPDATE orders
    SET status = 'PAYMENT_REJECTED', payment_status = 'REJECTED', updated_at = ?
    WHERE id = ?
  `).run(now(), order.id);

  const full = getFullOrder(order.id);
  emitRestaurant(req, 'orders:changed', { order: full });
  req.app.get('io')?.to(`order:${full.public_id}`).emit('order:updated', full);
  res.json({ order: full });
});

router.get('/service-requests', (req, res) => {
  const requests = db.prepare(`
    SELECT sr.*, t.table_number AS resolved_table_number
    FROM service_requests sr
    LEFT JOIN dining_tables t ON t.id = sr.table_id
    WHERE sr.restaurant_id = ?
    ORDER BY CASE sr.status WHEN 'OPEN' THEN 0 ELSE 1 END, sr.created_at DESC
    LIMIT 100
  `).all(restaurantId(req));
  res.json({ requests });
});

router.patch('/service-requests/:id', validate(z.object({ status: z.enum(['OPEN', 'DONE']) })), (req, res) => {
  const request = db.prepare('SELECT * FROM service_requests WHERE id = ? AND restaurant_id = ?').get(Number(req.params.id), restaurantId(req));
  if (!request) return res.status(404).json({ message: 'Service request not found.' });
  db.prepare('UPDATE service_requests SET status = ?, resolved_at = ? WHERE id = ?')
    .run(req.body.status, req.body.status === 'DONE' ? now() : null, request.id);
  const updated = db.prepare('SELECT * FROM service_requests WHERE id = ?').get(request.id);
  emitRestaurant(req, 'support:changed', { request: updated });
  res.json({ request: updated });
});

export default router;
