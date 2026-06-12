import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, makeSlug, now } from '../database.js';
import { authRequired, requireRole } from '../auth.js';
import { validate } from '../validation.js';
import { emailSchema, passwordSchema, phoneSchema } from '../validators.js';

const router = express.Router();
router.use(authRequired, requireRole('ADMIN'));

function isEn(req) {
  return String(req.headers['accept-language'] || '').toLowerCase().startsWith('en');
}

function msg(req, tr, en) {
  return isEn(req) ? en : tr;
}


router.get('/restaurants', (req, res) => {
  const restaurants = db.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM users u WHERE u.restaurant_id = r.id AND u.role = 'RESTAURANT_MANAGER') AS manager_count,
      (SELECT COUNT(*) FROM dining_tables t WHERE t.restaurant_id = r.id) AS table_count
    FROM restaurants r
    ORDER BY r.created_at DESC
  `).all();
  res.json({ restaurants });
});

router.post('/restaurants', validate(z.object({
  name: z.string().trim().min(2),
  address: z.string().trim().max(250).optional().default(''),
  phone: phoneSchema.default('')
})), (req, res) => {
  const baseSlug = makeSlug(req.body.name);
  let slug = baseSlug;
  let counter = 2;
  while (db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  const info = db.prepare(`
    INSERT INTO restaurants (name, slug, address, phone, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.body.name, slug, req.body.address, req.body.phone, now());

  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ restaurant });
});


router.patch('/restaurants/:id', validate(z.object({
  name: z.string().trim().min(2).optional(),
  address: z.string().trim().max(250).optional(),
  phone: phoneSchema.optional()
})), (req, res) => {
  const id = Number(req.params.id);
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
  if (!restaurant) return res.status(404).json({ message: msg(req, 'Restoran bulunamadı.', 'Restaurant not found.') });

  db.prepare(`
    UPDATE restaurants
    SET name = COALESCE(?, name),
        address = COALESCE(?, address),
        phone = COALESCE(?, phone)
    WHERE id = ?
  `).run(
    req.body.name ?? null,
    req.body.address ?? null,
    req.body.phone ?? null,
    id
  );

  const updated = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
  res.json({ restaurant: updated });
});

router.delete('/restaurants/:id', (req, res) => {
  const id = Number(req.params.id);
  const restaurant = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
  if (!restaurant) return res.status(404).json({ message: msg(req, 'Restoran bulunamadı.', 'Restaurant not found.') });

  db.transaction(() => {
    db.prepare("DELETE FROM users WHERE restaurant_id = ? AND role = 'RESTAURANT_MANAGER'").run(id);
    db.prepare('DELETE FROM restaurants WHERE id = ?').run(id);
  })();

  res.json({ ok: true, deleted_restaurant_id: id, deleted_managers: true });
});

router.get('/managers', (req, res) => {
  const managers = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.restaurant_id, u.created_at, r.name AS restaurant_name
    FROM users u
    LEFT JOIN restaurants r ON r.id = u.restaurant_id
    WHERE u.role = 'RESTAURANT_MANAGER'
    ORDER BY u.created_at DESC
  `).all();
  res.json({ managers });
});

router.post('/managers', validate(z.object({
  name: z.string().trim().min(2),
  email: emailSchema,
  password: passwordSchema,
  restaurant_id: z.coerce.number().int().positive()
})), (req, res) => {
  const restaurant = db.prepare('SELECT id FROM restaurants WHERE id = ?').get(req.body.restaurant_id);
  if (!restaurant) return res.status(404).json({ message: msg(req, 'Restoran bulunamadı.', 'Restaurant not found.') });

  try {
    const info = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, restaurant_id, created_at)
      VALUES (?, ?, ?, 'RESTAURANT_MANAGER', ?, ?)
    `).run(
      req.body.name,
      req.body.email,
      bcrypt.hashSync(req.body.password, 10),
      req.body.restaurant_id,
      now()
    );

    const manager = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.restaurant_id, u.created_at, r.name AS restaurant_name
      FROM users u LEFT JOIN restaurants r ON r.id = u.restaurant_id
      WHERE u.id = ?
    `).get(info.lastInsertRowid);
    return res.status(201).json({ manager });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ message: msg(req, 'Bu e-posta zaten kullanılıyor.', 'This email is already in use.') });
    }
    throw error;
  }
});

router.patch('/managers/:id', validate(z.object({
  name: z.string().trim().min(2).optional(),
  email: emailSchema.optional(),
  password: passwordSchema.optional(),
  restaurant_id: z.coerce.number().int().positive().optional()
})), (req, res) => {
  const id = Number(req.params.id);
  const manager = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'RESTAURANT_MANAGER'").get(id);
  if (!manager) return res.status(404).json({ message: msg(req, 'Yönetici bulunamadı.', 'Manager not found.') });

  if (req.body.restaurant_id) {
    const restaurant = db.prepare('SELECT id FROM restaurants WHERE id = ?').get(req.body.restaurant_id);
    if (!restaurant) return res.status(404).json({ message: msg(req, 'Restoran bulunamadı.', 'Restaurant not found.') });
  }

  try {
    db.prepare(`
      UPDATE users
      SET name = COALESCE(?, name),
          email = COALESCE(?, email),
          password_hash = COALESCE(?, password_hash),
          restaurant_id = COALESCE(?, restaurant_id)
      WHERE id = ?
    `).run(
      req.body.name ?? null,
      req.body.email ?? null,
      req.body.password ? bcrypt.hashSync(req.body.password, 10) : null,
      req.body.restaurant_id ?? null,
      id
    );
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ message: msg(req, 'Bu e-posta zaten kullanılıyor.', 'This email is already in use.') });
    }
    throw error;
  }

  const updated = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.restaurant_id, u.created_at, r.name AS restaurant_name
    FROM users u LEFT JOIN restaurants r ON r.id = u.restaurant_id
    WHERE u.id = ?
  `).get(id);
  res.json({ manager: updated });
});

router.delete('/managers/:id', (req, res) => {
  const id = Number(req.params.id);
  const manager = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'RESTAURANT_MANAGER'").get(id);
  if (!manager) return res.status(404).json({ message: msg(req, 'Yönetici bulunamadı.', 'Manager not found.') });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
