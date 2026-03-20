import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import socket from '../socket.js';
import { t } from '../i18n/index.js';

const API = import.meta.env.PROD ? '' : 'http://localhost:3000';

function Confetti() {
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 3,
    color: ['#00d4ff', '#b829dd', '#ff0080', '#ff6b35', '#00ff88'][Math.floor(Math.random() * 5)],
    size: 6 + Math.random() * 10,
    rotation: Math.random() * 360,
  }));

  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function Equalizer() {
  return (
    <div className="now-playing-eq">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="eq-bar" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}

function VoteFloat({ count }) {
  const [floats, setFloats] = useState([]);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      const id = Date.now();
      setFloats(prev => [...prev, id]);
      setTimeout(() => setFloats(prev => prev.filter(f => f !== id)), 1000);
    }
    prevCount.current = count;
  }, [count]);

  return (
    <>
      {floats.map(id => (
        <motion.span
          key={id}
          initial={{ opacity: 1, y: 0, scale: 1 }}
          animate={{ opacity: 0, y: -40, scale: 1.5 }}
          transition={{ duration: 0.8 }}
          style={{ position: 'absolute', top: -10, color: 'var(--neon-cyan)', fontWeight: 900, fontSize: 16, pointerEvents: 'none' }}
        >
          +1
        </motion.span>
      ))}
    </>
  );
}

