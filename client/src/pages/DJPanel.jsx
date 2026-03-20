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

  const createEvent = async () => {
    setFormError('');
    if (!newEventName.trim()) {
      setFormError(lang === 'tr' ? 'Etkinlik adı gerekli' : 'Event name required');
      return;
    }
    if (!password.trim()) {
      setFormError(lang === 'tr' ? 'DJ şifresi gerekli' : 'DJ password required');
      return;
    }
    localStorage.setItem('remiks_dj_pw', password);
    try {
      const res = await fetch(`${API}/api/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: newEventName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error === 'Unauthorized'
          ? (lang === 'tr' ? 'Şifre yanlış' : 'Wrong password')
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

  // ─── Create / Connect Form ───

  if (!event) {
    return (
      <div className="dj-panel">
        <div className="create-event-form">
          <img src="/logos/logo-white.png" alt="Remiks İstanbul" className="logo" />
          <h2>{T('dj.create_event')}</h2>

          <form onSubmit={(e) => { e.preventDefault(); createEvent(); }}>
            <div className="form-group">
              <label>{T('dj.event_name')}</label>
              <input className="input" placeholder={T('dj.event_name_placeholder')} value={newEventName} onChange={(e) => { setNewEventName(e.target.value); setFormError(''); }} autoFocus />
            </div>

            <div className="form-group">
              <label>{T('dj.password')}</label>
              <input className="input" type="password" placeholder="••••••" value={password} onChange={(e) => { setPassword(e.target.value); setFormError(''); }} />
            </div>

            {formError && (
              <div style={{ color: '#ff4444', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(255,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(255,68,68,0.2)' }}>
                {formError}
              </div>
            )}

            <motion.button type="submit" className="btn btn-primary" style={{ width: '100%' }} whileTap={{ scale: 0.96 }}>
              {T('dj.create')}
            </motion.button>
          </form>

          <div className="form-divider">{T('dj.or_create')}</div>

          <div className="connect-section">
            <div className="connect-row">
              <input className="input" placeholder={T('dj.enter_slug')} value={connectSlug} onChange={(e) => setConnectSlug(e.target.value)} />
              <button className="btn btn-ghost" onClick={() => { if (connectSlug.trim()) loadEvent(connectSlug.trim()); }}>{T('dj.connect')}</button>
            </div>
          </div>

          {/* Event History */}
          {eventHistory.length === 0 && password.trim() && (
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }} onClick={fetchHistory}>
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
        </div>

        <AnimatePresence>
          {toast && <motion.div className="success-toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>{toast}</motion.div>}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Main DJ Panel ───

  const pendingRequests = requests.filter(r => r.status === 'pending' || r.status === 'approved');
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;
  const totalVotes = requests.reduce((sum, r) => sum + r.votes, 0);

  return (
    <div className="dj-panel dj-compact">
      {!socketConnected && (
        <div className="socket-warning">{lang === 'tr' ? '⚠ Bağlantı kesildi, yeniden bağlanılıyor...' : '⚠ Disconnected, reconnecting...'}</div>
      )}
      {/* ─── Row 1: Header + Status + Lang ─── */}
      <div className="djc-row1">
        <div className="djc-brand-block">
          <img src="/logos/logo-white.png" alt="" style={{ height: 28 }} />
          <span className="djc-remiksbox">RemiksBox</span>
        </div>
        <div className="djc-row1-divider" />
        <span className="djc-event-name">{event.name}</span>
        <span className="djc-slug">/{slug}</span>
        <div style={{ flex: 1 }} />
        <div className="lang-toggle">
          <button className={lang === 'tr' ? 'active' : ''} onClick={() => changeLang('tr')}>TR</button>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => changeLang('en')}>EN</button>
        </div>
        <span className={`status-chip ${event.status}`}>{T(`dj.status_${event.status}`)}</span>
      </div>

      {/* ─── Row 2: Actions + Stats + Quick Links ─── */}
      <div className="djc-toolbar">
        <div className="djc-actions">
          {event.status === 'waiting' && (
            <>
              <button className="btn btn-primary djc-btn" onClick={() => updateStatus('active')}>▶ {T('dj.start_requests')}</button>
              <div className="djc-countdown-group">
                {[5, 10, 15, 30].map(m => (
                  <button key={m} className={`preset-btn djc-preset ${countdownMinutes === m ? 'active' : ''}`} onClick={() => setCountdownMinutes(m)}>{m}′</button>
                ))}
                <input type="number" className="input" style={{ width: 48, textAlign: 'center', padding: '6px 4px', fontSize: 14 }} value={countdownMinutes} onChange={(e) => setCountdownMinutes(Number(e.target.value))} min={1} max={120} />
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

        <div className="djc-stats-strip">
          <div className="djc-stat"><span className="djc-stat-val">{pendingRequests.length}</span><span className="djc-stat-lbl">{T('dj.total_requests')}</span></div>
          <div className="djc-stat"><span className="djc-stat-val">{totalVotes}</span><span className="djc-stat-lbl">{T('dj.total_votes')}</span></div>
          <div className="djc-stat"><span className="djc-stat-val">{rejectedCount}</span><span className="djc-stat-lbl">{T('dj.reject')}</span></div>
        </div>

        <div className="djc-quick-links">
          <button className="copy-btn djc-link-btn" onClick={copyLink} title="Link Kopyala">{copied ? '✓' : '🔗'}</button>
          <button className="copy-btn djc-link-btn" onClick={() => setShowQr(!showQr)} title="QR Kod">📱</button>
          <a href={`/display/${slug}`} target="_blank" rel="noopener noreferrer" className="copy-btn djc-link-btn" title="Display Ekranı" style={{ textDecoration: 'none' }}>🖥️</a>
        </div>
      </div>

      {/* ─── Ceremony Controls ─── */}
      <div className="djc-ceremony-bar">
        <div className="djc-ceremony-btns">
          <button className={`btn djc-ceremony-btn opening ${openingOn ? 'active' : ''}`} onClick={() => toggleCeremony('opening')}>
            {openingOn ? '⏹' : '🎉'} {lang === 'tr' ? 'Açılış' : 'Opening'}
          </button>
          <button className={`btn djc-ceremony-btn closing ${closingOn ? 'active' : ''}`} onClick={() => toggleCeremony('closing')}>
            {closingOn ? '⏹' : '✨'} {lang === 'tr' ? 'Kapanış' : 'Closing'}
          </button>
        </div>
        <div className="djc-ceremony-timer">
          <span className="djc-limit-label">{lang === 'tr' ? 'Süre:' : 'Duration:'}</span>
          {[5, 10, 15, 30].map(m => (
            <button key={m} className={`preset-btn djc-preset ${ceremonyMinutes === m ? 'active' : ''}`} onClick={() => updateCeremonyMinutes(m)}>{m}′</button>
          ))}
          <input type="number" className="input" style={{ width: 48, textAlign: 'center', padding: '6px 4px', fontSize: 14 }} value={ceremonyMinutes} onChange={(e) => updateCeremonyMinutes(Number(e.target.value))} min={1} max={120} />
        </div>
      </div>

      {/* ─── Music Mode Controls ─── */}
      <div className="djc-ceremony-bar">
        <span className="djc-limit-label">{lang === 'tr' ? '🎵 Müzik Modu:' : '🎵 Music Mode:'}</span>
        <div className="djc-dj-photos-row">
          <span className="djc-djphoto-label">{lang === 'tr' ? '📸 DJ Fotoğrafları:' : '📸 DJ Photos:'}</span>
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

      {/* Brand + Ticker + Theme + Animation Row */}
      <div className="djc-settings-row">
        <div className="djc-brand-row">
          <span className="djc-brand-label">{lang === 'tr' ? '📺 Ekran Yazısı' : '📺 Screen Text'}</span>
          <input className="input djc-brand-input" placeholder={lang === 'tr' ? 'Organizasyon adını yazın...' : 'Type organization name...'} value={brandText} onChange={(e) => handleBrandChange(e.target.value)} />
          {brandSaving && <span className="djc-brand-saving">⏳</span>}
        </div>
        <div className="djc-brand-row" style={{ alignItems: 'flex-start' }}>
          <span className="djc-brand-label">{lang === 'tr' ? '📜 Kayan Yazılar' : '📜 Ticker'}</span>
          <textarea className="input djc-ticker-input" placeholder={lang === 'tr' ? 'Her satıra bir mesaj...' : 'One message per line...'} value={tickerTexts} onChange={(e) => handleTickerChange(e.target.value)} rows={2} />
          {tickerSaving && <span className="djc-brand-saving">⏳</span>}
        </div>
        <div className="djc-brand-row">
          <span className="djc-brand-label">{lang === 'tr' ? '🎨 Tema' : '🎨 Theme'}</span>
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
          <span className="djc-brand-label">{lang === 'tr' ? '✨ Efekt' : '✨ Effects'}</span>
          <div className="djc-limit-toggle">
            {[
              { id: 'low', label: lang === 'tr' ? 'Düşük' : 'Low' },
              { id: 'medium', label: lang === 'tr' ? 'Orta' : 'Medium' },
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

      {/* QR Popup */}
      <AnimatePresence>
        {showQr && (
          <motion.div className="djc-qr-popup glass" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <QRCodeSVG value={requestUrl} size={120} bgColor="#ffffff" fgColor="#000000" level="M" />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all', maxWidth: 260 }}>{requestUrl}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Request List ─── */}
      <div className="djc-list-header">
        <span>🎵 {T('dj.requests_list')} ({pendingRequests.length})</span>
        <div className="djc-limit-toggle">
          <span className="djc-limit-label">{lang === 'tr' ? 'Kişi başı limit:' : 'Per person:'}</span>
          <button className={`preset-btn djc-preset ${requestLimit === 1 ? 'active' : ''}`} onClick={() => updateRequestLimit(1)}>1</button>
          <button className={`preset-btn djc-preset ${requestLimit === 2 ? 'active' : ''}`} onClick={() => updateRequestLimit(2)}>2</button>
        </div>
      </div>

      {pendingRequests.length === 0 ? (
        <div className="empty-state" style={{ flex: 1 }}>
          <div className="icon">📋</div>
          <p>{T('dj.no_requests')}</p>
        </div>
      ) : (
        <div className="dj-list-scroll">
          <table className="dj-table">
            <AnimatePresence>
              <tbody>
                {pendingRequests.map((req, idx) => (
                  <motion.tr key={req.id} className="dj-table-row" layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: 'spring', stiffness: 350, damping: 28 }}>
                    <td className={`dj-table-rank ${idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : ''}`}>{idx + 1}</td>
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

      <AnimatePresence>
        {toast && <motion.div className="success-toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>{toast}</motion.div>}
      </AnimatePresence>
    </div>
  );
}
