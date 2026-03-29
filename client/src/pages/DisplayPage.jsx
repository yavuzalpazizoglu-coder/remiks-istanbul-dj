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

function NeonOrbs({ themeRgb }) {
  const orbs = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      id: i,
      left: 10 + (i * 16),
      top: 20 + Math.random() * 50,
      size: 80 + Math.random() * 120,
      duration: 12 + Math.random() * 10,
      delay: i * 2,
      opacity: [0.14, 0.11, 0.09, 0.12, 0.08, 0.07][i],
    })), []);

  return (
    <div className="neon-orbs">
      {orbs.map(o => (
        <div key={o.id} className="neon-orb" style={{
          left: `${o.left}%`, top: `${o.top}%`,
          width: o.size, height: o.size,
          background: `radial-gradient(circle, rgba(${themeRgb}, ${o.opacity}), transparent 70%)`,
          animationDuration: `${o.duration}s`,
          animationDelay: `${o.delay}s`,
        }} />
      ))}
    </div>
  );
}

function DiscoParticles({ themeRgb }) {
  const particles = useMemo(() =>
    Array.from({ length: 35 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 2 + Math.random() * 4,
      duration: 8 + Math.random() * 12,
      delay: Math.random() * 10,
      opacity: [0.6, 0.5, 0.4, 0.3, 0.35][Math.floor(Math.random() * 5)],
    })), []);

  return (
    <div className="disco-particles">
      {particles.map(p => {
        const c = `rgba(${themeRgb}, ${p.opacity})`;
        return (
          <div key={p.id} className="disco-particle" style={{
            left: `${p.left}%`, width: p.size, height: p.size,
            background: c,
            boxShadow: `0 0 ${p.size * 3}px ${c}`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }} />
        );
      })}
    </div>
  );
}

function LightBeams({ themeColor }) {
  const beams = useMemo(() => [
    { left: '15%', delay: '0s' },
    { left: '40%', delay: '2s' },
    { left: '65%', delay: '4s' },
    { left: '85%', delay: '1s' },
  ], []);

  return (
    <div className="light-beams">
      {beams.map((b, i) => (
        <div key={i} className="light-beam" style={{
          left: b.left,
          background: `linear-gradient(180deg, transparent, ${themeColor}, transparent)`,
          animationDelay: b.delay,
          animationDuration: `${6 + i * 2}s`,
        }} />
      ))}
    </div>
  );
}

function GeoShapes({ themeRgb }) {
  const shapes = useMemo(() => {
    const types = ['triangle', 'diamond', 'hexagon', 'circle-ring', 'square'];
    return Array.from({ length: 14 }, (_, i) => ({
      id: i,
      type: types[i % types.length],
      left: 5 + Math.random() * 90,
      top: 5 + Math.random() * 90,
      size: 25 + Math.random() * 50,
      duration: 16 + Math.random() * 14,
      delay: Math.random() * 12,
      opacity: 0.15 + Math.random() * 0.2,
    }));
  }, []);

  return (
    <div className="geo-shapes">
      {shapes.map(s => {
        const color = `rgba(${themeRgb}, ${s.opacity})`;
        const isOutline = s.type === 'circle-ring' || s.type === 'square';
        return (
          <div key={s.id} className={`geo-shape geo-${s.type}`} style={{
            left: `${s.left}%`, top: `${s.top}%`,
            width: s.size, height: s.size,
            ...(isOutline
              ? { borderColor: color, background: 'transparent' }
              : { background: color, borderColor: 'transparent' }),
            boxShadow: `0 0 ${s.size * 0.4}px ${color}`,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }} />
        );
      })}
    </div>
  );
}

function Sparkles({ themeRgb, count = 20 }) {
  const sparks = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: 2 + Math.random() * 3,
      duration: 2 + Math.random() * 3,
      delay: Math.random() * 5,
      opacity: 0.4 + Math.random() * 0.5,
    })), [count]);

  return (
    <div className="sparkle-field">
      {sparks.map(s => {
        const c = `rgba(${themeRgb}, ${s.opacity})`;
        return (
          <div key={s.id} className="sparkle-dot" style={{
            left: `${s.left}%`, top: `${s.top}%`,
            width: s.size, height: s.size,
            background: c,
            boxShadow: `0 0 ${s.size * 2}px ${c}, 0 0 ${s.size * 4}px ${c}`,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
          }} />
        );
      })}
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

/* ═══ STAGE-SPECIFIC VISUAL COMPONENTS ═══ */

function ClubEqualizer({ themeRgb }) {
  const bars = useMemo(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      height: 20 + Math.random() * 60,
      duration: 0.4 + Math.random() * 0.8,
      delay: Math.random() * 0.5,
    })), []);

  return (
    <div className="club-equalizer">
      {bars.map(b => (
        <div key={b.id} className="club-eq-bar" style={{
          '--bar-h': `${b.height}%`,
          background: `linear-gradient(0deg, rgba(${themeRgb},0.8), rgba(${themeRgb},0.2) 70%, transparent)`,
          animationDuration: `${b.duration}s`,
          animationDelay: `${b.delay}s`,
        }} />
      ))}
    </div>
  );
}

function ClubLasers({ themeRgb }) {
  const lasers = useMemo(() => [
    { angle: -25, left: '30%', delay: 0 },
    { angle: 15, left: '50%', delay: 1.5 },
    { angle: -10, left: '70%', delay: 3 },
    { angle: 20, left: '20%', delay: 4.5 },
    { angle: -30, left: '80%', delay: 2 },
  ], []);

  return (
    <div className="club-lasers">
      {lasers.map((l, i) => (
        <div key={i} className="club-laser" style={{
          left: l.left,
          transform: `rotate(${l.angle}deg)`,
          background: `linear-gradient(180deg, rgba(${themeRgb},0.6), rgba(${themeRgb},0.0))`,
          animationDelay: `${l.delay}s`,
        }} />
      ))}
    </div>
  );
}

