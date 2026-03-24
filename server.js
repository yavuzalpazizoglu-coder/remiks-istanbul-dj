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
        setTimeout(() => {
          const requests = db.getRequests(event.id);
          io.to(event.slug).emit('list-updated', requests);
        }, 40000);
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
    const valid = ['classic', 'minimal', 'elegant', 'club', 'festival', 'corporate'];
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

app.get('/api/events/:slug/genres', (req, res) => {
  try {
    const event = db.getEventBySlug(req.params.slug);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(db.getGenreStats(event.id));
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

// ─── Song of the Night ───

function createNightRound(djName = 'DJ 1') {
  return {
    roundNumber: 1,
    djName,
    finalists: [],
    phase: 'idle',
    duration: 180,
    startedAt: null,
    endTime: null,
    votedUsers: {},
    totalVotes: 0,
    winnerId: null,
  };
}

function getNightState(slug) {
  if (!activeNightVotes.has(slug)) {
    activeNightVotes.set(slug, {
      currentRound: 1,
      rounds: [createNightRound('DJ 1')],
      showFullscreen: false,
    });
  }
  return activeNightVotes.get(slug);
}

function nightPayload(state) {
  const rounds = state.rounds.map(r => ({
    ...r,
    votedUsers: undefined,
    voterCount: Object.keys(r.votedUsers || {}).length,
  }));
  return { currentRound: state.currentRound, rounds, showFullscreen: state.showFullscreen };
}

app.get('/api/events/:slug/night/status', (req, res) => {
  const state = getNightState(req.params.slug);
  res.json(nightPayload(state));
});

app.post('/api/events/:slug/night/finalists', djAuth, (req, res) => {
  try {
    const { action, title, artist, albumArt, spotifyId, songId } = req.body;
    const state = getNightState(req.params.slug);
    const round = state.rounds[state.currentRound - 1];
    if (!round || round.phase !== 'idle') return res.status(400).json({ error: 'Cannot modify finalists now' });

    if (action === 'add') {
      if (!title) return res.status(400).json({ error: 'Title required' });
      if (round.finalists.length >= 3) return res.status(400).json({ error: 'Max 3 finalists' });
      const id = Math.random().toString(36).slice(2, 10);
      round.finalists.push({ id, title: sanitize(title), artist: sanitize(artist || ''), albumArt: albumArt || '', spotifyId: spotifyId || '', votes: 0 });
    } else if (action === 'remove') {
      round.finalists = round.finalists.filter(f => f.id !== songId);
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    io.to(req.params.slug).emit('night-update', nightPayload(state));
    res.json(nightPayload(state));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events/:slug/night/start', djAuth, (req, res) => {
  try {
    const { duration } = req.body;
    const state = getNightState(req.params.slug);
    const round = state.rounds[state.currentRound - 1];
    if (!round) return res.status(400).json({ error: 'No round found' });
    if (round.finalists.length !== 3) return res.status(400).json({ error: 'Need exactly 3 finalists' });
    if (round.phase === 'voting') return res.status(400).json({ error: 'Already voting' });

    const dur = Math.min(Math.max(Number(duration) || 180, 60), 1800);
    round.phase = 'voting';
    round.duration = dur;
    round.startedAt = Date.now();
    round.endTime = Date.now() + dur * 1000;
    round.votedUsers = {};
    round.totalVotes = 0;
    round.finalists.forEach(f => { f.votes = 0; });
    state.showFullscreen = false;

    io.to(req.params.slug).emit('night-update', nightPayload(state));
    res.json(nightPayload(state));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events/:slug/night/stop', djAuth, (req, res) => {
  try {
    const state = getNightState(req.params.slug);
    const round = state.rounds[state.currentRound - 1];
    if (!round) return res.status(400).json({ error: 'No round' });

    round.phase = 'finished';
    round.endTime = null;
    const sorted = [...round.finalists].sort((a, b) => b.votes - a.votes);
    if (sorted.length > 0) round.winnerId = sorted[0].id;

    io.to(req.params.slug).emit('night-update', nightPayload(state));
    res.json(nightPayload(state));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events/:slug/night/vote', (req, res) => {
  if (!rateLimit(req.ip, 60)) return res.status(429).json({ error: 'Too many votes' });
  try {
    const { songId, visitorId } = req.body;
    if (!songId || !visitorId) return res.status(400).json({ error: 'songId and visitorId required' });

    const state = getNightState(req.params.slug);
    const round = state.rounds[state.currentRound - 1];
    if (!round || round.phase !== 'voting') return res.status(400).json({ error: 'Voting not active' });
    if (round.endTime && Date.now() > round.endTime) return res.status(400).json({ error: 'Voting ended' });
    if (round.votedUsers[visitorId]) return res.status(400).json({ error: 'Already voted this round' });

    const song = round.finalists.find(f => f.id === songId);
    if (!song) return res.status(400).json({ error: 'Song not found' });

    song.votes++;
    round.totalVotes++;
    round.votedUsers[visitorId] = songId;

    io.to(req.params.slug).emit('night-vote', {
      roundNumber: round.roundNumber,
      finalists: round.finalists.map(f => ({ id: f.id, votes: f.votes })),
      totalVotes: round.totalVotes,
    });
    res.json({ ok: true, votedFor: songId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events/:slug/night/fullscreen', djAuth, (req, res) => {
  try {
    const { show } = req.body;
    const state = getNightState(req.params.slug);
    state.showFullscreen = !!show;
    io.to(req.params.slug).emit('night-update', nightPayload(state));
    res.json(nightPayload(state));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events/:slug/night/new-round', djAuth, (req, res) => {
  try {
    const { djName } = req.body;
    const state = getNightState(req.params.slug);
    if (state.currentRound >= 2) return res.status(400).json({ error: 'Max 2 rounds' });

    const newRound = createNightRound(djName || 'DJ 2');
    newRound.roundNumber = 2;
    state.rounds.push(newRound);
    state.currentRound = 2;
    state.showFullscreen = false;

    io.to(req.params.slug).emit('night-update', nightPayload(state));
    res.json(nightPayload(state));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/events/:slug/night/reset', djAuth, (req, res) => {
  try {
    activeNightVotes.delete(req.params.slug);
    const state = getNightState(req.params.slug);
    io.to(req.params.slug).emit('night-update', nightPayload(state));
    res.json(nightPayload(state));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Socket.io ───

const activeCeremonies = new Map();
const activeMusicModes = new Map();
const activeNightVotes = new Map();

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
    const nightState = activeNightVotes.get(eventSlug);
    if (nightState) {
      socket.emit('night-update', nightPayload(nightState));
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
