import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db, dataDir } from './database.js';

// Values that have shipped in this repo; anyone can sign tokens with them.
const KNOWN_SECRETS = new Set(['local-development-secret', 'change-this-local-secret']);
const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

export function isPublicDeployment(env) {
  return env.NODE_ENV === 'production' || !PRIVATE_HOST.test(new URL(env.PUBLIC_APP_URL || 'http://localhost').hostname);
}

// Returns the configured secret, or null when a local demo may fall back to a generated one.
export function resolveJwtSecret(env) {
  const secret = env.JWT_SECRET && !KNOWN_SECRETS.has(env.JWT_SECRET) ? env.JWT_SECRET : null;
  if (isPublicDeployment(env) && !(secret?.length >= 32)) {
    throw new Error('JWT_SECRET must be a random value of at least 32 characters when NODE_ENV=production or PUBLIC_APP_URL is a public address. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  return secret;
}

// Random per-install secret for local demos, stored next to the git-ignored SQLite file.
function localSecret() {
  const file = path.join(dataDir, 'jwt-secret');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(file, 'utf8').trim();
}

const jwtSecret = resolveJwtSecret(process.env) ?? localSecret();

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
