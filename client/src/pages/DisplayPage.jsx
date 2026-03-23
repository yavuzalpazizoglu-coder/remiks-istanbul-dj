import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import socket from '../socket.js';
import useSocketStatus from '../useSocketStatus.js';
import { t } from '../i18n/index.js';

const API = import.meta.env.PROD ? '' : 'http://localhost:3000';

function AmbientGlow() {
  return <div className="ambient-glow" />;
}

function NeonOrbs() {
  const orbs = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      id: i,
      left: 10 + (i * 16),
      top: 20 + Math.random() * 50,
      size: 80 + Math.random() * 120,
      duration: 12 + Math.random() * 10,
      delay: i * 2,
      color: ['rgba(0,212,255,0.12)', 'rgba(184,41,221,0.10)', 'rgba(255,0,128,0.08)', 'rgba(0,141,75,0.10)', 'rgba(255,107,53,0.08)', 'rgba(255,255,255,0.06)'][i],
    })), []);

  return (
    <div className="neon-orbs">
      {orbs.map(o => (
        <div key={o.id} className="neon-orb" style={{
          left: `${o.left}%`, top: `${o.top}%`,
          width: o.size, height: o.size,
          background: `radial-gradient(circle, ${o.color}, transparent 70%)`,
          animationDuration: `${o.duration}s`,
          animationDelay: `${o.delay}s`,
        }} />
      ))}
    </div>
  );
}

function DiscoParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 35 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 2 + Math.random() * 4,
      duration: 8 + Math.random() * 12,
      delay: Math.random() * 10,
      color: ['rgba(0,212,255,0.6)', 'rgba(184,41,221,0.5)', 'rgba(255,0,128,0.4)', 'rgba(255,255,255,0.3)', 'rgba(0,141,75,0.3)'][Math.floor(Math.random() * 5)],
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
      color: ['#00d4ff', '#b829dd', '#ff0080', '#ff6b35', '#008D4B'][Math.floor(Math.random() * 5)],
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

function OpeningOverlay({ lang, brandText, countdown, ceremonyEnd }) {
  const name = brandText || 'Remiks İstanbul';
  const [phase, setPhase] = useState(1);

  useEffect(() => {
    if (!ceremonyEnd) return;
    const totalMs = ceremonyEnd - Date.now();
    if (totalMs <= 0) return;

    const p2 = totalMs * 0.15;
    const p3 = totalMs * 0.40;
    const p4 = totalMs * 0.70;

    const t2 = setTimeout(() => setPhase(2), p2);
    const t3 = setTimeout(() => setPhase(3), p3);
    const t4 = setTimeout(() => setPhase(4), p4);
    return () => { clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [ceremonyEnd]);

  const letters = name.split('');

  return (
    <motion.div className={`ceremony-overlay opening-overlay opening-phase-${phase}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 1.5 } }}>

      {/* Phase 1: Darkness + ambient */}
      <div className="opening-ambient" />
      <div className="opening-grid-overlay" />

      {/* Phase 1 particles */}
      <div className="opening-particles">
        {Array.from({ length: 30 }, (_, i) => (
          <div key={i} className="opening-particle" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${6 + Math.random() * 8}s`,
          }} />
        ))}
      </div>

      {/* Phase 2: Logo reveal */}
      <div className="opening-logo-wrap">
        <span className="opening-logo"><span className="login-logo-remiks">Remiks</span><span className="login-logo-box">Box</span></span>
        <div className="opening-powered">POWERED BY REMiKS iSTANBUL</div>
      </div>

      {/* Phase 3: Event name letter-by-letter */}
      <div className="opening-event-block">
        <div className="opening-event-name" aria-label={name}>
          {letters.map((ch, i) => (
            <span key={i} className="opening-letter" style={{ animationDelay: `${i * 0.06}s` }}>
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          ))}
        </div>
        <div className="opening-motto">REQUEST · VOTE · DANCE</div>
      </div>

      {/* Phase 4: Neon finale */}
      <div className="opening-finale">
        <div className="opening-neon-text">
          {lang === 'tr' ? 'İYİ EĞLENCELER!' : 'ENJOY THE SHOW!'}
        </div>
        {countdown && <div className="opening-countdown">{countdown}</div>}
      </div>
    </motion.div>
  );
}

