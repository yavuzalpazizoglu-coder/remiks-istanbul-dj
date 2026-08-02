let token = null;
let tokenExpiry = 0;

async function getToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;
  if (token && Date.now() < tokenExpiry) return token;

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: 'grant_type=client_credentials',
    });

    const data = await res.json();
    token = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return token;
  } catch (err) {
    console.error('Spotify token error:', err.message);
    return null;
  }
}

const GENRE_MAP = [
  { category: 'Türkçe Pop', keywords: ['turkish pop', 'turkce pop', 'turkish dance', 'anatolian pop'] },
  { category: 'Latin', keywords: ['latin', 'latin pop', 'reggaeton', 'salsa', 'bachata', 'latin trap', 'cumbia', 'urbano latino', 'latin hip hop'] },
  { category: 'Yabancı Pop', keywords: ['pop', 'dance pop', 'electropop', 'synthpop', 'indie pop', 'k-pop', 'europop'] },
  { category: 'Rap', keywords: ['turkish hip hop', 'rap', 'hip hop', 'trap', 'drill', 'grime', 'turkish trap'] },
  { category: 'Arabesk', keywords: ['arabesk', 'arabesque'] },
  { category: 'Türk Halk', keywords: ['turkish folk', 'turkish classical', 'anatolian rock', 'anatolian', 'turku', 'türkü', 'halk'] },
  { category: 'Özgün', keywords: ['özgün', 'ozgun', 'protest'] },
  { category: 'Rock', keywords: ['turkish rock', 'rock', 'alternative rock', 'indie rock', 'metal', 'hard rock', 'punk'] },
  { category: 'Elektronik', keywords: ['electronic', 'edm', 'house', 'techno', 'trance', 'dubstep', 'drum and bass'] },
  { category: 'R&B', keywords: ['r&b', 'soul', 'funk', 'neo soul'] },
];

function classifyGenre(spotifyGenres) {
  if (!spotifyGenres || spotifyGenres.length === 0) return '';
  const joined = spotifyGenres.join(' ').toLowerCase();
  for (const { category, keywords } of GENRE_MAP) {
    if (keywords.some(k => joined.includes(k))) return category;
  }
  return 'Diğer';
}

const artistGenreCache = new Map();

async function getArtistGenres(artistId, accessToken) {
  if (artistGenreCache.has(artistId)) return artistGenreCache.get(artistId);
  try {
    const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    const genres = data.genres || [];
    artistGenreCache.set(artistId, genres);
    return genres;
  } catch {
    return [];
  }
}

// Arama sonucu onbellegi — ayni sorgu tekrar Spotify'a gitmez (kota korumasi)
const searchCache = new Map(); // normalizedQuery -> { results, at }
const SEARCH_CACHE_TTL = 30 * 60 * 1000; // 30 dk
const SEARCH_CACHE_MAX = 500;

export async function searchSpotify(query) {
  const key = query.trim().toLowerCase();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_CACHE_TTL) return hit.results;

  const accessToken = await getToken();
  if (!accessToken) return hit ? hit.results : [];

  try {
    const params = new URLSearchParams({
      q: query,
      type: 'track',
      limit: '6',
      market: 'TR',
    });

    const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json();

    // Kota / rate limit — eski sonuc varsa onu don, yoksa ozel hata firlat
    if (res.status === 429 || data.error?.status === 429) {
      if (hit) return hit.results;
      const err = new Error('Spotify quota exceeded');
      err.code = 'spotify_quota';
      throw err;
    }

    if (!data.tracks?.items) return hit ? hit.results : [];

    const artistIds = [...new Set(data.tracks.items.map(t => t.artists[0]?.id).filter(Boolean))];
    await Promise.all(artistIds.map(id => getArtistGenres(id, accessToken)));

    const results = data.tracks.items.map(track => {
      const primaryArtistId = track.artists[0]?.id;
      const genres = primaryArtistId ? (artistGenreCache.get(primaryArtistId) || []) : [];
      return {
        spotifyId: track.id,
        name: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        albumArt: track.album.images?.[1]?.url || track.album.images?.[0]?.url || '',
        previewUrl: track.preview_url,
        genre: classifyGenre(genres),
      };
    });

    searchCache.set(key, { results, at: Date.now() });
    if (searchCache.size > SEARCH_CACHE_MAX) {
      searchCache.delete(searchCache.keys().next().value); // en eski kaydi at
    }
    return results;
  } catch (err) {
    if (err.code === 'spotify_quota') throw err;
    console.error('Spotify search error:', err.message);
    return hit ? hit.results : [];
  }
}

