import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import socket from '../socket.js';
import useSocketStatus from '../useSocketStatus.js';
import { t } from '../i18n/index.js';

const API = import.meta.env.PROD ? '' : 'http://localhost:3000';

function DiscoParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 35 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 2 + Math.random() * 4,
      duration: 8 + Math.random() * 12,
      delay: Math.random() * 10,
      color: ['rgba(0,212,255,0.6)', 'rgba(184,41,221,0.5)', 'rgba(255,0,128,0.4)', 'rgba(255,255,255,0.3)', 'rgba(0,255,136,0.3)'][Math.floor(Math.random() * 5)],
    })), []);

  return (
    <div className="disco-particles">
      {particles.map(p => (
        <div key={p.id} className="disco-particle" style={{
          left: `${p.left}%`, width: p.size, height: p.size,
          background: p.color,
          boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          animationDuration: `${p.duration}s`,
          animationDelay: `${p.delay}s`,
        }} />
      ))}
    </div>
  );
}

function LightBeams() {
  const beams = useMemo(() => [
    { left: '15%', delay: '0s', color: 'var(--neon-cyan)' },
    { left: '40%', delay: '2s', color: 'var(--neon-purple)' },
    { left: '65%', delay: '4s', color: 'var(--neon-pink)' },
    { left: '85%', delay: '1s', color: 'var(--neon-cyan)' },
  ], []);

  return (
    <div className="light-beams">
      {beams.map((b, i) => (
        <div key={i} className="light-beam" style={{
          left: b.left,
          background: `linear-gradient(180deg, transparent, ${b.color}, transparent)`,
          animationDelay: b.delay,
          animationDuration: `${6 + i * 2}s`,
        }} />
      ))}
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i, left: Math.random() * 100,
      delay: Math.random() * 2, duration: 2 + Math.random() * 3,
      color: ['#00d4ff', '#b829dd', '#ff0080', '#ff6b35', '#00ff88'][Math.floor(Math.random() * 5)],
      size: 6 + Math.random() * 10,
    })), []);
  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece" style={{
          left: `${p.left}%`, width: p.size, height: p.size,
          background: p.color, borderRadius: Math.random() > 0.5 ? '50%' : '2px',
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

function SongRow({ req, rank, lang }) {
  const [shaking, setShaking] = useState(false);
  const prevVotes = useRef(req.votes);
  const isTop3 = rank <= 3;

  useEffect(() => {
    if (req.votes > prevVotes.current) { setShaking(true); setTimeout(() => setShaking(false), 500); }
    prevVotes.current = req.votes;
  }, [req.votes]);

  return (
    <motion.tr
      className={`dtable-row ${isTop3 ? 'dtable-top3' : ''} ${rank === 1 ? 'dtable-first' : ''} ${shaking ? 'animate-shake' : ''}`}
      layout
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <td className={`dtable-rank rank-${rank}`}>
        {rank <= 3 ? <span className="dtable-medal">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</span> : rank}
      </td>
      <td className="dtable-art-cell">
        {req.album_art
          ? <img src={req.album_art} alt="" className="dtable-art" />
          : <div className="dtable-art-ph">🎵</div>
        }
      </td>
      <td className="dtable-info-cell">
        <div className={`dtable-song ${isTop3 ? 'dtable-song-lg' : ''}`}>{req.song_name}</div>
        {req.artist && <div className="dtable-artist">{req.artist}</div>}
      </td>
      <td className="dtable-votes-cell">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <VoteFloat count={req.votes} />
          <motion.span className={`dtable-votes ${isTop3 ? 'dtable-votes-lg' : ''}`}
            key={req.votes} initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
            {req.votes}
          </motion.span>
        </div>
        <span className="dtable-vote-label">{t(lang, 'request.votes')}</span>
      </td>
      {rank === 1 && req.votes >= 5 && (
        <td className="dtable-badge-cell">
          <span className="badge badge-hot"><span className="fire-icon">🔥</span></span>
        </td>
      )}
    </motion.tr>
  );
}

