const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

// Server-side token cache — survives across requests in the same Lambda instance
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 30_000) {
    return tokenCache.token;
  }
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_NOT_CONFIGURED");
  }
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  const data = await res.json();
  tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return tokenCache.token;
}

export function parsePlaylistId(input: string): string | null {
  const s = input.trim();
  const uri = s.match(/^spotify:playlist:([A-Za-z0-9]+)/);
  if (uri) return uri[1];
  const url = s.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/);
  if (url) return url[1];
  if (/^[A-Za-z0-9]{22}$/.test(s)) return s;
  return null;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
}

export interface SpotifyAudioFeatures {
  id: string;
  danceability: number;
  energy: number;
  valence: number;
  acousticness: number;
  tempo: number;
  speechiness: number;
  instrumentalness: number;
}

export interface SpotifyPlaylistMeta {
  id: string;
  name: string;
  owner: string;
  trackCount: number;
  imageUrl: string | null;
}

export async function fetchPlaylist(playlistId: string): Promise<{
  meta: SpotifyPlaylistMeta;
  tracks: SpotifyTrack[];
}> {
  const token = await getAccessToken();

  const infoRes = await fetch(`${SPOTIFY_API_BASE}/playlists/${playlistId}?fields=id,name,owner,images,tracks.total`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (infoRes.status === 404) throw new Error("PLAYLIST_NOT_FOUND");
  if (infoRes.status === 403) throw new Error("PLAYLIST_PRIVATE");
  if (!infoRes.ok) throw new Error(`SPOTIFY_ERROR:${infoRes.status}`);
  const info = await infoRes.json();

  // Paginate tracks, cap at 100 for responsiveness
  const tracks: SpotifyTrack[] = [];
  let offset = 0;

  while (tracks.length < 100) {
    const res = await fetch(
      `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?limit=100&offset=${offset}&fields=items(track(id,name,artists(id,name))),next`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) break;
    const data = await res.json();

    for (const item of data.items ?? []) {
      const t = item?.track;
      if (!t?.id) continue; // skip local tracks / podcast episodes
      tracks.push({ id: t.id, name: t.name, artists: t.artists.map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })) });
    }

    if (!data.next || tracks.length >= 100) break;
    offset += 100;
  }

  return {
    meta: {
      id: info.id,
      name: info.name,
      owner: info.owner?.display_name ?? info.owner?.id ?? "Unknown",
      trackCount: info.tracks?.total ?? tracks.length,
      imageUrl: info.images?.[0]?.url ?? null,
    },
    tracks,
  };
}

export async function fetchAudioFeatures(trackIds: string[]): Promise<SpotifyAudioFeatures[]> {
  if (trackIds.length === 0) return [];
  const token = await getAccessToken();
  const results: SpotifyAudioFeatures[] = [];

  for (let i = 0; i < trackIds.length; i += 100) {
    const batch = trackIds.slice(i, i + 100);
    const res = await fetch(
      `${SPOTIFY_API_BASE}/audio-features?ids=${batch.join(",")}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) continue;
    const data = await res.json();
    for (const f of data.audio_features ?? []) {
      if (f?.id) results.push(f);
    }
  }

  return results;
}

export async function fetchArtistGenres(artistIds: string[]): Promise<Map<string, string[]>> {
  if (artistIds.length === 0) return new Map();
  const token = await getAccessToken();
  const map = new Map<string, string[]>();

  for (let i = 0; i < artistIds.length; i += 50) {
    const batch = artistIds.slice(i, i + 50);
    const res = await fetch(
      `${SPOTIFY_API_BASE}/artists?ids=${batch.join(",")}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) continue;
    const data = await res.json();
    for (const a of data.artists ?? []) {
      if (a?.id) map.set(a.id, a.genres ?? []);
    }
  }

  return map;
}
