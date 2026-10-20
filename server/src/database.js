import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const dataDir = path.join(__dirname, '..', 'data');
export const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'menu');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
const dbPath = process.env.DB_PATH || path.join(dataDir, 'campuseats.sqlite');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function now() {
  return new Date().toISOString();
}

export function randomToken(size = 18) {
  return crypto.randomBytes(size).toString('base64url');
}

export function makeSlug(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || randomToken(4);
}

export function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      address TEXT,
      phone TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('ADMIN', 'RESTAURANT_MANAGER')),
      restaurant_id INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS dining_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      table_number TEXT NOT NULL,
      table_token TEXT NOT NULL UNIQUE,
      capacity INTEGER DEFAULT 4,
      is_active INTEGER NOT NULL DEFAULT 1,
      current_order_id INTEGER,
      created_at TEXT NOT NULL,
      UNIQUE(restaurant_id, table_number),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
      FOREIGN KEY (current_order_id) REFERENCES orders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      image_url TEXT,
      emoji TEXT DEFAULT '🍽️',
      is_available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      restaurant_id INTEGER NOT NULL,
      table_id INTEGER NOT NULL,
      order_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PREPARING', 'READY', 'SERVED', 'PAYMENT_WAITING', 'PAYMENT_REJECTED', 'PAYMENT_APPROVED', 'COMPLETED', 'CANCELLED')),
      total_price REAL NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'NOT_REQUESTED' CHECK(payment_status IN ('NOT_REQUESTED', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
      FOREIGN KEY (table_id) REFERENCES dining_tables(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER,
      name_snapshot TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      note TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE,
      payment_method TEXT NOT NULL DEFAULT 'TEMPLATE',
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'WAITING_APPROVAL' CHECK(status IN ('WAITING_APPROVAL', 'APPROVED', 'REJECTED')),
      template_data TEXT NOT NULL,
      approved_by INTEGER,
      approved_at TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS service_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER NOT NULL,
      table_id INTEGER,
      table_number TEXT,
      type TEXT NOT NULL DEFAULT 'WAITER' CHECK(type IN ('WAITER', 'QR_HELP')),
      message TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'DONE')),
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
      FOREIGN KEY (table_id) REFERENCES dining_tables(id) ON DELETE SET NULL
    );
  `);
}

function insertMenuItem({ restaurantId, categoryId, name, description, price, emoji, imageUrl = null }) {
  db.prepare(`
    INSERT INTO menu_items (restaurant_id, category_id, name, description, price, emoji, image_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(restaurantId, categoryId, name, description, price, emoji, imageUrl, now());
}

