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
    brand_text TEXT DEFAULT '',
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

  CREATE TABLE IF NOT EXISTS dj_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'dj',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_requests_event ON requests(event_id);
  CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
  CREATE INDEX IF NOT EXISTS idx_votes_request ON votes(request_id);
  CREATE INDEX IF NOT EXISTS idx_votes_device ON votes(device_id);

`);

// ─── Seed DJ Users ───
const djUsers = [
  { id: 'dj-alp', name: 'DJ Alp', email: 'yavuzalpazizoglu@gmail.com', role: 'admin' },
  { id: 'dj-derin', name: 'DJ Derin', email: 'cnderinderyan@hotmail.com', role: 'dj' },
];
for (const u of djUsers) {
  const existing = db.prepare('SELECT id FROM dj_users WHERE id = ?').get(u.id);
  if (!existing) {
    db.prepare('INSERT INTO dj_users (id, name, email, role) VALUES (?, ?, ?, ?)').run(u.id, u.name, u.email, u.role);
  }
}

// ─── Migrations ───
try {
  db.prepare("SELECT brand_text FROM events LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE events ADD COLUMN brand_text TEXT DEFAULT ''");
}

try {
  db.prepare("SELECT ticker_texts FROM events LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE events ADD COLUMN ticker_texts TEXT DEFAULT ''");
}

try {
  db.prepare("SELECT request_limit FROM events LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE events ADD COLUMN request_limit INTEGER DEFAULT 2");
}

try {
  db.prepare("SELECT theme FROM events LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE events ADD COLUMN theme TEXT DEFAULT 'cyan'");
}

try {
  db.prepare("SELECT animation_level FROM events LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE events ADD COLUMN animation_level TEXT DEFAULT 'high'");
}

try {
  db.prepare("SELECT stage_design FROM events LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE events ADD COLUMN stage_design TEXT DEFAULT 'classic'");
}

try {
  db.prepare("SELECT event_logo FROM events LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE events ADD COLUMN event_logo TEXT DEFAULT ''");
}

try {
  db.prepare("SELECT genre FROM requests LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE requests ADD COLUMN genre TEXT DEFAULT ''");
}

try {
  db.prepare("SELECT display_list_style FROM events LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE events ADD COLUMN display_list_style TEXT DEFAULT 'cards'");
}

try {
  db.prepare("SELECT display_list_size FROM events LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE events ADD COLUMN display_list_size INTEGER DEFAULT 15");
}

// ─── Events ───

export function createEvent(name, djPassword) {
  const id = nanoid(12);
  const slug = nanoid(8).toLowerCase();
  // Yeni etkinlikler varsayılan olarak premium gold temayla açılır
  db.prepare(
    "INSERT INTO events (id, name, slug, dj_password, theme) VALUES (?, ?, ?, ?, 'gold')"
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

export function cancelCountdown(slug) {
  db.prepare('UPDATE events SET countdown_end = NULL, status = ? WHERE slug = ?')
    .run('waiting', slug);
  return getEventBySlug(slug);
}

export function updateBrandText(slug, brandText) {
  db.prepare('UPDATE events SET brand_text = ? WHERE slug = ?').run(brandText, slug);
  return getEventBySlug(slug);
}

export function updateTickerTexts(slug, tickerTexts) {
  db.prepare('UPDATE events SET ticker_texts = ? WHERE slug = ?').run(tickerTexts, slug);
  return getEventBySlug(slug);
}

// ─── Requests ───

export function isDuplicateRequest(eventId, songName, artist) {
  const row = db.prepare(`
    SELECT id FROM requests
    WHERE event_id = ? AND LOWER(song_name) = LOWER(?) AND LOWER(artist) = LOWER(?)
    AND status NOT IN ('rejected')
  `).get(eventId, songName, artist || '');
  return !!row;
}

export function createRequest(eventId, songName, artist, albumArt, spotifyId, deviceId, genre) {
  const id = nanoid(12);
  db.prepare(`
    INSERT INTO requests (id, event_id, song_name, artist, album_art, spotify_id, device_id, genre)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, eventId, songName, artist || '', albumArt || '', spotifyId || '', deviceId, genre || '');

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

const GENRE_UNKNOWN = 'Diğer/Bilinmiyor';

export function getRequestStats(eventId) {
  const statusRows = db.prepare(`
    SELECT status, COUNT(*) as count FROM requests WHERE event_id = ? GROUP BY status
  `).all(eventId);
  const statusCounts = { pending: 0, approved: 0, playing: 0, played: 0, rejected: 0 };
  for (const row of statusRows) {
    if (Object.prototype.hasOwnProperty.call(statusCounts, row.status)) statusCounts[row.status] = row.count;
  }

  const volumeRows = db.prepare(`
    SELECT CAST((strftime('%s', 'now') - strftime('%s', created_at)) / 300 AS INTEGER) as bucket
    FROM requests
    WHERE event_id = ? AND created_at >= datetime('now', '-60 minutes')
  `).all(eventId);
  const volume = new Array(12).fill(0);
  for (const row of volumeRows) {
    const idx = 11 - row.bucket;
    if (idx >= 0 && idx < 12) volume[idx]++;
  }

  const topArtists = db.prepare(`
    SELECT artist, COUNT(*) as count FROM requests
    WHERE event_id = ? AND artist != '' AND status != 'rejected'
    GROUP BY LOWER(artist) ORDER BY count DESC LIMIT 5
  `).all(eventId);

  const totals = db.prepare(`
    SELECT COUNT(*) as total, COALESCE(SUM(votes), 0) as totalVotes
    FROM requests WHERE event_id = ? AND status != 'rejected'
  `).get(eventId);

  return {
    statusCounts,
    volume,
    topArtists,
    total: totals.total,
    totalVotes: totals.totalVotes,
  };
}

