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
import { Resend } from 'resend';

/* ── Resend mail istemcisi ── */
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendEventReport(event, allRequests) {
  if (!resend) return; // API key yoksa sessizce geç
  const toEmails = (process.env.REPORT_TO_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
  if (!toEmails.length) return;

  const played    = allRequests.filter(r => r.status === 'playing' || r.status === 'played');
  const approved  = allRequests.filter(r => r.status === 'approved');
  const rejected  = allRequests.filter(r => r.status === 'rejected');
  const pending   = allRequests.filter(r => r.status === 'pending');
  const totalVotes = allRequests.reduce((s, r) => s + (r.votes || 0), 0);

  const songRow = (r, i) => `
    <tr style="background:${i % 2 === 0 ? '#1a1a2e' : '#16213e'}">
      <td style="padding:8px 12px;color:#aaa;text-align:center">${i + 1}</td>
      <td style="padding:8px 12px;color:#fff">${r.song_name || r.title || '-'}</td>
      <td style="padding:8px 12px;color:#ccc">${r.artist || '-'}</td>
      <td style="padding:8px 12px;color:#00d4ff;text-align:center;font-weight:700">${r.votes || 0}</td>
      <td style="padding:8px 12px;color:#888;text-align:center">${r.status}</td>
    </tr>`;

  const tableSection = (title, color, rows) => rows.length === 0 ? '' : `
    <h3 style="color:${color};margin:28px 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:2px">${title} (${rows.length})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#0d0d1a">
        <th style="padding:8px;color:#666">#</th>
        <th style="padding:8px;color:#666;text-align:left">Şarkı</th>
        <th style="padding:8px;color:#666;text-align:left">Sanatçı</th>
        <th style="padding:8px;color:#666">Oy</th>
        <th style="padding:8px;color:#666">Durum</th>
      </tr></thead>
      <tbody>${rows.map((r, i) => songRow(r, i)).join('')}</tbody>
    </table>`;

  const html = `
  <!DOCTYPE html>
  <html lang="tr">
  <head><meta charset="UTF-8"><style>
    body{margin:0;padding:0;background:#0d0d1a;font-family:Arial,sans-serif;color:#fff}
    .wrap{max-width:700px;margin:0 auto;padding:32px 24px}
    .header{text-align:center;padding:32px 0 24px;border-bottom:1px solid #1e2a3a}
    .logo{font-size:11px;letter-spacing:4px;color:#00d4ff;text-transform:uppercase}
    .title{font-size:28px;font-weight:900;margin:8px 0 4px;color:#fff}
    .sub{font-size:14px;color:#888}
    .stat-grid{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}
    .stat{flex:1;min-width:120px;background:#1a1a2e;border:1px solid #1e2a3a;border-radius:8px;padding:16px;text-align:center}
    .stat-num{font-size:32px;font-weight:900;color:#00d4ff}
    .stat-lbl{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
    .footer{margin-top:40px;padding-top:20px;border-top:1px solid #1e2a3a;text-align:center;font-size:11px;color:#444}
  </style></head>
  <body><div class="wrap">
    <div class="header">
      <div class="logo">REMİKS İSTANBUL</div>
      <div class="title">${event.name || 'Etkinlik'}</div>
      <div class="sub">Etkinlik Sonu Raporu &nbsp;·&nbsp; ${new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
    </div>

    <div class="stat-grid">
      <div class="stat"><div class="stat-num">${allRequests.length}</div><div class="stat-lbl">Toplam İstek</div></div>
      <div class="stat"><div class="stat-num">${played.length}</div><div class="stat-lbl">Çalınan Şarkı</div></div>
      <div class="stat"><div class="stat-num">${totalVotes}</div><div class="stat-lbl">Toplam Oy</div></div>
      <div class="stat"><div class="stat-num">${approved.length}</div><div class="stat-lbl">Onaylanan</div></div>
      <div class="stat"><div class="stat-num">${rejected.length}</div><div class="stat-lbl">Reddedilen</div></div>
    </div>

    ${tableSection('✅ Çalınan Şarkılar', '#00ff88', played.sort((a,b) => (b.votes||0)-(a.votes||0)))}
    ${tableSection('⏳ Onaylanan (Çalınmadı)', '#ffaa00', approved.sort((a,b) => (b.votes||0)-(a.votes||0)))}
    ${tableSection('❌ Reddedilen İstekler', '#ff4466', rejected)}
    ${tableSection('📋 Bekleyen İstekler', '#888', pending)}

    <div class="footer">
      Bu rapor otomatik olarak Remiks İstanbul DJ Sistemi tarafından gönderilmiştir.
    </div>
  </div></body></html>`;

  try {
    await resend.emails.send({
      from: 'Remiks İstanbul <onboarding@resend.dev>',
      to: toEmails,
      subject: `🎧 Etkinlik Raporu: ${event.name || 'Gecenin Özeti'} — ${new Date().toLocaleDateString('tr-TR')}`,
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

const allowedOrigin = process.env.APP_URL || '*';
const io = new Server(server, {
  cors: { origin: allowedOrigin, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim().slice(0, 200);
}
app.use('/logos', express.static(path.join(__dirname, 'public/logos')));
app.use('/modes', express.static(path.join(__dirname, 'public/modes')));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));
}

// ─── Rate Limiting (simple in-memory) ───

const requestCounts = new Map();
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
  if (password !== process.env.DJ_PASSWORD) {
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
    io.to(req.params.slug).emit('event-status', { status: event.status, countdown_end: event.countdown_end });

    if (status === 'ended') {
      const allRequests = db.getAllRequests(event.id);
      sendEventReport(event, allRequests);
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
  if (!rateLimit(req.ip, 60)) return res.status(429).json({ error: 'Too many votes' });

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
    io.to(req.params.slug).emit('theme-changed', { theme });
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
    io.to(req.params.slug).emit('stage-design-changed', { design });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'public/logos/events'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${req.params.slug}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
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
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    const updated = db.updateEventLogo(req.params.slug, '');
    io.to(req.params.slug).emit('logo-changed', { logo: '' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events/:slug/ceremony', djAuth, (req, res) => {
  try {
    const { type, active, minutes } = req.body;
    if (!['opening', 'closing'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
    const endTime = active && minutes ? Date.now() + minutes * 60 * 1000 : null;
    const payload = { type, active: !!active, endTime };
    if (active) {
      activeCeremonies.set(req.params.slug, payload);
    } else {
      activeCeremonies.delete(req.params.slug);
    }
    io.to(req.params.slug).emit('ceremony', payload);
    res.json({ ok: true, ...payload });
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

const activeCeremonies = new Map();
const activeMusicModes = new Map();

function emitRoomCount(eventSlug) {
  const room = io.sockets.adapter.rooms.get(eventSlug);
  const count = room ? room.size : 0;
  io.to(eventSlug).emit('room-count', { count });
}

io.on('connection', (socket) => {
  socket.on('join-event', ({ eventSlug, role }) => {
    socket.join(eventSlug);
    socket.data.role = role;
    socket.data.eventSlug = eventSlug;
    emitRoomCount(eventSlug);

    const ceremony = activeCeremonies.get(eventSlug);
    if (ceremony && ceremony.endTime > Date.now()) {
      socket.emit('ceremony', ceremony);
    }
    const musicMode = activeMusicModes.get(eventSlug);
    if (musicMode && musicMode.active) {
      socket.emit('music-mode', musicMode);
    }
  });

  socket.on('reji-brand', ({ text }) => {
    const { eventSlug } = socket.data;
    if (!eventSlug) return;
    const brandText = sanitize((text || '').slice(0, 200));
    try { db.updateBrandText(eventSlug, brandText); } catch {}
    io.to(eventSlug).emit('brand-updated', { brand_text: brandText });
  });

  socket.on('reji-ticker', ({ text }) => {
    const { eventSlug } = socket.data;
    if (!eventSlug) return;
    const tickerTexts = (text || '').split('\n').map(l => sanitize(l)).join('\n').slice(0, 500);
    try { db.updateTickerTexts(eventSlug, tickerTexts); } catch {}
    io.to(eventSlug).emit('ticker-updated', { ticker_texts: tickerTexts });
  });

  socket.on('reji-ceremony', ({ type, active, minutes }) => {
    const { eventSlug } = socket.data;
    if (!eventSlug || !['opening', 'closing'].includes(type)) return;
    const endTime = active && minutes ? Date.now() + minutes * 60 * 1000 : null;
    const payload = { type, active: !!active, endTime };
    if (active) { activeCeremonies.set(eventSlug, payload); } else { activeCeremonies.delete(eventSlug); }
    io.to(eventSlug).emit('ceremony', payload);
  });

  socket.on('reji-spotlight', ({ text }) => {
    const { eventSlug } = socket.data;
    if (!eventSlug || !text) return;
    io.to(eventSlug).emit('reji-spotlight', { text: sanitize(text.slice(0, 120)), timestamp: Date.now() });
  });

  socket.on('reji-blackout', ({ active }) => {
    const { eventSlug } = socket.data;
    if (!eventSlug) return;
    io.to(eventSlug).emit('reji-blackout', { active: !!active });
  });

  socket.on('reji-countdown', ({ seconds }) => {
    const { eventSlug } = socket.data;
    if (!eventSlug) return;
    const sec = Math.min(Math.max(Number(seconds) || 5, 3), 10);
    io.to(eventSlug).emit('reji-countdown', { seconds: sec, timestamp: Date.now() });
  });

  socket.on('crew-chat', ({ message, sender }) => {
    const { eventSlug } = socket.data;
    if (!eventSlug || !message) return;
    const payload = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      message: message.slice(0, 200),
      sender: sender || 'unknown',
      timestamp: Date.now(),
    };
    io.to(eventSlug).emit('crew-chat', payload);
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

// SPA fallback
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist/index.html'));
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
