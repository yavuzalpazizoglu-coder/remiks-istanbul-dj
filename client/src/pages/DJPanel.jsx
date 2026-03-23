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
  const [panelTheme, setPanelTheme] = useState(() => localStorage.getItem('remiks_panel_theme') || 'classic');
  const [connectedCount, setConnectedCount] = useState(0);
  const [rightTab, setRightTab] = useState('settings');
  const [nightState, setNightState] = useState(null);
  const [nightInput, setNightInput] = useState('');
  const [nightArtist, setNightArtist] = useState('');
  const [nightDuration, setNightDuration] = useState(180);
  const [nightQuery, setNightQuery] = useState('');
  const [nightSearchResults, setNightSearchResults] = useState([]);
  const [nightSelectedSong, setNightSelectedSong] = useState(null);
  const [nightSearching, setNightSearching] = useState(false);
  const [spotifyEnabled, setSpotifyEnabled] = useState(false);
  const nightSearchTimer = useRef(null);
  const brandTimer = useRef(null);
  const tickerTimer = useRef(null);
  const previewMonitorRef = useRef(null);
  const previewIframeRef = useRef(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (panelTheme === 'pioneer') {
      document.body.classList.add('theme-pioneer-gold');
    } else {
      document.body.classList.remove('theme-pioneer-gold');
    }
    localStorage.setItem('remiks_panel_theme', panelTheme);
    return () => document.body.classList.remove('theme-pioneer-gold');
  }, [panelTheme]);

  useEffect(() => {
    function updatePreviewScale() {
      const monitor = previewMonitorRef.current;
      const iframe = previewIframeRef.current;
      if (monitor && iframe) {
        const scaleX = monitor.offsetWidth / 1920;
        const scaleY = monitor.offsetHeight / 1080;
        const scale = Math.min(scaleX, scaleY);
        iframe.style.transform = `scale(${scale})`;
      }
    }
    updatePreviewScale();
    const timer = setTimeout(updatePreviewScale, 300);
    window.addEventListener('resize', updatePreviewScale);
    return () => { window.removeEventListener('resize', updatePreviewScale); clearTimeout(timer); };
  }, [event]);

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

    socket.on('room-count', ({ count }) => setConnectedCount(count));

    socket.on('night-update', (data) => setNightState(data));
    socket.on('crew-chat', (msg) => {
      setChatMessages(prev => [...prev.slice(-50), msg]);
    });
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
      socket.off('request-added');
      socket.off('vote-updated');
      socket.off('list-updated');
      socket.off('event-status');
      socket.off('ceremony');
      socket.off('music-mode');
      socket.off('room-count');
      socket.off('night-update');
      socket.off('night-vote');
      socket.off('crew-chat');
      socket.disconnect();
    };
  }, [slug, fetchRequests]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    if (!chatOpen && chatMessages.length > 0) setChatUnread(prev => prev + 1);
  }, [chatMessages.length]);

  const sendChat = () => {
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
    socket.emit('crew-chat', { message: msg, sender: 'dj' });
    setChatInput('');
  };

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
    { id: 'arabesk', icon: '🎻', tr: 'Arabesk', en: 'Arabesk' },
    { id: 'rock', icon: '🎸', tr: 'Rock', en: 'Rock' },
    { id: '90s-pop', icon: '💿', tr: "90'lar", en: "90's" },
    { id: 'turkish-delight', icon: '🌹', tr: 'Turkish D.', en: 'Turkish D.' },
    { id: 'tech', icon: '🎧', tr: 'Tech', en: 'Tech' },
    { id: 'latino', icon: '💃', tr: 'Latino', en: 'Latino' },
    { id: 'rap', icon: '🎤', tr: 'Rap', en: 'Rap' },
    { id: 'winamp', icon: '📟', tr: 'Winamp', en: 'Winamp' },
    { id: 'pioneer', icon: '🎛️', tr: 'Pioneer', en: 'Pioneer' },
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

  const nightApi = useCallback(async (endpoint, body = {}) => {
    try {
      const res = await fetch(`${API}/api/events/${slug}/night/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dj-password': password },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Error'); return null; }
      return data;
    } catch (err) { showToast(err.message); return null; }
  }, [slug, password]);

  const fetchNightStatus = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`${API}/api/events/${slug}/night/status`);
      if (res.ok) setNightState(await res.json());
    } catch {}
  }, [slug]);

  useEffect(() => { if (slug && event) fetchNightStatus(); }, [slug, event, fetchNightStatus]);

  useEffect(() => {
    fetch(`${API}/api/config`).then(r => r.json()).then(d => setSpotifyEnabled(d.spotifyEnabled)).catch(() => {});
  }, []);

  const handleNightSearch = (value) => {
    setNightQuery(value);
    setNightSelectedSong(null);
    if (nightSearchTimer.current) clearTimeout(nightSearchTimer.current);
    if (!value.trim() || !spotifyEnabled) { setNightSearchResults([]); return; }
    setNightSearching(true);
    nightSearchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/spotify/search?q=${encodeURIComponent(value)}`);
        if (!res.ok) throw new Error();
        setNightSearchResults(await res.json());
      } catch { setNightSearchResults([]); }
      finally { setNightSearching(false); }
    }, 400);
  };

  useEffect(() => {
    const round = nightState?.rounds?.[nightState.currentRound - 1];
    if (round?.phase !== 'voting' || !round?.endTime) return;
    const interval = setInterval(() => {
      if (Date.now() >= round.endTime) { clearInterval(interval); nightStop(); }
      setNightState(prev => ({ ...prev }));
    }, 1000);
    return () => clearInterval(interval);
  }, [nightState?.rounds?.[nightState?.currentRound - 1]?.phase, nightState?.rounds?.[nightState?.currentRound - 1]?.endTime]);

  const nightAddSong = async () => {
    const title = nightSelectedSong ? nightSelectedSong.name : nightInput.trim();
    const artist = nightSelectedSong ? nightSelectedSong.artist : nightArtist.trim();
    if (!title) return;
    const result = await nightApi('finalists', {
      action: 'add',
      title,
      artist,
      albumArt: nightSelectedSong?.albumArt || '',
      spotifyId: nightSelectedSong?.spotifyId || '',
    });
    if (result) {
      setNightInput(''); setNightArtist(''); setNightQuery('');
      setNightSearchResults([]); setNightSelectedSong(null);
    }
  };

  const nightRemoveSong = (songId) => nightApi('finalists', { action: 'remove', songId });
  const nightStart = () => nightApi('start', { duration: nightDuration });
  const nightStop = () => nightApi('stop');
  const nightFullscreen = (show) => nightApi('fullscreen', { show });
  const nightNewRound = () => {
    const dj2Name = DJ_PHOTOS[1]?.name || 'DJ 2';
    nightApi('new-round', { djName: dj2Name });
  };
  const nightReset = () => nightApi('reset');

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
          <span className="login-footer-logo-text"><span className="login-logo-remiks">Remiks</span><span className="login-logo-box">Box</span></span>
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
              <h1 className="login-logo-text"><span className="login-logo-remiks">Remiks</span><span className="login-logo-box">Box</span></h1>
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
            <h1 className="login-logo-text"><span className="login-logo-remiks">Remiks</span><span className="login-logo-box">Box</span></h1>
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

  return (
    <div className="dj-panel dj-compact">
      <div className="djc-bg-art" aria-hidden="true" />
      {!socketConnected && (
        <div className="socket-warning">{lang === 'tr' ? '⚠ Bağlantı kesildi, yeniden bağlanılıyor...' : '⚠ Disconnected, reconnecting...'}</div>
      )}

      {/* ─── Top Header Bar ─── */}
      <div className="djc-row1">
        <div className="djc-brand-block">
          <span className="djc-remiksbox-logo"><span className="login-logo-remiks">Remiks</span><span className="login-logo-box">Box</span></span>
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
        <button className="djc-guest-link-btn" onClick={() => {
          const guestUrl = `${window.location.origin}/request/${slug}`;
          const guestMsg = lang === 'tr'
            ? `🎵 ${event.name}\n━━━━━━━━━━━━━━━━━━━━\n🎶 DJ'e şarkı isteğinde bulun!\n🔗 ${guestUrl}\n\nLinke tıkla → İstediğin şarkıyı yaz → Gönder!\nEn çok oy alan şarkılar önce çalınır 🔥\n━━━━━━━━━━━━━━━━━━━━\nPowered by RemiksBox`
            : `🎵 ${event.name}\n━━━━━━━━━━━━━━━━━━━━\n🎶 Request a song from the DJ!\n🔗 ${guestUrl}\n\nTap the link → Type your song → Send!\nMost voted songs play first 🔥\n━━━━━━━━━━━━━━━━━━━━\nPowered by RemiksBox`;
          navigator.clipboard.writeText(guestMsg).then(() => showToast(lang === 'tr' ? 'Misafir linki kopyalandı!' : 'Guest link copied!'));
        }} title={lang === 'tr' ? 'Misafir istek linkini kopyala' : 'Copy guest request link'}>
          📱 {lang === 'tr' ? 'MİSAFİR' : 'GUEST'}
        </button>
        <button className="djc-reji-link-btn" onClick={() => {
          const url = `${window.location.origin}/reji/${slug}`;
          const msg = lang === 'tr'
            ? `╔══════════════════════════╗\n║  ██▀███ ▓█████  ███▄ ▄███▓██▓ ██ ▄█▀  ██████ \n║ ▓██ ▒ ██▓█   ▀ ▓██▒▀█▀██▓██▒██▄█▒ ▒██    ▒ \n║ ▓██ ░▄█ ▒███   ▓██    ▓██▒██▓███▄░ ░ ▓██▄   \n║ ▒██▀▀█▄ ▒▓█  ▄ ▒██    ▒██░██▓██ █▄   ▒   ██▒\n║ ░██▓ ▒██▒░▒████▒▒██▒   ░██░██▒██▒ █▄▒██████▒▒\n║          𝗕 𝗢 𝗫  ·  DJ Platform\n╚══════════════════════════╝\n\n🎬 REJİ KONTROL PANELİ\n📺 Etkinlik: ${event.name}\n🔗 ${url}\n\nBu linki herhangi bir tarayıcıda (Chrome, Safari vb.) aç.\nLED duvarına gönderilecek sahne görüntüsünü canlı olarak izleyeceksin.\nAlt taraftaki kontrol çubuğu ile sahneyi yönetebilirsin.\n\n━━━━ KONTROL ÇUBUĞU ━━━━\n\n📺 EKRAN YAZISI\n   LED'de görünen ana başlık metnini değiştirir.\n   Yazıp Enter'a bas, anında sahneye yansır.\n\n📜 KAYAN YAZI (Ticker)\n   Ekranın altından geçen kayan mesajı değiştirir.\n   Birden fazla satır yazarsan sırayla döner.\n\n🎬 TÖREN (Açılış / Kapanış)\n   Süre seç (1-15 dk) → "▶ Açılış" veya "▶ Kapanış" bas.\n   LED'de sinematik açılış/kapanış animasyonu başlar.\n   "⏹ Durdur" ile istediğin an iptal edebilirsin.\n\n💡 SPOTLIGHT\n   Kutucuğa mesaj yaz → ⚡ butonuna bas.\n   LED'de 5 saniye boyunca büyük neon yazı görünür.\n   Örnek: "Pasta Kesimi", "Gelin Buketi", "DJ Değişimi"\n\n🔲 KARARTMA (Blackout)\n   Tek tuşla LED'i tamamen karartır.\n   Tekrar basınca görüntü geri gelir.\n   Sahne geçişleri ve sürpriz anlar için kullan.\n\n⏱ GERİ SAYIM\n   "5...1" veya "3...1" butonuna bas.\n   LED'de büyük rakamlarla geri sayım görünür.\n   Pasta kesimi, balon patlatma vb. anlarda kullan.\n\n💬 CHAT\n   Sağ taraftaki mesaj kutusu ile DJ'e anlık mesaj atabilirsin.\n   DJ de sana yanıt verebilir. İletişim gerçek zamanlı.\n\n━━━━━━━━━━━━━━━━━━━━\n⚠️ Tarayıcıyı tam ekran aç (F11) — görüntü otomatik ölçeklenir.\n📱 Mobil cihazdan da erişilebilir ama laptop/PC önerilir.\n━━━━━━━━━━━━━━━━━━━━\nPowered by Remiks İstanbul\nremiksistanbul.com`
            : `╔══════════════════════════╗\n║  ██▀███ ▓█████  ███▄ ▄███▓██▓ ██ ▄█▀  ██████ \n║ ▓██ ▒ ██▓█   ▀ ▓██▒▀█▀██▓██▒██▄█▒ ▒██    ▒ \n║ ▓██ ░▄█ ▒███   ▓██    ▓██▒██▓███▄░ ░ ▓██▄   \n║ ▒██▀▀█▄ ▒▓█  ▄ ▒██    ▒██░██▓██ █▄   ▒   ██▒\n║ ░██▓ ▒██▒░▒████▒▒██▒   ░██░██▒██▒ █▄▒██████▒▒\n║          𝗕 𝗢 𝗫  ·  DJ Platform\n╚══════════════════════════╝\n\n🎬 CREW CONTROL PANEL\n📺 Event: ${event.name}\n🔗 ${url}\n\nOpen this link in any browser (Chrome, Safari etc.).\nYou will see the live stage output being sent to the LED wall.\nUse the control bar at the bottom to manage the stage.\n\n━━━━ CONTROL BAR ━━━━\n\n📺 SCREEN TEXT\n   Changes the main title shown on the LED.\n   Type and press Enter — reflects instantly on stage.\n\n📜 TICKER\n   Changes the scrolling text at the bottom of the LED.\n   Multiple lines rotate automatically.\n\n🎬 CEREMONY (Opening / Closing)\n   Select duration (1-15 min) → press "▶ Opening" or "▶ Closing".\n   A cinematic animation plays on the LED.\n   Press "⏹ Stop" to cancel anytime.\n\n💡 SPOTLIGHT\n   Type a message → press ⚡.\n   A large neon text appears on LED for 5 seconds.\n   Example: "Cake Cutting", "Bouquet Toss", "DJ Switch"\n\n🔲 BLACKOUT\n   One press blacks out the entire LED.\n   Press again to restore. Use for transitions and surprises.\n\n⏱ COUNTDOWN\n   Press "5...1" or "3...1".\n   Large countdown numbers appear on LED.\n   Use for cake cutting, balloon pop, etc.\n\n💬 CHAT\n   Use the message box on the right to chat with the DJ.\n   DJ can reply back. Communication is real-time.\n\n━━━━━━━━━━━━━━━━━━━━\n⚠️ Open browser in fullscreen (F11) — display auto-scales.\n📱 Accessible from mobile but laptop/PC recommended.\n━━━━━━━━━━━━━━━━━━━━\nPowered by Remiks İstanbul\nremiksistanbul.com`;
          navigator.clipboard.writeText(msg).then(() => showToast(lang === 'tr' ? 'Reji linki kopyalandı!' : 'Reji link copied!'));
        }} title={lang === 'tr' ? 'Reji ekranı linkini kopyala' : 'Copy reji display link'}>
          🎬 {lang === 'tr' ? 'REJİ' : 'CREW'}
        </button>
        <span className={`status-chip ${event.status}`}>{T(`dj.status_${event.status}`)}</span>
      </div>

      {/* ─── 2-Column Body ─── */}
      <div className="djc-body">

        {/* ═══ LEFT: Controls ═══ */}
        <div className="djc-left">

          {/* Theme Toggle */}
          <div className="djc-theme-toggle">
            <button
              className={`djc-theme-toggle-btn ${panelTheme === 'classic' ? 'active' : ''}`}
              onClick={() => setPanelTheme('classic')}>
              Winamp
            </button>
            <button
              className={`djc-theme-toggle-btn ${panelTheme === 'pioneer' ? 'active' : ''}`}
              onClick={() => setPanelTheme('pioneer')}>
              Pioneer Gold
            </button>
          </div>

          {/* Status & Control */}
          <div className="djc-sec">
            <div className="djc-sec-head">
              <span className="djc-sec-title"><strong>{lang === 'tr' ? 'KUMANDA' : 'BOOTH'}</strong> · {lang === 'tr' ? 'Kontrol' : 'Command'}</span>
            </div>
            <div className="djc-sec-body">
              <div className="djc-booth-top">
                <div className="djc-booth-buttons">
                  {event.status === 'waiting' && (
                    <button className="btn btn-primary djc-btn" onClick={() => updateStatus('active')}>{T('dj.start_requests')}</button>
                  )}
                  {event.status === 'countdown' && (
                    <button className="btn btn-primary djc-btn" onClick={() => updateStatus('active')}>{T('dj.start_requests')}</button>
                  )}
                  {(event.status === 'active' || event.status === 'paused') && (
                    <>
                      <button className="btn btn-ghost djc-btn" onClick={() => updateStatus(event.status === 'paused' ? 'active' : 'paused')}>
                        {event.status === 'paused' ? T('dj.resume') : T('dj.pause')}
                      </button>
                      <button className="btn btn-danger djc-btn" onClick={() => updateStatus('ended')}>{T('dj.end_event')}</button>
                    </>
                  )}
                </div>
              </div>
              <div className="djc-booth-selects">
                <label className="djc-booth-select-label">
                  {lang === 'tr' ? 'Süre' : 'Duration'}
                  <select className="djc-booth-select" value={countdownMinutes} onChange={(e) => setCountdownMinutes(Number(e.target.value))}>
                    {[5, 10, 15, 30, 60].map(m => <option key={m} value={m}>{m} dk</option>)}
                  </select>
                </label>
                <label className="djc-booth-select-label">
                  {lang === 'tr' ? 'G.Sayım' : 'Countdown'}
                  <select className="djc-booth-select" value={countdownMinutes} onChange={(e) => { setCountdownMinutes(Number(e.target.value)); }}>
                    {[3, 5, 10, 15, 30].map(m => <option key={m} value={m}>{m} dk</option>)}
                  </select>
                </label>
                {event.status === 'waiting' && (
                  <button className="btn btn-ghost djc-btn djc-btn-sm" onClick={startCountdown}>{lang === 'tr' ? 'Başlat' : 'Start'}</button>
                )}
              </div>
            </div>
          </div>

          {/* Live Stats (moved from right panel) */}
          <div className="djc-sec">
            <div className="djc-sec-head">
              <span className="djc-sec-title"><strong>{lang === 'tr' ? 'CANLI' : 'LIVE'}</strong> · {lang === 'tr' ? 'İstatistik' : 'Stats'}</span>
            </div>
            <div className="djc-sec-body">
              <div className="djc-left-stats">
                <div className="djc-left-stat">
                  <span className="djc-left-stat-val">{connectedCount}</span>
                  <span className="djc-left-stat-lbl">{lang === 'tr' ? 'Bağlı' : 'Online'}</span>
                </div>
                <div className="djc-left-stat">
                  <span className="djc-left-stat-val">{approvedRequests.length}</span>
                  <span className="djc-left-stat-lbl">{lang === 'tr' ? 'İstek' : 'Req'}</span>
                </div>
                <div className="djc-left-stat">
                  <span className="djc-left-stat-val">{totalVotes}</span>
                  <span className="djc-left-stat-lbl">{lang === 'tr' ? 'Oy' : 'Vote'}</span>
                </div>
                <div className="djc-left-stat djc-left-stat-warn">
                  <span className="djc-left-stat-val">{waitingRequests.length}</span>
                  <span className="djc-left-stat-lbl">{lang === 'tr' ? 'Bekleyen' : 'Pend.'}</span>
                </div>
              </div>
              {approvedRequests.length > 0 && (
                <div className="djc-left-top3">
                  <div className="djc-left-top3-title">{lang === 'tr' ? 'EN ÇOK OY' : 'TOP VOTED'}</div>
                  {[...approvedRequests].sort((a, b) => b.votes - a.votes).slice(0, 3).map((req, i) => (
                    <div key={req.id} className="djc-left-top3-row">
                      <span className="djc-left-top3-rank">{i + 1}</span>
                      <span className="djc-left-top3-name">{req.song_name}</span>
                      <span className="djc-left-top3-votes">{req.votes}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ceremony */}
          <div className="djc-sec">
            <div className="djc-sec-head">
              <span className="djc-sec-title"><strong>{lang === 'tr' ? 'GÖSTERİ' : 'SHOW'}</strong> · {lang === 'tr' ? 'Sahne' : 'Ceremony'}</span>
            </div>
            <div className="djc-sec-body">
              <div className="djc-btn-pair">
                <button className={`btn djc-ceremony-btn opening ${openingOn ? 'active' : ''}`} onClick={() => toggleCeremony('opening')}>
                  {lang === 'tr' ? 'Açılış' : 'Opening'}
                </button>
                <button className={`btn djc-ceremony-btn closing ${closingOn ? 'active' : ''}`} onClick={() => toggleCeremony('closing')}>
                  {lang === 'tr' ? 'Kapanış' : 'Closing'}
                </button>
              </div>
              <div className="djc-booth-selects" style={{ marginTop: 4 }}>
                <label className="djc-booth-select-label">
                  {lang === 'tr' ? 'Açılış' : 'Opening'}
                  <select className="djc-booth-select" value={ceremonyMinutes} onChange={(e) => updateCeremonyMinutes(Number(e.target.value))}>
                    {[1, 5, 10, 15, 30].map(m => <option key={m} value={m}>{m} dk</option>)}
                  </select>
                </label>
                <label className="djc-booth-select-label">
                  {lang === 'tr' ? 'Kapanış' : 'Closing'}
                  <select className="djc-booth-select" value={ceremonyMinutes} onChange={(e) => updateCeremonyMinutes(Number(e.target.value))}>
                    {[1, 5, 10, 15, 30].map(m => <option key={m} value={m}>{m} dk</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* Music Mode & DJ */}
          <div className="djc-sec">
            <div className="djc-sec-head">
              <span className="djc-sec-title"><strong>MOD & DJ</strong> · {lang === 'tr' ? 'Modlar' : 'Modes'}</span>
            </div>
            <div className="djc-sec-body">
              <div className="djc-dj-row">
                <span className="djc-dj-label">DJ</span>
                <div className="djc-dj-grid">
                {DJ_PHOTOS.map(dj => (
                  <button key={dj.id}
                    className={`djc-dj-card ${selectedDJs.includes(dj.id) ? 'active' : ''}`}
                    onClick={() => toggleDJPhoto(dj.id)}>
                    <img src={dj.src} alt={dj.name} className="djc-djphoto-thumb" />
                    <span>{dj.name}</span>
                  </button>
                ))}
                </div>
              </div>
              <div className="djc-mmode-grid">
                {MUSIC_MODES.map(m => (
                  <button key={m.id}
                    className={`djc-mmode-tag mm-${m.id} ${activeMusicMode === m.id ? 'active' : ''}`}
                    onClick={() => toggleMusicMode(m.id)}>
                    {lang === 'tr' ? m.tr : m.en}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Request Limit */}
          <div className="djc-sec">
            <div className="djc-sec-head">
              <span className="djc-sec-title"><strong>{lang === 'tr' ? 'LİMİT' : 'LIMIT'}</strong> · {lang === 'tr' ? 'Sınır' : 'Limit'}</span>
            </div>
            <div className="djc-sec-body">
              <div className="djc-limit-toggle">
                <button className={`preset-btn djc-preset djc-preset-eq ${requestLimit === 1 ? 'active' : ''}`} onClick={() => updateRequestLimit(1)}>1</button>
                <button className={`preset-btn djc-preset djc-preset-eq ${requestLimit === 2 ? 'active' : ''}`} onClick={() => updateRequestLimit(2)}>2</button>
                <button className={`preset-btn djc-preset djc-preset-eq ${requestLimit === 3 ? 'active' : ''}`} onClick={() => updateRequestLimit(3)}>3</button>
                <button className={`preset-btn djc-preset djc-preset-eq ${requestLimit === 5 ? 'active' : ''}`} onClick={() => updateRequestLimit(5)}>5</button>
              </div>
            </div>
          </div>

          {/* ═══ Stage Preview (in left menu) ═══ */}
          {slug && event && (
            <div className="djc-sec djc-sec-grow">
              <div className="djc-sec-head djc-sec-head-between">
                <span className="djc-sec-title"><strong>{lang === 'tr' ? 'ÖNİZLEME' : 'PREVIEW'}</strong> · {lang === 'tr' ? 'Canlı' : 'Live'}</span>
                <span className="stage-preview-live-badge">
                  <span className="stage-preview-live-dot" />
                  {lang === 'tr' ? 'CANLI' : 'LIVE'}
                </span>
              </div>
              <div className="djc-sec-body">
                <div className="stage-preview-monitor stage-preview-monitor-left" ref={previewMonitorRef}>
                  <iframe
                    ref={previewIframeRef}
                    src={`/display/${slug}?preview=true`}
                    title="Stage Preview"
                    className="stage-preview-iframe"
                    scrolling="no"
                    frameBorder="0"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="djc-left-footer">
            <span className="djc-left-footer-powered">{lang === 'tr' ? 'SUNAN' : 'POWERED BY'}</span>
            <span className="djc-left-footer-brand">REMİKS İSTANBUL</span>
          </div>

        </div>

        {/* ═══ RIGHT: Request List ═══ */}
        <div className="djc-right">
          <div className="djc-list-header">
            <span>🎵 {T('dj.requests_list')} ({allActiveRequests.length})</span>
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

          {/* ═══ Settings & Appearance (in right panel) — TAB SYSTEM ═══ */}
          <div className="djc-settings-bottom">
            <div className="djc-settings-bottom-divider" />
            <div className="right-panel-tabs">
              <button className={`right-panel-tab ${rightTab === 'settings' ? 'active' : ''}`} onClick={() => setRightTab('settings')}>
                {lang === 'tr' ? 'Ayarlar' : 'Settings'}
              </button>
              <button className={`right-panel-tab night-tab ${rightTab === 'night' ? 'active' : ''} ${nightState?.rounds?.some(r => r.phase === 'voting') ? 'has-active-vote' : ''}`} onClick={() => setRightTab('night')}>
                ★ {lang === 'tr' ? 'Gecenin Şarkısı' : 'Song of the Night'}
              </button>
            </div>

            {/* ─── Settings Tab ─── */}
            {rightTab === 'settings' && (
              <div className="djc-settings-split">
                <div className="djc-settings-main">
                  <div className="djc-sec-head">
                    <span className="djc-sec-title">{lang === 'tr' ? 'Ayarlar & Görünüm' : 'Settings'}</span>
                  </div>
                  <div className="djc-settings-grid">
                    <div className="djc-field">
                      <label className="djc-field-label">{lang === 'tr' ? 'Ekran Yazısı' : 'Screen Text'}</label>
                      <div className="djc-field-input-wrap">
                        <input className="input djc-field-input" placeholder={lang === 'tr' ? 'Organizasyon adı...' : 'Org name...'} value={brandText} onChange={(e) => handleBrandChange(e.target.value)} />
                        {brandSaving && <span className="djc-field-status">...</span>}
                      </div>
                    </div>
                    <div className="djc-field">
                      <label className="djc-field-label">{lang === 'tr' ? 'Kayan Yazı' : 'Ticker'}</label>
                      <div className="djc-field-input-wrap">
                        <textarea className="input djc-field-textarea" placeholder={lang === 'tr' ? 'Her satıra bir mesaj...' : 'One per line...'} value={tickerTexts} onChange={(e) => handleTickerChange(e.target.value)} rows={3} />
                        {tickerSaving && <span className="djc-field-status">...</span>}
                      </div>
                    </div>
                    <div className="djc-field djc-field-inline">
                      <label className="djc-field-label">{lang === 'tr' ? 'Tema' : 'Theme'}</label>
                      <div className="djc-theme-picker">
                        {[
                          { id: 'cyan', color: '#00d4ff', label: 'Cyan' },
                          { id: 'purple', color: '#b829dd', label: 'Mor' },
                          { id: 'pink', color: '#ff0080', label: 'Pembe' },
                          { id: 'green', color: '#008D4B', label: 'Yeşil' },
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
                    <div className="djc-field djc-field-inline">
                      <label className="djc-field-label">{lang === 'tr' ? 'Efekt' : 'Effects'}</label>
                      <div className="djc-fx-toggle">
                        {[
                          { id: 'low', label: lang === 'tr' ? 'Düşük' : 'Low' },
                          { id: 'medium', label: lang === 'tr' ? 'Orta' : 'Med' },
                          { id: 'high', label: lang === 'tr' ? 'Yüksek' : 'High' },
                        ].map(l => (
                          <button key={l.id}
                            className={`djc-fx-btn ${animationLevel === l.id ? 'active' : ''}`}
                            onClick={() => changeAnimationLevel(l.id)}>
                            {l.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="djc-field djc-field-inline">
                      <label className="djc-field-label">{lang === 'tr' ? 'Tören Süresi' : 'Ceremony'}</label>
                      <div className="djc-fx-toggle">
                        {[1, 3, 5, 10, 15].map(m => (
                          <button key={m}
                            className={`djc-fx-btn ${ceremonyMinutes === m ? 'active' : ''}`}
                            onClick={() => updateCeremonyMinutes(m)}>
                            {m} dk
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="djc-crew-chat-panel">
                  <div className="djc-crew-chat-title">💬 {lang === 'tr' ? 'REJİ CHAT' : 'CREW CHAT'}</div>
                  <div className="djc-crew-chat-messages">
                    {chatMessages.length === 0 && <div className="crew-chat-empty">{lang === 'tr' ? 'Mesaj yok' : 'No messages'}</div>}
                    {chatMessages.map(m => (
                      <div key={m.id} className={`crew-chat-msg crew-chat-${m.sender}`}>
                        <span className="crew-chat-sender">{m.sender === 'dj' ? '🎧 DJ' : '🎬 REJİ'}</span>
                        <span className="crew-chat-text">{m.message}</span>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="djc-crew-chat-input-row">
                    <input className="djc-crew-chat-input" value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendChat()}
                      placeholder={lang === 'tr' ? 'Mesaj...' : 'Message...'} maxLength={200} />
                    <button className="djc-crew-chat-send" onClick={sendChat}>↑</button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Song of the Night Tab ─── */}
            {rightTab === 'night' && (() => {
              const round = nightState?.rounds?.[nightState.currentRound - 1];
              const phase = round?.phase || 'idle';
              const finalists = round?.finalists || [];
              const maxVotes = Math.max(...finalists.map(f => f.votes), 1);
              const leaderId = finalists.length > 0 ? [...finalists].sort((a, b) => b.votes - a.votes)[0]?.id : null;
              const winner = round?.winnerId ? finalists.find(f => f.id === round.winnerId) : null;
              const elapsed = round?.startedAt ? (Date.now() - round.startedAt) / 1000 : 0;
              const remaining = round?.endTime ? Math.max(0, (round.endTime - Date.now()) / 1000) : 0;
              const progress = round?.duration ? Math.min(100, (elapsed / round.duration) * 100) : 0;
              const mins = Math.floor(remaining / 60);
              const secs = Math.floor(remaining % 60);
              const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

              return (
                <div className="night-panel">
                  {phase === 'idle' && (
                    <>
                      <div className="night-round-label">
                        {lang === 'tr' ? `Tur: ${round?.djName || 'DJ 1'}` : `Round: ${round?.djName || 'DJ 1'}`}
                      </div>
                      {spotifyEnabled ? (
                        <div className="night-spotify-search">
                          <div className="night-input-row">
                            <input className="input night-input" placeholder={lang === 'tr' ? 'Spotify\'da ara...' : 'Search Spotify...'} value={nightQuery} onChange={e => handleNightSearch(e.target.value)} disabled={finalists.length >= 3} />
                            <button className="night-add-btn" onClick={nightAddSong} disabled={finalists.length >= 3 || (!nightSelectedSong && !nightInput.trim())}>+</button>
                          </div>
                          {nightSearching && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, padding: 4 }}>...</div>}
                          {nightSearchResults.length > 0 && !nightSelectedSong && (
                            <div className="night-search-results">
                              {nightSearchResults.map(song => (
                                <div key={song.spotifyId} className="night-search-item" onClick={() => { setNightSelectedSong(song); setNightSearchResults([]); setNightQuery(song.name); }}>
                                  {song.albumArt && <img src={song.albumArt} alt="" className="night-search-art" />}
                                  <div className="night-search-info">
                                    <div className="night-search-name">{song.name}</div>
                                    <div className="night-search-artist">{song.artist}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {nightSelectedSong && (
                            <div className="night-selected-song">
                              {nightSelectedSong.albumArt && <img src={nightSelectedSong.albumArt} alt="" className="night-search-art" />}
                              <div className="night-search-info">
                                <div className="night-search-name">{nightSelectedSong.name}</div>
                                <div className="night-search-artist">{nightSelectedSong.artist}</div>
                              </div>
                              <button className="night-finalist-remove" onClick={() => { setNightSelectedSong(null); setNightQuery(''); }}>✕</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="night-input-row">
                          <input className="input night-input" placeholder={lang === 'tr' ? 'Şarkı adı' : 'Song title'} value={nightInput} onChange={e => setNightInput(e.target.value)} disabled={finalists.length >= 3} />
                          <input className="input night-input night-input-sm" placeholder={lang === 'tr' ? 'Sanatçı' : 'Artist'} value={nightArtist} onChange={e => setNightArtist(e.target.value)} disabled={finalists.length >= 3} />
                          <button className="night-add-btn" onClick={nightAddSong} disabled={finalists.length >= 3 || !nightInput.trim()}>+</button>
                        </div>
                      )}
                      <ul className="night-finalist-list">
                        {finalists.map((f, i) => (
                          <li key={f.id} className="night-finalist-item">
                            {f.albumArt && <img src={f.albumArt} alt="" className="night-finalist-art" />}
                            <span className="night-finalist-num">{i + 1}.</span>
                            <span className="night-finalist-info">
                              <span className="night-finalist-title">{f.title}</span>
                              {f.artist && <span className="night-finalist-artist"> — {f.artist}</span>}
                            </span>
                            <button className="night-finalist-remove" onClick={() => nightRemoveSong(f.id)}>✕</button>
                          </li>
                        ))}
                      </ul>
                      <div className="night-duration-row">
                        <span>{lang === 'tr' ? 'Süre:' : 'Duration:'}</span>
                        <select className="night-duration-select" value={nightDuration} onChange={e => setNightDuration(Number(e.target.value))}>
                          <option value={120}>2 dk</option>
                          <option value={180}>3 dk</option>
                          <option value={300}>5 dk</option>
                          <option value={600}>10 dk</option>
                        </select>
                      </div>
                      <button className="night-start-btn" onClick={nightStart} disabled={finalists.length !== 3}>
                        ▶ {lang === 'tr' ? 'Oylamayı Başlat' : 'Start Voting'}
                      </button>
                    </>
                  )}

                  {phase === 'voting' && (
                    <>
                      <div className="night-active-header">
                        <span className="night-active-badge">★ {lang === 'tr' ? 'AKTİF' : 'ACTIVE'}</span>
                        <span className="night-active-round">{round?.djName} {lang === 'tr' ? 'Turu' : 'Round'}</span>
                      </div>
                      {finalists.map((f, i) => (
                        <div key={f.id} className={`night-vote-item ${f.id === leaderId ? 'leading' : ''}`}>
                          {f.albumArt && <img src={f.albumArt} alt="" className="night-vote-art" />}
                          <span style={{ marginRight: 6, minWidth: 14 }}>{i + 1}.</span>
                          {f.id === leaderId && <span className="night-leader-dot" />}
                          <div className="night-vote-info">
                            <span className="night-vote-name">{f.title}</span>
                            <span className="night-vote-artist">{f.artist}</span>
                          </div>
                          <span className="night-vote-count">{f.votes} {lang === 'tr' ? 'oy' : ''}</span>
                        </div>
                      ))}
                      <div className="night-countdown-row">
                        <span className={`night-countdown-time ${remaining < 30 ? 'urgent' : ''}`}>⏱ {timeStr}</span>
                        <span>{lang === 'tr' ? 'Toplam' : 'Total'}: {round?.totalVotes || 0}</span>
                      </div>
                      <div className="night-progress">
                        <div className={`night-progress-fill ${remaining < 30 ? 'urgent' : ''}`} style={{ width: `${progress}%` }} />
                      </div>
                      <div className="night-controls">
                        <button className="night-stop-btn" onClick={nightStop}>⏹ {lang === 'tr' ? 'Bitir' : 'End'}</button>
                      </div>
                    </>
                  )}

                  {phase === 'finished' && (
                    <>
                      <div className="night-active-header">
                        <span className="night-active-badge">★ {lang === 'tr' ? 'KAZANAN' : 'WINNER'}</span>
                        <span className="night-active-round">{round?.djName} {lang === 'tr' ? 'Turu' : 'Round'}</span>
                      </div>
                      {winner && (
                        <div className="night-winner-display">
                          {winner.albumArt && <img src={winner.albumArt} alt="" className="night-winner-art" />}
                          <div>
                            <div className="night-winner-icon">🏆</div>
                            <div className="night-winner-name">{winner.title}</div>
                            <div className="night-winner-artist">{winner.artist}</div>
                            <div className="night-winner-votes">{winner.votes} {lang === 'tr' ? 'oy' : 'votes'}</div>
                          </div>
                        </div>
                      )}
                      <div className="night-result-actions">
                        <button className="night-result-btn primary" onClick={() => nightFullscreen(true)}>
                          {lang === 'tr' ? 'Tam Ekran Göster' : 'Show Fullscreen'}
                        </button>
                        {nightState?.currentRound < 2 && (
                          <button className="night-result-btn" onClick={nightNewRound}>
                            {lang === 'tr' ? `Yeni Tur Başlat (${DJ_PHOTOS[1]?.name || 'DJ 2'})` : `New Round (${DJ_PHOTOS[1]?.name || 'DJ 2'})`}
                          </button>
                        )}
                        <button className="night-result-btn" onClick={() => { nightFullscreen(false); nightReset(); }}>
                          {lang === 'tr' ? 'Kapat' : 'Close'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

      </div>


      <AnimatePresence>
        {toast && <motion.div className="success-toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>{toast}</motion.div>}
      </AnimatePresence>
    </div>
  );
}
