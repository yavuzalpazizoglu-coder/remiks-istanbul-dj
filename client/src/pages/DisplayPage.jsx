import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import socket from '../socket.js';
import useSocketStatus from '../useSocketStatus.js';
import { t } from '../i18n/index.js';

const API = import.meta.env.PROD ? '' : 'http://localhost:3000';

function sortApprovedDisplay(a, b) {
  const dv = (b.votes || 0) - (a.votes || 0);
  if (dv !== 0) return dv;
  return String(a.created_at || '').localeCompare(String(b.created_at || ''));
}

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

function NowPlayingBar({ req, lang, fading }) {
  const [flash, setFlash] = useState(false);
  const [slotActive, setSlotActive] = useState(false);
  const [slotLanded, setSlotLanded] = useState(false);
  const prevId = useRef(null);

  useEffect(() => {
    if (req && req.id !== prevId.current) {
      setFlash(true);
      prevId.current = req.id;
      setTimeout(() => setFlash(false), 1800);

      // Slot efekti
      setSlotActive(false);
      setSlotLanded(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setSlotActive(true)));
      setTimeout(() => { setSlotLanded(true); }, 1200);
      setTimeout(() => { setSlotLanded(false); setSlotActive(false); }, 1800);
    } else if (!req) {
      prevId.current = null;
    }
  }, [req]);

  return (
    <div className={`dsp-np-stage ${req ? 'dsp-np-stage-active' : 'dsp-np-stage-waiting'} ${flash ? 'dsp-np-stage-flash' : ''} ${slotLanded ? 'slot-landed' : ''} ${fading ? 'dsp-np-stage-fadeout' : ''}`}>

      {/* Sol: LIVE badge + Albüm + Şarkı Bilgisi */}
      <div className="dsp-np-stage-left">

        {/* LIVE / WAIT pill */}
        <div className={`dsp-np-live-pill ${req ? 'dsp-np-live-pill-on' : 'dsp-np-live-pill-off'}`}>
          {req ? (
            <>
              <span className="dsp-np-live-dot" />
              <span className="dsp-np-live-text">
                {lang === 'tr' ? 'ŞU AN\nÇALINIYOR' : 'NOW\nPLAYING'}
              </span>
            </>
          ) : (
            <>
              <span className="dsp-np-live-dot dsp-np-live-dot-idle" />
              <span className="dsp-np-live-text dsp-np-live-text-idle">
                {lang === 'tr' ? 'DJ\nSAHNESİ' : 'DJ\nSTAGE'}
              </span>
            </>
          )}
        </div>

        {/* Albüm fotoğrafı */}
        {req ? (
          req.album_art
            ? <img src={req.album_art} alt="" className="dsp-np-stage-art" />
            : <div className="dsp-np-stage-art-ph">♪</div>
        ) : (
          <div className="dsp-np-stage-art-empty">
            <span className="dsp-np-stage-wait-icon">⏸</span>
          </div>
        )}

        {/* Şarkı adı + sanatçı */}
        <div className="dsp-np-stage-info">
          {req ? (
            <div className={slotActive ? 'dsp-np-slot-spin' : ''}>
              <div className="dsp-np-stage-song">{req.song_name}</div>
              {req.artist && <div className="dsp-np-stage-artist">{req.artist}</div>}
            </div>
          ) : (
            <div className="dsp-np-stage-waiting-text">
              {lang === 'tr' ? 'İlk isteği gönder! 🎵' : 'Send the first request! 🎵'}
            </div>
          )}
        </div>
      </div>

      {/* Sağ: EQ barları + Oy */}
      <div className="dsp-np-stage-right">
        <div className={`dsp-np-stage-bars ${req ? '' : 'dsp-np-bars-idle'}`}>
          {[1,2,3,4,5].map(i => <span key={i} className={`dsp-np-eq-bar dsp-np-eq-bar-${i}`} />)}
        </div>
        {req ? (
          <div className="dsp-np-stage-votes-wrap">
            <span className="dsp-np-stage-votes-num">{req.votes}</span>
            <span className="dsp-np-stage-votes-lbl">OY</span>
          </div>
        ) : (
          <span className="dsp-np-stage-votes-empty">—</span>
        )}
      </div>
    </div>
  );
}