export function getGenreStats(eventId) {
  const allRows = db.prepare(`
    SELECT COALESCE(NULLIF(genre, ''), ?) as genre, COUNT(*) as count
    FROM requests WHERE event_id = ? AND status != 'rejected'
    GROUP BY genre ORDER BY count DESC
  `).all(GENRE_UNKNOWN, eventId);
  const totalAll = allRows.reduce((s, r) => s + r.count, 0);
  const byGenre = allRows.map(r => ({
    genre: r.genre,
    count: r.count,
    percent: totalAll ? Math.round((r.count / totalAll) * 1000) / 10 : 0,
  }));

  const recentRows = db.prepare(`
    SELECT COALESCE(NULLIF(genre, ''), ?) as genre, COUNT(*) as count
    FROM requests
    WHERE event_id = ? AND status != 'rejected' AND created_at >= datetime('now', '-20 minutes')
    GROUP BY genre ORDER BY count DESC
  `).all(GENRE_UNKNOWN, eventId);
  const totalRecent = recentRows.reduce((s, r) => s + r.count, 0);
  const recentByGenre = recentRows.map(r => ({
    genre: r.genre,
    count: r.count,
    percent: totalRecent ? Math.round((r.count / totalRecent) * 1000) / 10 : 0,
  }));

  const velocityRow = db.prepare(`
    SELECT COUNT(*) as count FROM requests
    WHERE event_id = ? AND status != 'rejected' AND created_at >= datetime('now', '-10 minutes')
  `).get(eventId);
  const velocityCount = velocityRow.count;
  let level = 'low';
  if (velocityCount > 8) level = 'high';
  else if (velocityCount >= 3) level = 'medium';

  return {
    total: totalAll,
    byGenre,
    recentWindowMinutes: 20,
    recentTotal: totalRecent,
    recentByGenre,
    velocity: { level, count: velocityCount, windowMinutes: 10 },
    dominant: byGenre[0] || null,
    trending: recentByGenre[0] || null,
  };
}

export function updateRequestLimit(slug, limit) {
  db.prepare('UPDATE events SET request_limit = ? WHERE slug = ?').run(limit, slug);
  return getEventBySlug(slug);
}

export function updateTheme(slug, theme) {
  db.prepare('UPDATE events SET theme = ? WHERE slug = ?').run(theme, slug);
  return getEventBySlug(slug);
}

export function updateAnimationLevel(slug, level) {
  db.prepare('UPDATE events SET animation_level = ? WHERE slug = ?').run(level, slug);
  return getEventBySlug(slug);
}

export function updateStageDesign(slug, design) {
  db.prepare('UPDATE events SET stage_design = ? WHERE slug = ?').run(design, slug);
  return getEventBySlug(slug);
}

export function updateEventLogo(slug, logoPath) {
  db.prepare('UPDATE events SET event_logo = ? WHERE slug = ?').run(logoPath, slug);
  return getEventBySlug(slug);
}

export function updateListSize(slug, size) {
  db.prepare('UPDATE events SET display_list_size = ? WHERE slug = ?').run(size, slug);
  return getEventBySlug(slug);
}

export function getActiveEvents() {
  return db.prepare("SELECT * FROM events WHERE status = 'active'").all();
}

export function getEventHistory(password) {
  return db.prepare(`
    SELECT e.id, e.name, e.slug, e.status, e.created_at,
      (SELECT COUNT(*) FROM requests r WHERE r.event_id = e.id) as total_requests,
      (SELECT COALESCE(SUM(r.votes), 0) FROM requests r WHERE r.event_id = e.id) as total_votes
    FROM events e WHERE e.dj_password = ?
    ORDER BY e.created_at DESC
  `).all(password);
}


// ─── DJ Users ───

export function getDJByEmail(email) {
  return db.prepare('SELECT * FROM dj_users WHERE email = ?').get(email);
}


// ─── Yedekleme: günlük otomatik yedek, son 7 kopya tutulur ───

export async function backupDatabase() {
  const backupDir = path.join(dataDir, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const target = path.join(backupDir, `remiks-${stamp}.db`);
  await db.backup(target);
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('remiks-') && f.endsWith('.db'))
    .sort();
  while (files.length > 7) fs.unlinkSync(path.join(backupDir, files.shift()));
  return target;
}


export default db;