export function seedIfEmpty() {
  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount > 0) return;

  const createdAt = now();
  const restaurantInfo = db.prepare(`
    INSERT INTO restaurants (name, slug, address, phone, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('CampusEats Demo', 'campus-eats', 'Local Demo Restaurant', '+90 555 000 0000', createdAt);

  const restaurantId = Number(restaurantInfo.lastInsertRowid);

  db.prepare(`
    INSERT INTO users (name, email, password_hash, role, restaurant_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('System Admin', 'admin@local.test', bcrypt.hashSync('admin123!', 10), 'ADMIN', null, createdAt);

  db.prepare(`
    INSERT INTO users (name, email, password_hash, role, restaurant_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('Demo Restaurant Manager', 'manager@local.test', bcrypt.hashSync('manager123!', 10), 'RESTAURANT_MANAGER', restaurantId, createdAt);

  const categoryStmt = db.prepare(`
    INSERT INTO categories (restaurant_id, name, sort_order, is_active)
    VALUES (?, ?, ?, 1)
  `);
  const mains = Number(categoryStmt.run(restaurantId, 'Mains', 1).lastInsertRowid);
  const appetizers = Number(categoryStmt.run(restaurantId, 'Appetizers', 2).lastInsertRowid);
  const drinks = Number(categoryStmt.run(restaurantId, 'Drinks', 3).lastInsertRowid);
  const desserts = Number(categoryStmt.run(restaurantId, 'Desserts', 4).lastInsertRowid);

  insertMenuItem({ restaurantId, categoryId: mains, name: 'Classic Burger', description: 'Juicy beef patty with fresh veggies', price: 129.90, emoji: '🍔' });
  insertMenuItem({ restaurantId, categoryId: mains, name: 'Margherita Pizza', description: 'Fresh mozzarella, basil and tomato sauce', price: 149.90, emoji: '🍕' });
  insertMenuItem({ restaurantId, categoryId: mains, name: 'Carbonara Pasta', description: 'Creamy pasta with parmesan and herbs', price: 135.00, emoji: '🍝' });
  insertMenuItem({ restaurantId, categoryId: appetizers, name: 'Crispy Fries', description: 'Golden potato fries with dip', price: 52.50, emoji: '🍟' });
  insertMenuItem({ restaurantId, categoryId: appetizers, name: 'Caesar Salad', description: 'Romaine lettuce, parmesan and croutons', price: 77.50, emoji: '🥗' });
  insertMenuItem({ restaurantId, categoryId: drinks, name: 'Iced Lemonade', description: 'Fresh lemon, mint and ice', price: 39.00, emoji: '🍋' });
  insertMenuItem({ restaurantId, categoryId: drinks, name: 'Turkish Coffee', description: 'Traditional coffee service', price: 32.50, emoji: '☕' });
  insertMenuItem({ restaurantId, categoryId: desserts, name: 'Cheesecake', description: 'Vanilla cheesecake with berry sauce', price: 68.00, emoji: '🍰' });

  const tableStmt = db.prepare(`
    INSERT INTO dining_tables (restaurant_id, table_number, table_token, capacity, is_active, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
  `);
  for (let i = 1; i <= 8; i += 1) {
    tableStmt.run(restaurantId, String(i), randomToken(12), i <= 2 ? 2 : 4, createdAt);
  }
}

export function getActiveOrdersForTable(tableId) {
  return db.prepare(`
    SELECT id, public_id, order_number, status, payment_status, total_price, created_at, updated_at
    FROM orders
    WHERE table_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')
    ORDER BY id DESC
  `).all(tableId);
}

export function tableBillingStarted(tableId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS count
    FROM orders
    WHERE table_id = ?
      AND status NOT IN ('COMPLETED', 'CANCELLED')
      AND (payment_status <> 'NOT_REQUESTED' OR status IN ('PAYMENT_WAITING', 'PAYMENT_REJECTED'))
  `).get(tableId);
  return Number(row?.count || 0) > 0;
}

export function setTableCurrentOrderToLatestActive(tableId) {
  const latest = db.prepare(`
    SELECT id
    FROM orders
    WHERE table_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')
    ORDER BY id DESC
    LIMIT 1
  `).get(tableId);
  db.prepare('UPDATE dining_tables SET current_order_id = ? WHERE id = ?').run(latest?.id || null, tableId);
  return latest?.id || null;
}


export function nextOrderNumber(restaurantId) {
  const row = db.prepare(`
    SELECT COALESCE(MAX(CAST(REPLACE(order_number, '#', '') AS INTEGER)), 0) AS max_number
    FROM orders
    WHERE restaurant_id = ?
  `).get(restaurantId);
  return `#${String(Number(row?.max_number || 0) + 1).padStart(5, '0')}`;
}

export function getFullOrder(orderId) {
  const order = db.prepare(`
    SELECT o.*, r.name AS restaurant_name, r.slug AS restaurant_slug, t.table_number, t.table_token
    FROM orders o
    JOIN restaurants r ON r.id = o.restaurant_id
    JOIN dining_tables t ON t.id = o.table_id
    WHERE o.id = ?
  `).get(orderId);
  if (!order) return null;

  const items = db.prepare(`
    SELECT id, menu_item_id, name_snapshot AS name, quantity, unit_price, note
    FROM order_items
    WHERE order_id = ?
  `).all(orderId);

  const payment = db.prepare(`
    SELECT * FROM payments WHERE order_id = ?
  `).get(orderId) || null;

  const tableOrders = getActiveOrdersForTable(order.table_id);

  return { ...order, items, payment, table_orders: tableOrders };
}

export function initDb() {
  createSchema();
  seedIfEmpty();
}