function ClubStrobe() {
  return <div className="club-strobe" />;
}

function ElegantShimmerCurtain({ themeRgb }) {
  const strands = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: 2 + (i * 5),
      height: 30 + Math.random() * 40,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 5,
      opacity: 0.12 + Math.random() * 0.15,
    })), []);

  return (
    <div className="elegant-shimmer-curtain">
      {strands.map(s => (
        <div key={s.id} className="elegant-shimmer-strand" style={{
          left: `${s.left}%`,
          height: `${s.height}%`,
          background: `linear-gradient(180deg, rgba(${themeRgb},${s.opacity}), transparent)`,
          animationDuration: `${s.duration}s`,
          animationDelay: `${s.delay}s`,
        }} />
      ))}
    </div>
  );
}

function ElegantBokeh({ themeRgb }) {
  const circles = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      left: 5 + Math.random() * 90,
      top: 5 + Math.random() * 90,
      size: 60 + Math.random() * 200,
      duration: 18 + Math.random() * 15,
      delay: Math.random() * 10,
      opacity: 0.08 + Math.random() * 0.12,
    })), []);

  return (
    <div className="elegant-bokeh">
      {circles.map(c => (
        <div key={c.id} className="elegant-bokeh-circle" style={{
          left: `${c.left}%`, top: `${c.top}%`,
          width: c.size, height: c.size,
          background: `radial-gradient(circle, rgba(${themeRgb},${c.opacity}) 0%, rgba(${themeRgb},${c.opacity * 0.4}) 40%, transparent 70%)`,
          animationDuration: `${c.duration}s`,
          animationDelay: `${c.delay}s`,
        }} />
      ))}
    </div>
  );
}

function ElegantDust({ themeRgb }) {
  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 1.5 + Math.random() * 3,
      duration: 10 + Math.random() * 15,
      delay: Math.random() * 12,
      opacity: 0.5 + Math.random() * 0.4,
    })), []);

  return (
    <div className="elegant-dust">
      {particles.map(p => (
        <div key={p.id} className="elegant-dust-particle" style={{
          left: `${p.left}%`,
          width: p.size, height: p.size,
          background: `rgba(${themeRgb},${p.opacity})`,
          boxShadow: `0 0 ${p.size * 6}px rgba(${themeRgb},${p.opacity * 0.5})`,
          animationDuration: `${p.duration}s`,
          animationDelay: `${p.delay}s`,
        }} />
      ))}
    </div>
  );
}

function FestivalSpotlights({ themeRgb }) {
  const spots = useMemo(() => [
    { x: '0%', color: '255,60,100', delay: 0 },
    { x: '100%', color: '60,120,255', delay: 2 },
    { x: '50%', color: themeRgb, delay: 4 },
    { x: '25%', color: '255,200,0', delay: 1 },
    { x: '75%', color: '0,255,150', delay: 3 },
  ], [themeRgb]);

  return (
    <div className="festival-spots">
      {spots.map((s, i) => (
        <div key={i} className="festival-spot" style={{
          left: s.x,
          background: `conic-gradient(from 250deg, transparent 0deg, rgba(${s.color},0.2) 15deg, transparent 30deg)`,
          animationDelay: `${s.delay}s`,
        }} />
      ))}
    </div>
  );
}

function FestivalConfetti() {
  const pieces = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 4 + Math.random() * 8,
      color: ['#ff3c64','#ffd000','#3c78ff','#00e87b','#b83cff','#ff8c00'][i % 6],
      duration: 6 + Math.random() * 8,
      delay: Math.random() * 8,
      rotate: Math.random() * 360,
    })), []);

  return (
    <div className="festival-confetti">
      {pieces.map(p => (
        <div key={p.id} className="festival-confetti-piece" style={{
          left: `${p.left}%`,
          width: p.size, height: p.size * 0.6,
          background: p.color,
          transform: `rotate(${p.rotate}deg)`,
          animationDuration: `${p.duration}s`,
          animationDelay: `${p.delay}s`,
          borderRadius: Math.random() > 0.5 ? '50%' : '1px',
        }} />
      ))}
    </div>
  );
}

function FestivalColorBars({ themeRgb }) {
  const barColors = useMemo(() => [
    '255,60,100', '60,120,255', themeRgb, '255,200,0', '0,255,150', '180,60,255',
  ], [themeRgb]);

  return (
    <div className="festival-color-bars">
      {barColors.map((c, i) => (
        <div key={i} className="festival-color-bar" style={{
          background: `rgba(${c}, 0.4)`,
          animationDelay: `${i * 0.8}s`,
        }} />
      ))}
    </div>
  );
}

function FestivalWaves({ themeRgb }) {
  return (
    <div className="festival-waves">
      <div className="festival-wave" style={{ '--wave-color': `rgba(${themeRgb},0.12)`, animationDelay: '0s' }} />
      <div className="festival-wave" style={{ '--wave-color': `rgba(${themeRgb},0.08)`, animationDelay: '2s' }} />
      <div className="festival-wave" style={{ '--wave-color': `rgba(${themeRgb},0.06)`, animationDelay: '4s' }} />
    </div>
  );
}

function MinimalScanLine({ themeRgb }) {
  return <div className="minimal-scanline" style={{ background: `linear-gradient(90deg, transparent, rgba(${themeRgb},0.3), transparent)` }} />;
}

