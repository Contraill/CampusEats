import { db, customerOrderView } from './database.js';
import { userFromToken } from './auth.js';

export function emitOrderUpdate(req, order) {
  req.app.get('io')?.to(`order:${order.public_id}`).emit('order:updated', customerOrderView(order));
}

export function setupSocket(io) {
  // Customers connect without a token; the manager panel sends its JWT.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next();
    try {
      const user = userFromToken(token);
      if (!user) return next(new Error('Invalid user.'));
      socket.data.userId = user.id;
      return next();
    } catch {
      return next(new Error('Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('joinRestaurant', (restaurantId, ack) => {
      // Re-read the user so a deleted or reassigned manager cannot join with an old connection.
      const user = socket.data.userId && db.prepare('SELECT role, restaurant_id FROM users WHERE id = ?').get(socket.data.userId);
      const ok = user?.role === 'RESTAURANT_MANAGER' && user.restaurant_id != null && Number(restaurantId) === user.restaurant_id;
      if (ok) socket.join(`restaurant:${user.restaurant_id}`);
      if (typeof ack === 'function') ack({ ok });
    });

    // The order's random public_id is the customer's access key, as in the REST routes.
    socket.on('joinOrder', (publicId, ack) => {
      const ok = typeof publicId === 'string' && Boolean(db.prepare('SELECT 1 FROM orders WHERE public_id = ?').get(publicId));
      if (ok) socket.join(`order:${publicId}`);
      if (typeof ack === 'function') ack({ ok });
    });
  });
}
