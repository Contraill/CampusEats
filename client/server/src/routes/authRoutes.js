import express from 'express';
import { z } from 'zod';
import { db } from '../database.js';
import { authRequired, signToken, verifyPassword } from '../auth.js';
import { validate, getLang } from '../validation.js';
import { emailSchema } from '../validators.js';

const router = express.Router();

router.post('/login', validate(z.object({
  email: emailSchema,
  password: z.string().min(1)
})), (req, res) => {
  const user = db.prepare(`
    SELECT id, name, email, password_hash, role, restaurant_id, created_at
    FROM users
    WHERE email = ?
  `).get(req.body.email);

  if (!user || !verifyPassword(req.body.password, user.password_hash)) {
    return res.status(401).json({ message: getLang(req) === 'tr' ? 'E-posta veya şifre hatalı.' : 'Email or password is incorrect.' });
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    restaurant_id: user.restaurant_id,
    created_at: user.created_at
  };

  return res.json({ token: signToken(safeUser), user: safeUser });
});

router.get('/me', authRequired, (req, res) => {
  const restaurant = req.user.restaurant_id
    ? db.prepare('SELECT id, name, slug FROM restaurants WHERE id = ?').get(req.user.restaurant_id)
    : null;
  res.json({ user: req.user, restaurant });
});

export default router;
