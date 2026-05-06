"use client";

import { useState, useCallback, useRef } from "react";
import { Music2, Sparkles, ArrowRight, ListMusic, Users, Wand2, Play, ChevronUp, Mic2 } from "lucide-react";
import { clsx } from "clsx";
import { PageTabs } from "@/components/assignment/PageTabs";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlaylistMeta {
  id: string;
  name: string;
  owner: string;
  trackCount: number;
  imageUrl: string | null;
}

interface Profile {
  avgDanceability: number;
  avgEnergy: number;
  avgValence: number;
  avgAcousticness: number;
  avgTempo: number;
  topGenres: string[];
  profileSource: "spotify" | "playlist";
}

interface MatchStats {
  total: number;
  directMatches: number;
  spotifyPicksFound: number;
  fillCount: number;
  knownArtists: number;
  coveragePercent: number;
  fallbackLevel: "direct" | "artist" | "genre" | "audio";
}

interface Recommendation {
  id: string;
  name: string;
  artist: string;
  danceability: number;
  valence: number;
  acousticness: number;
  energy: number;
  popularity: number;
  genres: string[];
  score: number;
  matchReason: "spotify" | "artist" | "genre" | "audio";
}

interface RecommendResult {
  playlist: PlaylistMeta;
  profile: Profile;
  matchStats: MatchStats;
  recommendations: Recommendation[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MATCH_REASON_CONFIG = {
  spotify: { label: "Spotify pick",  color: "bg-[#1DB954]/15 text-[#1DB954]" },
  artist:  { label: "Same artist",   color: "bg-[#22C55E]/15 text-[#22C55E]" },
  genre:   { label: "Same genre",    color: "bg-[#60A5FA]/15 text-[#60A5FA]" },
  audio:   { label: "Similar sound", color: "bg-[#A78BFA]/15 text-[#A78BFA]" },
};

const FALLBACK_DESCRIPTIONS = {
  direct: "Recommendations anchored on tracks from your playlist found directly in the graph.",
  artist: "Recommendations based on artists from your playlist found in the graph.",
  genre:  "Recommendations based on genres from your playlist matched in the graph.",
  audio:  "Recommendations based purely on your playlist's audio feature profile — danceability, mood, and acousticness.",
};

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function FeatureBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-xs text-[#64748b] shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: pct(value), backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right text-xs text-[#94A3B8] shrink-0">{pct(value)}</span>
    </div>
  );
}

function GenrePill({ genre }: { genre: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] bg-[#1E293B] text-[#94A3B8] border border-[#334155]">
      {genre}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RecommendPage() {
  const [url, setUrl]           = useState("");
  const [artistInput, setArtistInput] = useState("");
  const [status, setStatus]     = useState<"idle" | "loading" | "success" | "error" | "needs_manual">("idle");
  const [result, setResult]     = useState<RecommendResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const artistRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(async (body: Record<string, unknown>) => {
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res  = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.error === "NEEDS_MANUAL_INPUT") {
          setErrorMsg(data.message ?? null);
          setStatus("needs_manual");
          return;
        }
        setErrorMsg(data?.message ?? "Something went wrong. Try again.");
        setStatus("error");
        return;
      }

      setResult(data as RecommendResult);
      setStatus("success");
    } catch {
      setErrorMsg("Network error. Check your connection and try again.");
      setStatus("error");
    }
  }, []);

