import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import socket from '../socket.js';
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
  const brandTimer = useRef(null);
  const tickerTimer = useRef(null);

  const T = useCallback((key) => t(lang, key), [lang]);

  const headers = { 'Content-Type': 'application/json', 'x-dj-password': password };

  const fetchRequests = useCallback(async (eventSlug) => {
    try {
      const res = await fetch(`${API}/api/events/${eventSlug}/requests?all=true`);
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {}
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

    return () => {
      socket.off('request-added');
      socket.off('vote-updated');
      socket.off('list-updated');
      socket.off('event-status');
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
    } catch {}
  };

  const updateRequestStatus = async (requestId, status) => {
    try {
      const res = await fetch(`${API}/api/requests/${requestId}/status`, {
        method: 'PUT', headers,
        body: JSON.stringify({ status }),
      });
      if (res.ok) await fetchRequests(slug);
    } catch {}
  };

  const saveBrandText = useCallback(async (text) => {
    setBrandSaving(true);
    try {
      await fetch(`${API}/api/events/${slug}/brand`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-dj-password': password },
        body: JSON.stringify({ brandText: text }),
      });
    } catch {} finally {
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
    } catch {} finally {
      setTickerSaving(false);
    }
  }, [slug, password]);

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
              <button className="btn btn-ghost" onClick={() => loadEvent(connectSlug)}>{T('dj.connect')}</button>
            </div>
          </div>
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
      {/* ─── Row 1: Header + Status + Lang ─── */}
      <div className="djc-row1">
        <img src="/logos/logo-white.png" alt="" style={{ height: 28 }} />
        <span className="djc-event-name">{event.name}</span>
        <span className="djc-slug">/{slug}</span>
        <div style={{ flex: 1 }} />
        <div className="lang-toggle" style={{ transform: 'scale(0.85)' }}>
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
              <button className="btn btn-primary btn-sm" onClick={() => updateStatus('active')}>▶ {T('dj.start_requests')}</button>
              <div className="djc-countdown-group">
                {[5, 10, 15, 30].map(m => (
                  <button key={m} className={`preset-btn ${countdownMinutes === m ? 'active' : ''}`} onClick={() => setCountdownMinutes(m)}>{m}′</button>
                ))}
                <input type="number" className="input" style={{ width: 42, textAlign: 'center', padding: '4px 2px', fontSize: 12 }} value={countdownMinutes} onChange={(e) => setCountdownMinutes(Number(e.target.value))} min={1} max={120} />
                <button className="btn btn-ghost btn-sm" onClick={startCountdown}>⏱</button>
              </div>
            </>
          )}
          {event.status === 'countdown' && (
            <button className="btn btn-primary btn-sm" onClick={() => updateStatus('active')}>▶ {T('dj.start_requests')}</button>
          )}
          {event.status === 'active' && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => updateStatus('paused')}>⏸ {T('dj.pause')}</button>
              <button className="btn btn-danger btn-sm" onClick={() => updateStatus('ended')}>⏹ {T('dj.end_event')}</button>
            </>
          )}
          {event.status === 'paused' && (
            <>
              <button className="btn btn-primary btn-sm" onClick={() => updateStatus('active')}>▶ {T('dj.resume')}</button>
              <button className="btn btn-danger btn-sm" onClick={() => updateStatus('ended')}>⏹ {T('dj.end_event')}</button>
            </>
          )}
        </div>

        <div className="djc-stats-strip">
          <div className="djc-stat"><span className="djc-stat-val">{pendingRequests.length}</span><span className="djc-stat-lbl">{T('dj.total_requests')}</span></div>
          <div className="djc-stat"><span className="djc-stat-val">{totalVotes}</span><span className="djc-stat-lbl">{T('dj.total_votes')}</span></div>
          <div className="djc-stat"><span className="djc-stat-val">{rejectedCount}</span><span className="djc-stat-lbl">{T('dj.reject')}</span></div>
        </div>

        <div className="djc-quick-links">
          <button className="copy-btn" onClick={copyLink}>{copied ? '✓' : '🔗'}</button>
          <button className="copy-btn" onClick={() => setShowQr(!showQr)}>QR</button>
          <a href={`/display/${slug}`} target="_blank" rel="noopener noreferrer" className="copy-btn" style={{ textDecoration: 'none' }}>🖥</a>
        </div>
      </div>

      {/* Brand Text */}
      <div className="djc-brand-row">
        <span className="djc-brand-label">{lang === 'tr' ? '📺 Ekran Yazısı' : '📺 Screen Text'}</span>
        <input
          className="input djc-brand-input"
          placeholder={lang === 'tr' ? 'Organizasyon adını yazın...' : 'Type organization name...'}
          value={brandText}
          onChange={(e) => handleBrandChange(e.target.value)}
        />
        {brandSaving && <span className="djc-brand-saving">⏳</span>}
      </div>

      {/* Ticker Texts */}
      <div className="djc-brand-row" style={{ alignItems: 'flex-start' }}>
        <span className="djc-brand-label">{lang === 'tr' ? '📜 Kayan Yazılar' : '📜 Ticker Texts'}</span>
        <textarea
          className="input djc-ticker-input"
          placeholder={lang === 'tr'
            ? 'Her satıra bir mesaj yazın...\nÖrn: Remiks İstanbul etkinliğine hoşgeldiniz!\nİsteklerinizi gönderin!'
            : 'One message per line...\nE.g.: Welcome to Remiks Istanbul!\nSend your requests!'}
          value={tickerTexts}
          onChange={(e) => handleTickerChange(e.target.value)}
          rows={3}
        />
        {tickerSaving && <span className="djc-brand-saving">⏳</span>}
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

      {/* ─── Request List (full remaining space) ─── */}
      <div className="djc-list-header">
        <span>🎵 {T('dj.requests_list')} ({pendingRequests.length})</span>
      </div>

      {pendingRequests.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <p>{T('dj.no_requests')}</p>
        </div>
      ) : (
        <div className="dj-list-scroll">
          <table className="dj-table">
            <AnimatePresence>
              <tbody>
                {pendingRequests.map((req, idx) => (
                  <motion.tr
                    key={req.id}
                    className="dj-table-row"
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  >
                    <td className={`dj-table-rank ${idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : ''}`}>
                      {idx + 1}
                    </td>
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
                    <td className={`dj-table-votes ${req.votes >= 10 ? 'is-hot' : ''}`}>
                      {req.votes}
                    </td>
                    <td className="dj-table-actions">
                      {req.status === 'pending' && (
                        <button className="btn btn-small btn-success" onClick={() => updateRequestStatus(req.id, 'approved')}>✓</button>
                      )}
                      {req.status === 'approved' && (
                        <span style={{ fontSize: 10, color: 'var(--neon-cyan)', fontWeight: 600 }}>✓</span>
                      )}
                      <button className="btn btn-small btn-danger" onClick={() => updateRequestStatus(req.id, 'rejected')} style={{ marginLeft: 4 }}>✕</button>
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
