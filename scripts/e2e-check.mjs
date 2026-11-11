// Uctan uca sistem testi — `npm run check:e2e` ile calisir (sadece yerel sunucu).
// Etkinlik olusturur, istek/oy/onay, misafir kodu, socket rolleri, hiz siniri,
// yeniden baglanma ve silmeyi dener; sonunda test etkinligini siler.
import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(ROOT + '/client/package.json');
const { io } = require('socket.io-client');
const Database = createRequire(ROOT + '/package.json')('better-sqlite3');

const BASE = 'http://localhost:3000';
const PW = fs.readFileSync(ROOT + '/.env', 'utf8').match(/^DJ_PASSWORD=(.*)$/m)[1].trim();
const results = [];
const ok = (name, pass, extra = '') => results.push(`${pass ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`);
const j = (path, { method = 'GET', body, dj = false, headers = {} } = {}) =>
  fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(dj ? { 'x-dj-password': PW } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const connect = (slug, role, extra = {}) => new Promise((resolve) => {
  const s = io(BASE, { transports: ['websocket'], forceNew: true });
  const events = [];
  s.onAny((name, payload) => events.push({ name, payload }));
  s.on('connect', () => { s.emit('join-event', { eventSlug: slug, role, ...extra }); setTimeout(() => resolve({ s, events }), 300); });
});
const has = (sock, name) => sock.events.some(e => e.name === name);

const devA = randomUUID(), devB = randomUUID(), devC = randomUUID();
let slug;
try {
  ok('health', (await j('/api/health')).status === 200);
  ok('config', (await j('/api/config')).status === 200);
  ok('login yanlis sifre reddedilir', (await j('/api/auth/login', { method: 'POST', body: { email: 'cnderinderyan@hotmail.com', password: 'x' } })).status === 401);
  const login = await j('/api/auth/login', { method: 'POST', body: { email: 'cnderinderyan@hotmail.com', password: PW } });
  ok('login dogru sifre', login.status === 200 && login.data?.token === PW);
  ok('DJ ucu sifresiz 401', (await j('/api/events/history')).status === 401);

  const ev = await j('/api/events', { method: 'POST', dj: true, body: { name: 'E2E Test' } });
  slug = ev.data?.slug;
  ok('etkinlik olustur', ev.status === 200 && !!slug, slug);
  ok('olusturulan etkinlik sifre sizdirmaz', !('dj_password' in ((await j(`/api/events/${slug}`)).data || {})));

  const display = await connect(slug, 'display');
  const guest = await connect(slug, 'request');

  ok('istek kapaliyken reddedilir', (await j(`/api/events/${slug}/requests`, { method: 'POST', body: { songName: 'X', artist: 'Y', spotifyId: 's0', deviceId: devA } })).status === 400);
  const act = await j(`/api/events/${slug}/status`, { method: 'PUT', dj: true, body: { status: 'active' } });
  await sleep(300);
  ok('etkinlik aktif + display socket bildirimi', act.status === 200 && has(display, 'event-status'));

  const gA = await j(`/api/events/${slug}/guest-code?deviceId=${devA}`);
  const gA2 = await j(`/api/events/${slug}/guest-code?deviceId=${devA}`);
  const gB = await j(`/api/events/${slug}/guest-code?deviceId=${devB}`);
  ok('misafir kodu sabit', gA.data?.code === 'K-01' && gA2.data?.code === 'K-01', JSON.stringify([gA.data, gA2.data]));
  ok('ikinci cihaz K-02', gB.data?.code === 'K-02', JSON.stringify(gB.data));
  ok('gecersiz cihaz ID reddedilir', (await j(`/api/events/${slug}/guest-code?deviceId=abc`)).status === 400);

  const songs = ['Kuzu Kuzu', 'Simarik', 'Dudu', 'Hepsi Senin Mi'];
  const reqs = [];
  for (const s of songs) reqs.push(await j(`/api/events/${slug}/requests`, { method: 'POST', body: { songName: s, artist: 'Tarkan', spotifyId: 'sp-' + s, deviceId: devA } }));
  ok('istek olustur + misafir kodu', reqs[0].status === 200 && reqs[0].data?.guest_code === 'K-01', `HTTP ${reqs[0].status} ${reqs[0].data?.guest_code ?? JSON.stringify(reqs[0].data)}`);
  ok('kisi basi limit (3)', reqs[3].status === 400, `4. istek HTTP ${reqs[3].status}`);
  await sleep(200);
  ok('display request-added aldi', has(display, 'request-added'));
  ok('ayni sarki tekrar reddedilir', (await j(`/api/events/${slug}/requests`, { method: 'POST', body: { songName: 'Kuzu Kuzu', artist: 'Tarkan', spotifyId: 'x', deviceId: devB } })).status === 400);
  const xss = await j(`/api/events/${slug}/requests`, { method: 'POST', body: { songName: '<img src=x onerror=alert(1)>Hit', artist: '<b>A</b>', spotifyId: 'xss', deviceId: devB } });
  ok('XSS temizlenir', xss.status === 200 && !/[<>]/.test(xss.data?.song_name || ''), xss.data?.song_name);

  const r0 = reqs[0].data?.id;
  const v1 = await j(`/api/requests/${r0}/vote`, { method: 'POST', body: { deviceId: devB } });
  ok('oy ver (istekte bulunanin oyu + 1)', v1.status === 200 && v1.data?.votes === 2, `HTTP ${v1.status}`);
  ok('ayni cihaz 2. oy reddedilir', (await j(`/api/requests/${r0}/vote`, { method: 'POST', body: { deviceId: devB } })).status === 400);

  const ap = await j(`/api/requests/${r0}/status`, { method: 'PUT', dj: true, body: { status: 'approved' } });
  const rj = await j(`/api/requests/${reqs[1].data?.id}/status`, { method: 'PUT', dj: true, body: { status: 'rejected' } });
  await sleep(200);
  ok('onay/ret + list-updated', ap.status === 200 && rj.status === 200 && has(display, 'list-updated'));
  const pub = await j(`/api/events/${slug}/requests`);
  ok('reddedilen herkese acik listede yok', !pub.data?.requests?.some(r => r.status === 'rejected'));
  ok('herkese acik liste cihaz ID gostermez', !pub.data?.requests?.some(r => 'device_id' in r), 'device_id alani acikta');

  const lang = await j(`/api/events/${slug}/language`, { method: 'PUT', dj: true, body: { language: 'en' } });
  await sleep(200);
  ok('dil degisimi yayilir', lang.status === 200 && has(guest, 'language-changed') && has(display, 'language-changed'));

  const spotify = await j('/api/spotify/search?q=sezen%20aksu');
  ok('spotify arama', spotify.status === 200 && spotify.data?.length > 0, `${spotify.data?.length} sonuc`);

  // Guvenlik: sahte rol
  const fake = await connect(slug, 'dj');
  display.events.length = 0;
  fake.s.emit('reji-ticker', { text: 'HACKED' });
  fake.s.emit('reji-blackout', { active: true });
  fake.s.emit('display-card', { type: 'custom', message: 'HACKED', albumArt: 'https://evil.example/x.png', duration: 99999 });
  const anon = await connect(slug, 'request');
  anon.s.emit('display-card', { type: 'custom', message: 'HACKED2' });
  await sleep(400);
  ok('sifresiz "dj" rolu kayan yaziyi degistiremez', !has(display, 'ticker-updated'));
  ok('sifresiz "dj" rolu ekrani karartamaz', !has(display, 'reji-blackout'));
  ok('misafir ekrana kart gonderemez', !display.events.some(e => e.name === 'display-card'), `${display.events.filter(e => e.name === 'display-card').length} kart ulasti`);

  const realDj = await connect(slug, 'dj', { password: PW });
  const keyRes = await j(`/api/events/${slug}/reji-key`, { dj: true });
  ok('reji anahtari sadece DJ ile alinir', keyRes.status === 200 && !!keyRes.data?.key && (await j(`/api/events/${slug}/reji-key`)).status === 401);
  const reji = await connect(slug, 'reji', { key: keyRes.data?.key });
  const badReji = await connect(slug, 'reji', { key: 'yanlis' });
  display.events.length = 0;
  realDj.s.emit('reji-ticker', { text: 'Hos geldiniz' });
  realDj.s.emit('display-card', { type: 'custom', message: 'Iyi ki dogdun', albumArt: 'https://evil.example/x.png', duration: 99999 });
  reji.s.emit('reji-blackout', { active: true });
  badReji.s.emit('reji-spotlight', { text: 'HACK' });
  await sleep(400);
  const card = display.events.find(e => e.name === 'display-card')?.payload;
  ok('gercek DJ kayan yazi + kart gonderir', has(display, 'ticker-updated') && !!card);
  ok('kartta dis resim adresi ve uzun sure engellenir', card && card.albumArt === '' && card.duration === 120, JSON.stringify(card && { albumArt: card.albumArt, duration: card.duration }));
  ok('dogru anahtarli reji karartir', has(display, 'reji-blackout'));
  ok('yanlis anahtarli reji spotlight gonderemez', !has(display, 'reji-spotlight'));

  // Baglanti kopunca odaya geri donme (istemci socket.js ile ayni mantik)
  const rc = io(BASE, { transports: ['websocket'], forceNew: true });
  let lastJoin = { eventSlug: slug, role: 'display' };
  const rcEvents = [];
  rc.onAny(n => rcEvents.push(n));
  rc.io.on('reconnect', () => rc.emit('join-event', lastJoin));
  await new Promise(r => rc.on('connect', r));
  rc.emit('join-event', lastJoin);
  await sleep(200);
  rc.io.engine.close();
  await new Promise(r => rc.io.once('reconnect', r));
  await sleep(300);
  await j(`/api/events/${slug}/language`, { method: 'PUT', dj: true, body: { language: 'tr' } });
  await sleep(300);
  ok('kopma sonrasi canli guncelleme devam eder', rcEvents.includes('language-changed'));
  for (const x of [realDj, reji, badReji]) x.s.close();
  rc.close();

  // Hiz siniri: ayni IP'den farkli cihazlarin oylari (mekan WiFi senaryosu)
  await sleep(61000);
  const voters = Array.from({ length: 15 }, () => randomUUID());
  let blocked = 0;
  for (const d of voters) { const r = await j(`/api/requests/${r0}/vote`, { method: 'POST', body: { deviceId: d } }); if (r.status === 429) blocked++; }
  ok('ayni WiFi: 15 farkli telefon oy verebilir', blocked === 0, `${blocked}/15 engellendi`);

  ok('aktifken silme engellenir', (await j(`/api/events/${slug}`, { method: 'DELETE', dj: true })).status === 409);
  await j(`/api/events/${slug}/status`, { method: 'PUT', dj: true, body: { status: 'paused' } });
  const del = await j(`/api/events/${slug}`, { method: 'DELETE', dj: true });
  await sleep(200);
  ok('silme + event-deleted', del.status === 200 && has(guest, 'event-deleted'));
  const db = new Database(ROOT + '/data/remiks.db', { readonly: true });
  ok('silmede misafir kodlari da temizlenir', db.prepare('SELECT COUNT(*) c FROM guest_codes gc LEFT JOIN events e ON e.id = gc.event_id WHERE e.id IS NULL').get().c === 0);
  ok('yetim oy kaydi yok', db.prepare('SELECT COUNT(*) c FROM votes v LEFT JOIN requests r ON r.id = v.request_id WHERE r.id IS NULL').get().c === 0);
  for (const s of [display, guest, fake, anon]) s.s.close();
} catch (e) {
  ok('beklenmeyen hata', false, e.stack);
}
console.log(results.join('\n'));
console.log(`\n${results.filter(r => r.startsWith('✗')).length} hata / ${results.length} test`);
process.exit(results.some(r => r.startsWith('✗')) ? 1 : 0);
