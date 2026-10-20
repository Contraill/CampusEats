// Set before any src module loads: the database path and JWT secret are read at import time.
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret-0123456789abcdef0123456789abcdef';
process.env.NODE_ENV = 'test'; // keeps Express from logging expected 4xx errors
delete process.env.PUBLIC_APP_URL;

const { default: express } = await import('express');
const { createServer } = await import('http');
const { Server } = await import('socket.io');
const { io: connect } = await import('socket.io-client');
export const { db, initDb, now } = await import('../src/database.js');
const { setupSocket } = await import('../src/socket.js');
const { default: authRoutes } = await import('../src/routes/authRoutes.js');
const { default: adminRoutes } = await import('../src/routes/adminRoutes.js');
const { default: managerRoutes } = await import('../src/routes/managerRoutes.js');
const { default: publicRoutes } = await import('../src/routes/publicRoutes.js');

// Same wiring as server.js, on a random port and an in-memory database.
export async function startApp() {
  initDb();
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/manager', managerRoutes);
  app.use('/api/public', publicRoutes);
  const server = createServer(app);
  const io = new Server(server);
  setupSocket(io);
  app.set('io', io);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const sockets = [];

  async function call(path, { token, method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  async function login(email, password) {
    const res = await call('/api/auth/login', { method: 'POST', body: { email, password } });
    if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
    return res.body;
  }

  // Resolves once connected; rejects with the handshake error.
  function socket(token) {
    const client = connect(base, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(client);
    return new Promise((resolve, reject) => {
      client.on('connect', () => resolve(client));
      client.on('connect_error', reject);
    });
  }

  function close() {
    for (const client of sockets) client.disconnect();
    io.close();
  }

  return { call, login, socket, close };
}

export function nextEvent(client, event, ms = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event} within ${ms}ms`)), ms);
    client.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
  });
}

// Collects every payload of an event; read the array after the action has been observed elsewhere.
export function record(client, event) {
  const seen = [];
  client.on(event, (payload) => seen.push(payload));
  return seen;
}