function useCountUp(target, duration = 2000, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active || target <= 0) { setVal(0); return; }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active]);
  return val;
}

function ClosingOverlay({ lang, brandText, countdown, ceremonyEnd, requests, eventName, nightState }) {
  const name = brandText || eventName || 'Remiks İstanbul';
  const [phase, setPhase] = useState(1);

  useEffect(() => {
    if (!ceremonyEnd) return;
    const totalMs = ceremonyEnd - Date.now();
    if (totalMs <= 0) return;
    const p2 = totalMs * 0.40;
    const p3 = totalMs * 0.75;
    const t2 = setTimeout(() => setPhase(2), p2);
    const t3 = setTimeout(() => setPhase(3), p3);
    return () => { clearTimeout(t2); clearTimeout(t3); };
  }, [ceremonyEnd]);

  const totalRequests = requests?.length || 0;
  const totalVotes = (requests || []).reduce((sum, r) => sum + (r.votes || 0), 0);
  const sorted = [...(requests || [])].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const topSong = sorted[0];
  const today = new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  const countReq = useCountUp(totalRequests, 2000, phase >= 1);
  const countVotes = useCountUp(totalVotes, 2000, phase >= 1);

  const confettiColors = ['var(--theme-primary, #00d4ff)', '#ffffff', '#FFD700', '#ff0080', '#008D4B'];

  return (
    <motion.div className={`ceremony-overlay closing-overlay closing-phase-${phase}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 1.5 } }}>

      <div className="closing-stars">
        {Array.from({ length: 40 }, (_, i) => (
          <div key={i} className="closing-star" style={{
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 6}s`, animationDuration: `${4 + Math.random() * 4}s`,
            width: 2 + Math.random() * 3, height: 2 + Math.random() * 3,
          }} />
        ))}
      </div>

      {/* Phase 1: Statistics */}
      <div className="closing-phase-block closing-stats-block">
        <div className="closing-stats-grid">
          <div className="closing-stat-card">
            <div className="closing-stat-number">{countReq}</div>
            <div className="closing-stat-label">{lang === 'tr' ? 'şarkı istendi' : 'songs requested'}</div>
          </div>
          <div className="closing-stat-card">
            <div className="closing-stat-number">{countVotes}</div>
            <div className="closing-stat-label">{lang === 'tr' ? 'oy kullanıldı' : 'votes cast'}</div>
          </div>
          {topSong && (
            <div className="closing-stat-card closing-stat-wide">
              <div className="closing-stat-icon">🔥</div>
              <div className="closing-stat-song">{topSong.song_name}</div>
              <div className="closing-stat-artist">{topSong.artist}</div>
              <div className="closing-stat-label">{lang === 'tr' ? 'en çok oy alan istek' : 'most voted request'}</div>
            </div>
          )}
          {nightState?.rounds?.filter(r => r.winnerId).map(r => {
            const w = r.finalists.find(f => f.id === r.winnerId);
            if (!w) return null;
            return (
              <div key={r.roundNumber} className="closing-stat-card closing-stat-wide">
                {w.albumArt && <img src={w.albumArt} alt="" className="closing-night-art" />}
                <div className="closing-stat-icon">🏆</div>
                <div className="closing-stat-song">{w.title}</div>
                <div className="closing-stat-artist">{w.artist} — {w.votes} {lang === 'tr' ? 'oy' : 'votes'}</div>
                <div className="closing-stat-label">{r.djName}{lang === 'tr' ? "'ın Gecenin Şarkısı" : "'s Song of the Night"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase 2: Thank you */}
      <div className="closing-phase-block closing-thankyou-block">
        <div className="closing-thankyou-text">
          {lang === 'tr' ? 'TEŞEKKÜRLER!' : 'THANK YOU!'}
        </div>
        <div className="closing-event-name">{name}</div>
        <div className="closing-event-date">{today}</div>
        <div className="closing-confetti">
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} className="closing-confetti-piece" style={{
              left: `${5 + Math.random() * 90}%`,
              '--fall-duration': `${5 + Math.random() * 5}s`,
              '--fall-delay': `${Math.random() * 4}s`,
              background: confettiColors[i % confettiColors.length],
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            }} />
          ))}
        </div>
      </div>

      {/* Phase 3: Logo + Instagram */}
      <div className="closing-phase-block closing-final-block">
        <span className="closing-final-logo"><span className="login-logo-remiks">Remiks</span><span className="login-logo-box">Box</span></span>
        <div className="closing-social-row">
          <div className="closing-social-info">
            <svg className="closing-ig-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            <div className="closing-ig-handle">@remiks.istanbul</div>
            <div className="closing-ig-cta">{lang === 'tr' ? 'Bizi Takip Edin' : 'Follow Us'}</div>
          </div>
          <div className="closing-ig-qr">
            <QRCodeSVG value="https://instagram.com/remiks.istanbul" size={200} bgColor="transparent" fgColor="#ffffff" />
          </div>
        </div>
        {countdown && <div className="closing-countdown">{countdown}</div>}
      </div>
    </motion.div>
  );
}

