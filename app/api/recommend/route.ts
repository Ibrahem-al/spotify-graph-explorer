import { NextResponse } from "next/server";
import { z } from "zod";
import { isInt } from "neo4j-driver";
import type { Integer } from "neo4j-driver";
import { parsePlaylistId, scrapePublicPlaylist } from "@/lib/spotify";
import { analyzeMusicTaste } from "@/lib/gemini";
import { getDriver } from "@/lib/neo4j";
import { checkRateLimit, getIP } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  url:         z.string().min(1).max(500).optional(),
  artists:     z.array(z.string().min(1).max(100)).max(20).optional(),
  tracks:      z.array(z.string().min(1).max(200)).max(30).optional(),
  description: z.string().min(1).max(1000).optional(),
}).refine(d => d.url || (d.artists?.length ?? 0) > 0 || (d.tracks?.length ?? 0) > 0 || d.description, {
  message: "Provide a Spotify playlist URL, artist names, or a description of your taste.",
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

const TOTAL_RECS = 15;
const FEATURE_TOLERANCE = 0.28;

// Build audio profile from tracks found in Neo4j by name / artist name
const PROFILE_CYPHER = `
MATCH (t:Track)-[:PERFORMED_BY]->(a:Artist)
WHERE toLower(t.track_name) IN $trackNames
   OR toLower(a.name) IN $artistNames
OPTIONAL MATCH (t)-[:HAS_GENRE]->(g:Genre)
WITH t, collect(DISTINCT toLower(g.name)) AS genres
RETURN
  t.danceability AS danceability,
  t.energy       AS energy,
  t.valence      AS valence,
  t.acousticness AS acousticness,
  t.tempo        AS tempo,
  t.track_id     AS id,
  genres
LIMIT 100
`.trim();

const FILL_CYPHER = `
MATCH (t:Track)-[:PERFORMED_BY]->(a:Artist)
WHERE NOT t.track_id IN $excludeIds
  AND t.danceability >= $minDance    AND t.danceability <= $maxDance
  AND t.valence      >= $minValence  AND t.valence      <= $maxValence
  AND t.acousticness >= $minAcoustic AND t.acousticness <= $maxAcoustic
  AND t.energy       >= $minEnergy   AND t.energy       <= $maxEnergy
WITH t, a,
  CASE WHEN toLower(a.name) IN $knownArtists THEN 1 ELSE 0 END AS isKnownArtist,
  (1.0 - abs(t.danceability  - $avgDance))    * 0.20 +
  (1.0 - abs(t.valence       - $avgValence))  * 0.20 +
  (1.0 - abs(t.acousticness  - $avgAcoustic)) * 0.15 +
  (1.0 - abs(t.energy        - $avgEnergy))   * 0.15 +
  toFloat(t.popularity) / 100.0               * 0.10 AS audioPopScore
OPTIONAL MATCH (t)-[:HAS_GENRE]->(g:Genre)
WITH t, a, isKnownArtist, audioPopScore, collect(DISTINCT g.name) AS genres
WITH t, a, genres, isKnownArtist, audioPopScore,
  CASE WHEN any(gn IN genres WHERE toLower(gn) IN $knownGenres) THEN 1 ELSE 0 END AS isKnownGenre
WITH t, a, genres, isKnownArtist, isKnownGenre,
  isKnownArtist * 0.25 + audioPopScore +
  CASE WHEN any(gn IN genres WHERE toLower(gn) IN $knownGenres) THEN 0.15 ELSE 0.0 END AS totalScore
ORDER BY totalScore DESC
LIMIT $fillCount
RETURN
  t.track_id      AS id,
  t.track_name    AS name,
  a.name          AS artist,
  t.danceability  AS danceability,
  t.valence       AS valence,
  t.acousticness  AS acousticness,
  t.energy        AS energy,
  t.popularity    AS popularity,
  genres,
  round(totalScore * 100) / 100 AS score,
  CASE WHEN isKnownArtist = 1 THEN 'artist'
       WHEN isKnownGenre  = 1 THEN 'genre'
       ELSE 'audio' END AS matchReason
`.trim();

type RecRow = {
  id: string; name: string; artist: string;
  danceability: number; valence: number; acousticness: number; energy: number;
  popularity: number; genres: string[]; score: number;
  matchReason: "spotify" | "artist" | "genre" | "audio";
};

function mapRec(r: import("neo4j-driver").Record): RecRow {
  return {
    id:           r.get("id") as string,
    name:         r.get("name") as string,
    artist:       r.get("artist") as string,
    danceability: r2(coerceNum(r.get("danceability"))),
    valence:      r2(coerceNum(r.get("valence"))),
    acousticness: r2(coerceNum(r.get("acousticness"))),
    energy:       r2(coerceNum(r.get("energy"))),
    popularity:   coerceNum(r.get("popularity")),
    genres:       (r.get("genres") as string[]) ?? [],
    score:        r2(coerceNum(r.get("score"))),
    matchReason:  r.get("matchReason") as RecRow["matchReason"],
  };
}

export async function POST(req: Request) {
  const limited = checkRateLimit("recommend", getIP(req));
  if (limited) return limited;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Bad request." }, { status: 400 });
  }

  const { url, artists: manualArtists = [], tracks: manualTracks = [], description } = parsed.data;

  // ── Step 1: resolve track/artist names ─────────────────────────────────────
  let playlistName = "Custom mix";
  let playlistImage: string | null = null;
  let sourceTrackNames: string[] = [];
  let sourceArtistNames: string[] = [];

  if (url) {
    const playlistId = parsePlaylistId(url);
    if (!playlistId) {
      return NextResponse.json(
        { error: "INVALID_PLAYLIST_URL", message: "Paste a public Spotify playlist URL (open.spotify.com/playlist/…)." },
        { status: 400 }
      );
    }

    try {
      const scraped = await scrapePublicPlaylist(playlistId);
      playlistName  = scraped.name;
      playlistImage = scraped.imageUrl;
      sourceTrackNames  = scraped.tracks.map(t => t.name.toLowerCase());
      sourceArtistNames = scraped.tracks.flatMap(t => t.artistNames.map(a => a.toLowerCase()));
    } catch (e: unknown) {
      const msg = (e as Error).message ?? "";
      if (msg === "PLAYLIST_NOT_FOUND") {
        return NextResponse.json({ error: "PLAYLIST_NOT_FOUND", message: "Playlist not found. Make sure the URL is correct and the playlist is public." }, { status: 404 });
      }
      // Scraping failed — if the caller also passed manual names, keep going.
      // Otherwise tell the frontend to show the manual input form.
      if (manualArtists.length === 0 && manualTracks.length === 0) {
        return NextResponse.json({
          error: "NEEDS_MANUAL_INPUT",
          message: "We couldn't load your playlist automatically. Enter some artists you like below and we'll find recommendations.",
        }, { status: 422 });
      }
    }
  }

  // Merge scraped + any manually supplied names
  const allArtistNames = [...new Set([...sourceArtistNames, ...manualArtists.map(a => a.toLowerCase())])];
  const allTrackNames  = [...new Set([...sourceTrackNames,  ...manualTracks.map(t => t.toLowerCase())])];

  if (allArtistNames.length === 0 && allTrackNames.length === 0) {
    return NextResponse.json({
      error: "NEEDS_MANUAL_INPUT",
      message: "Enter some artists or track names to get recommendations.",
    }, { status: 422 });
  }

  // ── Step 1b: description → Groq → audio profile (skips PROFILE_CYPHER) ──────
  if (description) {
    let tasteProfile;
    try {
      tasteProfile = await analyzeMusicTaste(description);
    } catch (e: unknown) {
      const msg = (e as Error).message ?? "";
      if (msg === "GROQ_NOT_CONFIGURED") {
        return NextResponse.json({ error: "GROQ_NOT_CONFIGURED", message: "Groq API key is not configured on this server." }, { status: 503 });
      }
      return NextResponse.json({ error: "GROQ_ERROR", message: "Failed to analyse your description. Try rephrasing it." }, { status: 502 });
    }

    const driver   = getDriver();
    const database = process.env.NEO4J_DATABASE ?? "neo4j";
    const session  = driver.session({ database, defaultAccessMode: "READ" });

    try {
      const lowerArtists = tasteProfile.artists.map(a => a.toLowerCase());
      const artistResult = await session.executeRead(tx =>
        tx.run(
          "MATCH (a:Artist) WHERE toLower(a.name) IN $names RETURN DISTINCT toLower(a.name) AS name",
          { names: lowerArtists }
        )
      );
      const knownArtists = artistResult.records.map(r => r.get("name") as string);
      const knownGenres  = tasteProfile.genres.map(g => g.toLowerCase());

      const fillResult = await session.executeRead(tx =>
        tx.run(FILL_CYPHER, {
          excludeIds:   [],
          fillCount:    TOTAL_RECS,
          minDance:     Math.max(0, tasteProfile.danceability - FEATURE_TOLERANCE),
          maxDance:     Math.min(1, tasteProfile.danceability + FEATURE_TOLERANCE),
          minValence:   Math.max(0, tasteProfile.valence      - FEATURE_TOLERANCE),
          maxValence:   Math.min(1, tasteProfile.valence      + FEATURE_TOLERANCE),
          minAcoustic:  Math.max(0, tasteProfile.acousticness - FEATURE_TOLERANCE),
          maxAcoustic:  Math.min(1, tasteProfile.acousticness + FEATURE_TOLERANCE),
          minEnergy:    Math.max(0, tasteProfile.energy       - FEATURE_TOLERANCE),
          maxEnergy:    Math.min(1, tasteProfile.energy       + FEATURE_TOLERANCE),
          avgDance:     tasteProfile.danceability,
          avgValence:   tasteProfile.valence,
          avgAcoustic:  tasteProfile.acousticness,
          avgEnergy:    tasteProfile.energy,
          knownArtists,
          knownGenres,
        })
      );

      const recommendations = fillResult.records.map(mapRec);

      return NextResponse.json({
        playlist: {
          id:         "ai",
          name:       tasteProfile.playlistName,
          owner:      "Groq AI",
          trackCount: recommendations.length,
          imageUrl:   null,
        },
        profile: {
          avgDanceability: r2(tasteProfile.danceability),
          avgEnergy:       r2(tasteProfile.energy),
          avgValence:      r2(tasteProfile.valence),
          avgAcousticness: r2(tasteProfile.acousticness),
          avgTempo:        Math.round(tasteProfile.tempo),
          topGenres:       knownGenres.slice(0, 6),
          profileSource:   "playlist" as const,
        },
        matchStats: {
          total:             recommendations.length,
          directMatches:     0,
          spotifyPicksFound: 0,
          fillCount:         recommendations.length,
          knownArtists:      knownArtists.length,
          coveragePercent:   0,
          fallbackLevel:     knownArtists.length > 0 ? "artist" : knownGenres.length > 0 ? "genre" : "audio",
        },
        recommendations,
        aiArtists: tasteProfile.artists,
      });
    } finally {
      await session.close();
    }
  }

  // ── Step 2: Neo4j — build taste profile ────────────────────────────────────
  const driver   = getDriver();
  const database = process.env.NEO4J_DATABASE ?? "neo4j";
  const session  = driver.session({ database, defaultAccessMode: "READ" });

  try {
    const profileResult = await session.executeRead(tx =>
      tx.run(PROFILE_CYPHER, { trackNames: allTrackNames, artistNames: allArtistNames })
    );

    if (profileResult.records.length === 0) {
      return NextResponse.json({
        error: "NEEDS_MANUAL_INPUT",
        message: url
          ? "None of your playlist tracks are in our database. Try entering artist names manually below."
          : "None of those artists/tracks are in our database. Try different names.",
      }, { status: 422 });
    }

    const recs = profileResult.records;
    const avgDance   = mean(recs.map(r => coerceNum(r.get("danceability"))));
    const avgEnergy  = mean(recs.map(r => coerceNum(r.get("energy"))));
    const avgValence = mean(recs.map(r => coerceNum(r.get("valence"))));
    const avgAcoustic = mean(recs.map(r => coerceNum(r.get("acousticness"))));
    const avgTempo   = mean(recs.map(r => coerceNum(r.get("tempo"))));
    const profileIds = recs.map(r => r.get("id") as string);

    // Top genres from matched tracks
    const genreCounts = new Map<string, number>();
    for (const r of recs) {
      for (const g of (r.get("genres") as string[]) ?? []) {
        genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
      }
    }
    const topGenres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([g]) => g);

    // Known artists in graph (for match-reason scoring)
    const artistResult = await session.executeRead(tx =>
      tx.run(
        "MATCH (a:Artist) WHERE toLower(a.name) IN $names RETURN DISTINCT toLower(a.name) AS name",
        { names: allArtistNames }
      )
    );
    const knownArtists = artistResult.records.map(r => r.get("name") as string);

    // ── Step 3: fill recommendations ───────────────────────────────────────
    const fillResult = await session.executeRead(tx =>
      tx.run(FILL_CYPHER, {
        excludeIds:   profileIds,
        fillCount:    TOTAL_RECS,
        minDance:     Math.max(0, avgDance    - FEATURE_TOLERANCE),
        maxDance:     Math.min(1, avgDance    + FEATURE_TOLERANCE),
        minValence:   Math.max(0, avgValence  - FEATURE_TOLERANCE),
        maxValence:   Math.min(1, avgValence  + FEATURE_TOLERANCE),
        minAcoustic:  Math.max(0, avgAcoustic - FEATURE_TOLERANCE),
        maxAcoustic:  Math.min(1, avgAcoustic + FEATURE_TOLERANCE),
        minEnergy:    Math.max(0, avgEnergy   - FEATURE_TOLERANCE),
        maxEnergy:    Math.min(1, avgEnergy   + FEATURE_TOLERANCE),
        avgDance,
        avgValence,
        avgAcoustic,
        avgEnergy,
        knownArtists,
        knownGenres: topGenres,
      })
    );

    const recommendations = fillResult.records.map(mapRec);

    const fallbackLevel =
      knownArtists.length > 0  ? "artist"
      : topGenres.length > 0   ? "genre"
      : "audio";

    return NextResponse.json({
      playlist: {
        id:         url ? (parsePlaylistId(url) ?? "") : "manual",
        name:       playlistName,
        owner:      manualArtists.length > 0 && !url ? "You" : "Playlist owner",
        trackCount: recs.length,
        imageUrl:   playlistImage,
      },
      profile: {
        avgDanceability: r2(avgDance),
        avgEnergy:       r2(avgEnergy),
        avgValence:      r2(avgValence),
        avgAcousticness: r2(avgAcoustic),
        avgTempo:        Math.round(avgTempo),
        topGenres:       topGenres.slice(0, 6),
        profileSource:   "playlist" as const,
      },
      matchStats: {
        total:              recs.length,
        directMatches:      recs.length,
        spotifyPicksFound:  0,
        fillCount:          recommendations.length,
        knownArtists:       knownArtists.length,
        coveragePercent:    100,
        fallbackLevel,
      },
      recommendations,
    });
  } finally {
    await session.close();
  }
}