  const handleUrlSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    submit({ url: trimmed });
  }, [url, submit]);

  const handleManualSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const artists = artistInput
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    if (artists.length === 0) return;
    submit({ artists, url: url.trim() || undefined });
  }, [artistInput, url, submit]);

  return (
    <div className="flex flex-col min-h-screen bg-[#0F172A] text-[#F8FAFC]">
      {/* Header */}
      <header className="shrink-0 px-4 py-3 border-b border-[#1E293B] bg-[#0F172A]/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#22C55E]/15 flex items-center justify-center">
              <span className="text-[#22C55E] text-lg font-bold">⬡</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="font-semibold text-sm text-[#F8FAFC]">Spotify Graph Explorer</h1>
              <p className="text-xs text-[#64748b] hidden md:block">Ask in plain English, get a Neo4j graph back</p>
            </div>
          </div>
          <PageTabs current="recommend" />
          <div className="w-20 shrink-0" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-8">

          {/* ── URL form (idle / error) ── */}
          {(status === "idle" || status === "error") && (
            <div className="flex flex-col items-center text-center gap-6 py-8 sm:py-14">
              <div className="w-16 h-16 rounded-2xl bg-[#22C55E]/15 flex items-center justify-center">
                <Wand2 className="text-[#22C55E]" size={28} />
              </div>
              <div className="max-w-lg">
                <h2 className="text-2xl font-bold tracking-tight mb-2">Playlist recommender</h2>
                <p className="text-[#94A3B8] text-[15px] leading-relaxed">
                  Paste any public Spotify playlist. We'll analyse its sound profile and find
                  15 tracks from our graph that match your taste.
                </p>
              </div>

              <form onSubmit={handleUrlSubmit} className="w-full max-w-xl flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://open.spotify.com/playlist/…"
                    className={clsx(
                      "flex-1 px-4 py-3 rounded-xl text-sm bg-[#0B1120] border text-[#F8FAFC] placeholder-[#475569]",
                      "focus:outline-none focus:ring-2 focus:ring-[#22C55E]",
                      status === "error" ? "border-red-500/60" : "border-[#334155]"
                    )}
                  />
                  <button
                    type="submit"
                    disabled={!url.trim()}
                    className={clsx(
                      "shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                      "bg-[#22C55E] hover:bg-[#16A34A] text-white",
                      "disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                  >
                    <ArrowRight size={16} />
                    <span className="hidden sm:inline">Analyse</span>
                  </button>
                </div>
                {status === "error" && errorMsg && (
                  <p className="text-sm text-red-400 text-left">{errorMsg}</p>
                )}
              </form>

              {/* How it works */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl mt-2">
                {[
                  { icon: <ListMusic size={16} />, title: "Fetch playlist",      body: "We read your public playlist directly from Spotify's web page." },
                  { icon: <Sparkles   size={16} />, title: "Build taste profile", body: "We match your tracks against the graph to learn your audio preferences." },
                  { icon: <Music2     size={16} />, title: "Match in the graph",  body: "Neo4j finds 15 tracks that fit your sound — even if yours aren't in the DB." },
                ].map((s, i) => (
                  <div key={i} className="bg-[#0B1120] border border-[#1E293B] rounded-xl p-4 text-left">
                    <div className="text-[#22C55E] mb-2">{s.icon}</div>
                    <p className="text-sm font-semibold text-[#F8FAFC] mb-1">{s.title}</p>
                    <p className="text-xs text-[#64748b] leading-relaxed">{s.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Manual fallback ── */}
          {status === "needs_manual" && (
            <div className="flex flex-col items-center text-center gap-6 py-8 sm:py-14">
              <div className="w-16 h-16 rounded-2xl bg-[#F472B6]/15 flex items-center justify-center">
                <Mic2 className="text-[#F472B6]" size={28} />
              </div>
              <div className="max-w-lg">
                <h2 className="text-2xl font-bold tracking-tight mb-2">Tell us your taste</h2>
                <p className="text-[#94A3B8] text-[15px] leading-relaxed">
                  {errorMsg ?? "We couldn't read that playlist automatically. Enter some artists you like and we'll find tracks that match your vibe."}
                </p>
              </div>

              <form onSubmit={handleManualSubmit} className="w-full max-w-xl flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    ref={artistRef}
                    type="text"
                    value={artistInput}
                    onChange={(e) => setArtistInput(e.target.value)}
                    placeholder="e.g. Drake, The Weeknd, SZA, Kendrick Lamar"
                    className="flex-1 px-4 py-3 rounded-xl text-sm bg-[#0B1120] border border-[#334155] text-[#F8FAFC] placeholder-[#475569] focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
                  />
                  <button
                    type="submit"
                    disabled={!artistInput.trim()}
                    className={clsx(
                      "shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                      "bg-[#F472B6] hover:bg-[#EC4899] text-white",
                      "disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                  >
                    <ArrowRight size={16} />
                    <span className="hidden sm:inline">Find</span>
                  </button>
                </div>
                <p className="text-xs text-[#475569] text-left">Separate artists with commas. The more you add, the better the profile.</p>
              </form>

              <button
                onClick={() => { setStatus("idle"); setErrorMsg(null); }}
                className="text-xs text-[#475569] hover:text-[#94A3B8] underline underline-offset-2"
              >
                ← Try a different playlist URL
              </button>
            </div>
          )}

          {/* ── Loading ── */}
          {status === "loading" && (
            <div className="flex flex-col items-center gap-5 py-24">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-2 border-[#22C55E]/20" />
                <div className="absolute inset-0 rounded-full border-2 border-t-[#22C55E] animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-[#F8FAFC] font-medium">Analysing…</p>
                <p className="text-xs text-[#64748b] mt-1">Building taste profile · querying graph</p>
              </div>
            </div>
          )}

          {/* ── Results ── */}
          {status === "success" && result && (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  {result.playlist.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={result.playlist.imageUrl}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#1E293B] flex items-center justify-center shrink-0">
                      <Music2 size={20} className="text-[#475569]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-[#F8FAFC] truncate">{result.playlist.name}</p>
                    <p className="text-xs text-[#64748b]">
                      by {result.playlist.owner} · {result.playlist.trackCount} tracks matched
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setStatus("idle"); setResult(null); setUrl(""); setArtistInput(""); }}
                  className="shrink-0 text-xs text-[#64748b] hover:text-[#F8FAFC] px-3 py-1.5 rounded-lg border border-[#334155] hover:border-[#475569] transition-colors"
                >
                  Try another
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
                {/* Sidebar */}
                <div className="flex flex-col gap-4">
                  <div className="bg-[#0B1120] border border-[#1E293B] rounded-xl p-4">
                    <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">Results</p>
                    <div className="flex flex-col gap-1.5 mb-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#A78BFA]">Recommendations</span>
                        <span className="font-semibold text-[#F8FAFC]">{result.recommendations.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#22C55E]">Tracks matched in graph</span>
                        <span className="font-semibold text-[#F8FAFC]">{result.matchStats.directMatches}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-[#64748b] leading-relaxed mt-3">
                      <span className="mt-px shrink-0">
                        {result.matchStats.fallbackLevel === "direct" ? "✦" :
                         result.matchStats.fallbackLevel === "artist" ? "◈" : "◎"}
                      </span>
                      <span>{FALLBACK_DESCRIPTIONS[result.matchStats.fallbackLevel]}</span>
                    </div>
                    {result.matchStats.knownArtists > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-[#94A3B8]">
                        <Users size={12} className="text-[#22C55E]" />
                        {result.matchStats.knownArtists} artist{result.matchStats.knownArtists !== 1 ? "s" : ""} found in graph
                      </div>
                    )}
                  </div>

                  <div className="bg-[#0B1120] border border-[#1E293B] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Your vibe</p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <FeatureBar label="Danceability" value={result.profile.avgDanceability} color="#22C55E" />
                      <FeatureBar label="Energy"       value={result.profile.avgEnergy}       color="#FB923C" />
                      <FeatureBar label="Happiness"    value={result.profile.avgValence}      color="#F472B6" />
                      <FeatureBar label="Acousticness" value={result.profile.avgAcousticness} color="#60A5FA" />
                    </div>
                    <div className="mt-4 pt-3 border-t border-[#1E293B]">
                      <p className="text-xs text-[#64748b] mb-1">Avg tempo</p>
                      <p className="text-sm font-semibold text-[#F8FAFC]">{result.profile.avgTempo} BPM</p>
                    </div>
                    {result.profile.topGenres.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#1E293B]">
                        <p className="text-xs text-[#64748b] mb-2">Top genres</p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.profile.topGenres.map((g) => <GenrePill key={g} genre={g} />)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recommendations */}
                <div>
                  <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">
                    {result.recommendations.length} recommendations
                  </p>
                  <div className="flex flex-col gap-2">
                    {result.recommendations.map((rec, i) => (
                      <RecommendCard
                        key={rec.id}
                        rec={rec}
                        rank={i + 1}
                        isPlaying={playingId === rec.id}
                        onTogglePlay={() => setPlayingId((prev) => (prev === rec.id ? null : rec.id))}
                      />
                    ))}
                    {result.recommendations.length === 0 && (
                      <div className="text-center py-12 text-[#64748b] text-sm">
                        No recommendations found for this profile. Try a different playlist or artists.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Recommendation Card ───────────────────────────────────────────────────────

function RecommendCard({
  rec,
  rank,
  isPlaying,
  onTogglePlay,
}: {
  rec: Recommendation;
  rank: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
}) {
  const reason = MATCH_REASON_CONFIG[rec.matchReason];

  return (
    <div
      className={clsx(
        "bg-[#0B1120] border rounded-xl transition-colors overflow-hidden",
        isPlaying ? "border-[#1DB954]/40" : "border-[#1E293B] hover:border-[#334155]"
      )}
    >
      <div className="flex items-center gap-4 px-4 py-3">
        <span className="text-xs text-[#475569] w-6 text-right shrink-0 font-mono">{rank}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#F8FAFC] truncate">{rec.name}</p>
          <p className="text-xs text-[#64748b] truncate">{rec.artist}</p>
          {rec.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {rec.genres.slice(0, 3).map((g) => <GenrePill key={g} genre={g} />)}
            </div>
          )}
        </div>
        <div className="hidden sm:flex flex-col gap-1.5 w-24 shrink-0">
          <MiniBar label="Dance"  value={rec.danceability} color="#22C55E" />
          <MiniBar label="Energy" value={rec.energy}        color="#FB923C" />
          <MiniBar label="Mood"   value={rec.valence}       color="#F472B6" />
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={clsx("text-[11px] px-2 py-0.5 rounded-full font-medium", reason.color)}>
            {reason.label}
          </span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div
                    key={j}
                    className="w-1 h-2.5 rounded-sm"
                    style={{ backgroundColor: j < Math.round(rec.popularity / 20) ? "#22C55E" : "#1E293B" }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-[#475569]">{rec.popularity}</span>
            </div>
            <button
              onClick={onTogglePlay}
              className={clsx(
                "flex items-center justify-center w-6 h-6 rounded-full transition-colors shrink-0",
                isPlaying
                  ? "bg-[#1DB954]/20 text-[#1DB954] hover:bg-[#1DB954]/30"
                  : "bg-[#1E293B] text-[#64748b] hover:bg-[#334155] hover:text-[#F8FAFC]"
              )}
              aria-label={isPlaying ? "Collapse player" : "Play on Spotify"}
            >
              {isPlaying ? <ChevronUp size={12} /> : <Play size={10} />}
            </button>
          </div>
        </div>
      </div>

      {isPlaying && (
        <div className="border-t border-[#1E293B]">
          <iframe
            src={`https://open.spotify.com/embed/track/${rec.id}?utm_source=generator&theme=0`}
            width="100%"
            height="80"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            style={{ border: "none", display: "block" }}
            title={`Play ${rec.name} on Spotify`}
          />
        </div>
      )}
    </div>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-[#475569] w-8 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-[#1E293B] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: pct(value), backgroundColor: color }} />
      </div>
    </div>
  );
}
