import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import socket from '../socket.js';
import useSocketStatus from '../useSocketStatus.js';
import { t } from '../i18n/index.js';

const API = import.meta.env.PROD ? '' : 'http://localhost:3000';

export default function DJPanel() {
  const { slug: paramSlug } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState(() => localStorage.getItem('remiks_dj_pw') || '');
  const [djUser, setDjUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('remiks_dj_user')); } catch { return null; }
  });
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [slug, setSlug] = useState(paramSlug || '');
  const [event, setEvent] = useState(null);
  const [lang, setLang] = useState('tr');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [newEventName, setNewEventName] = useState('');
  const [connectSlug, setConnectSlug] = useState('');
  const [countdownMinutes, setCountdownMinutes] = useState(10);
  const [copied, setCopied] = useState(false);
  const [brandText, setBrandText] = useState('');
  const [brandSaving, setBrandSaving] = useState(false);
  const [tickerTexts, setTickerTexts] = useState('');
  const [tickerSaving, setTickerSaving] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [requestLimit, setRequestLimit] = useState(2);
  const [theme, setTheme] = useState('cyan');
  const [animationLevel, setAnimationLevel] = useState('high');
  const [eventHistory, setEventHistory] = useState([]);
  const [openingOn, setOpeningOn] = useState(false);
  const [closingOn, setClosingOn] = useState(false);
  const [ceremonyMinutes, setCeremonyMinutes] = useState(10);
  const [activeMusicMode, setActiveMusicMode] = useState(null);
  const [selectedDJs, setSelectedDJs] = useState([]);
  const brandTimer = useRef(null);
  const tickerTimer = useRef(null);

  const socketConnected = useSocketStatus();
  const T = useCallback((key) => t(lang, key), [lang]);

  const headers = { 'Content-Type': 'application/json', 'x-dj-password': password };

  const fetchRequests = useCallback(async (eventSlug) => {
    try {
      const res = await fetch(`${API}/api/events/${eventSlug}/requests?all=true`);
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err) { console.warn('fetchRequests failed:', err); }
  }, []);

  const loadEvent = useCallback(async (eventSlug) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/events/${eventSlug}`);
      if (!res.ok) throw new Error('Event not found');
      const data = await res.json();
      setEvent(data);
      setSlug(eventSlug);
      setLang(data.language || 'tr');
      setBrandText(data.brand_text || '');
      setTickerTexts(data.ticker_texts || '');
      setRequestLimit(data.request_limit || 2);
      setTheme(data.theme || 'cyan');
      setAnimationLevel(data.animation_level || 'high');
      await fetchRequests(eventSlug);
      if (!paramSlug) navigate(`/dj/${eventSlug}`, { replace: true });
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchRequests, navigate, paramSlug]);

  useEffect(() => {
    if (paramSlug) loadEvent(paramSlug);
  }, [paramSlug, loadEvent]);

  useEffect(() => {
    if (!slug) return;

    socket.connect();
    socket.emit('join-event', { eventSlug: slug, role: 'dj' });

    socket.on('request-added', () => fetchRequests(slug));
    socket.on('vote-updated', () => fetchRequests(slug));
    socket.on('list-updated', (list) => setRequests(list));

    socket.on('event-status', ({ status }) => {
      setEvent(prev => prev ? { ...prev, status } : prev);
    });

    socket.on('ceremony', ({ type, active }) => {
      if (type === 'opening') { setOpeningOn(active); if (active) setClosingOn(false); }
      if (type === 'closing') { setClosingOn(active); if (active) setOpeningOn(false); }
    });

    socket.on('music-mode', ({ mode, active }) => {
      setActiveMusicMode(active ? mode : null);
    });

    return () => {
      socket.off('request-added');
      socket.off('vote-updated');
      socket.off('list-updated');
      socket.off('event-status');
      socket.off('ceremony');
      socket.off('music-mode');
      socket.disconnect();
    };
  }, [slug, fetchRequests]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const [formError, setFormError] = useState('');

  const handleLogin = async () => {
    setFormError('');
    if (!loginEmail.trim()) {
      setFormError(lang === 'tr' ? 'E-posta adresi gerekli' : 'Email required');
      return;
    }
    if (!loginPassword.trim()) {
      setFormError(lang === 'tr' ? 'Şifre gerekli' : 'Password required');
      return;
    }
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'wrong_password') setFormError(lang === 'tr' ? 'Şifre yanlış' : 'Wrong password');
        else if (data.error === 'user_not_found') setFormError(lang === 'tr' ? 'Bu e-posta ile kayıtlı DJ bulunamadı' : 'No DJ found with this email');
        else setFormError(data.error);
        return;
      }
      setDjUser(data.user);
      setPassword(data.token);
      localStorage.setItem('remiks_dj_user', JSON.stringify(data.user));
      localStorage.setItem('remiks_dj_pw', data.token);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleLogout = () => {
    setDjUser(null);
    setPassword('');
    setEvent(null);
    setSlug('');
    localStorage.removeItem('remiks_dj_user');
    localStorage.removeItem('remiks_dj_pw');
    navigate('/dj', { replace: true });
  };

  const createEvent = async () => {
    setFormError('');
    if (!newEventName.trim()) {
      setFormError(lang === 'tr' ? 'Etkinlik adı gerekli' : 'Event name required');
      return;
    }
    try {
      const res = await fetch(`${API}/api/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newEventName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error === 'Unauthorized'
          ? (lang === 'tr' ? 'Oturum süresi doldu, tekrar giriş yapın' : 'Session expired, please login again')
          : data.error);
        return;
      }
      setEvent(data);
      setSlug(data.slug);
      navigate(`/dj/${data.slug}`, { replace: true });
    } catch (err) {
      setFormError(err.message);
    }
  };

  const updateStatus = async (status) => {
    try {
      const res = await fetch(`${API}/api/events/${slug}/status`, {
        method: 'PUT', headers,
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEvent(data);
    } catch (err) { showToast(err.message); }
  };

  const startCountdown = async () => {
    try {
      const res = await fetch(`${API}/api/events/${slug}/countdown`, {
        method: 'POST', headers,
        body: JSON.stringify({ minutes: countdownMinutes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEvent(data);
    } catch (err) { showToast(err.message); }
  };

  const changeLang = async (newLang) => {
    try {
      const res = await fetch(`${API}/api/events/${slug}/language`, {
        method: 'PUT', headers,
        body: JSON.stringify({ language: newLang }),
      });
      if (res.ok) setLang(newLang);
    } catch (err) { console.warn('changeLang failed:', err); }
  };

  const updateRequestStatus = async (requestId, status) => {
    try {
      const res = await fetch(`${API}/api/requests/${requestId}/status`, {
        method: 'PUT', headers,
        body: JSON.stringify({ status }),
      });
      if (res.ok) await fetchRequests(slug);
    } catch (err) { showToast(lang === 'tr' ? 'İşlem başarısız' : 'Action failed'); }
  };

  const saveBrandText = useCallback(async (text) => {
    setBrandSaving(true);
    try {
      await fetch(`${API}/api/events/${slug}/brand`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-dj-password': password },
        body: JSON.stringify({ brandText: text }),
      });
    } catch (err) { console.warn('saveBrandText failed:', err); } finally {
      setBrandSaving(false);
    }
  }, [slug, password]);

  const handleBrandChange = (val) => {
    setBrandText(val);
    if (brandTimer.current) clearTimeout(brandTimer.current);
    brandTimer.current = setTimeout(() => saveBrandText(val), 800);
  };

  const saveTickerTexts = useCallback(async (text) => {
    setTickerSaving(true);
    try {
      await fetch(`${API}/api/events/${slug}/ticker`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-dj-password': password },
        body: JSON.stringify({ tickerTexts: text }),
      });
    } catch (err) { console.warn('saveTickerTexts failed:', err); } finally {
      setTickerSaving(false);
    }
  }, [slug, password]);

  const updateRequestLimit = async (limit) => {
    setRequestLimit(limit);
    try {
      await fetch(`${API}/api/events/${slug}/limit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-dj-password': password },
        body: JSON.stringify({ requestLimit: limit }),
      });
    } catch (err) { console.warn('updateRequestLimit failed:', err); }
  };

  const changeTheme = async (newTheme) => {
    setTheme(newTheme);
    try {
      await fetch(`${API}/api/events/${slug}/theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-dj-password': password },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch (err) { console.warn('changeTheme failed:', err); }
  };

  const sendCeremony = async (type, active, minutes) => {
    try {
      await fetch(`${API}/api/events/${slug}/ceremony`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dj-password': password },
        body: JSON.stringify({ type, active, minutes: active ? minutes : 0 }),
      });
    } catch (err) { console.warn('sendCeremony failed:', err); }
  };

  const toggleCeremony = async (type) => {
    const isOn = type === 'opening' ? openingOn : closingOn;
    const newState = !isOn;
    if (type === 'opening') { setOpeningOn(newState); if (newState) setClosingOn(false); }
    if (type === 'closing') { setClosingOn(newState); if (newState) setOpeningOn(false); }
    await sendCeremony(type, newState, ceremonyMinutes);
  };

  const updateCeremonyMinutes = async (m) => {
    setCeremonyMinutes(m);
    const activeType = openingOn ? 'opening' : closingOn ? 'closing' : null;
    if (activeType) await sendCeremony(activeType, true, m);
  };

  const MUSIC_MODES = [
    { id: 'arabesk', icon: '🎻', tr: 'Remiks Arabesk Mode', en: 'Arabesk Mode' },
    { id: 'rock', icon: '🎸', tr: 'Remiks Rock', en: 'Remiks Rock' },
    { id: '90s-pop', icon: '💿', tr: "90'lar Türkçe Pop", en: "90s Turkish Pop" },
    { id: 'turkish-delight', icon: '🌹', tr: 'Remiks Turkish Delight', en: 'Turkish Delight' },
    { id: 'tech', icon: '🎧', tr: 'Remiks Tech', en: 'Remiks Tech' },
    { id: 'latino', icon: '💃', tr: 'Remiks Latino', en: 'Remiks Latino' },
    { id: 'rap', icon: '🎤', tr: 'Remiks Rap', en: 'Remiks Rap' },
  ];

  const DJ_PHOTOS = [
    { id: 'derin', name: 'DJ Derin', src: '/logos/dj-derin.png' },
    { id: 'alp', name: 'DJ Alp', src: '/logos/dj-alp.png' },
  ];

  const toggleDJPhoto = (djId) => {
    setSelectedDJs(prev => prev.includes(djId) ? prev.filter(d => d !== djId) : [...prev, djId]);
  };

  const toggleMusicMode = async (modeId) => {
    const isActive = activeMusicMode === modeId;
    const newMode = isActive ? null : modeId;
    setActiveMusicMode(newMode);
    const djPhotos = selectedDJs.map(id => DJ_PHOTOS.find(d => d.id === id)).filter(Boolean);
    try {
      await fetch(`${API}/api/events/${slug}/music-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dj-password': password },
        body: JSON.stringify({ mode: modeId, active: !isActive, djPhotos: !isActive ? djPhotos : [] }),
      });
    } catch (err) { console.warn('toggleMusicMode failed:', err); }
  };

  const changeAnimationLevel = async (level) => {
    setAnimationLevel(level);
    try {
      await fetch(`${API}/api/events/${slug}/animation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-dj-password': password },
        body: JSON.stringify({ level }),
      });
    } catch (err) { console.warn('changeAnimationLevel failed:', err); }
  };

  const handleTickerChange = (val) => {
    setTickerTexts(val);
    if (tickerTimer.current) clearTimeout(tickerTimer.current);
    tickerTimer.current = setTimeout(() => saveTickerTexts(val), 800);
  };

  const copyLink = () => {
    const appUrl = window.location.origin;
    navigator.clipboard.writeText(`${appUrl}/request/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const requestUrl = `${window.location.origin}/request/${slug}`;

  // ─── Fetch event history ───

  const fetchHistory = useCallback(async () => {
    if (!password.trim()) return;
    try {
      const res = await fetch(`${API}/api/events/history`, { headers: { 'x-dj-password': password } });
      if (res.ok) {
        const data = await res.json();
        setEventHistory(data);
      }
    } catch (err) { console.warn('fetchHistory failed:', err); }
  }, [password]);

  // ─── Login / Create / Connect ───

  if (!event) {
    const loginBg = (
      <>
        <div className="login-bg">
          <div className="login-grid" />
          <div className="login-orb login-orb-1" />
          <div className="login-orb login-orb-2" />
          <div className="login-orb login-orb-3" />
          <div className="login-scanline" />
        </div>
      </>
    );

    const loginFooter = (
      <footer className="login-footer">
        <div className="login-footer-brand">
          <span className="login-footer-logo">RemiksBox</span>
          <span className="login-footer-by">by Remiks İstanbul</span>
        </div>
        <div className="login-footer-links">
          <span>{lang === 'tr' ? 'Tüm hakları saklıdır.' : 'All rights reserved.'} &copy; {new Date().getFullYear()}</span>
          <span className="login-footer-sep">|</span>
          <span>{lang === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'}</span>
          <span className="login-footer-sep">|</span>
          <span>{lang === 'tr' ? 'Kullanım Koşulları' : 'Terms of Use'}</span>
        </div>
        <div className="login-footer-legal">
          <p>{lang === 'tr'
            ? 'Bu yazılım Remiks İstanbul tarafından geliştirilmiştir. Ticari veya kişisel kullanım için lisans gereklidir. Müzik içerikleri ilgili hak sahiplerine aittir. Spotify entegrasyonu Spotify AB lisansı altında kullanılmaktadır.'
            : 'This software is developed by Remiks İstanbul. License required for commercial or personal use. Music content belongs to respective rights holders. Spotify integration is used under Spotify AB license.'
          }</p>
          <p>{lang === 'tr'
            ? 'İletişim: info@remiksistanbul.com | KVKK ve GDPR uyumlu veri işleme politikalarımız geçerlidir.'
            : 'Contact: info@remiksistanbul.com | KVKK and GDPR compliant data processing policies apply.'
          }</p>
        </div>
      </footer>
    );

    // Step 1: Login
    if (!djUser) {
      return (
        <div className="login-page">
          {loginBg}
          <div className="login-content">
            <motion.div className="login-hero" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="login-remiksbox">RemiksBox</span>
              <p className="login-tagline">{lang === 'tr' ? 'DJ Etkinlik Yönetim Sistemi' : 'DJ Event Management System'}</p>
              <div className="login-badge-row">
                <span className="login-badge">Real-Time</span>
                <span className="login-badge">Spotify</span>
                <span className="login-badge">QR Code</span>
              </div>
            </motion.div>

            <motion.div className="login-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
              <h2 className="login-card-title">{lang === 'tr' ? 'DJ Girişi' : 'DJ Login'}</h2>

              <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
                <div className="form-group">
                  <label>{lang === 'tr' ? 'E-POSTA' : 'EMAIL'}</label>
                  <div className="login-input-wrap">
                    <span className="login-input-icon">📧</span>
                    <input className="input" type="email" placeholder="email@example.com" value={loginEmail} onChange={(e) => { setLoginEmail(e.target.value); setFormError(''); }} autoFocus />
                  </div>
                </div>

                <div className="form-group">
                  <label>{lang === 'tr' ? 'ŞİFRE' : 'PASSWORD'}</label>
                  <div className="login-input-wrap">
                    <span className="login-input-icon">🔒</span>
                    <input className="input" type="password" placeholder="••••••" value={loginPassword} onChange={(e) => { setLoginPassword(e.target.value); setFormError(''); }} />
                  </div>
                </div>

                {formError && (
                  <motion.div className="login-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    {formError}
                  </motion.div>
                )}

                <motion.button type="submit" className="login-btn-primary" whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02 }}>
                  {lang === 'tr' ? 'Giriş Yap' : 'Sign In'}
                </motion.button>
              </form>
            </motion.div>
          </div>

          {loginFooter}
          <AnimatePresence>
            {toast && <motion.div className="success-toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>{toast}</motion.div>}
          </AnimatePresence>
        </div>
      );
    }

    // Step 2: Create / Connect (logged in)
    return (
      <div className="login-page">
        {loginBg}
        <div className="login-content">
          <motion.div className="login-hero" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="login-remiksbox">RemiksBox</span>
            <div className="login-user-chip">
              <span className="login-user-avatar">{djUser.name?.charAt(0) || 'D'}</span>
              <span className="login-user-name">{djUser.name}</span>
              <button className="login-user-logout" onClick={handleLogout} title={lang === 'tr' ? 'Çıkış' : 'Logout'}>✕</button>
            </div>
          </motion.div>

          <motion.div className="login-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
            <h2 className="login-card-title">{T('dj.create_event')}</h2>

            <form onSubmit={(e) => { e.preventDefault(); createEvent(); }}>
              <div className="form-group">
                <label>{T('dj.event_name')}</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon">🎤</span>
                  <input className="input" placeholder={T('dj.event_name_placeholder')} value={newEventName} onChange={(e) => { setNewEventName(e.target.value); setFormError(''); }} autoFocus />
                </div>
              </div>

              {formError && (
                <motion.div className="login-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  {formError}
                </motion.div>
              )}

              <motion.button type="submit" className="login-btn-primary" whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02 }}>
                {T('dj.create')}
              </motion.button>
            </form>

            <div className="form-divider">{T('dj.or_create')}</div>

            <div className="connect-section">
              <div className="connect-row">
                <div className="login-input-wrap" style={{ flex: 1 }}>
                  <span className="login-input-icon">🔗</span>
                  <input className="input" placeholder={T('dj.enter_slug')} value={connectSlug} onChange={(e) => setConnectSlug(e.target.value)} />
                </div>
                <motion.button className="login-btn-ghost" whileTap={{ scale: 0.96 }} onClick={() => { if (connectSlug.trim()) loadEvent(connectSlug.trim()); }}>{T('dj.connect')}</motion.button>
              </div>
            </div>

            {eventHistory.length === 0 && (
              <button className="login-btn-ghost" style={{ width: '100%', marginTop: 12 }} onClick={fetchHistory}>
                {lang === 'tr' ? '📋 Geçmiş Etkinlikleri Getir' : '📋 Load Past Events'}
              </button>
            )}
            {eventHistory.length > 0 && (
              <div className="djc-history">
                <div className="djc-history-title">{lang === 'tr' ? '📋 Geçmiş Etkinlikler' : '📋 Past Events'}</div>
                {eventHistory.map(ev => (
                  <div key={ev.id} className="djc-history-item" onClick={() => loadEvent(ev.slug)}>
                    <div className="djc-history-name">{ev.name}</div>
                    <div className="djc-history-meta">
                      <span>{ev.total_requests} {lang === 'tr' ? 'istek' : 'req'}</span>
                      <span>{ev.total_votes} {lang === 'tr' ? 'oy' : 'votes'}</span>
                      <span className={`djc-history-status ${ev.status}`}>{ev.status}</span>
                      <span>{new Date(ev.created_at).toLocaleDateString('tr-TR')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {loginFooter}
        <AnimatePresence>
          {toast && <motion.div className="success-toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>{toast}</motion.div>}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Main DJ Panel ───

  const waitingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const allActiveRequests = [...waitingRequests, ...approvedRequests];
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;
  const totalVotes = requests.reduce((sum, r) => sum + r.votes, 0);

  const djcBgSvg = (
    <div className="djc-bg-art" aria-hidden="true">
      {/* Vinyl record - bottom right */}
      <svg className="djc-bg-vinyl" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.1"/>
        <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.08"/>
        <circle cx="100" cy="100" r="64" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.08"/>
        <circle cx="100" cy="100" r="48" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.08"/>
        <circle cx="100" cy="100" r="32" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.1"/>
        <circle cx="100" cy="100" r="14" fill="currentColor" opacity="0.08"/>
        <circle cx="100" cy="100" r="4" fill="currentColor" opacity="0.15"/>
        <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" strokeWidth="0.3" strokeDasharray="3 5" opacity="0.06"/>
        <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 4" opacity="0.06"/>
        <circle cx="100" cy="100" r="56" fill="none" stroke="currentColor" strokeWidth="0.3" strokeDasharray="4 3" opacity="0.06"/>
      </svg>

      {/* Equalizer bars - left bottom */}
      <svg className="djc-bg-eq" viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
        {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => (
          <rect key={i} x={i * 10} y={80 - (20 + Math.sin(i * 0.8) * 30 + Math.cos(i * 1.2) * 20)} width="6" rx="2" height={20 + Math.sin(i * 0.8) * 30 + Math.cos(i * 1.2) * 20} fill="currentColor" opacity={0.07 + (i % 3) * 0.02}/>
        ))}
      </svg>

      {/* Musical notes scattered */}
      <svg className="djc-bg-notes" viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
        <text x="20" y="40" fontSize="36" fill="#3b82f6" opacity="0.07">&#9835;</text>
        <text x="130" y="65" fontSize="28" fill="#06b6d4" opacity="0.06">&#9834;</text>
        <text x="240" y="35" fontSize="32" fill="#8b5cf6" opacity="0.06">&#9833;</text>
        <text x="70" y="140" fontSize="40" fill="#3b82f6" opacity="0.05">&#9839;</text>
        <text x="190" y="170" fontSize="30" fill="#06b6d4" opacity="0.07">&#9835;</text>
        <text x="260" y="110" fontSize="24" fill="#8b5cf6" opacity="0.05">&#9834;</text>
        <text x="40" y="100" fontSize="20" fill="#06b6d4" opacity="0.04">&#9833;</text>
        <text x="170" y="100" fontSize="26" fill="#3b82f6" opacity="0.05">&#9839;</text>
      </svg>

      {/* Waveform across middle */}
      <svg className="djc-bg-wave" viewBox="0 0 400 60" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <path d="M0 30 Q10 10,20 30 Q30 50,40 30 Q50 12,60 30 Q70 48,80 30 Q90 8,100 30 Q110 52,120 30 Q130 14,140 30 Q150 46,160 30 Q170 10,180 30 Q190 50,200 30 Q210 15,220 30 Q230 45,240 30 Q250 12,260 30 Q270 48,280 30 Q290 16,300 30 Q310 44,320 30 Q330 10,340 30 Q350 50,360 30 Q370 14,380 30 Q390 46,400 30" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.06"/>
        <path d="M0 30 Q15 18,30 30 Q45 42,60 30 Q75 16,90 30 Q105 44,120 30 Q135 20,150 30 Q165 40,180 30 Q195 18,210 30 Q225 42,240 30 Q255 22,270 30 Q285 38,300 30 Q315 20,330 30 Q345 40,360 30 Q375 22,390 30 L400 30" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.04"/>
      </svg>

      {/* Headphones icon */}
      <svg className="djc-bg-headphones" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 38 C12 24,20 14,32 14 C44 14,52 24,52 38" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.08"/>
        <rect x="6" y="34" width="10" height="18" rx="5" fill="currentColor" opacity="0.07"/>
        <rect x="48" y="34" width="10" height="18" rx="5" fill="currentColor" opacity="0.07"/>
      </svg>

      {/* Large center watermark */}
      <div className="djc-bg-watermark">REMIKS ISTANBUL</div>
    </div>
  );

  return (
    <div className="dj-panel dj-compact">
      {djcBgSvg}
      {!socketConnected && (
        <div className="socket-warning">{lang === 'tr' ? '⚠ Bağlantı kesildi, yeniden bağlanılıyor...' : '⚠ Disconnected, reconnecting...'}</div>
      )}

      {/* ─── Top Header Bar ─── */}
      <div className="djc-row1">
        <div className="djc-brand-block">
          <span className="djc-remiksbox">RemiksBox</span>
        </div>
        <div className="djc-row1-divider" />
        <span className="djc-event-name">{event.name}</span>
        <span className="djc-slug">/{slug}</span>
        <div style={{ flex: 1 }} />

        <div className="djc-stats-strip">
          <div className="djc-stat"><span className="djc-stat-val djc-stat-pending">{waitingRequests.length}</span><span className="djc-stat-lbl">{lang === 'tr' ? 'Bekleyen' : 'Pending'}</span></div>
          <div className="djc-stat"><span className="djc-stat-val">{approvedRequests.length}</span><span className="djc-stat-lbl">{lang === 'tr' ? 'Onaylı' : 'OK'}</span></div>
          <div className="djc-stat"><span className="djc-stat-val">{totalVotes}</span><span className="djc-stat-lbl">{T('dj.total_votes')}</span></div>
          <div className="djc-stat"><span className="djc-stat-val">{rejectedCount}</span><span className="djc-stat-lbl">{T('dj.reject')}</span></div>
        </div>

        <div className="lang-toggle">
          <button className={lang === 'tr' ? 'active' : ''} onClick={() => changeLang('tr')}>TR</button>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => changeLang('en')}>EN</button>
        </div>
        <span className={`status-chip ${event.status}`}>{T(`dj.status_${event.status}`)}</span>
      </div>

      {/* ─── 2-Column Body ─── */}
      <div className="djc-body">

        {/* ═══ LEFT: Controls ═══ */}
        <div className="djc-left">

          {/* Quick Actions */}
          <div className="djc-section">
            <div className="djc-section-label">{lang === 'tr' ? 'DURUM & KONTROL' : 'STATUS & CONTROL'}</div>
            <div className="djc-section-content">
              <div className="djc-actions">
                {event.status === 'waiting' && (
                  <>
                    <button className="btn btn-primary djc-btn" onClick={() => updateStatus('active')}>▶ {T('dj.start_requests')}</button>
                    <div className="djc-countdown-group">
                      {[5, 10, 15, 30].map(m => (
                        <button key={m} className={`preset-btn djc-preset ${countdownMinutes === m ? 'active' : ''}`} onClick={() => setCountdownMinutes(m)}>{m}′</button>
                      ))}
                      <input type="number" className="input" style={{ width: 44, textAlign: 'center', padding: '4px 2px', fontSize: 12 }} value={countdownMinutes} onChange={(e) => setCountdownMinutes(Number(e.target.value))} min={1} max={120} />
                      <button className="btn btn-ghost djc-btn" onClick={startCountdown}>⏱ {lang === 'tr' ? 'Başlat' : 'Start'}</button>
                    </div>
                  </>
                )}
                {event.status === 'countdown' && (
                  <button className="btn btn-primary djc-btn" onClick={() => updateStatus('active')}>▶ {T('dj.start_requests')}</button>
                )}
                {event.status === 'active' && (
                  <>
                    <button className="btn btn-ghost djc-btn" onClick={() => updateStatus('paused')}>⏸ {T('dj.pause')}</button>
                    <button className="btn btn-danger djc-btn" onClick={() => updateStatus('ended')}>⏹ {T('dj.end_event')}</button>
                  </>
                )}
                {event.status === 'paused' && (
                  <>
                    <button className="btn btn-primary djc-btn" onClick={() => updateStatus('active')}>▶ {T('dj.resume')}</button>
                    <button className="btn btn-danger djc-btn" onClick={() => updateStatus('ended')}>⏹ {T('dj.end_event')}</button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Links - BIG */}
          <div className="djc-section">
            <div className="djc-section-label">{lang === 'tr' ? 'PAYLAŞIM & EKRAN' : 'SHARE & DISPLAY'}</div>
            <div className="djc-big-links">
              <a href={`/display/${slug}`} target="_blank" rel="noopener noreferrer" className="djc-big-link-btn djc-big-display">
                <span className="djc-big-link-icon">🖥️</span>
                <span className="djc-big-link-text">{lang === 'tr' ? 'Display Ekranı' : 'Display Screen'}</span>
              </a>
              <button className="djc-big-link-btn djc-big-qr" onClick={() => setShowQr(!showQr)}>
                <span className="djc-big-link-icon">📱</span>
                <span className="djc-big-link-text">{lang === 'tr' ? 'QR Kod' : 'QR Code'}</span>
              </button>
              <button className="djc-big-link-btn djc-big-copy" onClick={copyLink}>
                <span className="djc-big-link-icon">{copied ? '✅' : '🔗'}</span>
                <span className="djc-big-link-text">{copied ? (lang === 'tr' ? 'Kopyalandı!' : 'Copied!') : (lang === 'tr' ? 'Link Kopyala' : 'Copy Link')}</span>
              </button>
            </div>
          </div>

          {/* QR Popup */}
          <AnimatePresence>
            {showQr && (
              <motion.div className="djc-qr-popup glass" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <QRCodeSVG value={requestUrl} size={140} bgColor="#ffffff" fgColor="#000000" level="M" />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all', maxWidth: 260 }}>{requestUrl}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ceremony Controls */}
          <div className="djc-section">
            <div className="djc-section-label">{lang === 'tr' ? 'TÖREN & AÇILIŞ' : 'CEREMONY'}</div>
            <div className="djc-section-content djc-section-row">
              <div className="djc-ceremony-btns">
                <button className={`btn djc-ceremony-btn opening ${openingOn ? 'active' : ''}`} onClick={() => toggleCeremony('opening')}>
                  {openingOn ? '⏹' : '🎉'} {lang === 'tr' ? 'Açılış' : 'Opening'}
                </button>
                <button className={`btn djc-ceremony-btn closing ${closingOn ? 'active' : ''}`} onClick={() => toggleCeremony('closing')}>
                  {closingOn ? '⏹' : '✨'} {lang === 'tr' ? 'Kapanış' : 'Closing'}
                </button>
              </div>
              <div className="djc-ceremony-timer">
                <span className="djc-limit-label">{lang === 'tr' ? 'Süre:' : 'Dur:'}</span>
                {[5, 10, 15, 30].map(m => (
                  <button key={m} className={`preset-btn djc-preset ${ceremonyMinutes === m ? 'active' : ''}`} onClick={() => updateCeremonyMinutes(m)}>{m}′</button>
                ))}
                <input type="number" className="input" style={{ width: 42, textAlign: 'center', padding: '4px 2px', fontSize: 12 }} value={ceremonyMinutes} onChange={(e) => updateCeremonyMinutes(Number(e.target.value))} min={1} max={120} />
              </div>
            </div>
          </div>

          {/* Music Mode */}
          <div className="djc-section">
            <div className="djc-section-label">{lang === 'tr' ? 'MÜZİK MODU & DJ' : 'MUSIC MODE & DJ'}</div>
            <div className="djc-section-content">
              <div className="djc-dj-photos-row">
                <span className="djc-djphoto-label">{lang === 'tr' ? '📸 DJ:' : '📸 DJ:'}</span>
                {DJ_PHOTOS.map(dj => (
                  <button key={dj.id}
                    className={`btn djc-djphoto-btn ${selectedDJs.includes(dj.id) ? 'active' : ''}`}
                    onClick={() => toggleDJPhoto(dj.id)}>
                    <img src={dj.src} alt={dj.name} className="djc-djphoto-thumb" />
                    <span>{dj.name}</span>
                  </button>
                ))}
              </div>
              <div className="djc-ceremony-btns" style={{ flexWrap: 'wrap' }}>
                {MUSIC_MODES.map(m => (
                  <button key={m.id}
                    className={`btn djc-ceremony-btn djc-mmode-btn mm-${m.id} ${activeMusicMode === m.id ? 'active' : ''}`}
                    onClick={() => toggleMusicMode(m.id)}>
                    {activeMusicMode === m.id ? '⏹' : m.icon} {lang === 'tr' ? m.tr : m.en}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="djc-section">
            <div className="djc-section-label">{lang === 'tr' ? 'AYARLAR & GÖRÜNÜM' : 'SETTINGS & APPEARANCE'}</div>
            <div className="djc-section-content djc-settings-grid">
              <div className="djc-brand-row">
                <span className="djc-brand-label">📺 {lang === 'tr' ? 'Ekran' : 'Screen'}</span>
                <input className="input djc-brand-input" placeholder={lang === 'tr' ? 'Organizasyon adı...' : 'Org name...'} value={brandText} onChange={(e) => handleBrandChange(e.target.value)} />
                {brandSaving && <span className="djc-brand-saving">⏳</span>}
              </div>
              <div className="djc-brand-row" style={{ alignItems: 'flex-start' }}>
                <span className="djc-brand-label">📜 {lang === 'tr' ? 'Ticker' : 'Ticker'}</span>
                <textarea className="input djc-ticker-input" placeholder={lang === 'tr' ? 'Her satıra bir mesaj...' : 'One per line...'} value={tickerTexts} onChange={(e) => handleTickerChange(e.target.value)} rows={2} />
                {tickerSaving && <span className="djc-brand-saving">⏳</span>}
              </div>
              <div className="djc-brand-row">
                <span className="djc-brand-label">🎨 {lang === 'tr' ? 'Tema' : 'Theme'}</span>
                <div className="djc-theme-picker">
                  {[
                    { id: 'cyan', color: '#00d4ff', label: 'Cyan' },
                    { id: 'purple', color: '#b829dd', label: 'Mor' },
                    { id: 'pink', color: '#ff0080', label: 'Pembe' },
                    { id: 'green', color: '#00ff88', label: 'Yeşil' },
                    { id: 'orange', color: '#ff6b35', label: 'Turuncu' },
                    { id: 'red', color: '#ff4444', label: 'Kırmızı' },
                  ].map(t => (
                    <button key={t.id}
                      className={`djc-theme-dot ${theme === t.id ? 'active' : ''}`}
                      style={{ background: t.color }}
                      onClick={() => changeTheme(t.id)}
                      title={t.label}
                    />
                  ))}
                </div>
              </div>
              <div className="djc-brand-row">
                <span className="djc-brand-label">✨ {lang === 'tr' ? 'Efekt' : 'FX'}</span>
                <div className="djc-limit-toggle">
                  {[
                    { id: 'low', label: lang === 'tr' ? 'Düşük' : 'Low' },
                    { id: 'medium', label: lang === 'tr' ? 'Orta' : 'Med' },
                    { id: 'high', label: lang === 'tr' ? 'Yüksek' : 'High' },
                  ].map(l => (
                    <button key={l.id}
                      className={`preset-btn djc-preset ${animationLevel === l.id ? 'active' : ''}`}
                      onClick={() => changeAnimationLevel(l.id)}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ═══ RIGHT: Request List ═══ */}
        <div className="djc-right">
          <div className="djc-list-header">
            <span>🎵 {T('dj.requests_list')} ({allActiveRequests.length})</span>
            <div className="djc-limit-toggle">
              <span className="djc-limit-label">{lang === 'tr' ? 'Limit:' : 'Limit:'}</span>
              <button className={`preset-btn djc-preset ${requestLimit === 1 ? 'active' : ''}`} onClick={() => updateRequestLimit(1)}>1</button>
              <button className={`preset-btn djc-preset ${requestLimit === 2 ? 'active' : ''}`} onClick={() => updateRequestLimit(2)}>2</button>
            </div>
          </div>

          {allActiveRequests.length === 0 ? (
            <div className="empty-state" style={{ flex: 1 }}>
              <div className="icon">📋</div>
              <p>{T('dj.no_requests')}</p>
            </div>
          ) : (
            <div className="dj-list-scroll">
              <table className="dj-table">
                <AnimatePresence>
                  <tbody>
                    {[...waitingRequests, ...approvedRequests].map((req, idx) => (
                      <motion.tr key={req.id} className={`dj-table-row ${req.status === 'pending' ? 'dj-table-row-pending' : ''}`} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: 'spring', stiffness: 350, damping: 28 }}>
                        <td className={`dj-table-rank ${req.status === 'approved' && idx - waitingRequests.length === 0 ? 'top-1' : req.status === 'approved' && idx - waitingRequests.length === 1 ? 'top-2' : req.status === 'approved' && idx - waitingRequests.length === 2 ? 'top-3' : ''}`}>{idx + 1}</td>
                        <td style={{ width: 40, padding: '6px' }}>
                          {req.album_art
                            ? <img src={req.album_art} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', display: 'block' }} />
                            : <div style={{ width: 34, height: 34, borderRadius: 6, background: 'var(--bg-glass-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎵</div>
                          }
                        </td>
                        <td>
                          <div className="dj-table-song">{req.song_name}</div>
                          {req.artist && <div className="dj-table-artist">{req.artist}</div>}
                        </td>
                        <td className={`dj-table-votes ${req.votes >= 10 ? 'is-hot' : ''}`}>{req.votes}</td>
                        <td className="dj-table-actions">
                          {req.status === 'pending' && <button className="btn btn-small btn-success" onClick={() => updateRequestStatus(req.id, 'approved')} title={lang === 'tr' ? 'Onayla' : 'Approve'}>✓</button>}
                          {req.status === 'approved' && <button className="btn btn-small btn-played" onClick={() => updateRequestStatus(req.id, 'played')} title={lang === 'tr' ? 'Çalındı' : 'Played'}>♫</button>}
                          <button className="btn btn-small btn-danger" onClick={() => updateRequestStatus(req.id, 'rejected')} style={{ marginLeft: 4 }} title={lang === 'tr' ? 'Reddet' : 'Reject'}>✕</button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </AnimatePresence>
              </table>
            </div>
          )}
        </div>

      </div>

      <AnimatePresence>
        {toast && <motion.div className="success-toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>{toast}</motion.div>}
      </AnimatePresence>
    </div>
  );
}
