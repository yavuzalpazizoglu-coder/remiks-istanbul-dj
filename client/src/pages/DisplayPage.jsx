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
  }));
  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece" style={{
          left: `${p.left}%`, width: p.size, height: p.size,
          background: p.color,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`,
        }} />
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
  return floats.map(id => (
    <motion.span key={id}
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -30, scale: 1.4 }}
      transition={{ duration: 0.7 }}
      style={{ position: 'absolute', top: -8, color: 'var(--neon-cyan)', fontWeight: 900, fontSize: 14, pointerEvents: 'none' }}
    >+1</motion.span>
  ));
}

function PodiumCard({ req, rank, lang }) {
  const [shaking, setShaking] = useState(false);
  const prevVotes = useRef(req.votes);

  useEffect(() => {
    if (req.votes > prevVotes.current) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
    prevVotes.current = req.votes;
  }, [req.votes]);

  return (
    <motion.div
      className={`podium-card rank-${rank} glass ${shaking ? 'animate-shake' : ''}`}
      layout
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ order: rank === 1 ? 1 : rank === 2 ? 0 : 2 }}
    >
      <div className="podium-rank">#{rank}</div>
      {req.album_art
        ? <img src={req.album_art} alt="" className="podium-art" />
        : <div className="podium-art-placeholder">🎵</div>
      }
      <div className="podium-song">{req.song_name}</div>
      {req.artist && <div className="podium-artist">{req.artist}</div>}
      <div className="podium-votes" style={{ position: 'relative' }}>
        <VoteFloat count={req.votes} />
        <motion.span key={req.votes} initial={{ scale: 1.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}>
          {req.votes}
        </motion.span>
      </div>
      <div className="podium-vote-label">{t(lang, 'request.votes')}</div>
      {rank === 1 && req.votes >= 5 && (
        <div style={{ position: 'absolute', top: 8, right: 10 }}>
          <span className="badge badge-hot"><span className="fire-icon">🔥</span> HOT</span>
        </div>
      )}
    </motion.div>
  );
}

function RestItem({ req, rank, lang }) {
  const [shaking, setShaking] = useState(false);
  const prevVotes = useRef(req.votes);

  useEffect(() => {
    if (req.votes > prevVotes.current) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
    prevVotes.current = req.votes;
  }, [req.votes]);

  return (
    <motion.div
      className={`display-rest-item ${shaking ? 'animate-shake' : ''}`}
      layout
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <span className="song-rank">{rank}</span>
      {req.album_art
        ? <img src={req.album_art} alt="" className="song-album-art" />
        : <div className="song-album-art-placeholder">🎵</div>
      }
      <div className="song-info">
        <div className="song-name">{req.song_name}</div>
        {req.artist && <div className="song-artist">{req.artist}</div>}
      </div>
      <div style={{ position: 'relative' }}>
        <VoteFloat count={req.votes} />
        <div className="display-rest-vote">{req.votes}</div>
      </div>
      {req.votes >= 10 && <span className="fire-icon" style={{ fontSize: 18 }}>🔥</span>}
    </motion.div>
  );
}

export default function DisplayPage() {
  const { slug } = useParams();
  const [event, setEvent] = useState(null);
  const [lang, setLang] = useState('tr');
  const [requests, setRequests] = useState([]);
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
      setRequests((reqData.requests || []).filter(r => r.status !== 'rejected' && r.status !== 'played'));
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
        return [...prev, req].sort((a, b) => b.votes - a.votes);
      });
    });

    socket.on('vote-updated', ({ requestId, votes }) => {
      setRequests(prev =>
        prev.map(r => r.id === requestId ? { ...r, votes } : r)
            .sort((a, b) => b.votes - a.votes)
      );
    });

    socket.on('list-updated', (list) => {
      setRequests(list.filter(r => r.status !== 'rejected' && r.status !== 'played'));
    });

    socket.on('event-status', ({ status, countdown_end }) => {
      setEvent(prev => {
        const oldStatus = prev?.status;
        if (status === 'active' && oldStatus === 'countdown') {
          setJustOpened(true);
          setShowConfetti(true);
          setTimeout(() => { setShowConfetti(false); setJustOpened(false); }, 4000);
        }
        if (status === 'ended') {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 6000);
        }
        return prev ? { ...prev, status } : prev;
      });
      if (countdown_end) setCountdownEnd(countdown_end);
    });

    socket.on('language-changed', ({ language }) => setLang(language));

    return () => {
      socket.off('request-added');
      socket.off('vote-updated');
      socket.off('list-updated');
      socket.off('event-status');
      socket.off('language-changed');
      socket.disconnect();
    };
  }, [slug]);

  useEffect(() => {
    if (!countdownEnd || event?.status !== 'countdown') { setCountdownDisplay(''); return; }
    const interval = setInterval(() => {
      const diff = countdownEnd - Date.now();
      if (diff <= 0) { setCountdownDisplay('00:00'); clearInterval(interval); return; }
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

  const top3 = requests.slice(0, 3);
  const rest = requests.slice(3, 8);

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

        {/* Header: Logo centered */}
        <div className="display-header">
          <img src="/logos/logo-white.png" alt="Remiks İstanbul" className="logo logo-display" />
        </div>

        {/* ─── WAITING ─── */}
        {event.status === 'waiting' && (
          <div className="display-state-center display-waiting">
            <motion.img src="/logos/logo-white.png" alt="" className="display-waiting-logo"
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} />
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
            <motion.div className="countdown-label" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
              {T('display.countdown_title')}
            </motion.div>
            <motion.div className="countdown-timer" key={countdownDisplay}
              initial={{ scale: 1.03 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
              {countdownDisplay || '--:--'}
            </motion.div>
            <div className="countdown-sub">{T('display.scan_to_request')}</div>
          </div>
        )}

        {/* ─── ACTIVE ─── */}
        {event.status === 'active' && (
          <>
            {justOpened && (
              <motion.div className="display-state-center"
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(7,7,26,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.h2
                  style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 900, background: 'var(--gradient-main)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                  initial={{ scale: 0.3 }} animate={{ scale: [0.3, 1.1, 1] }} transition={{ duration: 0.8, times: [0, 0.7, 1] }}>
                  {T('display.requests_open')}
                </motion.h2>
              </motion.div>
            )}

            {requests.length === 0 ? (
              <div className="display-state-center">
                <div style={{ fontSize: 48, marginBottom: 16 }}>🎵</div>
                <p style={{ color: 'var(--text-muted)', fontSize: 18 }}>{T('display.no_requests')}</p>
              </div>
            ) : (
              <>
                {/* Podium: Top 3 */}
                <LayoutGroup>
                  {top3.length > 0 && (
                    <div className="display-podium">
                      {top3.map((req, idx) => (
                        <PodiumCard key={req.id} req={req} rank={idx + 1} lang={lang} />
                      ))}
                      {top3.length === 1 && <><div /><div /></>}
                      {top3.length === 2 && <div />}
                    </div>
                  )}

                  {/* Rest of list */}
                  {rest.length > 0 && (
                    <div className="display-rest-list">
                      {rest.map((req, idx) => (
                        <RestItem key={req.id} req={req} rank={idx + 4} lang={lang} />
                      ))}
                    </div>
                  )}
                </LayoutGroup>
              </>
            )}
          </>
        )}

        {/* ─── PAUSED ─── */}
        {event.status === 'paused' && (
          <div className="display-state-center display-paused">
            <motion.div style={{ fontSize: 72, marginBottom: 16 }} animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 3 }}>🎧</motion.div>
            <h2>{T('display.paused')}</h2>
            <p>{T('display.paused_sub')}</p>
          </div>
        )}

        {/* ─── ENDED ─── */}
        {event.status === 'ended' && (
          <div className="display-state-center display-ended">
            <motion.div style={{ fontSize: 72, marginBottom: 16 }} initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, 10, -10, 0] }} transition={{ duration: 0.8 }}>🎉</motion.div>
            <h2>{T('display.ended')}</h2>
            <p>{T('display.ended_sub')}</p>
          </div>
        )}

        {/* QR Code - Bottom Center */}
        <div className="display-qr-bottom">
          <div className="qr-box">
            <QRCodeSVG value={requestUrl} size={64} bgColor="#ffffff" fgColor="#000000" level="M" />
          </div>
          <div className="qr-text">{T('display.scan_to_request')}</div>
        </div>

      </div>
    </div>
  );
}