function MinimalPulseRing({ themeRgb }) {
  return (
    <div className="minimal-pulse-rings">
      <div className="minimal-pulse-ring" style={{ borderColor: `rgba(${themeRgb},0.2)`, animationDelay: '0s' }} />
      <div className="minimal-pulse-ring" style={{ borderColor: `rgba(${themeRgb},0.15)`, animationDelay: '2s' }} />
      <div className="minimal-pulse-ring" style={{ borderColor: `rgba(${themeRgb},0.1)`, animationDelay: '4s' }} />
    </div>
  );
}

function CorporateDataStreams({ themeRgb }) {
  const streams = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      left: 8 + (i * 12),
      duration: 6 + Math.random() * 6,
      delay: Math.random() * 5,
      opacity: 0.1 + Math.random() * 0.1,
    })), []);

  return (
    <div className="corporate-streams">
      {streams.map(s => (
        <div key={s.id} className="corporate-stream" style={{
          left: `${s.left}%`,
          background: `linear-gradient(180deg, transparent, rgba(${themeRgb},${s.opacity}) 40%, rgba(${themeRgb},${s.opacity}) 60%, transparent)`,
          animationDuration: `${s.duration}s`,
          animationDelay: `${s.delay}s`,
        }} />
      ))}
    </div>
  );
}

function CorporateGrid() {
  return <div className="corporate-grid" />;
}

