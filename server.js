import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from './db.js';
import { searchSpotify, isSpotifyConfigured } from './spotify.js';

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
        setTimeout(() => {
          const requests = db.getRequests(event.id);
          io.to(event.slug).emit('list-updated', requests);
        }, 10000);
      } else {
        if (status === 'playing') {
          io.to(event.slug).emit('now-playing', updated);
        }
        const requests = db.getRequests(event.id);
        io.to(event.slug).emit('list-updated', requests);
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/events/:slug/limit', djAuth, (req, res) => {
  try {
    const { requestLimit } = req.body;
    if (![1, 2].includes(requestLimit)) return res.status(400).json({ error: 'Limit must be 1 or 2' });
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
    const { mode, active } = req.body;
    const validModes = ['arabesk', 'rock', '90s-pop', 'turkish-delight', 'tech', 'latino', 'rap'];
    if (!validModes.includes(mode)) return res.status(400).json({ error: 'Invalid mode' });
    const payload = { mode, active: !!active };
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

app.get('/api/events/:slug/genres', (req, res) => {
  try {
    const event = db.getEventBySlug(req.params.slug);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(db.getGenreStats(event.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/events/history', djAuth, (req, res) => {
  try {
    const history = db.getEventHistory(process.env.DJ_PASSWORD);
    res.json(history);
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