export function isSpotifyConfigured() {
  return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

/* ═══ Mode Cover Walls — mod basina sanatci listesi, Spotify top-track kapaklari ═══ */

const MODE_ARTISTS = {
  arabesk: ['Müslüm Gürses', 'Adnan Şenses', 'Ferdi Özbeğen', 'Selami Şahin', 'Orhan Gencebay', 'Ferdi Tayfur', 'Bergen', 'Kibariye', 'Hakkı Bulut', 'Emrah', 'Mahsun Kırmızıgül', 'Özcan Deniz', 'Semicenk', 'Hakan Altun', 'Hakan Taşıyan'],
  rock: ['Barış Manço', 'Cem Karaca', 'Duman', 'Mor ve Ötesi', 'Şebnem Ferah', 'Teoman', 'maNga', 'Athena', 'Haluk Levent', 'Yüksek Sadakat'],
  '90s-pop': ['Tarkan', 'Sezen Aksu', 'Mustafa Sandal', 'Serdar Ortaç', 'Yonca Evcimik', 'Kenan Doğulu', 'Sertab Erener', 'Çelik', 'Levent Yüksel', 'Aşkın Nur Yengi'],
  // Yöresel: Ankara havalari, halay, zeybek, horon
  'turkish-delight': ['Oğuz Yılmaz', 'Ankaralı Namık', 'Ankaralı Turgut', 'Ankaralı Yasemin', 'Mahmut Tuncer', 'İsmail Türüt', 'Davut Güloğlu', 'Volkan Konak', 'Bülent Serttaş', 'Grup Laçin'],
};

const modeCoverCache = new Map(); // modeId -> { covers: [...], fetchedAt }
const MODE_COVER_TTL = 7 * 24 * 60 * 60 * 1000; // 7 gun
const MODE_COVER_RETRY_COOLDOWN = 10 * 60 * 1000; // basarisiz denemeden sonra 10 dk bekle
const modeCoverLastAttempt = new Map(); // modeId -> timestamp

// Dosya tabanli kalici cache — restart/deploy sonrasi Spotify'a tekrar gitmemek icin
import { fileURLToPath } from 'url';
const MODE_COVER_FILE = fileURLToPath(new URL('./data/mode-covers.json', import.meta.url));
const MODE_COVER_DIR = fileURLToPath(new URL('./data', import.meta.url));

async function loadModeCoverFile() {
  try {
    const { readFile } = await import('fs/promises');
    const raw = JSON.parse(await readFile(MODE_COVER_FILE, 'utf8'));
    for (const [modeId, entry] of Object.entries(raw)) {
      if (entry?.covers?.length > 0 && !modeCoverCache.has(modeId)) {
        modeCoverCache.set(modeId, entry);
      }
    }
  } catch { /* dosya yoksa sorun degil */ }
}
const modeCoverFileLoaded = loadModeCoverFile();

async function saveModeCoverFile() {
  try {
    const { writeFile, mkdir } = await import('fs/promises');
    await mkdir(MODE_COVER_DIR, { recursive: true }).catch(() => {});
    await writeFile(MODE_COVER_FILE, JSON.stringify(Object.fromEntries(modeCoverCache)), 'utf8');
  } catch (err) {
    console.error('Mode cover cache yazilamadi:', err.message);
  }
}

async function fetchArtistTopCovers(artistName, accessToken) {
  try {
    // Not: top-tracks endpoint'i client-credentials icin 403 veriyor —
    // track aramasi popülerlik sirasina yakin sonuc dondurur.
    const params = new URLSearchParams({ q: `artist:"${artistName}"`, type: 'track', limit: '10', market: 'TR' });
    const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    const items = data.tracks?.items || [];
    const lower = artistName.toLowerCase();
    const own = items.filter(t => t.artists?.some(a => a.name.toLowerCase() === lower));
    return (own.length > 0 ? own : items).map(t => ({
      url: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || '',
      artist: artistName,
    })).filter(c => c.url);
  } catch (err) {
    console.error(`Mode cover fetch error (${artistName}):`, err.message);
    return [];
  }
}

export async function getModeCovers(modeId) {
  const artists = MODE_ARTISTS[modeId];
  if (!artists) return [];

  await modeCoverFileLoaded;

  const cached = modeCoverCache.get(modeId);
  if (cached && Date.now() - cached.fetchedAt < MODE_COVER_TTL) return cached.covers;

  // Basarisiz deneme sonrasi bekleme — Spotify kotasini korur (QUOTA_EXCEEDED)
  const lastAttempt = modeCoverLastAttempt.get(modeId) || 0;
  if (Date.now() - lastAttempt < MODE_COVER_RETRY_COOLDOWN) return cached ? cached.covers : [];
  modeCoverLastAttempt.set(modeId, Date.now());

  const accessToken = await getToken();
  if (!accessToken) return cached ? cached.covers : [];

  const perArtist = await Promise.all(artists.map(a => fetchArtistTopCovers(a, accessToken)));

  // Sanatcilar arasi esit dagilim + ayni kapagin tekrarini engelle
  const seen = new Set();
  const covers = [];
  for (let round = 0; round < 10 && covers.length < 48; round++) {
    for (const list of perArtist) {
      const c = list[round];
      if (c && !seen.has(c.url)) {
        seen.add(c.url);
        covers.push(c);
      }
    }
  }

  if (covers.length > 0) {
    modeCoverCache.set(modeId, { covers, fetchedAt: Date.now() });
    saveModeCoverFile();
    return covers;
  }
  // Yeni veri alinamadi — eski cache varsa suresi gecmis olsa bile onu kullan
  return cached ? cached.covers : [];
}