const MUSIC_MODE_CONFIG = {
  arabesk: {
    title: { tr: 'ARABESK MODE', en: 'ARABESK MODE' },
    subtitle: { tr: 'Remiks Arabesk Mode', en: 'Arabesk Mode' },
    icon: '🎻',
    bg: 'radial-gradient(ellipse at center, rgba(40, 15, 5, 0.95) 0%, rgba(10, 3, 0, 0.98) 100%)',
    color1: '#d4a017', color2: '#8b4513', color3: '#ff6b35',
    image: '/modes/mode-arabesk.png', imgClass: 'mm-img-arabesk',
  },
  rock: {
    title: { tr: 'ROCK MODE', en: 'ROCK MODE' },
    subtitle: { tr: 'Remiks Rock', en: 'Remiks Rock' },
    icon: '🎸',
    bg: 'radial-gradient(ellipse at center, rgba(30, 5, 5, 0.95) 0%, rgba(5, 0, 0, 0.98) 100%)',
    color1: '#ff4444', color2: '#ff0000', color3: '#ff6b35',
    image: '/modes/mode-rock.png', imgClass: 'mm-img-rock',
  },
  '90s-pop': {
    title: { tr: "90'LAR POP", en: "90S TURKISH POP" },
    subtitle: { tr: "90'lar Türkçe Pop", en: "90s Turkish Pop" },
    icon: '💿',
    bg: 'radial-gradient(ellipse at center, rgba(20, 5, 30, 0.95) 0%, rgba(5, 0, 10, 0.98) 100%)',
    color1: '#ff0080', color2: '#00d4ff', color3: '#b829dd',
    image: '/modes/mode-90s-pop.png', imgClass: 'mm-img-90s',
  },
  'turkish-delight': {
    title: { tr: 'TURKISH DELIGHT', en: 'TURKISH DELIGHT' },
    subtitle: { tr: 'Remiks Turkish Delight', en: 'Turkish Delight' },
    icon: '🌹',
    bg: 'radial-gradient(ellipse at center, rgba(25, 5, 15, 0.95) 0%, rgba(5, 0, 5, 0.98) 100%)',
    color1: '#e8a0bf', color2: '#d4a017', color3: '#ff6b9d',
    image: '/modes/mode-turkish-delight.png', imgClass: 'mm-img-delight',
  },
  tech: {
    title: { tr: 'TECH MODE', en: 'TECH MODE' },
    subtitle: { tr: 'Remiks Tech', en: 'Remiks Tech' },
    icon: '🎧',
    bg: 'radial-gradient(ellipse at center, rgba(0, 5, 20, 0.95) 0%, rgba(0, 2, 8, 0.98) 100%)',
    color1: '#0088ff', color2: '#008D4B', color3: '#00d4ff',
    image: '/modes/mode-tech.png', imgClass: 'mm-img-tech',
  },
  latino: {
    title: { tr: 'LATINO MODE', en: 'LATINO MODE' },
    subtitle: { tr: 'Remiks Latino', en: 'Remiks Latino' },
    icon: '💃',
    bg: 'radial-gradient(ellipse at center, rgba(30, 8, 0, 0.95) 0%, rgba(8, 2, 0, 0.98) 100%)',
    color1: '#e63946', color2: '#f4a261', color3: '#ff6b35',
    image: '/modes/mode-latino.png', imgClass: 'mm-img-latino',
  },
  rap: {
    title: { tr: 'RAP MODE', en: 'RAP MODE' },
    subtitle: { tr: 'Remiks Rap', en: 'Remiks Rap' },
    icon: '🎤',
    bg: 'radial-gradient(ellipse at center, rgba(20, 0, 0, 0.95) 0%, rgba(5, 0, 0, 0.98) 100%)',
    color1: '#cc0000', color2: '#444444', color3: '#8b0000',
    image: '/modes/mode-rap.png', imgClass: 'mm-img-rap',
  },
  winamp: {
    title: { tr: 'WINAMP MODE', en: 'WINAMP MODE' },
    subtitle: { tr: 'Winamp Mode', en: 'Winamp Mode' },
    icon: '📟',
    bg: 'radial-gradient(ellipse at center, rgba(35, 35, 35, 0.96) 0%, rgba(26, 26, 26, 0.98) 100%)',
    color1: '#007000', color2: '#008D00', color3: '#005500',
    image: '/modes/winamp_mode.png', imgClass: 'mm-img-winamp',
    modeClass: 'display-mode-winamp',
  },
  pioneer: {
    title: { tr: 'PIONEER MODE', en: 'PIONEER MODE' },
    subtitle: { tr: 'Pioneer Mode', en: 'Pioneer Mode' },
    icon: '🎛️',
    bg: 'radial-gradient(ellipse at center, rgba(8, 12, 24, 0.95) 0%, rgba(4, 6, 12, 0.98) 100%)',
    color1: '#00b4dc', color2: '#dc9628', color3: '#0064c8',
    image: '/modes/pioneer_mode.png', imgClass: 'mm-img-pioneer',
    modeClass: 'display-mode-pioneer',
  },
};