export default function DisplayPage() {
  const { slug } = useParams();

  const [event, setEvent] = useState(null);
  const [lang, setLang] = useState('tr');
  const [requests, setRequests] = useState([]);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [showFullscreenHint, setShowFullscreenHint] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [countdownEnd, setCountdownEnd] = useState(null);
  const [countdownDisplay, setCountdownDisplay] = useState('');
  const [justOpened, setJustOpened] = useState(false);

  const T = useCallback((key) => t(lang, key), [lang]);

  const requestUrl = `${window.location.origin}/request/${slug}`;

  const fetchData = useCallback(async () => {
    try {
      const [eventRes, reqRes] = await Promise.all([
        fetch(`${API}/api/events/${slug}`),
        fetch(`${API}/api/events/${slug}/requests`),
      ]);
      if (!eventRes.ok) return;
      const eventData = await eventRes.json();
      const reqData = await reqRes.json();
      setEvent(eventData);
      setLang(eventData.language || 'tr');
      const reqs = reqData.requests || [];
      setRequests(reqs.filter(r => r.status !== 'playing'));
      const playing = reqs.find(r => r.status === 'playing');
      if (playing) setNowPlaying(playing);
      if (eventData.countdown_end) setCountdownEnd(eventData.countdown_end);
    } catch {}
  }, [slug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    socket.connect();
    socket.emit('join-event', { eventSlug: slug, role: 'display' });

    socket.on('request-added', (req) => {
      setRequests(prev => {
        if (prev.find(r => r.id === req.id)) return prev;
        return [...prev, { ...req, isNew: true }].sort((a, b) => b.votes - a.votes);
      });
      setTimeout(() => {
        setRequests(prev => prev.map(r => r.id === req.id ? { ...r, isNew: false } : r));
      }, 2000);
    });

    socket.on('vote-updated', ({ requestId, votes }) => {
      setRequests(prev =>
        prev.map(r => r.id === requestId ? { ...r, votes } : r)
            .sort((a, b) => b.votes - a.votes)
      );
    });

    socket.on('list-updated', (list) => {
      const playing = list.find(r => r.status === 'playing');
      if (playing) setNowPlaying(playing);
      else setNowPlaying(null);
      setRequests(list.filter(r => r.status !== 'playing' && r.status !== 'rejected' && r.status !== 'played'));
    });

    socket.on('now-playing', (req) => {
      setNowPlaying(req);
      setRequests(prev => prev.filter(r => r.id !== req.id));
    });

    socket.on('event-status', ({ status, countdown_end }) => {
      setEvent(prev => prev ? { ...prev, status } : prev);
      if (countdown_end) setCountdownEnd(countdown_end);
      if (status === 'active' && event?.status === 'countdown') {
        setJustOpened(true);
        setShowConfetti(true);
        setTimeout(() => { setShowConfetti(false); setJustOpened(false); }, 4000);
      }
      if (status === 'ended') {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 6000);
      }
    });

    socket.on('language-changed', ({ language }) => setLang(language));

    return () => {
      socket.off('request-added');
      socket.off('vote-updated');
      socket.off('list-updated');
      socket.off('now-playing');
      socket.off('event-status');
      socket.off('language-changed');
      socket.disconnect();
    };
  }, [slug, event?.status, fetchData]);

  // Countdown timer
  useEffect(() => {
    if (!countdownEnd || event?.status !== 'countdown') {
      setCountdownDisplay('');
      return;
    }
    const interval = setInterval(() => {
      const diff = countdownEnd - Date.now();
      if (diff <= 0) {
        setCountdownDisplay('00:00');
        clearInterval(interval);
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdownDisplay(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 100);
    return () => clearInterval(interval);
  }, [countdownEnd, event?.status]);

  const goFullscreen = () => {
    setShowFullscreenHint(false);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  if (!event) return <div className="display-page"><div className="display-bg" /></div>;

  const displayRequests = requests.slice(0, 8);

  return (
    <div className="display-page">
      <div className="display-bg" />

      {showConfetti && <Confetti />}

      {showFullscreenHint && (
        <div className="display-fullscreen-hint" onClick={goFullscreen}>
          <span>{T('display.click_fullscreen')}</span>
        </div>
      )}

      <div className="display-content">
        {/* Header */}
        <div className="display-header">
          <div className="display-header-left">
            <img src="/logos/logo-white.png" alt="Remiks İstanbul" className="logo logo-display" />
          </div>
          <div className="display-header-right">
            <div>
              <div className="display-qr">
                <QRCodeSVG value={requestUrl} size={80} bgColor="#ffffff" fgColor="#000000" level="M" />
              </div>
              <div className="display-qr-label">{T('display.scan_to_request')}</div>
            </div>
          </div>
        </div>

        {/* ─── WAITING ─── */}
        {event.status === 'waiting' && (
          <div className="display-state-center display-waiting">
            <motion.img
              src="/logos/logo-white.png"
              alt=""
              className="display-waiting-logo"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1 }}
            />
            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              {T('display.waiting')}
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
              {T('display.scan_to_request')}
            </motion.p>
          </div>
        )}

        {/* ─── COUNTDOWN ─── */}
        {event.status === 'countdown' && (
          <div className="display-state-center display-countdown">
            <motion.div
              className="countdown-label"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {T('display.countdown_title')}
            </motion.div>
            <motion.div
              className="countdown-timer"
              key={countdownDisplay}
              initial={{ scale: 1.05 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              {countdownDisplay || '--:--'}
            </motion.div>
            <div className="countdown-sub">{T('display.scan_to_request')}</div>
          </div>
        )}

        {/* ─── ACTIVE ─── */}
        {(event.status === 'active' || event.status === 'countdown') && event.status === 'active' && (
          <>
            {justOpened && (
              <motion.div
                className="display-state-center"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(10,10,26,0.95)' }}
              >
                <motion.h2
                  style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 900, background: 'var(--gradient-main)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                  initial={{ scale: 0.3 }}
                  animate={{ scale: [0.3, 1.1, 1] }}
                  transition={{ duration: 0.8, times: [0, 0.7, 1] }}
                >
                  {T('display.requests_open')}
                </motion.h2>
              </motion.div>
            )}

            {/* Now Playing */}
            <AnimatePresence>
              {nowPlaying && (
                <motion.div
                  className="display-now-playing"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  layout
                >
                  <Equalizer />
                  {nowPlaying.album_art && (
                    <img src={nowPlaying.album_art} alt="" className="now-playing-art" />
                  )}
                  <div style={{ flex: 1 }}>
                    <div className="now-playing-tag">{T('display.now_playing')}</div>
                    <div className="now-playing-song">{nowPlaying.song_name}</div>
                    {nowPlaying.artist && <div className="now-playing-artist">{nowPlaying.artist}</div>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Request List */}
            <div className="display-list-area">
              <div className="display-list-title">
                <span className="fire-icon">🔥</span>
                {T('display.hot_requests')}
              </div>

              {displayRequests.length === 0 ? (
                <div className="display-state-center" style={{ minHeight: '40vh' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🎵</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 20 }}>{T('display.no_requests')}</p>
                </div>
              ) : (
                <LayoutGroup>
                  <div className="display-list">
                    {displayRequests.map((req, idx) => (
                      <motion.div
                        key={req.id}
                        className={`display-song-card ${req.isNew ? 'is-new' : ''} ${idx === 0 ? 'is-top-1' : ''}`}
                        layout
                        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                        initial={{ opacity: 0, x: 80 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <span className={`song-rank ${idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : ''}`} style={{ fontSize: 28 }}>
                          {idx + 1}
                        </span>

                        {req.album_art ? (
                          <img src={req.album_art} alt="" className="song-album-art" style={{ width: 56, height: 56 }} />
                        ) : (
                          <div className="song-album-art-placeholder" style={{ width: 56, height: 56 }}>🎵</div>
                        )}

                        <div className="song-info" style={{ flex: 1 }}>
                          <div className="song-name" style={{ fontSize: 20 }}>{req.song_name}</div>
                          {req.artist && <div className="song-artist" style={{ fontSize: 15 }}>{req.artist}</div>}
                        </div>

                        <div style={{ textAlign: 'center', position: 'relative' }}>
                          <VoteFloat count={req.votes} />
                          <motion.div
                            className="display-vote-count"
                            key={req.votes}
                            initial={{ scale: 1.3 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400 }}
                          >
                            {req.votes}
                          </motion.div>
                          <div className="display-vote-label">{t(lang, 'request.votes')}</div>
                        </div>

                        {idx === 0 && req.votes >= 5 && (
                          <div style={{ position: 'absolute', top: 8, right: 12 }}>
                            <span className="badge badge-hot">🔥 HOT</span>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </LayoutGroup>
              )}
            </div>
          </>
        )}

        {/* ─── PAUSED ─── */}
        {event.status === 'paused' && (
          <div className="display-state-center display-paused">
            <motion.div style={{ fontSize: 80, marginBottom: 20 }} animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 3 }}>
              🎧
            </motion.div>
            <h2>{T('display.paused')}</h2>
            <p>{T('display.paused_sub')}</p>
          </div>
        )}

        {/* ─── ENDED ─── */}
        {event.status === 'ended' && (
          <div className="display-state-center display-ended">
            <motion.div style={{ fontSize: 80, marginBottom: 20 }} initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, 10, -10, 0] }} transition={{ duration: 0.8 }}>
              🎉
            </motion.div>
            <h2>{T('display.ended')}</h2>
            <p>{T('display.ended_sub')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
