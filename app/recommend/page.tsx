"use client";

import { useState, useCallback, useRef } from "react";
import { Music2, Sparkles, ArrowRight, ListMusic, Users, Wand2, Play, ChevronUp, Mic2, MessageSquare, Link2 } from "lucide-react";
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
  aiArtists?: string[];
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
  const [inputMode, setInputMode]     = useState<"url" | "artists" | "describe">("url");
  const [url, setUrl]                 = useState("");
  const [artistInput, setArtistInput] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus]           = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult]           = useState<RecommendResult | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [playingId, setPlayingId]     = useState<string | null>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const artistRef = useRef<HTMLInputElement>(null);

  const switchTab = (mode: "url" | "artists" | "describe") => {
    setInputMode(mode);
    setErrorMsg(null);
    if (status === "error") setStatus("idle");
  };

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
        // URL scraping failed — switch to artists tab with a hint
        if (data?.error === "NEEDS_MANUAL_INPUT") {
          setErrorMsg(data.message ?? null);
          setInputMode("artists");
          setStatus("error");
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

  const handleArtistSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const artists = artistInput.split(",").map(s => s.trim()).filter(Boolean);
    if (artists.length === 0) return;
    submit({ artists });
  }, [artistInput, submit]);

  const handleDescribeSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = description.trim();
    if (!trimmed) return;
    submit({ description: trimmed });
  }, [description, submit]);

  const resetToIdle = () => {
    setStatus("idle"); setResult(null); setUrl(""); setArtistInput(""); setDescription(""); setErrorMsg(null);
  };

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

          {/* ── Input form (idle / error) ── */}
          {(status === "idle" || status === "error") && (
            <div className="flex flex-col items-center text-center gap-6 py-8 sm:py-14">
              <div className="w-16 h-16 rounded-2xl bg-[#22C55E]/15 flex items-center justify-center">
                <Wand2 className="text-[#22C55E]" size={28} />
              </div>
              <div className="max-w-lg">
                <h2 className="text-2xl font-bold tracking-tight mb-2">Playlist recommender</h2>
                <p className="text-[#94A3B8] text-[15px] leading-relaxed">
                  Three ways to get recommendations — pick whichever suits you.
                </p>
              </div>

              {/* ── Three tabs ── */}
              <div className="flex gap-1 p-1 bg-[#0B1120] border border-[#1E293B] rounded-xl w-full max-w-xl">
                {([
                  { mode: "url",      label: "Spotify URL",        icon: <Link2         size={13} />, active: "bg-[#22C55E]/15 text-[#22C55E]" },
                  { mode: "artists",  label: "Enter artists",      icon: <Mic2          size={13} />, active: "bg-[#F472B6]/15 text-[#F472B6]" },
                  { mode: "describe", label: "Describe your taste", icon: <MessageSquare size={13} />, active: "bg-[#A78BFA]/15 text-[#A78BFA]" },
                ] as const).map(t => (
                  <button
                    key={t.mode}
                    onClick={() => switchTab(t.mode)}
                    className={clsx(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors",
                      inputMode === t.mode ? t.active : "text-[#64748b] hover:text-[#94A3B8]"
                    )}
                  >
                    {t.icon}
                    <span className="hidden sm:inline">{t.label}</span>
                    <span className="sm:hidden">{t.label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>

              {/* ── URL tab ── */}
              {inputMode === "url" && (
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
                    <button type="submit" disabled={!url.trim()}
                      className="shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-[#22C55E] hover:bg-[#16A34A] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ArrowRight size={16} /><span className="hidden sm:inline">Analyse</span>
                    </button>
                  </div>
                  {status === "error" && errorMsg && (
                    <p className="text-sm text-red-400 text-left">{errorMsg}</p>
                  )}
                </form>
              )}

              {/* ── Artists tab ── */}
              {inputMode === "artists" && (
                <form onSubmit={handleArtistSubmit} className="w-full max-w-xl flex flex-col gap-3">
                  {status === "error" && errorMsg && (
                    <p className="text-sm text-amber-400 text-left bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">{errorMsg}</p>
                  )}
                  <div className="flex gap-2">
                    <input
                      ref={artistRef}
                      type="text"
                      value={artistInput}
                      onChange={(e) => setArtistInput(e.target.value)}
                      placeholder="e.g. Drake, The Weeknd, SZA, Kendrick Lamar"
                      className="flex-1 px-4 py-3 rounded-xl text-sm bg-[#0B1120] border border-[#334155] text-[#F8FAFC] placeholder-[#475569] focus:outline-none focus:ring-2 focus:ring-[#F472B6]"
                    />
                    <button type="submit" disabled={!artistInput.trim()}
                      className="shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-[#F472B6] hover:bg-[#EC4899] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ArrowRight size={16} /><span className="hidden sm:inline">Find</span>
                    </button>
                  </div>
                  <p className="text-xs text-[#475569] text-left">Separate artists with commas. The more you add, the better the profile.</p>
                </form>
              )}

              {/* ── Describe tab ── */}
              {inputMode === "describe" && (
                <form onSubmit={handleDescribeSubmit} className="w-full max-w-xl flex flex-col gap-3">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder={"Describe the vibe you're after — e.g.\n\"Late night driving, melancholic but not too slow, like The Weeknd\"\n\"Happy summer energy, danceable, feel-good pop\"\n\"Dark hip-hop with heavy bass and introspective lyrics\""}
                    className={clsx(
                      "w-full px-4 py-3 rounded-xl text-sm bg-[#0B1120] border text-[#F8FAFC] placeholder-[#475569] resize-none",
                      "focus:outline-none focus:ring-2 focus:ring-[#A78BFA]",
                      status === "error" ? "border-red-500/60" : "border-[#334155]"
                    )}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#475569]">{description.length}/1000</span>
                    <button type="submit" disabled={!description.trim()}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#A78BFA] hover:bg-[#9061f9] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <Sparkles size={14} />Generate playlist
                    </button>
                  </div>
                  {status === "error" && errorMsg && (
                    <p className="text-sm text-red-400">{errorMsg}</p>
                  )}
                </form>
              )}

              {/* How it works cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl mt-2">
                {(inputMode === "url" ? [
                  { icon: <ListMusic size={16} />,     color: "#22C55E", title: "Fetch playlist",       body: "We read your public playlist directly from Spotify's web page." },
                  { icon: <Sparkles  size={16} />,     color: "#22C55E", title: "Build taste profile",  body: "We match your tracks against the graph to learn your audio preferences." },
                  { icon: <Music2    size={16} />,     color: "#22C55E", title: "Match in the graph",   body: "Neo4j finds 15 tracks that fit your sound." },
                ] : inputMode === "artists" ? [
                  { icon: <Mic2     size={16} />,      color: "#F472B6", title: "Name your artists",    body: "Enter a few artists you already love, separated by commas." },
                  { icon: <Sparkles size={16} />,      color: "#F472B6", title: "Build audio profile",  body: "We find those artists in the graph and average their audio features." },
                  { icon: <Music2   size={16} />,      color: "#F472B6", title: "Match in the graph",   body: "Neo4j finds 15 tracks with a similar sound." },
                ] : [
                  { icon: <MessageSquare size={16} />, color: "#A78BFA", title: "Describe freely",      body: "Tell Groq your mood, activity, or artists you like — plain English." },
                  { icon: <Sparkles      size={16} />, color: "#A78BFA", title: "AI decodes your vibe", body: "Groq extracts artists, genres, and audio features from your words." },
                  { icon: <Music2        size={16} />, color: "#A78BFA", title: "Graph builds the mix", body: "Neo4j finds 15 tracks that match the decoded profile." },
                ]).map((s, i) => (
                  <div key={i} className="bg-[#0B1120] border border-[#1E293B] rounded-xl p-4 text-left">
                    <div className="mb-2" style={{ color: s.color }}>{s.icon}</div>
                    <p className="text-sm font-semibold text-[#F8FAFC] mb-1">{s.title}</p>
                    <p className="text-xs text-[#64748b] leading-relaxed">{s.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Loading ── */}
          {status === "loading" && (
            <div className="flex flex-col items-center gap-5 py-24">
              <div className="relative w-14 h-14">
                <div className={clsx("absolute inset-0 rounded-full border-2",
                  inputMode === "describe" ? "border-[#A78BFA]/20"
                  : inputMode === "artists" ? "border-[#F472B6]/20"
                  : "border-[#22C55E]/20")} />
                <div className={clsx("absolute inset-0 rounded-full border-2 border-t-transparent animate-spin",
                  inputMode === "describe" ? "border-t-[#A78BFA]"
                  : inputMode === "artists" ? "border-t-[#F472B6]"
                  : "border-t-[#22C55E]")} />
              </div>
              <div className="text-center">
                <p className="text-[#F8FAFC] font-medium">
                  {inputMode === "describe" ? "Asking Groq…" : "Analysing…"}
                </p>
                <p className="text-xs text-[#64748b] mt-1">
                  {inputMode === "describe"
                    ? "Decoding your vibe · finding matching tracks in the graph"
                    : "Building taste profile · querying graph"}
                </p>
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
                  onClick={resetToIdle}
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
                    {result.aiArtists && result.aiArtists.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#1E293B]">
                        <p className="text-xs text-[#64748b] mb-2">Artists Groq identified</p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.aiArtists.map(a => (
                            <span key={a} className="px-2 py-0.5 rounded-full text-[11px] bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/20">
                              {a}
                            </span>
                          ))}
                        </div>
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