function CorporateAccentLine({ themeRgb }) {
  return (
    <div className="corporate-accent-line" style={{
      background: `linear-gradient(90deg, transparent, rgba(${themeRgb},0.6), transparent)`,
    }} />
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

function ClosingOverlay({ lang, brandText, countdown, ceremonyEnd, requests, eventName }) {
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

  const albumArts = (requests || []).filter(r => r.album_art).map(r => r.album_art);

  return (
    <motion.div className={`ceremony-overlay closing-overlay closing-phase-${phase}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 1.5 } }}>

      {albumArts.length > 0 && (
        <div className="closing-album-grid">
          {albumArts.map((art, i) => (
            <div key={i} className="closing-album-tile" style={{ backgroundImage: `url(${art})` }} />
          ))}
        </div>
      )}

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
  const [voteFlash, setVoteFlash]   = useState(false);
  const [delta, setDelta]           = useState(0);
  const [showDelta, setShowDelta]   = useState(false);
  const [rankFlash, setRankFlash]   = useState(null); // 'up'|'down'|null
  const [fadingOut, setFadingOut]   = useState(false);
  const prevVotes   = useRef(req.votes);
  const prevRank    = useRef(rank);
  const deltaTimer  = useRef(null);
  const fadeTimer   = useRef(null);
  const isTop3      = rank <= 3;

  useEffect(() => {
    if (req.votes > prevVotes.current) {
      const d = req.votes - prevVotes.current;
      setDelta(d);
      setShowDelta(true);
      setVoteFlash(true);
      clearTimeout(deltaTimer.current);
      deltaTimer.current = setTimeout(() => { setShowDelta(false); setDelta(0); }, 6000);
      setTimeout(() => setVoteFlash(false), 1200);
    }
    prevVotes.current = req.votes;
  }, [req.votes]);

  useEffect(() => {
    if (rank < prevRank.current)      { setRankFlash('up');   setTimeout(() => setRankFlash(null), 2500); }
    else if (rank > prevRank.current) { setRankFlash('down'); setTimeout(() => setRankFlash(null), 2500); }
    prevRank.current = rank;
  }, [rank]);

  /* 1 dakika sonra satır solar */
  useEffect(() => {
    clearTimeout(fadeTimer.current);
    if (isPlayed) {
      setFadingOut(false);
      fadeTimer.current = setTimeout(() => setFadingOut(true), 58000);
    } else {
      setFadingOut(false);
    }
    return () => clearTimeout(fadeTimer.current);
  }, [isPlayed]);

  const tier = rank <= 3 ? rank : 'rest';

  return (
    <motion.tr
      className={`dtable-row ${isTop3 ? 'dtable-top3' : ''} ${rank === 1 ? 'dtable-first' : ''} ${isPlayed ? 'dtable-played' : ''} ${voteFlash ? 'dtable-vote-flash' : ''} ${fadingOut ? 'dtf-row-fadeout' : ''}`}
      layout
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      {/* ── # Sıra ── */}
      <td className="dtf-rank-cell">
        {isPlayed
          ? <span className="dtf-playing-dot" />
          : <>
              <span className={`dtf-rank-num dtf-rank-${tier}`}>{rank}</span>
              {rankFlash && (
                <span className={`dtf-rank-arrow dtf-arrow-${rankFlash}`}>
                  {rankFlash === 'up' ? '▲' : '▼'}
                </span>
              )}
            </>
        }
      </td>

      {/* ── Albüm kapağı (Spotify) ── */}
      <td className="dtf-art-cell">
        {req.album_art
          ? <img src={req.album_art} alt="" className="dtf-art" />
          : <div className="dtf-art-ph">♪</div>
        }
      </td>

      {/* ── Şarkı adı + Sanatçı ── */}
      <td className="dtf-name-cell">
        <div className={`dtf-song-name ${isTop3 ? 'dtf-song-top' : ''}`}>{req.song_name}</div>
        {req.artist && <div className="dtf-artist">{req.artist}</div>}
        {isPlayed && <div className="dtf-live-label">● ÇALINIYOR</div>}
      </td>

      {/* ── Oy sayısı — "fiyat" ── */}
      <td className="dtf-votes-cell">
        <VoteFloat count={req.votes} />
        <motion.span
          className={`dtf-votes-num ${isTop3 ? 'dtf-votes-top' : ''}`}
          key={req.votes}
          initial={{ scale: 1.25 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.35 }}
        >
          {req.votes}
        </motion.span>
        <span className="dtf-votes-label">OY</span>
      </td>

      {/* ── Değişim — "% change" ── */}
      <td className="dtf-chg-cell">
        {showDelta && delta > 0
          ? <motion.span className="dtf-chg-pill dtf-chg-green"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
            >+{delta}</motion.span>
          : rankFlash === 'up'
            ? <span className="dtf-chg-pill dtf-chg-up">▲</span>
            : rankFlash === 'down'
              ? <span className="dtf-chg-pill dtf-chg-dn">▼</span>
              : <span className="dtf-chg-flat">—</span>
        }
      </td>
    </motion.tr>
  );
}

function EventSummary({ requests, lang, eventName }) {
  const totalRequests = requests.length;
  const totalVotes = requests.reduce((sum, r) => sum + (r.votes || 0), 0);
  const sorted = [...requests].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const top3 = sorted.slice(0, 3);
  const albumArts = requests.filter(r => r.album_art).map(r => r.album_art);
  const today = new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const confettiColors = ['var(--theme-primary, #00d4ff)', '#ffffff', '#FFD700', '#ff0080', '#008D4B'];

  return (
    <div className="summary-overlay">
      {albumArts.length > 0 && (
        <div className="closing-album-grid">
          {albumArts.map((art, i) => (
            <div key={i} className="closing-album-tile" style={{ backgroundImage: `url(${art})` }} />
          ))}
        </div>
      )}

      <div className="closing-stars">
        {Array.from({ length: 40 }, (_, i) => (
          <div key={i} className="closing-star" style={{
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 6}s`, animationDuration: `${4 + Math.random() * 4}s`,
            width: 2 + Math.random() * 3, height: 2 + Math.random() * 3,
          }} />
        ))}
      </div>

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

      {/* ── EN ÜSTTE: Etkinlik Adı + Tarih ── */}
      <motion.div className="summary-event-header"
        initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
        {eventName && <div className="summary-event-name">{eventName}</div>}
        <div className="summary-event-date">{today}</div>
      </motion.div>

      {/* ── Gecenin Özeti başlığı ── */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}>
        <div className="summary-title">{t(lang, 'display.summary_title')}</div>
      </motion.div>

      {/* ── Top 3 ── */}
      {top3.length > 0 && (
        <motion.div className="summary-top3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}>
          <div className="summary-top3-title">{lang === 'tr' ? '🏆 EN ÇOK OY ALAN ŞARKILAR' : '🏆 MOST VOTED SONGS'}</div>
          <div className="summary-top3-list">
            {top3.map((song, i) => (
              <motion.div key={song.id || i} className={`summary-top3-card rank-${i + 1}`}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + i * 0.2 }}>
                <div className="summary-top3-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</div>
                {song.album_art && <img src={song.album_art} alt="" className="summary-top3-art" />}
                <div className="summary-top3-info">
                  <div className="summary-top3-song">{song.song_name}</div>
                  {song.artist && <div className="summary-top3-artist">{song.artist}</div>}
                </div>
                <div className="summary-top3-votes">{song.votes} {lang === 'tr' ? 'oy' : 'votes'}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── ALTTA: İstatistikler ── */}
      <motion.div className="summary-stats-bottom"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.6 }}>
        <div className="summary-stat-item">
          <span className="summary-stat-num">{totalRequests}</span>
          <span className="summary-stat-lbl">{lang === 'tr' ? 'şarkı istendi' : 'songs requested'}</span>
        </div>
        <div className="summary-stat-divider" />
        <div className="summary-stat-item">
          <span className="summary-stat-num">{totalVotes}</span>
          <span className="summary-stat-lbl">{lang === 'tr' ? 'oy kullanıldı' : 'votes cast'}</span>
        </div>
        <div className="summary-stat-divider" />
        <div className="summary-stat-item">
          <span className="summary-stat-num summary-stat-thanks">{lang === 'tr' ? 'TEŞEKKÜRLER!' : 'THANK YOU!'}</span>
        </div>
      </motion.div>

    </div>
  );
}