function SongCard({ req, rank, listSize = 15 }) {
  const isTop3 = rank <= 3;
  const tier = rank <= 3 ? rank : 'rest';
  const tierClass = rank === 1 ? 'dsp-card-gold' : rank === 2 ? 'dsp-card-silver' : rank === 3 ? 'dsp-card-bronze' : '';
  const t3Start = listSize >= 30 ? 10 : 7;
  const t4Start = listSize >= 30 ? 19 : 10;
  const rowGroup = rank <= 3 ? 'dsp-row-t1'
    : rank < t3Start ? 'dsp-row-t2'
    : rank < t4Start ? 'dsp-row-t3'
    : 'dsp-row-t4';

  return (
    <motion.div
      className={`dsp-song-card ${tierClass} ${rowGroup}`}
      initial={false}
      exit={{ opacity: 0 }}
      transition={{ opacity: { duration: 0.18 } }}
    >
      <div className={`dsp-card-rank dsp-card-rank-${tier}`}>
        {isTop3 ? (
          <span className={`dsp-rank-badge dsp-rank-badge-${rank}`}>{rank}</span>
        ) : (
          <>
            <span className="dsp-card-rank-label">#</span>
            <span className="dsp-card-rank-num">{rank}</span>
          </>
        )}
      </div>

      {req.album_art
        ? <img src={req.album_art} alt="" className="dsp-card-art" />
        : <div className="dsp-card-art-ph">♪</div>
      }

      <div className="dsp-card-info">
        <div className={`dsp-card-song ${isTop3 ? 'dsp-card-song-top' : ''}`}>{req.song_name}</div>
        {req.artist && <div className="dsp-card-artist">{req.artist}</div>}
      </div>

      <div className="dsp-card-votes">
        <div className="dsp-card-votes-box">
          <span className={`dsp-card-votes-num ${isTop3 ? 'dsp-card-votes-top' : ''}`}>
            {String(req.votes).padStart(3, '0')}
          </span>
        </div>
      </div>
    </motion.div>
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

function Ticker({ requests, lang, tickerTexts, fontDelta = 0 }) {
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
            <div key={`ticker-${i}`} className="ticker-item" style={fontDelta !== 0 ? { fontSize: `calc(clamp(10px, 1.2vw, 26px) + ${fontDelta}px)` } : undefined}>
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
  const [countdownEnd, setCountdownEnd] = useState(null);
  const [countdownDisplay, setCountdownDisplay] = useState('');
  const [activeMusicMode, setActiveMusicMode] = useState(null);
  const [connectedCount, setConnectedCount] = useState(0);
  const [brandText, setBrandText] = useState('');
  const [tickerTexts, setTickerTexts] = useState('');
  const [tickerFontDelta, setTickerFontDelta] = useState(0);
  const [allRequests, setAllRequests] = useState([]);
  const [playedSong, setPlayedSong] = useState(null);   // tam nesne — listeden çıksa da göster
  const [playedSongFading, setPlayedSongFading] = useState(false);
  const playedSongTimer = useRef(null);
  const playedFadeTimer = useRef(null);
  const [playedCount, setPlayedCount] = useState(0);
  const [theme, setTheme] = useState('cyan');
  const [animLevel, setAnimLevel] = useState('high');
  const [stageDesign, setStageDesign] = useState('elegant');
  const [eventLogo, setEventLogo] = useState('');
  const [modeDJPhotos, setModeDJPhotos] = useState([]);
  const [listSize, setListSize] = useState(15);

  const [blackout, setBlackout] = useState(false);
  const [spotlightText, setSpotlightText] = useState('');
  const [rejiCountdown, setRejiCountdown] = useState(0);
  const [displayCard, setDisplayCard] = useState(null);
  const displayCardTimer = useRef(null);
  const rejiCountdownTimer = useRef(null);
  const voteResortTimerRef = useRef(null);

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
      setStageDesign(eventData.stage_design || 'elegant');
      setEventLogo(eventData.event_logo || '');
      setListSize(eventData.display_list_size || 15);
      setRequests((reqData.requests || []).filter(r => r.status === 'approved').sort(sortApprovedDisplay));
      if (eventData.countdown_end) setCountdownEnd(eventData.countdown_end);
      if (eventData.status === 'ended') {
        fetch(`${API}/api/events/${slug}/requests?all=true`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.requests) setAllRequests(d.requests); })
          .catch(() => {});
      }
    } catch (err) { console.warn('DisplayPage fetchData failed:', err); }
  }, [slug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    socket.connect();
    socket.emit('join-event', { eventSlug: slug, role: 'display' });

    socket.on('request-added', (req) => {
      if (req.status !== 'approved') return;
      clearTimeout(voteResortTimerRef.current);
      setRequests(prev => {
        if (prev.find(r => r.id === req.id)) return prev;
        return [...prev, req].sort(sortApprovedDisplay);
      });
    });

    socket.on('vote-updated', ({ requestId, votes }) => {
      setRequests(prev => prev.map(r => (r.id === requestId ? { ...r, votes } : r)));
      clearTimeout(voteResortTimerRef.current);
      voteResortTimerRef.current = setTimeout(() => {
        setRequests(prev => [...prev].sort(sortApprovedDisplay));
      }, 480);
    });

    socket.on('list-updated', (list) => {
      clearTimeout(voteResortTimerRef.current);
      setRequests(list.filter(r => r.status === 'approved').sort(sortApprovedDisplay));
    });

    // DJ ▶ Çal tıkladığında — bar hemen açılır, listeden çıkar
    socket.on('now-playing', (req) => {
      setPlayedSong(req);
      setPlayedSongFading(false);
      clearTimeout(playedSongTimer.current);
      clearTimeout(playedFadeTimer.current);
      playedSongTimer.current = setTimeout(() => {
        setPlayedSongFading(true);
        playedFadeTimer.current = setTimeout(() => {
          setPlayedSong(null);
          setPlayedSongFading(false);
        }, 3000);
      }, 57000);
    });

    socket.on('request-played', (req) => {
      setPlayedSong(req);
      setPlayedSongFading(false);
      setPlayedCount(c => c + 1);
      clearTimeout(playedSongTimer.current);
      clearTimeout(playedFadeTimer.current);
      playedSongTimer.current = setTimeout(() => {
        setPlayedSongFading(true);
        playedFadeTimer.current = setTimeout(() => {
          setPlayedSong(null);
          setPlayedSongFading(false);
        }, 3000);
      }, 57000);
    });

    socket.on('clear-playing', () => {
      clearTimeout(playedSongTimer.current);
      clearTimeout(playedFadeTimer.current);
      setPlayedSongFading(true);
      playedFadeTimer.current = setTimeout(() => {
        setPlayedSong(null);
        setPlayedSongFading(false);
      }, 3000);
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

    socket.on('language-changed', ({ language }) => setLang(language));
    socket.on('brand-updated', ({ brand_text }) => setBrandText(brand_text || ''));
    socket.on('ticker-updated', ({ ticker_texts }) => setTickerTexts(ticker_texts || ''));
    socket.on('ticker-font-size', ({ delta }) => setTickerFontDelta(delta));
    socket.on('theme-changed', ({ theme }) => setTheme(theme));
    socket.on('animation-changed', ({ level }) => setAnimLevel(level));
    socket.on('list-size-changed', ({ size }) => setListSize(size));
    socket.on('stage-design-changed', ({ design }) => setStageDesign(design));
    socket.on('logo-changed', ({ logo }) => setEventLogo(logo));

    socket.on('music-mode', ({ mode, active, djPhotos }) => {
      setActiveMusicMode(active ? mode : null);
      setModeDJPhotos(active && Array.isArray(djPhotos) ? djPhotos : []);
    });

    socket.on('room-count', ({ count }) => setConnectedCount(count));

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
      clearTimeout(voteResortTimerRef.current);
      socket.off('request-added'); socket.off('vote-updated'); socket.off('list-updated');
      socket.off('event-status'); socket.off('language-changed'); socket.off('brand-updated');
      socket.off('now-playing'); socket.off('clear-playing');
      socket.off('ticker-updated'); socket.off('room-count'); socket.off('request-played');
      socket.off('ticker-font-size');
      socket.off('theme-changed'); socket.off('animation-changed'); socket.off('stage-design-changed');
      socket.off('list-size-changed');
      socket.off('logo-changed'); socket.off('music-mode');
      clearTimeout(playedSongTimer.current);
      clearTimeout(playedFadeTimer.current);
      if (rejiCountdownTimer.current) clearInterval(rejiCountdownTimer.current);
      socket.off('reji-blackout'); socket.off('reji-spotlight'); socket.off('reji-countdown');
      socket.off('display-card'); socket.off('dismiss-card');
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

  // Played şarkı ayrı NowPlayingBar'da gösterilir — ana listede yer almaz
  const baseList = playedSong
    ? requests.filter(r => r.id !== playedSong.id)
    : requests;
  const topN = baseList.slice(0, listSize);
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
      {/* ─── SAHNE TASARIMLARI (animLevel: low/medium/high) ─── */}

      {/* Elegant: kadife bordo + gül altını bokeh + şimmer */}
      {stageDesign === 'elegant' && <>
        <div className="display-bg" />
        <img src="/logos/remiksbox_marka_transparent_hr.png" alt="" className="stage-bg-img stage-bg-elegant" />
        {animLevel === 'low' && <><AmbientGlow /><Sparkles themeRgb="200,80,120" count={8} /></>}
        {animLevel === 'medium' && <><ElegantBokeh themeRgb="200,80,120" /><GeoShapes themeRgb="180,60,100" /><Sparkles themeRgb="220,100,140" count={15} /></>}
        {animLevel === 'high' && <><ElegantShimmerCurtain themeRgb="200,80,120" /><ElegantBokeh themeRgb="200,80,120" /><ElegantDust themeRgb="220,100,140" /><ClubEqualizer themeRgb="200,80,120" /><AmbientGlow /><Sparkles themeRgb="240,120,160" count={25} /></>}
      </>}

      {/* Club: gece mavisi + cyan equalizer + lazer + strobe */}
      {stageDesign === 'club' && <>
        <div className="display-bg" />
        <img src="/logos/disco-ball-bg-opt.jpg" alt="" className="display-disco-img" />
        {animLevel === 'low' && <><AmbientGlow /><Sparkles themeRgb="0,180,255" count={10} /></>}
        {animLevel === 'medium' && <><ClubEqualizer themeRgb="0,180,255" /><GeoShapes themeRgb="0,160,255" /><DiscoParticles themeRgb="0,200,255" /></>}
        {animLevel === 'high' && <><ClubEqualizer themeRgb="0,180,255" /><ClubLasers themeRgb="0,200,255" /><ClubStrobe /><DiscoParticles themeRgb="0,200,255" /><Sparkles themeRgb="0,220,255" count={30} /></>}
      </>}

      {/* Festival: sıcak turuncu/altın spotlar + konfeti + dalgalar */}
      {stageDesign === 'festival' && <>
        <div className="display-bg" />
        <img src="/logos/disco-ball-bg-opt.jpg" alt="" className="display-disco-img" />
        {animLevel === 'low' && <><FestivalSpotlights themeRgb="255,120,0" /><Sparkles themeRgb="255,160,0" count={10} /></>}
        {animLevel === 'medium' && <><FestivalSpotlights themeRgb="255,100,0" /><FestivalColorBars themeRgb="255,140,0" /><ClubEqualizer themeRgb="255,160,0" /><Sparkles themeRgb="255,200,0" count={18} /></>}
        {animLevel === 'high' && <><FestivalSpotlights themeRgb="255,80,0" /><FestivalConfetti /><FestivalColorBars themeRgb="255,120,0" /><FestivalWaves themeRgb="255,100,0" /><ClubEqualizer themeRgb="255,160,0" /><Sparkles themeRgb="255,200,0" count={25} /></>}
      </>}

      {/* Cyber: neon pembe/magenta grid + cyan detaylar */}
      {stageDesign === 'cyber' && <>
        <div className="display-bg" />
        {animLevel === 'low' && <><div className="floating-particles" aria-hidden="true" /><AmbientGlow /></>}
        {animLevel === 'medium' && <><div className="floating-particles" aria-hidden="true" /><GeoShapes themeRgb="255,0,160" /><Sparkles themeRgb="255,0,160" count={12} /></>}
        {animLevel === 'high' && <><div className="floating-particles" aria-hidden="true" /><GeoShapes themeRgb="255,0,160" /><NeonOrbs themeRgb="0,220,255" /><ClubEqualizer themeRgb="255,0,160" /><Sparkles themeRgb="0,220,255" count={22} /></>}
      </>}

      {/* Rave: UV mor + neon yeşil partiküller + strobe */}
      {stageDesign === 'rave' && <>
        <div className="display-bg" />
        {animLevel === 'low' && <><div className="floating-particles" aria-hidden="true" /><Sparkles themeRgb="120,0,255" count={12} /></>}
        {animLevel === 'medium' && <><div className="floating-particles" aria-hidden="true" /><GeoShapes themeRgb="120,0,255" /><DiscoParticles themeRgb="0,255,120" /><ClubEqualizer themeRgb="120,0,255" /></>}
        {animLevel === 'high' && <><div className="floating-particles" aria-hidden="true" /><DiscoParticles themeRgb="0,255,120" /><ClubEqualizer themeRgb="120,0,255" /><ClubLasers themeRgb="0,255,120" /><ClubStrobe /><Sparkles themeRgb="200,0,255" count={30} /></>}
      </>}

      {/* Cinema: noir siyah/beyaz spotlight + minimal */}
      {stageDesign === 'cinema' && <>
        {animLevel === 'low' && <AmbientGlow />}
        {animLevel === 'medium' && <><AmbientGlow /><GeoShapes themeRgb="200,200,200" /></>}
        {animLevel === 'high' && <><ClubEqualizer themeRgb="220,220,200" /><LightBeams themeColor="#e0e0cc" /><Sparkles themeRgb="255,255,220" count={15} /></>}
      </>}


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
            <div className="dsp-logo-inline">
              <img
                src={eventLogo || '/logos/remiksbox_marka_transparent_hr.png'}
                alt={eventLogo ? 'Logo' : 'RemiksBox'}
                className="dsp-logo-inline-img"
              />
            </div>
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
        <Ticker requests={requests} lang={lang} tickerTexts={tickerTexts} fontDelta={tickerFontDelta} />

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

        {/* ─── ACTIVE: Beatbox layout (QR sol | liste merkez | QR sağ) ─── */}
        {event.status === 'active' && (() => {
          const totalVotesStat = requests.reduce((s, r) => s + (r.votes || 0), 0);
          const topVotesStat = requests[0]?.votes || 0;
          return (
          <div className="dsp-beatbox">
            {/* Sol QR + Sol İstatistikler */}
              <div className="dsp-beatbox-qr">
                <div className="dsp-qr-motto">{lang === 'tr' ? <>Playlist sınırlı, sevgimiz sınırsız<br/>❤️</> : <>Limited playlist, unlimited love<br/>❤️</>}</div>
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

              {/* Merkez: Altın Saatler + NOW PLAYING + Şarkı Grid */}
              <div className="dsp-beatbox-songs">
                <div className="dsp-card-title dsp-card-title-altinsaatler">
                  <span className="dtf-brand-full">🎧 DJ SİZSİNİZ</span>
                </div>

                {/* NOW PLAYING — sabit çerçeve, her zaman görünür */}
                <NowPlayingBar req={playedSong} lang={lang} fading={playedSongFading} />

                {requests.length === 0 ? (
                  <div className="dsp-table-empty">
                    <span>🎵</span> {T('display.no_requests')}
                  </div>
                ) : (
                  <div className={`dsp-song-grid dsp-song-grid--n${listSize}`}>
                    <AnimatePresence>
                      {topN.map((req, idx) => (
                        <SongCard key={req.id} req={req} rank={idx + 1} listSize={listSize} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Sağ QR + Sağ İstatistikler */}
              <div className="dsp-beatbox-qr">
                <div className="dsp-qr-motto">{lang === 'tr' ? <>Playlist sınırlı, sevgimiz sınırsız<br/>❤️</> : <>Limited playlist, unlimited love<br/>❤️</>}</div>
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

        {/* ─── MUSIC MODE OVERLAY ─── */}
        <AnimatePresence>
          {activeMusicMode && (
            <MusicModeOverlay mode={activeMusicMode} lang={lang} djPhotos={modeDJPhotos} />
          )}
        </AnimatePresence>

        {/* ─── ENDED ─── */}
        {event.status === 'ended' && (
          <EventSummary requests={allRequests.length > 0 ? allRequests : requests} lang={lang} eventName={event?.name} />
        )}
      </div>
    </div>
  );
}
