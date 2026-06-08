import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db } from './database.js';

const jwtSecret = process.env.JWT_SECRET || 'local-development-secret';

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      restaurant_id: user.restaurant_id,
      name: user.name,
      email: user.email
    },
    jwtSecret,
    { expiresIn: '8h' }
  );
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required.' });

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = db.prepare(`
      SELECT id, name, email, role, restaurant_id, created_at
      FROM users
      WHERE id = ?
    `).get(payload.id);
    if (!user) return res.status(401).json({ message: 'Invalid user.' });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission for this action.' });
    }
    return next();
  };
}

export function requireManagerRestaurant(req, res, next) {
  if (!req.user?.restaurant_id) {
    return res.status(403).json({ message: 'Manager is not assigned to a restaurant.' });
  }
  return next();
}
