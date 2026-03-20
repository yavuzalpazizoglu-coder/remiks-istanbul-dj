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

  const nowPlaying = requests.find(r => r.status === 'playing');
  const pendingRequests = requests.filter(r => r.status === 'pending' || r.status === 'approved');
  const playedRequests = requests.filter(r => r.status === 'played');
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
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="number" className="input" style={{ width: 70, textAlign: 'center' }} value={countdownMinutes} onChange={(e) => setCountdownMinutes(Number(e.target.value))} min={1} max={60} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{T('dj.countdown_minutes')}</span>
              <button className="btn btn-ghost" onClick={startCountdown}>⏱ {T('dj.start_countdown')}</button>
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
        <div className="stat-card">
          <div className="stat-value">{requests.length}</div>
          <div className="stat-label">{T('dj.total_requests')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalVotes}</div>
          <div className="stat-label">{T('dj.total_votes')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{playedRequests.length}</div>
          <div className="stat-label">{T('dj.mark_played')}</div>
        </div>
      </div>

      {/* QR Code + Links */}
      <div className="dj-qr-section">
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

      {/* Now Playing */}
      {nowPlaying && (
        <motion.div className="card" style={{ marginBottom: 20, borderColor: 'rgba(0,255,136,0.2)' }} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="now-playing-label">♫ {T('request.now_playing')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            {nowPlaying.album_art ? <img src={nowPlaying.album_art} alt="" className="song-album-art" /> : <div className="song-album-art-placeholder">🎵</div>}
            <div style={{ flex: 1 }}>
              <div className="song-name">{nowPlaying.song_name}</div>
              {nowPlaying.artist && <div className="song-artist">{nowPlaying.artist}</div>}
            </div>
            <button className="btn btn-small btn-ghost" onClick={() => updateRequestStatus(nowPlaying.id, 'played')}>
              ✓ {T('dj.mark_played')}
            </button>
          </div>
        </motion.div>
      )}

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
        <div className="dj-request-list">
          <AnimatePresence>
            {pendingRequests.map((req, idx) => (
              <motion.div
                key={req.id}
                className="dj-song-card"
                layout
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <span className={`song-rank ${idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : ''}`}>
                  {idx + 1}
                </span>
                {req.album_art ? <img src={req.album_art} alt="" className="song-album-art" /> : <div className="song-album-art-placeholder">🎵</div>}
                <div className="song-info">
                  <div className="song-name">{req.song_name}</div>
                  {req.artist && <div className="song-artist">{req.artist}</div>}
                </div>
                <div className="vote-area">
                  <span className={`vote-count ${req.votes >= 10 ? 'is-hot' : ''}`} style={{ fontSize: 18, fontWeight: 800 }}>{req.votes}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>oy</span>
                </div>
                <div className="dj-card-actions">
                  {req.status === 'pending' && (
                    <button className="btn btn-small btn-success" onClick={() => updateRequestStatus(req.id, 'approved')}>
                      {T('dj.approve')}
                    </button>
                  )}
                  <button className="btn btn-small btn-primary" onClick={() => updateRequestStatus(req.id, 'playing')}>
                    🎵 {T('dj.play_now')}
                  </button>
                  <button className="btn btn-small btn-danger" onClick={() => updateRequestStatus(req.id, 'rejected')} style={{ fontSize: 14, padding: '6px 10px' }}>
                    ✕
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {toast && <motion.div className="success-toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>{toast}</motion.div>}
      </AnimatePresence>
    </div>
  );
}
