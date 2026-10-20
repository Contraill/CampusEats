import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'campuseats.sqlite');
const walPath = `${dbPath}-wal`;
const shmPath = `${dbPath}-shm`;

for (const file of [dbPath, walPath, shmPath]) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

console.log('Local database deleted. Run npm start or npm run dev to recreate seed data.');
