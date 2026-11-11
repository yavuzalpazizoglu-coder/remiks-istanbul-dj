// Sistem saglik kontrolu — `npm run check` ile calisir.
// Yerel sunucu (localhost:3000) uzerinde uctan uca API akisini test eder:
// istek olusturma, DJ onayi, oylama, guvenlik korumalari ve temizlik.
// Canli sistemde veri kirletmemek icin sadece yerelde calisir.
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE = process.env.CHECK_URL || 'http://localhost:3000';

const results = [];
let failed = 0;
const ok = (name, pass, extra = '') => {
  results.push(`${pass ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!pass) failed++;
};

// ── Hazirlik ──
const db = new Database(path.join(ROOT, 'data', 'remiks.db'));
const SLUG = 'sistemtest';
const cleanup = () => {
  const e = db.prepare('SELECT id FROM events WHERE slug = ?').get(SLUG);
  if (e) {
    db.prepare('DELETE FROM votes WHERE request_id IN (SELECT id FROM requests WHERE event_id = ?)').run(e.id);
    db.prepare('DELETE FROM requests WHERE event_id = ?').run(e.id);
    db.prepare('DELETE FROM guest_codes WHERE event_id = ?').run(e.id);
    db.prepare('DELETE FROM events WHERE id = ?').run(e.id);
  }
};
cleanup();
const eventId = randomUUID();
db.prepare("INSERT INTO events (id, name, slug, dj_password, status, request_limit) VALUES (?, ?, ?, ?, 'active', 3)")
  .run(eventId, 'Sistem Testi', SLUG, 'test1234');

const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const DJ_PASSWORD = env.match(/^DJ_PASSWORD=(.*)$/m)[1].trim();

try {
  // 1. Saglik + config
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  ok('Sunucu health', health?.status === 200, `HTTP ${health?.status ?? 'yok'}`);
  if (!health || health.status !== 200) throw new Error('Sunucu ayakta degil — once `node server.js` calistirin');

  // 2. Spotify arama
  const sp = await fetch(`${BASE}/api/spotify/search?q=tarkan`);
  const tracks = sp.ok ? await sp.json() : [];
  ok('Spotify arama', sp.ok && tracks.length > 0, `${tracks.length} sonuc`);

  // 3. Istek olusturma
  const t = tracks[0] || { name: 'Test', artist: 'Test', albumArt: '', spotifyId: 'test-1' };
  const reqRes = await fetch(`${BASE}/api/events/${SLUG}/requests`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ songName: t.name, artist: t.artist, albumArt: t.albumArt, spotifyId: t.spotifyId, deviceId: 'check-dev-1' }),
  });
  const request = reqRes.ok ? await reqRes.json() : null;
  ok('Istek olusturma', !!request?.id, `HTTP ${reqRes.status}`);

  // 4. DJ onayi (dogru + yanlis sifre)
  const wrongAuth = await fetch(`${BASE}/api/requests/${request.id}/status`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-dj-password': 'yanlis-sifre' },
    body: JSON.stringify({ status: 'approved' }),
  });
  ok('Yanlis DJ sifresi reddediliyor', wrongAuth.status === 401, `HTTP ${wrongAuth.status}`);
  const approve = await fetch(`${BASE}/api/requests/${request.id}/status`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-dj-password': DJ_PASSWORD },
    body: JSON.stringify({ status: 'approved' }),
  });
  ok('DJ onayi', approve.ok, `HTTP ${approve.status}`);

  // 5. Oylama + cift oy engeli
  const vote1 = await fetch(`${BASE}/api/requests/${request.id}/vote`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'check-voter-1' }),
  });
  ok('Oy verme', vote1.ok, `HTTP ${vote1.status}`);
  const vote2 = await fetch(`${BASE}/api/requests/${request.id}/vote`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: 'check-voter-1' }),
  });
  ok('Cift oy engelleniyor', vote2.status === 400, `HTTP ${vote2.status}`);

  // 6. Cihaz basina istek limiti (3)
  let limitHit = false;
  for (let k = 0; k < 4; k++) {
    const r = await fetch(`${BASE}/api/events/${SLUG}/requests`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songName: `Limit ${k}`, artist: 'L', spotifyId: `check-lim-${k}`, deviceId: 'check-limit-dev' }),
    });
    if (r.status === 400) { limitHit = true; break; }
  }
  ok('Cihaz istek limiti calisiyor', limitHit);

  // 7. Display + request sayfalari (statik servis)
  for (const p of [`display/${SLUG}`, `request/${SLUG}`, 'dj']) {
    const r = await fetch(`${BASE}/${p}`);
    ok(`Sayfa /${p}`, r.status === 200, `HTTP ${r.status}`);
  }

  // 8. DB butunlugu
  ok('DB butunlugu', db.pragma('integrity_check', { simple: true }) === 'ok');
} catch (err) {
  ok(`Kontrol kesildi: ${err.message}`, false);
} finally {
  cleanup();
  const leftover = db.prepare('SELECT COUNT(*) c FROM events WHERE slug = ?').get(SLUG).c;
  ok('Test verisi temizlendi', leftover === 0);
}

console.log('\n══ SISTEM KONTROLU ══');
console.log(results.join('\n'));
console.log(failed === 0 ? '\nSONUC: TUM KONTROLLER GECTI ✓' : `\nSONUC: ${failed} KONTROL BASARISIZ ✗`);
process.exit(failed === 0 ? 0 : 1);
