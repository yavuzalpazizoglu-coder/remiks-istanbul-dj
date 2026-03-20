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
    <div className="dj-panel">
      <div className="dj-header">
        <div className="dj-header-left">
          <img src="/logos/logo-white.png" alt="" className="logo" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{event.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>/{slug}</div>
          </div>
        </div>
        <div className="dj-header-right">
          <div className="lang-toggle">
            <button className={lang === 'tr' ? 'active' : ''} onClick={() => changeLang('tr')}>TR</button>
            <button className={lang === 'en' ? 'active' : ''} onClick={() => changeLang('en')}>EN</button>
          </div>
          <span className={`status-chip ${event.status}`}>
            {T(`dj.status_${event.status}`)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="dj-actions">
        {event.status === 'waiting' && (
          <>
            <button className="btn btn-primary" onClick={() => updateStatus('active')}>▶ {T('dj.start_requests')}</button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <div className="countdown-presets">
                {[5, 10, 15, 30].map(m => (
                  <button key={m} className={`preset-btn ${countdownMinutes === m ? 'active' : ''}`} onClick={() => setCountdownMinutes(m)}>
                    {m} {T('dj.countdown_minutes')}
                  </button>
                ))}
                <input type="number" className="input" style={{ width: 56, textAlign: 'center', padding: '8px 4px', fontSize: 13 }} value={countdownMinutes} onChange={(e) => setCountdownMinutes(Number(e.target.value))} min={1} max={120} />
              </div>
              <button className="btn btn-ghost" onClick={startCountdown} style={{ width: '100%' }}>⏱ {T('dj.start_countdown')}</button>
            </div>
          </>
        )}
        {event.status === 'countdown' && (
          <button className="btn btn-primary" onClick={() => updateStatus('active')}>▶ {T('dj.start_requests')}</button>
        )}
        {event.status === 'active' && (
          <>
            <button className="btn btn-ghost" onClick={() => updateStatus('paused')}>⏸ {T('dj.pause')}</button>
            <button className="btn btn-danger" onClick={() => updateStatus('ended')}>⏹ {T('dj.end_event')}</button>
          </>
        )}
        {event.status === 'paused' && (
          <>
            <button className="btn btn-primary" onClick={() => updateStatus('active')}>▶ {T('dj.resume')}</button>
            <button className="btn btn-danger" onClick={() => updateStatus('ended')}>⏹ {T('dj.end_event')}</button>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="dj-stats">
        <div className="stat-card glass">
          <div className="stat-value">{pendingRequests.length}</div>
          <div className="stat-label">{T('dj.total_requests')}</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-value">{totalVotes}</div>
          <div className="stat-label">{T('dj.total_votes')}</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-value">{rejectedCount}</div>
          <div className="stat-label">{T('dj.reject')}</div>
        </div>
      </div>

      {/* QR Code + Links */}
      <div className="dj-qr-section glass">
        <QRCodeSVG value={requestUrl} size={100} bgColor="#ffffff" fgColor="#000000" level="M" />
        <div className="dj-qr-info">
          <div style={{ fontWeight: 600, fontSize: 14 }}>{T('dj.qr_code')}</div>
          <div className="link">{requestUrl}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="copy-btn" onClick={copyLink}>
              {copied ? T('dj.copied') : T('dj.share_link')}
            </button>
            <a
              href={`/display/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="copy-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
            >
              🖥 {lang === 'tr' ? 'Display Ekranı Aç' : 'Open Display Screen'}
            </a>
          </div>
        </div>
      </div>

      {/* Request List */}
      <div className="section-title">
        <span>🎵</span> {T('dj.requests_list')} ({pendingRequests.length})
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
