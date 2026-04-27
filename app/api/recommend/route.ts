import { NextResponse } from "next/server";
import { z } from "zod";
import { isInt } from "neo4j-driver";
import type { Integer } from "neo4j-driver";
import { parsePlaylistId, fetchPlaylist, fetchAudioFeatures, fetchArtistGenres } from "@/lib/spotify";
import { getDriver } from "@/lib/neo4j";
import { checkRateLimit, getIP } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  url: z.string().min(1).max(500),
});

function coerceNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (isInt(v as Integer)) return (v as Integer).toNumber();
  return typeof v === "number" ? v : 0;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

const FEATURE_TOLERANCE = 0.28; // ±this for range pre-filter

// The recommendation query scores every candidate track on:
//   - audio feature proximity (danceability, valence, acousticness)  → up to 0.70
//   - popularity bonus                                                → up to 0.10
//   - known-artist bonus                                              → +0.25
//   - known-genre bonus                                               → +0.15
const RECOMMEND_CYPHER = `
MATCH (t:Track)-[:PERFORMED_BY]->(a:Artist)
WHERE NOT t.track_id IN $excludeIds
  AND t.danceability >= $minDance  AND t.danceability <= $maxDance
  AND t.valence      >= $minValence AND t.valence     <= $maxValence
  AND t.acousticness >= $minAcoustic AND t.acousticness <= $maxAcoustic
WITH t, a,
  CASE WHEN toLower(a.name) IN $knownArtists THEN 1 ELSE 0 END AS isKnownArtist,
  (1.0 - abs(t.danceability  - $avgDance))    * 0.30 +
  (1.0 - abs(t.valence       - $avgValence))  * 0.30 +
  (1.0 - abs(t.acousticness  - $avgAcoustic)) * 0.20 +
  toFloat(t.popularity) / 100.0              * 0.10  AS audioPopScore
OPTIONAL MATCH (t)-[:HAS_GENRE]->(g:Genre)
WITH t, a, isKnownArtist, audioPopScore, collect(DISTINCT g.name) AS genres
WITH t, a, genres, isKnownArtist, audioPopScore,
  CASE WHEN any(gn IN genres WHERE toLower(gn) IN $knownGenres) THEN 1 ELSE 0 END AS isKnownGenre
WITH t, a, genres, isKnownArtist, isKnownGenre,
  isKnownArtist * 0.25 + audioPopScore +
  CASE WHEN any(gn IN genres WHERE toLower(gn) IN $knownGenres) THEN 0.15 ELSE 0.0 END AS totalScore
ORDER BY totalScore DESC
LIMIT 30
RETURN
  t.track_id      AS id,
  t.track_name    AS name,
  a.name          AS artist,
  t.danceability  AS danceability,
  t.valence       AS valence,
  t.acousticness  AS acousticness,
  t.popularity    AS popularity,
  genres,
  round(totalScore * 100) / 100 AS score,
  CASE WHEN isKnownArtist = 1 THEN 'artist'
       WHEN isKnownGenre  = 1 THEN 'genre'
       ELSE 'audio' END AS matchReason
`.trim();