function MusicModeOverlay({ mode, lang, djPhotos = [] }) {
  const cfg = MUSIC_MODE_CONFIG[mode];
  if (!cfg) return null;

  return (
    <motion.div className={`music-mode-overlay mm-overlay-${mode} ${cfg.modeClass || ''}`}
      style={{ background: cfg.bg }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 1 } }}>
      <div className="mm-border-frame" style={{ '--mm-c1': cfg.color1, '--mm-c2': cfg.color2, '--mm-c3': cfg.color3 }} />
      {cfg.image && <motion.img src={cfg.image} alt="" className={`mm-bg-image ${cfg.imgClass}`}
        initial={{ opacity: 0, scale: 1.15 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5 }}
      />}

      {mode === 'winamp' && (
        <>
          <div className="winamp-scanlines" />
          <div className="winamp-grid" />
          <div className="winamp-eq-bg">
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} className="winamp-eq-bar" style={{
                '--eq-speed': `${(0.6 + Math.random() * 1.0).toFixed(2)}s`,
                '--eq-min': (0.2 + Math.random() * 0.3).toFixed(2),
                height: `${30 + Math.random() * 70}%`,
              }} />
            ))}
          </div>
        </>
      )}

      {mode === 'pioneer' && (
        <>
          <div className="pioneer-grid" />
          <div className="pioneer-jog-glow" />
          <div className="pioneer-jog-ring" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="pioneer-particle" style={{
              left: `${Math.random() * 100}%`,
              '--p-dur': `${10 + Math.random() * 15}s`,
              '--p-delay': `${Math.random() * 10}s`,
            }} />
          ))}
        </>
      )}

      {djPhotos.length > 0 && (
        <div className="mm-dj-photos">
          {djPhotos.map((dj, i) => (
            <motion.div key={dj.id} className={`mm-dj-card mm-dj-${i === 0 ? 'left' : 'right'}`}
              initial={{ opacity: 0, y: 40, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.3, duration: 0.8, type: 'spring' }}>
              <div className="mm-dj-img-wrap">
                <img src={dj.src} alt={dj.name} className="mm-dj-img" />
              </div>
              <span className="mm-dj-live-badge"><span className="mm-dj-live-dot" />LIVE</span>
              <span className="mm-dj-name">{dj.name}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
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

function SongRow({ req, rank, lang, isPlayed }) {
  const [shaking, setShaking] = useState(false);
  const prevVotes = useRef(req.votes);
  const isTop3 = rank <= 3;

  useEffect(() => {
    if (req.votes > prevVotes.current) { setShaking(true); setTimeout(() => setShaking(false), 500); }
    prevVotes.current = req.votes;
  }, [req.votes]);

  return (
    <motion.tr
      className={`dtable-row ${isTop3 ? 'dtable-top3' : ''} ${rank === 1 ? 'dtable-first' : ''} ${shaking ? 'animate-shake' : ''} ${isPlayed ? 'dtable-played' : ''}`}
      layout
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      initial={{ opacity: 0, x: -30 }}
      animate={isPlayed ? { opacity: [1, 1, 1, 0], x: 0, scale: [1, 1.02, 1.02, 0.8] } : { opacity: 1, x: 0 }}
      {...(isPlayed ? { transition: { duration: 40, times: [0, 0.1, 0.85, 1] } } : {})}
    >
      <td className={`dtable-rank rank-${rank}`}>
        {isPlayed ? <span className="dtable-medal">🔥</span> : rank <= 3 ? <span className="dtable-medal">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</span> : rank}
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
        {isPlayed && <div className="dtable-played-label">{lang === 'tr' ? '🔥 Çalınıyor!' : '🔥 Now Playing!'}</div>}
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
      {rank === 1 && req.votes >= 5 && !isPlayed && (
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
  const isPreview = new URLSearchParams(window.location.search).get('preview') === 'true';
  const [showConfetti, setShowConfetti] = useState(false);
  const [countdownEnd, setCountdownEnd] = useState(null);
  const [countdownDisplay, setCountdownDisplay] = useState('');
  const [openingActive, setOpeningActive] = useState(false);
  const [closingActive, setClosingActive] = useState(false);
  const [ceremonyEnd, setCeremonyEnd] = useState(null);
  const [ceremonyCountdown, setCeremonyCountdown] = useState('');
  const [connectedCount, setConnectedCount] = useState(0);
  const [brandText, setBrandText] = useState('');
  const [tickerTexts, setTickerTexts] = useState('');
  const [allRequests, setAllRequests] = useState([]);
  const [playedId, setPlayedId] = useState(null);
  const [theme, setTheme] = useState('cyan');
  const [animLevel, setAnimLevel] = useState('high');
  const [activeMusicMode, setActiveMusicMode] = useState(null);
  const [modeDJPhotos, setModeDJPhotos] = useState([]);
  const [nightState, setNightState] = useState(null);

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
      setTheme(eventData.theme || 'cyan');
      setAnimLevel(eventData.animation_level || 'high');
      setRequests((reqData.requests || []).filter(r => r.status === 'approved'));
      if (eventData.countdown_end) setCountdownEnd(eventData.countdown_end);
    } catch (err) { console.warn('DisplayPage fetchData failed:', err); }
  }, [slug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    socket.connect();
    socket.emit('join-event', { eventSlug: slug, role: 'display' });

    socket.on('request-added', (req) => {
      if (req.status !== 'approved') return;
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
      setRequests(list.filter(r => r.status === 'approved'));
    });

    socket.on('request-played', (req) => {
      setPlayedId(req.id);
      setTimeout(() => setPlayedId(null), 40000);
    });

    socket.on('event-status', ({ status, countdown_end }) => {
      setEvent(prev => {
        if (status === 'ended') {
          fetch(`${API}/api/events/${slug}/requests?all=true`)
            .then(r => r.json())
            .then(d => { if (d.requests) setAllRequests(d.requests); })
            .catch(() => {});
        }
        return prev ? { ...prev, status } : prev;
      });
      if (countdown_end) setCountdownEnd(countdown_end);
    });

    socket.on('ceremony', ({ type, active, endTime }) => {
      if (type === 'opening') {
        setOpeningActive(active);
        if (active) setClosingActive(false);
        setCeremonyEnd(active && endTime ? endTime : null);
        if (active) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 10000); }
      }
      if (type === 'closing') {
        setClosingActive(active);
        if (active) setOpeningActive(false);
        setCeremonyEnd(active && endTime ? endTime : null);
        if (active) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 10000); }
      }
      if (!active) setCeremonyEnd(null);
    });

    socket.on('language-changed', ({ language }) => setLang(language));
    socket.on('brand-updated', ({ brand_text }) => setBrandText(brand_text || ''));
    socket.on('ticker-updated', ({ ticker_texts }) => setTickerTexts(ticker_texts || ''));
    socket.on('theme-changed', ({ theme }) => setTheme(theme));
    socket.on('animation-changed', ({ level }) => setAnimLevel(level));

    socket.on('music-mode', ({ mode, active, djPhotos }) => {
      setActiveMusicMode(active ? mode : null);
      setModeDJPhotos(active && Array.isArray(djPhotos) ? djPhotos : []);
    });

    socket.on('room-count', ({ count }) => setConnectedCount(count));

    socket.on('night-update', (data) => setNightState(data));
    socket.on('night-vote', ({ roundNumber, finalists, totalVotes }) => {
      setNightState(prev => {
        if (!prev) return prev;
        const rounds = prev.rounds.map(r => {
          if (r.roundNumber !== roundNumber) return r;
          return { ...r, finalists: r.finalists.map(f => {
            const updated = finalists.find(u => u.id === f.id);
            return updated ? { ...f, votes: updated.votes } : f;
          }), totalVotes };
        });
        return { ...prev, rounds };
      });
    });

    return () => {
      socket.off('request-added'); socket.off('vote-updated'); socket.off('list-updated');
      socket.off('event-status'); socket.off('language-changed'); socket.off('brand-updated');
      socket.off('ticker-updated'); socket.off('room-count'); socket.off('request-played');
      socket.off('theme-changed'); socket.off('animation-changed'); socket.off('ceremony'); socket.off('music-mode');
      socket.off('night-update'); socket.off('night-vote');
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

  useEffect(() => {
    if (!ceremonyEnd) { setCeremonyCountdown(''); return; }
    const interval = setInterval(() => {
      const diff = ceremonyEnd - Date.now();
      if (diff <= 0) {
        setCeremonyCountdown('00:00');
        setOpeningActive(false);
        setClosingActive(false);
        setCeremonyEnd(null);
        clearInterval(interval);
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCeremonyCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [ceremonyEnd]);

  useEffect(() => {
    const round = nightState?.rounds?.[nightState?.currentRound - 1];
    if (round?.phase !== 'voting' || !round?.endTime) return;
    const interval = setInterval(() => {
      setNightState(prev => ({ ...prev }));
    }, 1000);
    return () => clearInterval(interval);
  }, [nightState?.rounds?.[nightState?.currentRound - 1]?.phase]);

  const goFullscreen = () => {
    setShowFullscreenHint(false);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  if (!event) return <div className="display-page"><div className="display-bg" /></div>;

  const top10 = requests.slice(0, 10);
  const displayName = brandText || event.name;

  const themeColors = {
    cyan: { primary: '#00d4ff', glow: 'rgba(0,212,255,0.3)' },
    purple: { primary: '#b829dd', glow: 'rgba(184,41,221,0.3)' },
    pink: { primary: '#ff0080', glow: 'rgba(255,0,128,0.3)' },
    green: { primary: '#008D4B', glow: 'rgba(0,141,75,0.3)' },
    orange: { primary: '#ff6b35', glow: 'rgba(255,107,53,0.3)' },
    red: { primary: '#ff4444', glow: 'rgba(255,68,68,0.3)' },
  };
  const tc = themeColors[theme] || themeColors.cyan;

  return (
    <div className="display-page" style={{ '--theme-primary': tc.primary, '--theme-glow': tc.glow }}>
      {!isPreview && (
        <div className="live-indicator" aria-hidden="true">
          <span className="live-indicator-dot" />
          LIVE
        </div>
      )}
      <div className="display-bg" />
      <div className="floating-particles" aria-hidden="true" />
      <img src="/logos/disco-ball-bg.png" alt="" className="display-disco-img" />
      {animLevel === 'low' && <AmbientGlow />}
      {animLevel === 'medium' && <NeonOrbs />}
      {animLevel === 'high' && <><DiscoParticles /><LightBeams /></>}
      {showConfetti && <Confetti />}

      {!socketConnected && (
        <div className="socket-warning">{lang === 'tr' ? '⚠ Bağlantı kesildi' : '⚠ Disconnected'}</div>
      )}

      {showFullscreenHint && !isPreview && (
        <div className="display-fullscreen-hint" onClick={goFullscreen}>
          <span>{T('display.click_fullscreen')}</span>
        </div>
      )}

      <div className="display-content dsp-v2">
        {/* ─── Logo + Event Name + Motto (top center) + LIVE badge (top right) ─── */}
        <div className="dsp-topbar">
          <div className="dsp-topbar-center">
            <span className="dsp-brand-logo"><span className="login-logo-remiks">Remiks</span><span className="login-logo-box">Box</span></span>
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

        {/* ─── OPENING OVERLAY ─── */}
        <AnimatePresence>
          {openingActive && (
            <OpeningOverlay lang={lang} brandText={displayName} countdown={ceremonyCountdown} ceremonyEnd={ceremonyEnd} />
          )}
        </AnimatePresence>

        {/* ─── ACTIVE: 3-column layout ─── */}
        {event.status === 'active' && !openingActive && (
          <>
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
                            <SongRow key={req.id} req={req} rank={idx + 1} lang={lang} isPlayed={playedId === req.id} />
                          ))}
                        </tbody>
                      </AnimatePresence>
                    </table>
                  </div>
                )}
              </div>

              {/* RIGHT: VS Card + QR Card */}
              <div className="dsp-card dsp-qr-card">
                {(() => {
                  const nightRound = nightState?.rounds?.[nightState.currentRound - 1];
                  const nightPhase = nightRound?.phase;
                  const nightFinalists = nightRound?.finalists || [];
                  const nightMaxVotes = Math.max(...nightFinalists.map(f => f.votes), 1);
                  const nightLeader = nightFinalists.length > 0 ? [...nightFinalists].sort((a, b) => b.votes - a.votes)[0]?.id : null;
                  const nightRemaining = nightRound?.endTime ? Math.max(0, (nightRound.endTime - Date.now()) / 1000) : 0;
                  const nightProgress = nightRound?.duration ? Math.min(100, ((Date.now() - (nightRound.startedAt || Date.now())) / (nightRound.duration * 1000)) * 100) : 0;
                  const nm = Math.floor(nightRemaining / 60);
                  const ns = Math.floor(nightRemaining % 60);
                  const nightWinner = nightRound?.winnerId ? nightFinalists.find(f => f.id === nightRound.winnerId) : null;

                  if ((nightPhase === 'voting' || nightPhase === 'finished') && nightFinalists.length > 0) {
                    return (
                      <div className="night-vs-card">
                        <div className="night-vs-title">★ {lang === 'tr' ? 'GECENİN ŞARKISI' : 'SONG OF THE NIGHT'}</div>
                        <div className="night-vs-round-label">{nightRound?.djName} {lang === 'tr' ? 'Turu' : 'Round'}</div>
                        {nightFinalists.map((f, i) => (
                          <div key={f.id}>
                            <div className={`night-vs-song ${f.id === nightLeader ? 'leading' : ''} ${nightPhase === 'finished' && f.id !== nightRound?.winnerId ? 'night-vs-loser' : ''}`}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'clamp(4px,0.5vw,10px)' }}>
                                {f.albumArt && <img src={f.albumArt} alt="" className="night-vs-album-art" />}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="night-vs-song-title">{f.title}</div>
                                  <div className="night-vs-song-artist">{f.artist}</div>
                                </div>
                                <div className="night-vs-vote-count">{f.votes}</div>
                              </div>
                              <div className="night-vs-bar">
                                <div className="night-vs-bar-fill" style={{ width: `${(f.votes / nightMaxVotes) * 100}%` }} />
                              </div>
                            </div>
                            {i < nightFinalists.length - 1 && (
                              <div className="night-vs-divider">─── VS ───</div>
                            )}
                          </div>
                        ))}
                        {nightPhase === 'voting' && (
                          <>
                            <div className="night-vs-countdown" style={{ marginTop: 'clamp(4px,0.6vw,12px)' }}>
                              <span className={nightRemaining < 30 ? 'critical' : ''}>⏱ {String(nm).padStart(2, '0')}:{String(ns).padStart(2, '0')}</span>
                            </div>
                            <div className="night-vs-progress">
                              <div className={`night-vs-progress-fill ${nightRemaining < 30 ? 'urgent' : ''}`} style={{ width: `${nightProgress}%` }} />
                            </div>
                          </>
                        )}
                        {nightPhase === 'finished' && nightWinner && (
                          <div style={{ textAlign: 'center', marginTop: 'clamp(4px,0.5vw,10px)' }}>
                            <span className="night-vs-title" style={{ fontSize: 'clamp(9px,1.1vw,20px)' }}>🏆 {lang === 'tr' ? 'KAZANAN' : 'WINNER'}: {nightWinner.title}</span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="dsp-qr-box">
                  <QRCodeSVG value={requestUrl} size={300} bgColor="#ffffff" fgColor="#000000" level="M" className="dsp-qr-svg" />
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

        {/* ─── PAUSED: Live Performance Screen ─── */}
        {event.status === 'paused' && (
          <div className="performance-mode">
            <div className="performance-equalizer">
              <span /><span /><span /><span /><span />
              <span /><span /><span /><span /><span />
              <span /><span /><span /><span /><span />
              <span /><span /><span /><span /><span />
            </div>
          </div>
        )}

        {/* ─── CLOSING OVERLAY ─── */}
        <AnimatePresence>
          {closingActive && (
            <ClosingOverlay lang={lang} brandText={displayName} countdown={ceremonyCountdown} ceremonyEnd={ceremonyEnd} requests={requests} eventName={event?.name} nightState={nightState} />
          )}
        </AnimatePresence>

        {/* ─── MUSIC MODE OVERLAY ─── */}
        <AnimatePresence>
          {activeMusicMode && !openingActive && !closingActive && (
            <MusicModeOverlay mode={activeMusicMode} lang={lang} djPhotos={modeDJPhotos} />
          )}
        </AnimatePresence>

        {/* ─── NIGHT FULLSCREEN WINNER ─── */}
        {nightState?.showFullscreen && (() => {
          const round = nightState.rounds[nightState.currentRound - 1];
          const winner = round?.winnerId ? round.finalists.find(f => f.id === round.winnerId) : null;
          if (!winner) return null;
          return (
            <motion.div className="night-winner-fullscreen"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
              <div className="night-winner-dj-name">{round.djName}</div>
              <div className="night-winner-badge">{lang === 'tr' ? 'GECENİN ŞARKISI' : 'SONG OF THE NIGHT'}</div>
              {winner.albumArt && <motion.img src={winner.albumArt} alt="" className="night-winner-album-art" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }} />}
              <motion.div className="night-winner-song-name"
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }}>
                {winner.title}
              </motion.div>
              <div className="night-winner-artist-name">{winner.artist}</div>
              <div style={{ marginTop: 'clamp(8px,1vw,20px)', fontSize: 'clamp(14px,1.8vw,40px)', color: 'var(--theme-primary,#00d4ff)' }}>
                🏆 {winner.votes} {lang === 'tr' ? 'oy' : 'votes'}
              </div>
            </motion.div>
          );
        })()}

        {/* ─── ENDED (summary after closing) ─── */}
        {event.status === 'ended' && !closingActive && (
          <EventSummary requests={allRequests.length > 0 ? allRequests : requests} lang={lang} />
        )}
      </div>
    </div>
  );
}
