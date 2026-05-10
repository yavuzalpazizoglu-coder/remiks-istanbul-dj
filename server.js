import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import * as db from './db.js';
import { searchSpotify, isSpotifyConfigured } from './spotify.js';
import nodemailer from 'nodemailer';

/* ── Gmail nodemailer istemcisi ── */
const gmailTransporter = (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  : null;

async function sendEventReport(event, allRequests) {
  if (!gmailTransporter) return;
  const toEmails = (process.env.REPORT_TO_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
  if (!toEmails.length) return;

  const played   = allRequests.filter(r => ['playing','played'].includes(r.status)).sort((a,b) => (b.votes||0)-(a.votes||0));
  const approved = allRequests.filter(r => r.status === 'approved').sort((a,b) => (b.votes||0)-(a.votes||0));
  const rejected = allRequests.filter(r => r.status === 'rejected').sort((a,b) => (b.votes||0)-(a.votes||0));
  const pending  = allRequests.filter(r => r.status === 'pending').sort((a,b) => (b.votes||0)-(a.votes||0));
  const totalVotes = allRequests.reduce((s, r) => s + (r.votes || 0), 0);
  const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

  /* ── Yardımcılar ── */
  const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const statBox = (num, label, color) => `
    <td width="20%" style="padding:0 6px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f9fa;border:2px solid ${color};border-radius:8px;">
        <tr><td style="padding:14px 8px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:${color};line-height:1;">${num}</div>
          <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-top:4px;font-family:Arial,sans-serif;">${label}</div>
        </td></tr>
      </table>
    </td>`;

  const sectionHeader = (emoji, title, count, color) => `
    <tr><td style="padding:28px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="border-left:4px solid ${color};padding:4px 0 4px 14px;">
            <span style="font-size:16px;font-weight:700;color:#1a1a1a;font-family:Arial,sans-serif;">${emoji} ${esc(title)}</span>
            <span style="font-size:13px;color:#888;margin-left:8px;font-family:Arial,sans-serif;">(${count} şarkı)</span>
          </td>
        </tr>
      </table>
    </td></tr>`;

  const songTable = (rows) => {
    if (!rows.length) return '';
    const rowsHtml = rows.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
        <td width="36" style="padding:10px 12px;text-align:center;font-size:13px;font-weight:700;color:#999;font-family:Arial,sans-serif;border-bottom:1px solid #eee;">${i + 1}</td>
        <td style="padding:10px 12px;font-size:14px;font-weight:600;color:#1a1a1a;font-family:Arial,sans-serif;border-bottom:1px solid #eee;">${esc(r.song_name || r.title || '-')}</td>
        <td style="padding:10px 12px;font-size:13px;color:#555;font-family:Arial,sans-serif;border-bottom:1px solid #eee;">${esc(r.artist || '-')}</td>
        <td width="60" style="padding:10px 12px;text-align:center;border-bottom:1px solid #eee;">
          <span style="background:#e8f5ff;color:#0077cc;font-size:13px;font-weight:700;padding:3px 10px;border-radius:12px;font-family:Arial,sans-serif;">${r.votes || 0}</span>
        </td>
      </tr>`).join('');
    return `
      <tr><td style="padding:10px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f1f3f5;">
              <th width="36" style="padding:8px 12px;font-size:11px;color:#888;text-align:center;font-family:Arial,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:1px;">#</th>
              <th style="padding:8px 12px;font-size:11px;color:#888;text-align:left;font-family:Arial,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Şarkı Adı</th>
              <th style="padding:8px 12px;font-size:11px;color:#888;text-align:left;font-family:Arial,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Sanatçı</th>
              <th width="60" style="padding:8px 12px;font-size:11px;color:#888;text-align:center;font-family:Arial,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Oy</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </td></tr>`;
  };

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Etkinlik Raporu</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f2f5;">
  <tr><td align="center" style="padding:32px 16px;">

    <!-- KART -->
    <table width="620" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

      <!-- HEADER -->
      <tr>
        <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);padding:32px 32px 28px;text-align:center;">
          <div style="font-size:10px;letter-spacing:5px;color:#00d4ff;text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:10px;">REMİKS İSTANBUL</div>
          <div style="font-size:26px;font-weight:900;color:#ffffff;font-family:Arial,sans-serif;margin-bottom:6px;">${esc(event.name || 'Etkinlik')}</div>
          <div style="font-size:13px;color:#94a3b8;font-family:Arial,sans-serif;">Etkinlik Sonu Raporu &nbsp;·&nbsp; ${dateStr}</div>
        </td>
      </tr>

      <!-- İSTATİSTİKLER -->
      <tr>
        <td style="padding:24px 32px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              ${statBox(allRequests.length, 'Toplam İstek', '#6366f1')}
              ${statBox(played.length,      'Çalınan',      '#22c55e')}
              ${statBox(totalVotes,          'Toplam Oy',    '#0ea5e9')}
              ${statBox(approved.length,     'Onaylanan',    '#f59e0b')}
              ${statBox(rejected.length,     'Reddedilen',   '#ef4444')}
            </tr>
          </table>
        </td>
      </tr>

      <!-- İÇERİK -->
      <tr><td style="padding:8px 32px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">

          ${played.length ? sectionHeader('✅', 'Çalınan Şarkılar', played.length, '#22c55e') + songTable(played) : ''}
          ${approved.length ? sectionHeader('⏳', 'Onaylanan — Çalınmadı', approved.length, '#f59e0b') + songTable(approved) : ''}
          ${rejected.length ? sectionHeader('❌', 'Reddedilen İstekler', rejected.length, '#ef4444') + songTable(rejected) : ''}
          ${pending.length  ? sectionHeader('📋', 'Bekleyen İstekler',   pending.length,  '#94a3b8') + songTable(pending)  : ''}

        </table>
      </td></tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#f8f9fa;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
          <span style="font-size:11px;color:#94a3b8;font-family:Arial,sans-serif;">Bu rapor otomatik olarak Remiks İstanbul DJ Sistemi tarafından oluşturulmuştur.</span>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  try {
    await gmailTransporter.sendMail({
      from: `"Remiks İstanbul DJ" <${process.env.GMAIL_USER}>`,
      to: toEmails.join(', '),
      subject: `🎧 Etkinlik Raporu: ${event.name || 'Gecenin Özeti'} — ${dateStr}`,
      html,
    });
    console.log(`📧 Etkinlik raporu gönderildi → ${toEmails.join(', ')}`);
  } catch (err) {
    console.error('❌ Mail gönderilemedi:', err.message);
  }
}


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

/* ── Etkinlik sonu JSON yedek ── */
function saveEventBackup(event, allRequests) {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${event.slug}_${dateStr}.json`;
    const data = JSON.stringify({ event, requests: allRequests, exportedAt: new Date().toISOString() }, null, 2);
    fs.promises.writeFile(path.join(backupDir, filename), data, 'utf8')
      .then(() => console.log(`✅ Etkinlik yedeği kaydedildi: backups/${filename}`))
      .catch(err => console.error('❌ Yedek kaydedilemedi:', err.message));
  } catch (err) {
    console.error('❌ Yedek kaydedilemedi:', err.message);
  }
}

/* ── Global hata yakalama ── */
process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException:', err.message, err.stack);
  if (isProduction) process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ unhandledRejection:', reason);
});

const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigin = process.env.APP_URL || (isProduction ? false : '*');
if (isProduction && !process.env.APP_URL) {
  console.warn('⚠️  UYARI: APP_URL tanımlı değil — CORS kökeni kapalı (false). İstemci ile API aynı host’ta olmalı; QR ve tam URL için APP_URL şart.');
}
if (isProduction && process.env.TRUST_PROXY !== '0') {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}
const io = new Server(server, {
  cors: { origin: allowedOrigin, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"']/g, '').trim().slice(0, 200);
}
app.use('/logos', express.static(path.join(__dirname, 'public/logos')));
app.use('/modes', express.static(path.join(__dirname, 'public/modes')));
app.use('/legal', express.static(path.join(__dirname, 'public/legal')));

const clientDistIndex = path.join(__dirname, 'client/dist/index.html');
const serveClient = isProduction || fs.existsSync(clientDistIndex);
if (serveClient) {
  app.use(express.static(path.join(__dirname, 'client/dist')));
}

// ─── Rate Limiting (simple in-memory with periodic cleanup) ───

const requestCounts = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestCounts) {
    if (now - entry.start > 120000) requestCounts.delete(key);
  }
}, 60000);

function rateLimit(ip, max = 30, windowMs = 60000) {
  const now = Date.now();
  const key = ip;
  const entry = requestCounts.get(key);
  if (!entry || now - entry.start > windowMs) {
    requestCounts.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= max;
}

// ─── Auth Middleware ───

function djAuth(req, res, next) {
  const password = req.headers['x-dj-password'];
  if (!process.env.DJ_PASSWORD || password !== process.env.DJ_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── API Routes ───

app.get('/api/config', (req, res) => {
  res.json({ spotifyEnabled: isSpotifyConfigured() });
});

// ─── DJ Auth Login ───
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password !== process.env.DJ_PASSWORD) return res.status(401).json({ error: 'wrong_password' });
    const user = db.getDJByEmail(email.toLowerCase().trim());
    if (!user) return res.status(401).json({ error: 'user_not_found' });
    const { created_at, ...safeUser } = user;
    res.json({ user: safeUser, token: password });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Event History (must be before :slug route)
app.get('/api/events/history', djAuth, (req, res) => {
  try {
    const history = db.getEventHistory(process.env.DJ_PASSWORD);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Events
app.post('/api/events', djAuth, (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Event name required' });
    const event = db.createEvent(name, process.env.DJ_PASSWORD);
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/events/:slug', (req, res) => {
  const event = db.getEventBySlug(req.params.slug);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const { dj_password, ...safeEvent } = event;
  res.json(safeEvent);
});

app.put('/api/events/:slug/status', djAuth, (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['waiting', 'countdown', 'active', 'paused', 'ended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const event = db.updateEventStatus(req.params.slug, status);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    io.to(req.params.slug).emit('event-status', { status: event.status, countdown_end: event.countdown_end });

    if (status === 'ended') {
      const allRequests = db.getAllRequests(event.id);
      sendEventReport(event, allRequests);
      saveEventBackup(event, allRequests);
    }

    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events/:slug/language', djAuth, (req, res) => {
  try {
    const { language } = req.body;
    if (!['tr', 'en'].includes(language)) {
      return res.status(400).json({ error: 'Invalid language' });
    }
    const event = db.updateEventLanguage(req.params.slug, language);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    io.to(req.params.slug).emit('language-changed', { language });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events/:slug/ticker', djAuth, (req, res) => {
  try {
    const tickerTexts = (req.body.tickerTexts || '').split('\n').map(l => sanitize(l)).join('\n');
    const event = db.updateTickerTexts(req.params.slug, tickerTexts);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    io.to(req.params.slug).emit('ticker-updated', { ticker_texts: event.ticker_texts });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events/:slug/brand', djAuth, (req, res) => {
  try {
    const brandText = sanitize(req.body.brandText || '');
    const event = db.updateBrandText(req.params.slug, brandText);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    io.to(req.params.slug).emit('brand-updated', { brand_text: event.brand_text });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events/:slug/countdown', djAuth, (req, res) => {
  try {
    const { minutes } = req.body;
    const countdownEnd = Date.now() + (minutes || 10) * 60 * 1000;
    const event = db.setCountdownEnd(req.params.slug, countdownEnd);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    io.to(req.params.slug).emit('event-status', {
      status: 'countdown',
      countdown_end: countdownEnd,
    });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Requests
app.post('/api/events/:slug/requests', (req, res) => {
  if (!rateLimit(req.ip)) return res.status(429).json({ error: 'Too many requests' });

  try {
    const event = db.getEventBySlug(req.params.slug);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!['active', 'countdown'].includes(event.status)) {
      return res.status(400).json({ error: 'Requests not open' });
    }

    const { albumArt, spotifyId, deviceId, genre } = req.body;
    const songName = sanitize(req.body.songName);
    const artist = sanitize(req.body.artist);
    if (!songName || !deviceId) {
      return res.status(400).json({ error: 'Song name and device ID required' });
    }

    const limit = event.request_limit || 2;
    const count = db.getDeviceRequestCount(event.id, deviceId);
    if (count >= limit) {
      return res.status(400).json({ error: 'Request limit reached', limit });
    }

    if (db.isDuplicateRequest(event.id, songName, artist)) {
      return res.status(400).json({ error: 'Bu şarkı zaten istendi / This song has already been requested' });
    }

    const request = db.createRequest(event.id, songName, artist, albumArt, spotifyId, deviceId, genre || '');
    io.to(req.params.slug).emit('request-added', request);
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/events/:slug/requests', (req, res) => {
  try {
    const event = db.getEventBySlug(req.params.slug);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const all = req.query.all === 'true';
    const requests = all ? db.getAllRequests(event.id) : db.getRequests(event.id);
    const deviceId = req.query.deviceId;
    const votedIds = deviceId ? db.getVotedRequestIds(event.id, deviceId) : [];
    const requestCount = deviceId ? db.getDeviceRequestCount(event.id, deviceId) : 0;

    res.json({ requests, votedIds, requestCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Votes
app.post('/api/requests/:id/vote', (req, res) => {
  if (!rateLimit(req.ip, 10)) return res.status(429).json({ error: 'Too many votes' });

  try {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: 'Device ID required' });

    const updated = db.voteRequest(req.params.id, deviceId);
    if (!updated) return res.status(400).json({ error: 'Already voted' });

    const event = db.getEventById(updated.event_id);
    if (event) {
      io.to(event.slug).emit('vote-updated', {
        requestId: updated.id,
        votes: updated.votes,
      });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DJ Request Management
app.put('/api/requests/:id/status', djAuth, (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'approved', 'playing', 'played', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const beforeUpdate = (status === 'played') ? db.getRequestById(req.params.id) : null;
    const updated = db.updateRequestStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: 'Request not found' });
    const event = db.getEventById(updated.event_id);

    if (event) {
      if (status === 'played' && beforeUpdate) {
        io.to(event.slug).emit('request-played', beforeUpdate);
      }
      if (status === 'playing') {
        io.to(event.slug).emit('now-playing', updated);
      }
      const requests = db.getRequests(event.id);
      io.to(event.slug).emit('list-updated', requests);
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events/:slug/limit', djAuth, (req, res) => {
  try {
    const { requestLimit } = req.body;
    if (![1, 2, 3, 5].includes(requestLimit)) return res.status(400).json({ error: 'Limit must be 1, 2, 3 or 5' });
    const event = db.updateRequestLimit(req.params.slug, requestLimit);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events/:slug/theme', djAuth, (req, res) => {
  try {
    const { theme } = req.body;
    const valid = ['cyan', 'purple', 'pink', 'green', 'orange', 'red'];
    if (!valid.includes(theme)) return res.status(400).json({ error: 'Invalid theme' });
    const event = db.updateTheme(req.params.slug, theme);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    io.to(req.params.slug).emit('theme-changed', { theme });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events/:slug/list-size', djAuth, (req, res) => {
  try {
    const { size } = req.body;
    if (![15, 30, 40].includes(size)) return res.status(400).json({ error: 'Invalid size' });
    const event = db.updateListSize(req.params.slug, size);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    io.to(req.params.slug).emit('list-size-changed', { size });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events/:slug/animation', djAuth, (req, res) => {
  try {
    const { level } = req.body;
    const valid = ['low', 'medium', 'high'];
    if (!valid.includes(level)) return res.status(400).json({ error: 'Invalid level' });
    const event = db.updateAnimationLevel(req.params.slug, level);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    io.to(req.params.slug).emit('animation-changed', { level });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events/:slug/stage-design', djAuth, (req, res) => {
  try {
    const { design } = req.body;
    const valid = ['classic', 'minimal', 'elegant', 'club', 'festival', 'corporate', 'cyber', 'lounge', 'rave', 'cinema'];
    if (!valid.includes(design)) return res.status(400).json({ error: 'Invalid design' });
    const event = db.updateStageDesign(req.params.slug, design);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    io.to(req.params.slug).emit('stage-design-changed', { design });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const SAFE_SLUG = /^[a-zA-Z0-9_-]+$/;

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'public/logos/events'),
    filename: (req, file, cb) => {
      if (!SAFE_SLUG.test(req.params.slug)) return cb(new Error('Invalid slug'));
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${req.params.slug}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

app.post('/api/events/:slug/logo', djAuth, logoUpload.single('logo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const logoPath = `/logos/events/${req.file.filename}`;
    const event = db.updateEventLogo(req.params.slug, logoPath);
    io.to(req.params.slug).emit('logo-changed', { logo: logoPath });
    res.json({ logo: logoPath, event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/events/:slug/logo', djAuth, (req, res) => {
  try {
    const event = db.getEventBySlug(req.params.slug);
    if (event?.event_logo) {
      const filePath = path.join(__dirname, 'public', event.event_logo);
      const safeDir = path.join(__dirname, 'public/logos/events');
      if (filePath.startsWith(safeDir) && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    const updated = db.updateEventLogo(req.params.slug, '');
    io.to(req.params.slug).emit('logo-changed', { logo: '' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events/:slug/music-mode', djAuth, (req, res) => {
  try {
    const { mode, active, djPhotos } = req.body;
    const validModes = ['arabesk', 'rock', '90s-pop', 'turkish-delight', 'tech', 'latino', 'rap', 'winamp', 'pioneer'];
    if (!validModes.includes(mode)) return res.status(400).json({ error: 'Invalid mode' });
    const payload = { mode, active: !!active };
    if (Array.isArray(djPhotos)) payload.djPhotos = djPhotos;
    if (active) {
      activeMusicModes.set(req.params.slug, payload);
    } else {
      activeMusicModes.delete(req.params.slug);
    }
    io.to(req.params.slug).emit('music-mode', payload);
    res.json({ ok: true, ...payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Spotify Search
app.get('/api/spotify/search', async (req, res) => {
  if (!rateLimit(req.ip, 20)) return res.status(429).json({ error: 'Too many searches' });

  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const results = await searchSpotify(q);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Socket.io ───

const activeMusicModes = new Map();

function emitRoomCount(eventSlug) {
  const room = io.sockets.adapter.rooms.get(eventSlug);
  const count = room ? room.size : 0;
  io.to(eventSlug).emit('room-count', { count });
}

io.on('connection', (socket) => {
  socket.on('join-event', ({ eventSlug, role } = {}) => {
    if (!eventSlug || typeof eventSlug !== 'string') return;
    const safeRole = ['dj', 'reji', 'display', 'request'].includes(role) ? role : 'guest';
    socket.join(eventSlug);
    socket.data.role = safeRole;
    socket.data.eventSlug = eventSlug;
    emitRoomCount(eventSlug);

    const musicMode = activeMusicModes.get(eventSlug);
    if (musicMode && musicMode.active) {
      socket.emit('music-mode', musicMode);
    }
  });

  function requireRole(socket, ...roles) {
    return roles.includes(socket.data.role);
  }

  socket.on('reji-brand', ({ text }) => {
    const { eventSlug } = socket.data;
    if (!eventSlug || !requireRole(socket, 'dj', 'reji')) return;
    const brandText = sanitize((text || '').slice(0, 200));
    try { db.updateBrandText(eventSlug, brandText); } catch {}
    io.to(eventSlug).emit('brand-updated', { brand_text: brandText });
  });

  socket.on('reji-ticker', ({ text }) => {
    const { eventSlug } = socket.data;
    if (!eventSlug || !requireRole(socket, 'dj', 'reji')) return;
    const tickerTexts = (text || '').split('\n').map(l => sanitize(l)).join('\n').slice(0, 500);
    try { db.updateTickerTexts(eventSlug, tickerTexts); } catch {}
    io.to(eventSlug).emit('ticker-updated', { ticker_texts: tickerTexts });
  });

  socket.on('reji-spotlight', ({ text }) => {
    const { eventSlug } = socket.data;
    if (!eventSlug || !text || !requireRole(socket, 'dj', 'reji')) return;
    io.to(eventSlug).emit('reji-spotlight', { text: sanitize(text.slice(0, 120)), timestamp: Date.now() });
  });

  socket.on('reji-blackout', ({ active }) => {
    const { eventSlug } = socket.data;
    if (!eventSlug || !requireRole(socket, 'dj', 'reji')) return;
    io.to(eventSlug).emit('reji-blackout', { active: !!active });
  });

  socket.on('reji-countdown', ({ seconds }) => {
    const { eventSlug } = socket.data;
    if (!eventSlug || !requireRole(socket, 'dj', 'reji')) return;
    const sec = Math.min(Math.max(Number(seconds) || 5, 3), 10);
    io.to(eventSlug).emit('reji-countdown', { seconds: sec, timestamp: Date.now() });
  });

  socket.on('crew-chat', ({ message }) => {
    const { eventSlug, role } = socket.data;
    if (!eventSlug || !message || !requireRole(socket, 'dj', 'reji')) return;
    const payload = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      message: message.slice(0, 200),
      sender: role === 'dj' ? 'DJ' : 'Reji',
      timestamp: Date.now(),
    };
    io.to(eventSlug).emit('crew-chat', payload);
  });

  socket.on('ticker-font-size', ({ delta }) => {
    const { eventSlug } = socket.data;
    if (!eventSlug || !requireRole(socket, 'dj', 'reji')) return;
    const safeDelta = Math.min(8, Math.max(-4, Number(delta) || 0));
    io.to(eventSlug).emit('ticker-font-size', { delta: safeDelta });
  });

  socket.on('clear-playing', () => {
    const { eventSlug } = socket.data;
    if (!eventSlug) return;
    io.to(eventSlug).emit('clear-playing');
  });

  socket.on('display-card', (data) => {
    const { eventSlug } = socket.data;
    if (!eventSlug) return;
    io.to(eventSlug).emit('display-card', {
      ...data,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
    });
  });

  socket.on('dismiss-card', () => {
    const { eventSlug } = socket.data;
    if (!eventSlug) return;
    io.to(eventSlug).emit('dismiss-card');
  });

  socket.on('disconnect', () => {
    const { eventSlug } = socket.data;
    if (eventSlug) {
      setTimeout(() => emitRoomCount(eventSlug), 500);
    }
  });
});

// SPA fallback (build sonrası `node server.js` ile NODE_ENV olmadan da /dj vb. çalışır)
if (serveClient) {
  app.get('*', (req, res) => {
    res.sendFile(clientDistIndex);
  });
}

// ─── Start ───

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  🎧 Remiks İstanbul DJ Request System`);
  console.log(`  ────────────────────────────────────`);
  console.log(`  Server:  http://localhost:${PORT}`);
  console.log(`  DJ:      http://localhost:${PORT}/dj`);
  console.log(`  Display: http://localhost:${PORT}/display\n`);
});
