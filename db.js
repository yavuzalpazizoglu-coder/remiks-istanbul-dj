import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'remiks.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'waiting',
    language TEXT DEFAULT 'tr',
    dj_password TEXT NOT NULL,
    countdown_end INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    song_name TEXT NOT NULL,
    artist TEXT DEFAULT '',
    album_art TEXT DEFAULT '',
    spotify_id TEXT DEFAULT '',
    device_id TEXT NOT NULL,
    votes INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id),
    UNIQUE(request_id, device_id)
  );

  CREATE INDEX IF NOT EXISTS idx_requests_event ON requests(event_id);
  CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
  CREATE INDEX IF NOT EXISTS idx_votes_request ON votes(request_id);
  CREATE INDEX IF NOT EXISTS idx_votes_device ON votes(device_id);
`);

// ─── Events ───

export function createEvent(name, djPassword) {
  const id = nanoid(12);
  const slug = nanoid(8).toLowerCase();
  db.prepare(
    'INSERT INTO events (id, name, slug, dj_password) VALUES (?, ?, ?, ?)'
  ).run(id, name, slug, djPassword);
  return getEventBySlug(slug);
}

export function getEventBySlug(slug) {
  return db.prepare('SELECT * FROM events WHERE slug = ?').get(slug);
}

export function getEventById(id) {
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id);
}

export function updateEventStatus(slug, status) {
  db.prepare('UPDATE events SET status = ? WHERE slug = ?').run(status, slug);
  return getEventBySlug(slug);
}

export function updateEventLanguage(slug, language) {
  db.prepare('UPDATE events SET language = ? WHERE slug = ?').run(language, slug);
  return getEventBySlug(slug);
}

export function setCountdownEnd(slug, timestamp) {
  db.prepare('UPDATE events SET countdown_end = ?, status = ? WHERE slug = ?')
    .run(timestamp, 'countdown', slug);
  return getEventBySlug(slug);
}

// ─── Requests ───

export function createRequest(eventId, songName, artist, albumArt, spotifyId, deviceId) {
  const id = nanoid(12);
  db.prepare(`
    INSERT INTO requests (id, event_id, song_name, artist, album_art, spotify_id, device_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, eventId, songName, artist || '', albumArt || '', spotifyId || '', deviceId);

  db.prepare('INSERT INTO votes (id, request_id, device_id) VALUES (?, ?, ?)')
    .run(nanoid(12), id, deviceId);

  return getRequestById(id);
}

export function getRequestById(id) {
  return db.prepare('SELECT * FROM requests WHERE id = ?').get(id);
}

export function getRequests(eventId, includeRejected = false) {
  const statusFilter = includeRejected
    ? ''
    : "AND status != 'rejected' AND status != 'played'";
  return db.prepare(`
    SELECT * FROM requests
    WHERE event_id = ? ${statusFilter}
    ORDER BY
      CASE status WHEN 'playing' THEN 0 WHEN 'approved' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
      votes DESC,
      created_at ASC
  `).all(eventId);
}

export function getAllRequests(eventId) {
  return db.prepare(`
    SELECT * FROM requests WHERE event_id = ?
    ORDER BY votes DESC, created_at ASC
  `).all(eventId);
}

export function voteRequest(requestId, deviceId) {
  const existing = db.prepare(
    'SELECT id FROM votes WHERE request_id = ? AND device_id = ?'
  ).get(requestId, deviceId);

  if (existing) return null;

  const id = nanoid(12);
  db.prepare('INSERT INTO votes (id, request_id, device_id) VALUES (?, ?, ?)').run(id, requestId, deviceId);
  db.prepare('UPDATE requests SET votes = votes + 1 WHERE id = ?').run(requestId);
  return getRequestById(requestId);
}

export function hasVoted(requestId, deviceId) {
  return !!db.prepare(
    'SELECT id FROM votes WHERE request_id = ? AND device_id = ?'
  ).get(requestId, deviceId);
}

export function updateRequestStatus(requestId, status) {
  if (status === 'playing') {
    const req = getRequestById(requestId);
    if (req) {
      db.prepare("UPDATE requests SET status = 'played' WHERE event_id = ? AND status = 'playing'")
        .run(req.event_id);
    }
  }
  db.prepare('UPDATE requests SET status = ? WHERE id = ?').run(status, requestId);
  return getRequestById(requestId);
}

export function getDeviceRequestCount(eventId, deviceId) {
  const result = db.prepare(
    'SELECT COUNT(*) as count FROM requests WHERE event_id = ? AND device_id = ?'
  ).get(eventId, deviceId);
  return result.count;
}

export function getVotedRequestIds(eventId, deviceId) {
  return db.prepare(`
    SELECT v.request_id FROM votes v
    JOIN requests r ON r.id = v.request_id
    WHERE r.event_id = ? AND v.device_id = ?
  `).all(eventId, deviceId).map(r => r.request_id);
}

export function getNowPlaying(eventId) {
  return db.prepare(
    "SELECT * FROM requests WHERE event_id = ? AND status = 'playing' LIMIT 1"
  ).get(eventId);
}

export default db;
