import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import socket from '../socket.js';
import useSocketStatus from '../useSocketStatus.js';
import { t } from '../i18n/index.js';

const API = import.meta.env.PROD ? '' : 'http://localhost:3000';

function getDeviceId() {
  let id = localStorage.getItem('remiks_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('remiks_device_id', id);
  }
  return id;
}

export default function RequestPage() {
  const { slug } = useParams();
  const deviceId = useRef(getDeviceId()).current;

  const [event, setEvent] = useState(null);
  const [lang, setLang] = useState('tr');
  const [requests, setRequests] = useState([]);
  const [votedIds, setVotedIds] = useState([]);
  const [requestCount, setRequestCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualArtist, setManualArtist] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [spotifyEnabled, setSpotifyEnabled] = useState(false);
  const [searching, setSearching] = useState(false);
  const [countdownEnd, setCountdownEnd] = useState(null);
  const [countdownDisplay, setCountdownDisplay] = useState('');
  const [djTheme, setDjTheme] = useState('cyan');
  const [eventLogo, setEventLogo] = useState('');

  const searchTimer = useRef(null);
  const socketConnected = useSocketStatus();
  const T = useCallback((key) => t(lang, key), [lang]);

  useEffect(() => {
    fetch(`${API}/api/config`).then(r => r.json()).then(d => setSpotifyEnabled(d.spotifyEnabled)).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [eventRes, reqRes] = await Promise.all([
        fetch(`${API}/api/events/${slug}`),
        fetch(`${API}/api/events/${slug}/requests?deviceId=${deviceId}`),
      ]);
      if (!eventRes.ok) throw new Error('Event not found');
      const eventData = await eventRes.json();
      const reqData = await reqRes.json();
      setEvent(eventData);
      setLang(eventData.language || 'tr');
      setRequests(reqData.requests);
      setVotedIds(reqData.votedIds);
      setRequestCount(reqData.requestCount);
      if (eventData.countdown_end) setCountdownEnd(eventData.countdown_end);
      if (eventData.theme) setDjTheme(eventData.theme);
      if (eventData.event_logo) setEventLogo(eventData.event_logo);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [slug, deviceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    socket.connect();
    socket.emit('join-event', { eventSlug: slug, role: 'request' });

    socket.on('request-added', (req) => {
      if (req.status !== 'approved') return;
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

    socket.on('list-updated', (list) => setRequests(list.filter(r => r.status === 'approved')));
    socket.on('now-playing', () => fetchData());

    socket.on('event-status', ({ status, countdown_end }) => {
      setEvent(prev => prev ? { ...prev, status } : prev);
      if (countdown_end) setCountdownEnd(countdown_end);
    });

    socket.on('language-changed', ({ language }) => setLang(language));
    socket.on('theme-changed', ({ theme }) => setDjTheme(theme));
    socket.on('logo-changed', ({ logo }) => setEventLogo(logo || ''));

    return () => {
      socket.off('request-added');
      socket.off('vote-updated');
      socket.off('list-updated');
      socket.off('now-playing');
      socket.off('event-status');
      socket.off('language-changed');
      socket.off('theme-changed');
      socket.off('logo-changed');
    };
  }, [slug, fetchData]);

  useEffect(() => {
    if (!countdownEnd || event?.status !== 'countdown') return;
    const interval = setInterval(() => {
      const diff = countdownEnd - Date.now();
      if (diff <= 0) {
        setCountdownDisplay('00:00');
        clearInterval(interval);
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdownDisplay(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdownEnd, event?.status]);

  const handleSearch = (value) => {
    setQuery(value);
    setSelectedSong(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim() || !spotifyEnabled) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/spotify/search?q=${encodeURIComponent(value)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSearchResults(data);
      } catch {
        setSearchResults([]);
        showToast(lang === 'tr' ? 'Arama başarısız' : 'Search failed');
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleSubmit = async () => {
    const songName = selectedSong ? selectedSong.name : manualName.trim();
    const artist = selectedSong ? selectedSong.artist : manualArtist.trim();
    if (!songName) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/events/${slug}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songName,
          artist,
          albumArt: selectedSong?.albumArt || '',
          spotifyId: selectedSong?.spotifyId || '',
          genre: selectedSong?.genre || '',
          deviceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setRequestCount(prev => prev + 1);
      setQuery('');
      setManualName('');
      setManualArtist('');
      setSelectedSong(null);
      setSearchResults([]);
      setShowManual(false);
      showToast(T('request.success'));
    } catch (err) {
      showToast(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const [activeTab, setActiveTab] = useState('request');
  const [votedAnimation, setVotedAnimation] = useState(null);
  const [confettiPos, setConfettiPos] = useState(null);

  const handleVote = async (requestId, e) => {
    if (votedIds.includes(requestId)) return;
    try {
      const res = await fetch(`${API}/api/requests/${requestId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || T('request.vote_error'));
        return;
      }
      setVotedIds(prev => [...prev, requestId]);
      setVotedAnimation(requestId);
      setTimeout(() => setVotedAnimation(null), 600);

      if (e?.currentTarget) {
        const rect = e.currentTarget.getBoundingClientRect();
        setConfettiPos({ x: rect.left + rect.width / 2, y: rect.top });
        setTimeout(() => setConfettiPos(null), 700);
      }
    } catch {
      showToast(lang === 'tr' ? 'Bağlantı hatası' : 'Connection error');
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  if (loading) return <div className="status-overlay"><div className="icon">🎧</div></div>;
  if (error) return <div className="status-overlay"><div className="icon">😕</div><h2>Oops</h2><p>{error}</p></div>;

  const themeColors = {
    cyan: { primary: '#00d4ff', rgb: '0,212,255' },
    purple: { primary: '#b829dd', rgb: '184,41,221' },
    pink: { primary: '#ff0080', rgb: '255,0,128' },
    green: { primary: '#008D4B', rgb: '0,141,75' },
    orange: { primary: '#ff6b35', rgb: '255,107,53' },
    red: { primary: '#ff4444', rgb: '255,68,68' },
  };
  const tc = themeColors[djTheme] || themeColors.cyan;
  const themeStyle = {
    '--theme-primary': tc.primary,
    '--theme-rgb': tc.rgb,
    '--neon-cyan': tc.primary,
    '--neon-pink': tc.primary,
    '--neon-purple': tc.primary,
  };

  const visibleRequests = requests.filter(r => r.status === 'approved');
  const limit = event.request_limit || 2;
  const remaining = limit - requestCount;
  const canRequest = remaining > 0 && ['active', 'countdown'].includes(event.status);

  if (event.status === 'waiting') {
    return (
      <div className="request-page" style={themeStyle}>
        <div className="status-overlay">
          <div className="icon">🎧</div>
          <h2>{T('request.not_open')}</h2>
          <p>{T('request.waiting_message')}</p>
        </div>
      </div>
    );
  }

  if (event.status === 'ended') {
    return (
      <div className="request-page" style={themeStyle}>
        <div className="status-overlay">
          <div className="icon">🎉</div>
          <h2>{T('request.ended')}</h2>
          <p>{T('request.ended_message')}</p>
        </div>
      </div>
    );
  }

  if (event.status === 'paused') {
    return (
      <div className="request-page" style={themeStyle}>
        <div className="status-overlay">
          <div className="icon">☕</div>
          <h2>{T('request.paused')}</h2>
          <p>{T('request.paused_message')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="request-page" style={themeStyle}>
      {!socketConnected && (
        <div className="socket-warning">{lang === 'tr' ? '⚠ Bağlantı kesildi, yeniden bağlanılıyor...' : '⚠ Disconnected, reconnecting...'}</div>
      )}

          <div className="request-header">
        <div className="request-header-logos">
          {eventLogo && <img src={eventLogo} alt="Event" className="request-event-logo" />}
          <span className="request-brand-logo"><span className="login-logo-remiks">Remiks</span><span className="login-logo-box">Box</span></span>
        </div>
        <h1>{T('request.title')}</h1>
        {event.status === 'countdown' && countdownDisplay && (
          <div style={{ marginTop: 8, fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--neon-cyan)' }}>
            {countdownDisplay}
          </div>
        )}
        <div className="request-remaining">
          {remaining > 0
            ? <>{T('request.remaining')}: <strong>{remaining}/{limit}</strong></>
            : <span style={{ color: 'var(--neon-pink)' }}>{T('request.limit_reached')}</span>
          }
        </div>
      </div>

      <div className="req-tab-bar">
        <button className={`req-tab ${activeTab === 'request' ? 'active' : ''}`} onClick={() => setActiveTab('request')}>
          🎵 {lang === 'tr' ? 'İstek Gönder' : 'Request'}
        </button>
        <button className={`req-tab ${activeTab === 'vote' ? 'active' : ''}`} onClick={() => setActiveTab('vote')}>
          🔥 {lang === 'tr' ? `Oylama (${visibleRequests.length})` : `Vote (${visibleRequests.length})`}
        </button>
      </div>

      {activeTab === 'request' && canRequest && (
        <div className="search-section">
          {spotifyEnabled && (
            <input
              className="input"
              placeholder={T('request.search_placeholder')}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
            />
          )}

          {searching && <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 12, fontSize: 13 }}>...</p>}

          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div className="search-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {searchResults.map((song) => (
                  <motion.div
                    key={song.spotifyId}
                    className={`search-result-item ${selectedSong?.spotifyId === song.spotifyId ? 'selected' : ''}`}
                    onClick={() => { setSelectedSong(song); setShowManual(false); }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {song.albumArt && <img src={song.albumArt} alt="" />}
                    <div className="search-result-info">
                      <div className="name">{song.name}</div>
                      <div className="artist">{song.artist}</div>
                    </div>
                    {selectedSong?.spotifyId === song.spotifyId && <span style={{ color: 'var(--neon-cyan)', fontSize: 20 }}>✓</span>}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="manual-input">
            <div className="manual-toggle" onClick={() => { setShowManual(!showManual); setSelectedSong(null); }}>
              <span>─</span>
              <span>{spotifyEnabled ? T('request.or_type_manually') : T('request.manual_placeholder')}</span>
              <span>─</span>
            </div>

            <AnimatePresence>
              {(showManual || !spotifyEnabled) && (
                <motion.div className="manual-fields" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <input className="input" placeholder={T('request.manual_placeholder')} value={manualName} onChange={(e) => setManualName(e.target.value)} />
                  <input className="input" placeholder={T('request.artist_placeholder')} value={manualArtist} onChange={(e) => setManualArtist(e.target.value)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="submit-section">
            <motion.button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting || (!selectedSong && !manualName.trim())}
              whileTap={{ scale: 0.96 }}
              style={{ opacity: submitting || (!selectedSong && !manualName.trim()) ? 0.5 : 1 }}
            >
              {submitting ? T('request.sending') : T('request.send')}
            </motion.button>
          </div>
        </div>
      )}

      {activeTab === 'request' && !canRequest && (
        <div className="empty-state" style={{ marginTop: 24 }}>
          <div className="icon">🚫</div>
          <p>{remaining <= 0 ? T('request.limit_reached') : T('request.not_open')}</p>
        </div>
      )}

      {activeTab === 'vote' && (
        <div className="request-list-section" style={{ marginTop: 12 }}>
          {visibleRequests.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🎵</div>
              <p>{T('request.no_requests')}</p>
            </div>
          ) : (
            <LayoutGroup>
              <div className="request-list">
                {visibleRequests.map((req, idx) => (
                  <motion.div
                    key={req.id}
                    layout
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`song-card ${idx === 0 ? 'is-top-1' : ''} ${votedAnimation === req.id ? 'song-card-voted' : ''}`}
                  >
                    <span className={`song-rank ${idx === 0 ? 'top-1' : idx === 1 ? 'top-2' : idx === 2 ? 'top-3' : ''}`}>
                      {idx + 1}
                    </span>
                    {req.album_art ? (
                      <img src={req.album_art} alt="" className="song-album-art" />
                    ) : (
                      <div className="song-album-art-placeholder">🎵</div>
                    )}
                    <div className="song-info">
                      <div className="song-name">{req.song_name}</div>
                      {req.artist && <div className="song-artist">{req.artist}</div>}
                    </div>
                    <div className="vote-area">
                      <motion.button
                        className={`vote-btn ${votedIds.includes(req.id) ? 'voted' : ''}`}
                        onClick={(e) => handleVote(req.id, e)}
                        whileTap={{ scale: 0.85 }}
                      >
                        ▲
                      </motion.button>
                      <span className={`vote-count ${req.votes >= 10 ? 'is-hot' : ''}`}>
                        {req.votes}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </LayoutGroup>
          )}
        </div>
      )}

      {confettiPos && (
        <div className="vote-confetti" style={{ left: confettiPos.x, top: confettiPos.y }}>
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * 360;
            const dist = 30 + Math.random() * 40;
            const dx = Math.cos(angle * Math.PI / 180) * dist;
            const dy = Math.sin(angle * Math.PI / 180) * dist;
            const colors = ['#00d4ff', '#b829dd', '#ff0080', '#008D4B', '#ff6b35'];
            return (
              <div key={i} className="vote-particle" style={{
                background: colors[i % colors.length],
                transform: `translate(${dx}px, ${dy}px)`,
                animationDelay: `${i * 0.03}s`,
              }} />
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            className="success-toast"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
