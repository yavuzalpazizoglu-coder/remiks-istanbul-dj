import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import socket from '../socket.js';

const API = import.meta.env.PROD ? '' : 'http://localhost:3000';

export default function RejiPage() {
  const { slug } = useParams();

  const [event, setEvent]               = useState(null);
  const [connectedCount, setConnectedCount] = useState(0);
  const [requests, setRequests]         = useState([]);
  const [activeMusicMode, setActiveMusicMode] = useState(null);

  // Kontroller
  const [rejiBrand, setRejiBrand]       = useState('');
  const [rejiTicker, setRejiTicker]     = useState('');
  const [rejiSpotInput, setRejiSpotInput] = useState('');
  const [blackout, setBlackout]         = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput]       = useState('');
  const chatEndRef = useRef(null);

  const displayUrl = `${window.location.origin}/display/${slug}`;

  // ── Veri yükleme ──
  const fetchData = useCallback(async () => {
    try {
      const [evRes, reqRes] = await Promise.all([
        fetch(`${API}/api/events/${slug}`),
        fetch(`${API}/api/events/${slug}/requests`),
      ]);
      if (!evRes.ok) return;
      const ev  = await evRes.json();
      const req = await reqRes.json();
      setEvent(ev);
      setRejiBrand(ev.brand_text || '');
      setRejiTicker(ev.ticker_texts || '');
      setRequests((req.requests || []).filter(r => r.status === 'approved'));
    } catch (e) { console.warn('RejiPage fetch failed:', e); }
  }, [slug]);

  // ── Socket ──
  useEffect(() => {
    fetchData();
    socket.connect();
    socket.emit('join-event', { eventSlug: slug, role: 'reji' });

    socket.on('event-status',  ({ status }) => setEvent(p => p ? { ...p, status } : p));
    socket.on('room-count',    ({ count })  => setConnectedCount(count));
    socket.on('list-updated',  (list)       => setRequests((list || []).filter(r => r.status === 'approved')));
    socket.on('vote-updated',  ({ requestId, votes }) =>
      setRequests(p => p.map(r => r.id === requestId ? { ...r, votes } : r).sort((a, b) => (b.votes || 0) - (a.votes || 0))));
    socket.on('music-mode',    ({ mode, active }) => setActiveMusicMode(active ? mode : null));
    socket.on('reji-blackout', ({ active }) => setBlackout(active));
    socket.on('crew-chat',     (msg)        => setChatMessages(p => [...p.slice(-60), msg]));

    return () => {
      socket.off('event-status'); socket.off('room-count');
      socket.off('list-updated'); socket.off('vote-updated');
      socket.off('music-mode');
      socket.off('reji-blackout'); socket.off('crew-chat');
    };
  }, [slug, fetchData]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── Yardımcılar ──
  const sendSpotlight = () => {
    if (!rejiSpotInput.trim()) return;
    socket.emit('reji-spotlight', { text: rejiSpotInput.trim() });
    setRejiSpotInput('');
  };
  const sendChat = () => {
    if (!chatInput.trim()) return;
    socket.emit('crew-chat', { message: chatInput.trim(), sender: 'reji' });
    setChatInput('');
  };
  const toggleBlackout = () => {
    const next = !blackout;
    setBlackout(next);
    socket.emit('reji-blackout', { active: next });
  };

  const statusLabel = {
    waiting: '— BEKLEMEDE', countdown: '⏱ GERİ SAYIM',
    active: '▶ CANLI', paused: '⏸ MOLA', ended: '⏹ BİTTİ',
  }[event?.status] || '—';

  if (!event) {
    return (
      <div className="reji-standalone-loading">
        <div className="reji-loading-dot" />
        <span>Bağlanıyor…</span>
      </div>
    );
  }

  return (
    <div className="reji-standalone">
      {/* ── Topbar ── */}
      <div className="reji-sb-topbar">
        <span className="reji-sb-logo">🎬 REJİ</span>
        <span className="reji-sb-event">{event.name}</span>
        <span className="reji-sb-slug">/{slug}</span>
        <div className="reji-sb-spacer" />
        <span className={`reji-sb-status reji-sb-status-${event.status}`}>{statusLabel}</span>
        <span className="reji-sb-stat">👥 {connectedCount}</span>
        <span className="reji-sb-stat">🎵 {requests.length}</span>
        {activeMusicMode && <span className="reji-sb-mode">{activeMusicMode}</span>}
        {blackout && <span className="reji-sb-blackout">🔲 KARARTMA</span>}
      </div>

      {/* ── Ana içerik ── */}
      <div className="reji-sb-body">

        {/* SOL: Display iframe %60 */}
        <div className="reji-sb-preview">
          <iframe
            src={displayUrl}
            title="Display Önizleme"
            className="reji-sb-iframe"
            allow="fullscreen"
          />
        </div>

        {/* SAĞ: Kontrol paneli %40 */}
        <div className="reji-sb-ctrl">

          {/* METİN */}
          <div className="reji-sb-sec">
            <div className="reji-sb-sec-title">📺 METİN</div>
            <div className="reji-sb-field">
              <label className="reji-sb-label">Ekran Yazısı</label>
              <input className="reji-sb-input" value={rejiBrand}
                onChange={e => { setRejiBrand(e.target.value); socket.emit('reji-brand', { text: e.target.value }); }}
                placeholder="Organizasyon adı..." />
            </div>
            <div className="reji-sb-field">
              <label className="reji-sb-label">Kayan Yazı</label>
              <input className="reji-sb-input" value={rejiTicker}
                onChange={e => { setRejiTicker(e.target.value); socket.emit('reji-ticker', { text: e.target.value }); }}
                placeholder="Ticker mesajı..." />
            </div>
          </div>

          {/* SPOTLIGHT */}
          <div className="reji-sb-sec">
            <div className="reji-sb-sec-title">⚡ SPOTLIGHT</div>
            <div className="reji-sb-field">
              <div className="reji-sb-row">
                <input className="reji-sb-input" value={rejiSpotInput}
                  onChange={e => setRejiSpotInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendSpotlight()}
                  placeholder="Sahne mesajı (5sn)…" maxLength={120} />
                <button className="reji-sb-btn reji-sb-btn-yellow" onClick={sendSpotlight}>⚡</button>
              </div>
            </div>
          </div>

          {/* EFEKT */}
          <div className="reji-sb-sec">
            <div className="reji-sb-sec-title">🎛 SAHNE EFEKTİ</div>
            <div className="reji-sb-btn-grid">
              <button className={`reji-sb-btn reji-sb-btn-full ${blackout ? 'reji-sb-btn-active' : ''}`} onClick={toggleBlackout}>
                {blackout ? '💡 Aydınlat' : '🔲 Karartma'}
              </button>
              <button className="reji-sb-btn reji-sb-btn-ghost" onClick={() => socket.emit('reji-countdown', { seconds: 5 })}>⏱ 5s</button>
              <button className="reji-sb-btn reji-sb-btn-ghost" onClick={() => socket.emit('reji-countdown', { seconds: 3 })}>⏱ 3s</button>
            </div>
          </div>


          {/* CHAT */}
          <div className="reji-sb-sec reji-sb-sec-chat reji-sb-sec-chat-expanded">
            <div className="reji-sb-sec-title">💬 DJ CHAT</div>
            <div className="reji-sb-chat-msgs">
              {chatMessages.length === 0 && <div className="reji-sb-chat-empty">Henüz mesaj yok</div>}
              {chatMessages.map((m, i) => (
                <div key={i} className={`reji-sb-chat-msg ${m.sender === 'reji' ? 'reji-sb-chat-mine' : ''}`}>
                  <span className="reji-sb-chat-sender">{m.sender === 'dj' ? '🎧 DJ' : '🎬 REJİ'}</span>
                  <span className="reji-sb-chat-text">{m.message}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="reji-sb-chat-input-row">
              <input className="reji-sb-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Mesaj yaz…" maxLength={200} />
              <button className="reji-sb-btn reji-sb-btn-purple" onClick={sendChat}>↑</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