function EventSummary({ requests, lang }) {
  const totalRequests = requests.length;
  const totalVotes = requests.reduce((sum, r) => sum + r.votes, 0);
  const sorted = [...requests].sort((a, b) => b.votes - a.votes);
  const topVoted = sorted[0];

  return (
    <div className="summary-overlay">
      <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
        <div className="summary-title">{t(lang, 'display.summary_title')}</div>
      </motion.div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-card-label">{t(lang, 'display.summary_total_requests')}</div>
          <div className="summary-stat-big">{totalRequests}</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-label">{t(lang, 'display.summary_total_votes')}</div>
          <div className="summary-stat-big">{totalVotes}</div>
        </div>
        {topVoted && (
          <div className="summary-card">
            <div className="summary-card-label">{t(lang, 'display.summary_most_voted')}</div>
            <div className="summary-card-value">{topVoted.song_name}</div>
            {topVoted.artist && <div className="summary-card-sub">{topVoted.artist}</div>}
            <div style={{ marginTop: 8, color: 'var(--neon-cyan)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>
              {topVoted.votes} {t(lang, 'request.votes')}
            </div>
          </div>
        )}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
        style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 10 }}>
        {t(lang, 'display.summary_thanks')}
      </motion.div>
    </div>
  );
}

function Ticker({ requests, lang, tickerTexts }) {
  const hasRequests = requests.length > 0;
  const customLines = (tickerTexts || '').split('\n').map(s => s.trim()).filter(Boolean);

  const reqItems = requests.slice(0, 12);
  const textItems = customLines.length > 0
    ? customLines
    : [lang === 'tr' ? 'Remiks İstanbul etkinliğine hoşgeldiniz!' : 'Welcome to Remiks Istanbul!'];

  const items = hasRequests ? reqItems : textItems;
  const doubled = [...items, ...items];
  const duration = Math.max(20, items.length * 4);

  return (
    <div className="display-ticker">
      <div className="ticker-track" style={{ '--ticker-duration': `${duration}s` }}>
        {doubled.map((item, i) => (
          <div key={`ticker-${i}`} className="ticker-item">
            {hasRequests ? (
              <>
                <span className="ticker-emoji">🎵</span>
                <span className="ticker-song">{item.song_name}</span>
                {item.artist && <span>- {item.artist}</span>}
                <span style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>({item.votes} {t(lang, 'request.votes')})</span>
              </>
            ) : (
              <>
                <span className="ticker-emoji">✨</span>
                <span className="ticker-song">{item}</span>
              </>
            )}
            <span className="ticker-dot">●</span>
          </div>
        ))}
      </div>
    </div>
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
  const [connectedCount, setConnectedCount] = useState(0);
  const [brandText, setBrandText] = useState('');
  const [tickerTexts, setTickerTexts] = useState('');
  const [allRequests, setAllRequests] = useState([]);

  const socketConnected = useSocketStatus();
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
      setBrandText(eventData.brand_text || '');
      setTickerTexts(eventData.ticker_texts || '');
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
        prev.map(r => r.id === requestId ? { ...r, votes } : r).sort((a, b) => b.votes - a.votes)
      );
    });

    socket.on('list-updated', (list) => {
      setRequests(list.filter(r => r.status !== 'rejected' && r.status !== 'played'));
    });

    socket.on('event-status', ({ status, countdown_end }) => {
      setEvent(prev => {
        const oldStatus = prev?.status;
        if (status === 'active' && oldStatus === 'countdown') {
          setJustOpened(true); setShowConfetti(true);
          setTimeout(() => { setShowConfetti(false); setJustOpened(false); }, 4000);
        }
        if (status === 'ended') {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 6000);
          fetch(`${API}/api/events/${slug}/requests?all=true`)
            .then(r => r.json())
            .then(d => { if (d.requests) setAllRequests(d.requests); })
            .catch(() => {});
        }
        return prev ? { ...prev, status } : prev;
      });
      if (countdown_end) setCountdownEnd(countdown_end);
    });

    socket.on('language-changed', ({ language }) => setLang(language));
    socket.on('brand-updated', ({ brand_text }) => setBrandText(brand_text || ''));
    socket.on('ticker-updated', ({ ticker_texts }) => setTickerTexts(ticker_texts || ''));

    socket.on('room-count', ({ count }) => setConnectedCount(count));

    return () => {
      socket.off('request-added'); socket.off('vote-updated'); socket.off('list-updated');
      socket.off('event-status'); socket.off('language-changed'); socket.off('brand-updated');
      socket.off('ticker-updated'); socket.off('room-count');
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

  const top10 = requests.slice(0, 10);
  const displayName = brandText || event.name;

  return (
    <div className="display-page">
      <div className="display-bg" />
      <img src="/logos/disco-ball-bg.png" alt="" className="display-disco-img" />
      <DiscoParticles />
      <LightBeams />
      {showConfetti && <Confetti />}

      {!socketConnected && (
        <div className="socket-warning">{lang === 'tr' ? '⚠ Bağlantı kesildi' : '⚠ Disconnected'}</div>
      )}

      {showFullscreenHint && (
        <div className="display-fullscreen-hint" onClick={goFullscreen}>
          <span>{T('display.click_fullscreen')}</span>
        </div>
      )}

      <div className="display-content dsp-v2">
        {/* ─── Logo + Event Name + Motto (top center) + LIVE badge (top right) ─── */}
        <div className="dsp-topbar">
          <div className="dsp-topbar-center">
            <img src="/logos/logo-white.png" alt="Remiks İstanbul" className="dsp-brand-logo" />
            <motion.div className="dsp-event-name"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              {displayName}
            </motion.div>
            <div className="dsp-brand-motto">Request · Vote · Dance</div>
          </div>
          <div className="dsp-topbar-right">
            <div className="display-live-badge">
              <span className="live-dot" />
              <span style={{ color: '#ff4444' }}>LIVE</span>
              <span className="live-count">{connectedCount} {lang === 'tr' ? 'kişi' : 'people'}</span>
            </div>
          </div>
        </div>

        {/* ─── Ticker (always visible) ─── */}
        <Ticker requests={requests} lang={lang} tickerTexts={tickerTexts} />

        {/* ─── WAITING ─── */}
        {event.status === 'waiting' && (
          <div className="display-state-center display-waiting">
            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              {T('display.waiting')}
            </motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
              {T('display.scan_to_request')}
            </motion.p>
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.9 }}
              style={{ marginTop: 24, padding: 16, background: '#fff', borderRadius: 12, display: 'inline-block' }}>
              <QRCodeSVG value={requestUrl} size={140} bgColor="#ffffff" fgColor="#000000" level="M" />
            </motion.div>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              style={{ marginTop: 20, padding: 14, background: '#fff', borderRadius: 12, display: 'inline-block' }}>
              <QRCodeSVG value={requestUrl} size={120} bgColor="#ffffff" fgColor="#000000" level="M" />
            </motion.div>
          </div>
        )}

        {/* ─── ACTIVE: 3-column layout ─── */}
        {event.status === 'active' && (
          <>
            {justOpened && (
              <motion.div className="display-state-center"
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(5,5,16,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.h2
                  style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 900, background: 'var(--gradient-main)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                  initial={{ scale: 0.3 }} animate={{ scale: [0.3, 1.1, 1] }} transition={{ duration: 0.8, times: [0, 0.7, 1] }}>
                  {T('display.requests_open')}
                </motion.h2>
              </motion.div>
            )}

            <div className="dsp-3col">
              {/* LEFT: Song Table Card */}
              <div className="dsp-card dsp-list-card">
                <div className="dsp-card-title">
                  <span className="fire-icon">🔥</span> {T('display.hot_requests')}
                </div>
                {requests.length === 0 ? (
                  <div className="dsp-table-empty">
                    <span>🎵</span> {T('display.no_requests')}
                  </div>
                ) : (
                  <div className="dsp-table-wrap">
                    <table className="dsp-table">
                      <AnimatePresence>
                        <tbody>
                          {top10.map((req, idx) => (
                            <SongRow key={req.id} req={req} rank={idx + 1} lang={lang} />
                          ))}
                        </tbody>
                      </AnimatePresence>
                    </table>
                  </div>
                )}
              </div>

              {/* RIGHT: QR Card */}
              <div className="dsp-card dsp-qr-card">
                <div className="dsp-qr-box">
                  <QRCodeSVG value={requestUrl} size={160} bgColor="#ffffff" fgColor="#000000" level="M" />
                </div>
                <div className="dsp-qr-label">
                  {lang === 'tr' ? 'QR Kodu Tara' : 'Scan QR Code'}
                </div>
                <div className="dsp-qr-sub">
                  {lang === 'tr' ? 'İsteğini Gönder!' : 'Send Your Request!'}
                </div>
              </div>
            </div>
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
          <EventSummary requests={allRequests.length > 0 ? allRequests : requests} lang={lang} />
        )}
      </div>
    </div>
  );
}