function LiveStat({ value, label }) {
  const [flash, setFlash] = useState(false);
  const prevVal = useRef(value);
  useEffect(() => {
    if (prevVal.current !== value) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      prevVal.current = value;
      return () => clearTimeout(t);
    }
  }, [value]);
  return (
    <div className={`dsp-live-stat${flash ? ' dsp-live-stat-flash' : ''}`}>
      <span className="dsp-live-stat-val">{value}</span>
      <span className="dsp-live-stat-lbl">{label}</span>
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
  const duration = Math.max(24, items.length * 4.5);

  const separatorEmojis = ['🎶', '◆', '🎵', '◆', '✦', '◆', '🎸', '◆'];

  return (
    <div className="display-ticker">
      <div className="ticker-track" style={{ '--ticker-duration': `${duration}s` }}>
        {doubled.map((item, i) => {
          const rank = (i % items.length) + 1;
          return (
            <div key={`ticker-${i}`} className="ticker-item">
              {hasRequests ? (
                <>
                  <span className="ticker-emoji">🎵</span>
                  <span className="ticker-rank">#{rank}</span>
                  <span className="ticker-song">{item.song_name}</span>
                  {item.artist && <span className="ticker-artist">· {item.artist}</span>}
                  <span className="ticker-votes">⬆ {item.votes} oy</span>
                </>
              ) : (
                <>
                  <span className="ticker-emoji">✨</span>
                  <span className="ticker-song">{item}</span>
                </>
              )}
              <span className="ticker-dot">{separatorEmojis[i % separatorEmojis.length]}</span>
            </div>
          );
        })}
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
  const [playedSong, setPlayedSong] = useState(null);   // tam nesne — listeden çıksa da göster
  const playedSongTimer = useRef(null);
  const [playedCount, setPlayedCount] = useState(0);
  const [theme, setTheme] = useState('cyan');
  const [animLevel, setAnimLevel] = useState('high');
  const [stageDesign, setStageDesign] = useState('classic');
  const [eventLogo, setEventLogo] = useState('');
  const [activeMusicMode, setActiveMusicMode] = useState(null);
  const [modeDJPhotos, setModeDJPhotos] = useState([]);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);
  const [blackout, setBlackout] = useState(false);
  const [spotlightText, setSpotlightText] = useState('');
  const [rejiCountdown, setRejiCountdown] = useState(0);
  const [displayCard, setDisplayCard] = useState(null);
  const displayCardTimer = useRef(null);
  const rejiCountdownTimer = useRef(null);

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
      setStageDesign(eventData.stage_design || 'classic');
      setEventLogo(eventData.event_logo || '');
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
      setPlayedSong(req);
      setPlayedCount(c => c + 1);
      clearTimeout(playedSongTimer.current);
      // 60 sn sonra hem fade hem temizlik
      playedSongTimer.current = setTimeout(() => {
        setPlayedId(null);
        setPlayedSong(null);
      }, 62000);
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
    socket.on('stage-design-changed', ({ design }) => setStageDesign(design));
    socket.on('logo-changed', ({ logo }) => setEventLogo(logo));

    socket.on('music-mode', ({ mode, active, djPhotos }) => {
      setActiveMusicMode(active ? mode : null);
      setModeDJPhotos(active && Array.isArray(djPhotos) ? djPhotos : []);
    });

    socket.on('room-count', ({ count }) => setConnectedCount(count));

    socket.on('crew-chat', (msg) => {
      setChatMessages(prev => [...prev.slice(-50), msg]);
    });

    socket.on('reji-blackout', ({ active }) => setBlackout(active));

    socket.on('reji-spotlight', ({ text }) => {
      setSpotlightText(text);
      setTimeout(() => setSpotlightText(''), 5000);
    });

    socket.on('reji-countdown', ({ seconds }) => {
      if (rejiCountdownTimer.current) clearInterval(rejiCountdownTimer.current);
      setRejiCountdown(seconds);
      const iv = setInterval(() => {
        setRejiCountdown(prev => {
          if (prev <= 1) { clearInterval(iv); rejiCountdownTimer.current = null; return 0; }
          return prev - 1;
        });
      }, 1000);
      rejiCountdownTimer.current = iv;
    });

    socket.on('display-card', (card) => {
      setDisplayCard({ ...card, _state: 'entering' });
      requestAnimationFrame(() => {
        setTimeout(() => setDisplayCard(prev => prev ? { ...prev, _state: 'visible' } : null), 50);
      });
      if (displayCardTimer.current) clearTimeout(displayCardTimer.current);
      displayCardTimer.current = setTimeout(() => {
        setDisplayCard(prev => prev ? { ...prev, _state: 'exiting' } : null);
        setTimeout(() => setDisplayCard(null), 600);
      }, (card.duration || 45) * 1000);
    });

    socket.on('dismiss-card', () => {
      setDisplayCard(prev => prev ? { ...prev, _state: 'exiting' } : null);
      setTimeout(() => setDisplayCard(null), 600);
      if (displayCardTimer.current) clearTimeout(displayCardTimer.current);
    });

    return () => {
      socket.off('request-added'); socket.off('vote-updated'); socket.off('list-updated');
      socket.off('event-status'); socket.off('language-changed'); socket.off('brand-updated');
      socket.off('ticker-updated'); socket.off('room-count'); socket.off('request-played');
      socket.off('theme-changed'); socket.off('animation-changed'); socket.off('stage-design-changed'); socket.off('logo-changed'); socket.off('ceremony'); socket.off('music-mode');
      socket.off('crew-chat');
      clearTimeout(playedSongTimer.current);
      socket.off('reji-blackout'); socket.off('reji-spotlight'); socket.off('reji-countdown');
      socket.off('display-card'); socket.off('dismiss-card');
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
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  const sendChat = (sender) => {
    if (!chatInput.trim()) return;
    const EMOJI_MAP = { ':)':'😊',':D':'😄',':(':'😢',';)':'😉',':P':'😛',':O':'😮','<3':'❤️',':*':'😘',
      ':fire:':'🔥',':ok:':'👍',':no:':'👎',':clap:':'👏',':mic:':'🎤',':music:':'🎵',':headphones:':'🎧',
      ':star:':'⭐',':check:':'✅',':x:':'❌',':warning:':'⚠️',':eyes:':'👀',':100:':'💯',':rocket:':'🚀',
      ':wave:':'👋',':pray:':'🙏',':party:':'🎉',':dj:':'🎧',':camera:':'🎬',':speaker:':'🔊',':stop:':'⏹',
      ':play:':'▶️',':pause:':'⏸',':next:':'⏭',':prev:':'⏮',':up:':'⬆️',':down:':'⬇️',':cool:':'😎',
      ':think:':'🤔',':sad:':'😞',':angry:':'😡',':love:':'😍',':lol:':'🤣',':wow:':'🤩',':sleep:':'😴',
      ':thumbsup:':'👍',':thumbsdown:':'👎',':raised:':'🙌',':time:':'⏰',':light:':'💡',':ready:':'🟢',
      ':wait:':'🟡',':alert:':'🔴' };
    let msg = chatInput.trim();
    Object.entries(EMOJI_MAP).forEach(([k, v]) => { msg = msg.split(k).join(v); });
    socket.emit('crew-chat', { message: msg, sender });
    setChatInput('');
  };

  const goFullscreen = () => {
    setShowFullscreenHint(false);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  if (!event) return <div className="display-page"><div className="display-bg" /></div>;

  // Played şarkı her zaman listenin başında göster, requests'ten çıkar (duplicate önle)
  const baseList = playedSong
    ? [playedSong, ...requests.filter(r => r.id !== playedSong.id)]
    : requests;
  const top15 = baseList.slice(0, 15);
  // Soldan sağa sıralı: sol = 1..8, sağ = 9..15
  const half     = Math.ceil(top15.length / 2);
  const listLeft  = top15.slice(0, half);
  const listRight = top15.slice(half);
  const displayName = brandText || event.name;

  const themeColors = {
    cyan: { primary: '#00d4ff', glow: 'rgba(0,212,255,0.3)', rgb: '0,212,255' },
    purple: { primary: '#b829dd', glow: 'rgba(184,41,221,0.3)', rgb: '184,41,221' },
    pink: { primary: '#ff0080', glow: 'rgba(255,0,128,0.3)', rgb: '255,0,128' },
    green: { primary: '#008D4B', glow: 'rgba(0,141,75,0.3)', rgb: '0,141,75' },
    orange: { primary: '#ff6b35', glow: 'rgba(255,107,53,0.3)', rgb: '255,107,53' },
    red: { primary: '#ff4444', glow: 'rgba(255,68,68,0.3)', rgb: '255,68,68' },
  };
  const tc = themeColors[theme] || themeColors.cyan;

  const MUSIC_MODE_LABELS = {
    arabesk: 'Arabesk', rock: 'Rock', '90s-pop': '90s Pop',
    'turkish-delight': 'Turkish Delight', tech: 'Tech/EDM',
    latino: 'Latino', rap: 'Rap/HipHop', winamp: 'Winamp', pioneer: 'Pioneer'
  };

  return (
    <div className={`display-page stage-${stageDesign}`} style={{ '--theme-primary': tc.primary, '--theme-glow': tc.glow, '--theme-rgb': tc.rgb }}>
      {blackout && <div className="reji-blackout-overlay" />}
      {spotlightText && (
        <div className="reji-spotlight-overlay">
          <div className="reji-spotlight-text">{spotlightText}</div>
        </div>
      )}
      {rejiCountdown > 0 && (
        <div className="reji-countdown-overlay">
          <div className="reji-countdown-number">{rejiCountdown}</div>
        </div>
      )}
      {displayCard && (() => {
        const DCARD_TYPES = {
          request: { icon: '🎵', tr: 'ŞARKI İSTEĞİ', en: 'SONG REQUEST' },
          birthday: { icon: '🎂', tr: 'DOĞUM GÜNÜ', en: 'BIRTHDAY' },
          anniversary: { icon: '💍', tr: 'EVLİLİK YILDÖNÜMÜ', en: 'ANNIVERSARY' },
          celebration: { icon: '🎉', tr: 'KUTLAMA', en: 'CELEBRATION' },
          custom: { icon: '💬', tr: 'ÖZEL MESAJ', en: 'SPECIAL MESSAGE' },
        };
        const ct = DCARD_TYPES[displayCard.type] || DCARD_TYPES.request;
        const senderInitial = displayCard.sender ? displayCard.sender.charAt(0).toUpperCase() : '';

        return (
          <div className={`dcard-overlay dcard-type-${displayCard.type} dcard-${displayCard._state || 'visible'}`}>
            <div className="dcard-backdrop" />
            <div className="dcard-container">
              <div className="dcard-shimmer" />
              <div className="dcard-now-playing">
                <span className="dcard-np-bars">
                  <span className="dcard-np-bar" /><span className="dcard-np-bar" /><span className="dcard-np-bar" /><span className="dcard-np-bar" />
                </span>
                <span className="dcard-np-text">{lang === 'tr' ? 'ŞU AN ÇALIYOR' : 'NOW PLAYING'}</span>
                <span className="dcard-np-bars">
                  <span className="dcard-np-bar" /><span className="dcard-np-bar" /><span className="dcard-np-bar" /><span className="dcard-np-bar" />
                </span>
              </div>
              <div className="dcard-badge">
                <span className="dcard-badge-icon">{ct.icon}</span>
                <span className="dcard-badge-label">{lang === 'tr' ? ct.tr : ct.en}</span>
              </div>
              <div className="dcard-content">
                {displayCard.albumArt && (
                  <div className="dcard-album-wrap">
                    <img src={displayCard.albumArt} alt="" className="dcard-album-img" />
                    <div className="dcard-album-glow" style={{ backgroundImage: `url(${displayCard.albumArt})` }} />
                  </div>
                )}
                <div className="dcard-info">
                  {displayCard.songName && <div className="dcard-song">{displayCard.songName}</div>}
                  {displayCard.artist && <div className="dcard-artist">{displayCard.artist}</div>}
                  {(displayCard.recipient || displayCard.message) && <div className="dcard-divider" />}
                  {displayCard.recipient && <div className="dcard-recipient">{displayCard.recipient}</div>}
                  {displayCard.message && <div className="dcard-message">"{displayCard.message}"</div>}
                </div>
              </div>
              <div className="dcard-footer">
                <div className="dcard-sender-area">
                  {senderInitial && <div className="dcard-sender-initial">{senderInitial}</div>}
                  <div className="dcard-sender-text">
                    {displayCard.sender && <div className="dcard-sender-name">{lang === 'tr' ? 'İsteyen' : 'From'}: {displayCard.sender}</div>}
                  </div>
                </div>
                <div className="dcard-branding">
                  <span className="dcard-branding-note">♪</span>
                  <span className="dcard-branding-text">RemiksBox</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {!isPreview && null /* logo artık topbar-left içinde */}
      {/* Classic: disco ball + effects by animLevel */}
      {stageDesign === 'classic' && <>
        <div className="display-bg" />
        <div className="floating-particles" aria-hidden="true" />
        <img src="/logos/disco-ball-bg.png" alt="" className="display-disco-img" />
        {animLevel === 'low' && <><AmbientGlow /><Sparkles themeRgb={tc.rgb} count={10} /></>}
        {animLevel === 'medium' && <><NeonOrbs themeRgb={tc.rgb} /><GeoShapes themeRgb={tc.rgb} /><Sparkles themeRgb={tc.rgb} count={18} /></>}
        {animLevel === 'high' && <><DiscoParticles themeRgb={tc.rgb} /><LightBeams themeColor={tc.primary} /><GeoShapes themeRgb={tc.rgb} /><Sparkles themeRgb={tc.rgb} count={30} /></>}
      </>}

      {/* Minimal: logo bg + scanline + pulse rings */}
      {stageDesign === 'minimal' && <>
        <img src="/logos/remiksbox_logo_transparent.png" alt="" className="stage-bg-img stage-bg-minimal" />
        <MinimalScanLine themeRgb={tc.rgb} />
        <MinimalPulseRing themeRgb={tc.rgb} />
      </>}

      {/* Elegant: logo bg + shimmer curtain + bokeh + dust */}
      {stageDesign === 'elegant' && <>
        <div className="display-bg" />
        <img src="/logos/remiksbox_logo_square.png" alt="" className="stage-bg-img stage-bg-elegant" />
        <ElegantShimmerCurtain themeRgb={tc.rgb} />
        <ElegantBokeh themeRgb={tc.rgb} />
        <ElegantDust themeRgb={tc.rgb} />
        <AmbientGlow />
        <Sparkles themeRgb={tc.rgb} count={15} />
      </>}

      {/* Club: disco ball + equalizer + lasers + strobe + particles */}
      {stageDesign === 'club' && <>
        <div className="display-bg" />
        <img src="/logos/disco-ball-bg.png" alt="" className="display-disco-img" />
        <ClubEqualizer themeRgb={tc.rgb} />
        <ClubLasers themeRgb={tc.rgb} />
        <ClubStrobe />
        <DiscoParticles themeRgb={tc.rgb} />
        <Sparkles themeRgb={tc.rgb} count={30} />
      </>}

      {/* Festival: mode bg + spotlights + confetti + color bars + waves */}
      {/* Festival: disco ball + spotlights + confetti + color bars + waves + equalizer */}
      {stageDesign === 'festival' && <>
        <div className="display-bg" />
        <img src="/logos/disco-ball-bg.png" alt="" className="display-disco-img" />
        <FestivalSpotlights themeRgb={tc.rgb} />
        <FestivalConfetti />
        <FestivalColorBars themeRgb={tc.rgb} />
        <FestivalWaves themeRgb={tc.rgb} />
        <ClubEqualizer themeRgb={tc.rgb} />
        <Sparkles themeRgb={tc.rgb} count={25} />
      </>}

      {/* Corporate/Obsidian: logo bg + grid + data streams + accent line */}
      {stageDesign === 'corporate' && <>
        <img src="/logos/remiksbox_logo_horizontal.png" alt="" className="stage-bg-img stage-bg-corporate" />
        <CorporateGrid />
        <CorporateDataStreams themeRgb={tc.rgb} />
        <CorporateAccentLine themeRgb={tc.rgb} />
      </>}

      {/* Cyber: particles only — CSS handles grid & glow */}
      {stageDesign === 'cyber' && <>
        <div className="display-bg" />
        <div className="floating-particles" aria-hidden="true" />
      </>}

      {/* Lounge: ambient glow + dim particles */}
      {stageDesign === 'lounge' && <>
        <div className="display-bg" />
        <div className="floating-particles" aria-hidden="true" />
        <AmbientGlow />
      </>}

      {/* Rave: particles + display-bg */}
      {stageDesign === 'rave' && <>
        <div className="display-bg" />
        <div className="floating-particles" aria-hidden="true" />
        <Sparkles themeRgb={tc.rgb} count={20} />
      </>}

      {/* Cinema: minimal — CSS handles spotlight + grain */}
      {stageDesign === 'cinema' && <></>}

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
        {/* ─── Topbar: Logo sol | Etkinlik adı merkez | LIVE sağ ─── */}
        <div className="dsp-topbar">
          {/* Sol: Organizasyon logosu (sadece gerçek logo yüklüyse göster) */}
          <div className="dsp-topbar-left">
            {eventLogo && (
              <div className="dsp-logo-inline">
                <img src={eventLogo} alt="Logo" className="dsp-logo-inline-img" />
              </div>
            )}
          </div>

          {/* Merkez: Etkinlik adı + motto */}
          <div className="dsp-topbar-center">
            <motion.div className="dsp-event-name"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              {displayName}
            </motion.div>
            <div className="dsp-brand-motto">Request · Vote · Dance</div>
          </div>

          {/* Sağ: LIVE */}
          <div className="dsp-topbar-right">
            <div className="display-live-badge">
              <span className="live-dot" />
              <span style={{ color: '#ff4444' }}>LIVE</span>
              <span className="live-count">{connectedCount} {lang === 'tr' ? 'kişi' : 'ppl'}</span>
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

        {/* ─── ACTIVE: Beatbox layout (QR sol | liste merkez | QR sağ) ─── */}
        {event.status === 'active' && !openingActive && (() => {
          const totalVotesStat = requests.reduce((s, r) => s + (r.votes || 0), 0);
          const topVotesStat = requests[0]?.votes || 0;
          return (
          <div className="dsp-beatbox">
            {/* Sol QR + Sol İstatistikler */}
              <div className="dsp-beatbox-qr">
                <div className="dsp-beatbox-qr-wrap">
                  <QRCodeSVG value={requestUrl} size={153} bgColor="#ffffff" fgColor="#000000" level="M" className="dsp-qr-svg" />
                </div>
                <div className="dsp-beatbox-qr-lbl">{lang === 'tr' ? 'QR ile Tara' : 'Scan QR'}</div>
                <div className="dsp-beatbox-qr-sub">{lang === 'tr' ? 'İsteğini Gönder!' : 'Send Request!'}</div>
                <div className="dsp-beatbox-stats">
                  <LiveStat value={connectedCount} label={lang === 'tr' ? 'Canlı' : 'Live'} />
                  <LiveStat value={requests.length} label={lang === 'tr' ? 'İstek' : 'Requests'} />
                  <LiveStat value={totalVotesStat} label={lang === 'tr' ? 'Oy' : 'Votes'} />
                </div>
              </div>

              {/* Merkez: Altın Saatler + Şarkı Listesi */}
              <div className="dsp-beatbox-songs">
                <div className="dsp-card-title dsp-card-title-altinsaatler">
                  <span className="dtf-brand-full">REMİKSBOX — ⭐ ALTIN SAATLER ⭐</span>
                </div>
                {requests.length === 0 ? (
                  <div className="dsp-table-empty">
                    <span>🎵</span> {T('display.no_requests')}
                  </div>
                ) : (
                  <div className="dsp-table-wrap dsp-table-2col">
                    <div className="dsp-table-col">
                      <table className="dsp-table">
                        <thead>
                          <tr className="dtf-thead-row">
                            <th className="dtf-th dtf-th-rank">#</th>
                            <th className="dtf-th" />
                            <th className="dtf-th">{lang === 'tr' ? 'ŞARKI' : 'SONG'}</th>
                            <th className="dtf-th dtf-th-num">OY</th>
                            <th className="dtf-th dtf-th-num">DEĞ</th>
                          </tr>
                        </thead>
                        <AnimatePresence>
                          <tbody>
                            {listLeft.map((req, idx) => (
                              <SongRow key={req.id} req={req} rank={idx + 1} lang={lang} isPlayed={playedId === req.id} />
                            ))}
                          </tbody>
                        </AnimatePresence>
                      </table>
                    </div>
                    <div className="dsp-table-col-divider" />
                    <div className="dsp-table-col">
                      <table className="dsp-table">
                        <thead>
                          <tr className="dtf-thead-row">
                            <th className="dtf-th dtf-th-rank">#</th>
                            <th className="dtf-th" />
                            <th className="dtf-th">{lang === 'tr' ? 'ŞARKI' : 'SONG'}</th>
                            <th className="dtf-th dtf-th-num">OY</th>
                            <th className="dtf-th dtf-th-num">DEĞ</th>
                          </tr>
                        </thead>
                        <AnimatePresence>
                          <tbody>
                            {listRight.map((req, idx) => (
                              <SongRow key={req.id} req={req} rank={half + idx + 1} lang={lang} isPlayed={playedId === req.id} />
                            ))}
                          </tbody>
                        </AnimatePresence>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Sağ QR + Sağ İstatistikler */}
              <div className="dsp-beatbox-qr">
                <div className="dsp-beatbox-qr-wrap">
                  <QRCodeSVG value={requestUrl} size={153} bgColor="#ffffff" fgColor="#000000" level="M" className="dsp-qr-svg" />
                </div>
                <div className="dsp-beatbox-qr-lbl">{lang === 'tr' ? 'QR ile Tara' : 'Scan QR'}</div>
                <div className="dsp-beatbox-qr-sub">{lang === 'tr' ? 'İsteğini Gönder!' : 'Send Request!'}</div>
                <div className="dsp-beatbox-stats">
                  <LiveStat value={playedCount} label={lang === 'tr' ? 'Çalındı' : 'Played'} />
                  <LiveStat value={topVotesStat} label={lang === 'tr' ? '1. Sıra' : 'Top'} />
                </div>
              </div>
            </div>
          );
        })()}

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
            <ClosingOverlay lang={lang} brandText={displayName} countdown={ceremonyCountdown} ceremonyEnd={ceremonyEnd} requests={requests} eventName={event?.name} />
          )}
        </AnimatePresence>

        {/* ─── MUSIC MODE OVERLAY ─── */}
        <AnimatePresence>
          {activeMusicMode && !openingActive && !closingActive && (
            <MusicModeOverlay mode={activeMusicMode} lang={lang} djPhotos={modeDJPhotos} />
          )}
        </AnimatePresence>

        {/* ─── ENDED (summary after closing) ─── */}
        {event.status === 'ended' && !closingActive && (
          <EventSummary requests={allRequests.length > 0 ? allRequests : requests} lang={lang} eventName={event?.name} />
        )}
      </div>
    </div>
  );
}
