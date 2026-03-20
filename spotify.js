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

    return data.tracks.items.map(track => ({
      spotifyId: track.id,
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      albumArt: track.album.images?.[1]?.url || track.album.images?.[0]?.url || '',
      previewUrl: track.preview_url,
    }));
  } catch (err) {
    console.error('Spotify search error:', err.message);
    return [];
  }
}

export function isSpotifyConfigured() {
  return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}
