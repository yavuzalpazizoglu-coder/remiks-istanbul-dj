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
  { category: 'Yabancı Pop', keywords: ['pop', 'dance pop', 'electropop', 'synthpop', 'indie pop', 'k-pop', 'latin pop', 'europop'] },
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

export async function searchSpotify(query) {
  const accessToken = await getToken();
  if (!accessToken) return [];

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
    if (!data.tracks?.items) return [];

    const artistIds = [...new Set(data.tracks.items.map(t => t.artists[0]?.id).filter(Boolean))];
    await Promise.all(artistIds.map(id => getArtistGenres(id, accessToken)));

    return data.tracks.items.map(track => {
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
  } catch (err) {
    console.error('Spotify search error:', err.message);
    return [];
  }
}

export function isSpotifyConfigured() {
  return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}
