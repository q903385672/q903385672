import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nas-music-secret-key';
const MUSIC_DIR = path.join(__dirname, 'music');
const DB_PATH = path.join(__dirname, 'nas_music.db');

// Ensure music directory exists
fs.ensureDirSync(MUSIC_DIR);

// Initialize Database
const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    settings TEXT,
    role TEXT DEFAULT 'user'
  );
`);

// Migration: Add role column if it doesn't exist
try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
} catch (e) {
  // Column probably already exists
}

// Pre-create admin user
const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!adminUser) {
  const hashedAdminPassword = bcrypt.hashSync('10086Vip', 10);
  db.prepare('INSERT INTO users (username, password, settings, role) VALUES (?, ?, ?, ?)').run(
    'admin', 
    hashedAdminPassword, 
    JSON.stringify({}), 
    'admin'
  );
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cors());

  // Serve music files
  app.use('/api/music-files', express.static(MUSIC_DIR));

  // --- Auth Routes ---
  app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const stmt = db.prepare('INSERT INTO users (username, password, settings) VALUES (?, ?, ?)');
      stmt.run(username, hashedPassword, JSON.stringify({}));
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Username already exists' });
    }
  });

  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    
    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
      res.json({ 
        token, 
        username: user.username, 
        role: user.role,
        settings: JSON.parse(user.settings || '{}') 
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  // --- Admin Routes ---
  app.get('/api/admin/users', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      if (decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const users = db.prepare('SELECT id, username, role FROM users WHERE username != ?').all('admin');
      res.json(users);
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  app.delete('/api/admin/users/:id', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      if (decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const userId = req.params.id;
      db.prepare('DELETE FROM users WHERE id = ? AND username != ?').run(userId, 'admin');
      res.json({ success: true });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // --- Music Library Routes ---
  app.get('/api/library', async (req, res) => {
    try {
      const files = await fs.readdir(MUSIC_DIR);
      const musicFiles = files.filter(f => /\.(mp3|wav|ogg|m4a)$/i.test(f)).map((f, i) => ({
        id: `nas-${i}`,
        title: f.replace(/\.[^/.]+$/, ""),
        artist: 'NAS Library',
        url: `/api/music-files/${encodeURIComponent(f)}`,
        cover: 'https://picsum.photos/seed/music/200/200',
        isNas: true
      }));
      res.json(musicFiles);
    } catch (error) {
      res.status(500).json({ error: 'Failed to scan music directory' });
    }
  });

  // --- User Settings Routes ---
  app.post('/api/settings', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const { settings } = req.body;
      
      const stmt = db.prepare('UPDATE users SET settings = ? WHERE id = ?');
      stmt.run(JSON.stringify(settings), decoded.id);
      res.json({ success: true });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NAS Music Server running at http://localhost:${PORT}`);
    console.log(`Music directory: ${MUSIC_DIR}`);
  });
}

startServer();
