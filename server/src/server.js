import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';
import { initDb } from './database.js';
import { formatZodError, getLang, translateMessage } from './validation.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import managerRoutes from './routes/managerRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import { setupSocket } from './socket.js';

initDb();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 4000);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const allowedOrigins = [clientOrigin, 'http://127.0.0.1:5173', `http://localhost:${port}`, `http://127.0.0.1:${port}`];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});
app.set('io', io);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

setupSocket(io);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, mode: 'local', firebase: false });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/public', publicRoutes);

const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'), (error) => {
    if (error) res.status(404).send('Client build not found. Run npm run build or use npm run dev.');
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (error?.name === 'ZodError') return res.status(400).json(formatZodError(error, req));
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: translateMessage('Image is too large. Maximum 5 MB.', req) });
  if (String(error?.message || '').includes('Only image files')) return res.status(400).json({ message: translateMessage('Only image files are allowed.', req) });
  if (error?.statusCode) return res.status(error.statusCode).json({ message: translateMessage(error.message, req) });
  const lang = getLang(req);
  res.status(500).json({ message: lang === 'tr' ? 'Sunucu hatası.' : 'Server error.', detail: process.env.NODE_ENV === 'production' ? undefined : error.message });
});

server.listen(port, () => {
  console.log(`CampusEats local server running on http://localhost:${port}`);
});