export async function POST(req: Request) {
  const limited = checkRateLimit("recommend", getIP(req));
  if (limited) return limited;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body must be { url: string }." }, { status: 400 });
  }

  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "SPOTIFY_NOT_CONFIGURED", message: "Spotify credentials are not set on this server." },
      { status: 503 }
    );
  }

  const playlistId = parsePlaylistId(parsed.data.url);
  if (!playlistId) {
    return NextResponse.json(
      { error: "INVALID_PLAYLIST_URL", message: "Paste a public Spotify playlist URL (open.spotify.com/playlist/…)." },
      { status: 400 }
    );
  }

  // ── Spotify fetches ────────────────────────────────────────────────────────
  let playlistData: Awaited<ReturnType<typeof fetchPlaylist>>;
  try {
    playlistData = await fetchPlaylist(playlistId);
  } catch (e: unknown) {
    const msg = String((e as Error).message ?? "");
    if (msg === "PLAYLIST_NOT_FOUND") {
      return NextResponse.json({ error: "PLAYLIST_NOT_FOUND", message: "Playlist not found. Make sure it is public." }, { status: 404 });
    }
    if (msg === "PLAYLIST_PRIVATE") {
      return NextResponse.json({ error: "PLAYLIST_PRIVATE", message: "That playlist is private. Make it public first." }, { status: 403 });
    }
    return NextResponse.json({ error: "SPOTIFY_ERROR", message: msg }, { status: 502 });
  }

  const { meta, tracks } = playlistData;
  if (tracks.length === 0) {
    return NextResponse.json({ error: "EMPTY_PLAYLIST", message: "Playlist has no playable tracks." }, { status: 400 });
  }

  const trackIds = tracks.map((t) => t.id);
  const artistIds = [...new Set(tracks.flatMap((t) => t.artists.map((a) => a.id)))];

  // Parallel: audio features + artist genres (both just read from Spotify)
  const [audioFeatures, artistGenreMap] = await Promise.all([
    fetchAudioFeatures(trackIds),
    fetchArtistGenres(artistIds),
  ]);

  // ── Build taste profile ────────────────────────────────────────────────────
  const featureMap = new Map(audioFeatures.map((f) => [f.id, f]));
  const feats = tracks.map((t) => featureMap.get(t.id)).filter(Boolean) as typeof audioFeatures;

  const avgDance    = mean(feats.map((f) => f.danceability));
  const avgValence  = mean(feats.map((f) => f.valence));
  const avgAcoustic = mean(feats.map((f) => f.acousticness));
  const avgEnergy   = mean(feats.map((f) => f.energy));
  const avgTempo    = mean(feats.map((f) => f.tempo));

  // Collect Spotify genre signals across all artists in the playlist
  const genreCounts = new Map<string, number>();
  for (const id of artistIds) {
    for (const g of artistGenreMap.get(id) ?? []) {
      genreCounts.set(g.toLowerCase(), (genreCounts.get(g.toLowerCase()) ?? 0) + 1);
    }
  }
  const topSpotifyGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([g]) => g);

  // ── Neo4j ──────────────────────────────────────────────────────────────────
  const driver = getDriver();
  const database = process.env.NEO4J_DATABASE ?? "neo4j";
  const session = driver.session({ database, defaultAccessMode: "READ" });

  try {
    // Level 1: direct Spotify-ID matches in the DB
    const directResult = await session.executeRead((tx) =>
      tx.run("MATCH (t:Track) WHERE t.track_id IN $ids RETURN t.track_id AS id", { ids: trackIds })
    );
    const directMatches = new Set(directResult.records.map((r) => r.get("id") as string));

    // Level 2: artist names present in the DB (lowercase for comparison)
    const allArtistNames = [...new Set(tracks.flatMap((t) => t.artists.map((a) => a.name.toLowerCase())))];
    const artistResult = await session.executeRead((tx) =>
      tx.run(
        "MATCH (a:Artist) WHERE toLower(a.name) IN $names RETURN DISTINCT toLower(a.name) AS name",
        { names: allArtistNames }
      )
    );
    const knownArtists = artistResult.records.map((r) => r.get("name") as string);

    // Recommendations — the cascade scoring query
    const recResult = await session.executeRead((tx) =>
      tx.run(RECOMMEND_CYPHER, {
        excludeIds:   trackIds,
        minDance:     Math.max(0, avgDance    - FEATURE_TOLERANCE),
        maxDance:     Math.min(1, avgDance    + FEATURE_TOLERANCE),
        minValence:   Math.max(0, avgValence  - FEATURE_TOLERANCE),
        maxValence:   Math.min(1, avgValence  + FEATURE_TOLERANCE),
        minAcoustic:  Math.max(0, avgAcoustic - FEATURE_TOLERANCE),
        maxAcoustic:  Math.min(1, avgAcoustic + FEATURE_TOLERANCE),
        avgDance,
        avgValence,
        avgAcoustic,
        knownArtists,
        knownGenres: topSpotifyGenres,
      })
    );

    const recommendations = recResult.records.map((r) => ({
      id:           r.get("id") as string,
      name:         r.get("name") as string,
      artist:       r.get("artist") as string,
      danceability: r2(coerceNum(r.get("danceability"))),
      valence:      r2(coerceNum(r.get("valence"))),
      acousticness: r2(coerceNum(r.get("acousticness"))),
      popularity:   coerceNum(r.get("popularity")),
      genres:       (r.get("genres") as string[]) ?? [],
      score:        r2(coerceNum(r.get("score"))),
      matchReason:  r.get("matchReason") as "artist" | "genre" | "audio",
    }));

    // Determine the best fallback level that was actually used
    const fallbackLevel =
      directMatches.size > 0 ? "direct"
      : knownArtists.length > 0 ? "artist"
      : topSpotifyGenres.length > 0 ? "genre"
      : "audio";

    return NextResponse.json({
      playlist: meta,
      profile: {
        avgDanceability: r2(avgDance),
        avgEnergy:       r2(avgEnergy),
        avgValence:      r2(avgValence),
        avgAcousticness: r2(avgAcoustic),
        avgTempo:        Math.round(avgTempo),
        topGenres:       topSpotifyGenres.slice(0, 6),
      },
      matchStats: {
        total:           tracks.length,
        directMatches:   directMatches.size,
        knownArtists:    knownArtists.length,
        coveragePercent: Math.round((directMatches.size / tracks.length) * 100),
        fallbackLevel,
      },
      recommendations,
    });
  } finally {
    await session.close();
  }
}
