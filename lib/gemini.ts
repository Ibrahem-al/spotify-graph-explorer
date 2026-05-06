import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

export type Provider = "groq" | "openai" | "gemini";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

const SCHEMA_BLOCK = `
You are a Cypher query generator for a read-only Spotify graph in Neo4j.

GRAPH SCHEMA (use only these labels, properties, and relationships):

Nodes:
- (:Track { track_id: STRING, track_name: STRING, popularity: INTEGER,
            danceability: FLOAT, valence: FLOAT, acousticness: FLOAT })
- (:Artist { name: STRING })
- (:Album  { name: STRING })
- (:Genre  { name: STRING })

Relationships:
- (:Track)-[:PERFORMED_BY]->(:Artist)
- (:Track)-[:BELONGS_TO]->(:Album)
- (:Track)-[:HAS_GENRE]->(:Genre)

HARD RULES:
- Read-only Cypher ONLY. Never use CREATE, MERGE, SET, DELETE, REMOVE, DROP,
  DETACH, LOAD CSV, FOREACH, CALL { ... } IN TRANSACTIONS, or apoc.* writes.
- Do NOT invent labels, properties, or relationships. The lists above are exhaustive.
- Artist, Album, and Genre nodes have ONLY the 'name' property. No id, releaseYear, etc.
- Track's genre, album, and artists are only reachable through relationships.
- Always include a LIMIT (default 500) unless the user asks for an aggregation.
- When user names an artist/album/genre, match on the 'name' property exactly.
- For substring search on tracks, use toLower(t.track_name) CONTAINS '...'.
- popularity is 0-100 integer; danceability/valence/acousticness are 0.0-1.0 floats.

GRAPH VISUALIZATION RULES (CRITICAL — obey exactly):

1. NON-AGGREGATE QUERIES (list / show / find / get) MUST return graph variables,
   never scalar projections. Include the relationship + endpoint whenever the
   question mentions an artist/album/genre so the graph has edges.

   Examples:
     Q: "Show 20 tracks with popularity over 85"
     A: MATCH (t:Track) WHERE t.popularity > 85 RETURN t ORDER BY t.popularity DESC LIMIT 20

     Q: "List tracks by Taylor Swift"
     A: MATCH (t:Track)-[r:PERFORMED_BY]->(a:Artist {name: 'Taylor Swift'})
        RETURN t, r, a LIMIT 200

     Q: "Find tracks in the rock genre"
     A: MATCH (t:Track)-[r:HAS_GENRE]->(g:Genre {name: 'rock'})
        RETURN t, r, g LIMIT 200

     Q: "Show upbeat danceable tracks"
     A: MATCH (t:Track) WHERE t.danceability > 0.7 AND t.valence > 0.7
        AND t.popularity > 60 RETURN t ORDER BY t.popularity DESC LIMIT 50

     Q: "Find tracks with 'love' in the title"
     A: MATCH (t:Track) WHERE toLower(t.track_name) CONTAINS 'love'
        RETURN t ORDER BY t.popularity DESC LIMIT 50

   NEVER do this for non-aggregate queries:
     BAD: RETURN t.track_name AS name, t.popularity AS p
     BAD: RETURN t.track_name, a.name

2. AGGREGATE QUERIES (count / avg / sum / min / max / "how many" / "top N by count")
   MUST return scalars with AS aliases because a graph cannot show aggregates.

   Examples:
     Q: "Average popularity by genre"
     A: MATCH (t:Track)-[:HAS_GENRE]->(g:Genre)
        RETURN g.name AS genre, avg(t.popularity) AS avg_popularity
        ORDER BY avg_popularity DESC LIMIT 20

     Q: "Top 10 genres by track count"
     A: MATCH (t:Track)-[:HAS_GENRE]->(g:Genre)
        RETURN g.name AS genre, count(t) AS track_count
        ORDER BY track_count DESC LIMIT 10

     Q: "How many tracks does Taylor Swift have?"
     A: MATCH (t:Track)-[:PERFORMED_BY]->(a:Artist {name: 'Taylor Swift'})
        RETURN count(t) AS track_count

3. Decision flow: if the question contains "avg", "average", "count", "how many",
   "top N by count/avg/sum", or "per X" → use rule 2. Otherwise use rule 1.

Respond with ONLY a JSON object in this exact shape, no markdown, no explanation:
{ "cypher": "...", "rationale": "..." }

rationale is a single plain sentence explaining what the query returns.
`.trim();

export async function generateCypher(opts: {
  question: string;
  apiKey: string;
}): Promise<{ cypher: string; rationale: string }> {
  const client = new OpenAI({
    apiKey: opts.apiKey,
    baseURL: GROQ_BASE_URL,
  });

  const response = await client.chat.completions.create({
    model: process.env.GROQ_MODEL ?? DEFAULT_MODEL,
    messages: [
      { role: "system", content: SCHEMA_BLOCK },
      { role: "user", content: opts.question },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 800,
  });

  const text = response.choices[0]?.message?.content ?? "";

  let parsed: { cypher: string; rationale: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`LLM returned non-JSON output: ${text.slice(0, 200)}`);
  }

  if (!parsed.cypher || !parsed.rationale) {
    throw new Error("LLM response missing cypher or rationale fields.");
  }

  return { cypher: parsed.cypher, rationale: parsed.rationale };
}

async function generateCypherOpenAI(opts: {
  question: string;
  apiKey: string;
}): Promise<{ cypher: string; rationale: string }> {
  const client = new OpenAI({ apiKey: opts.apiKey });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SCHEMA_BLOCK },
      { role: "user", content: opts.question },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 800,
  });

  const text = response.choices[0]?.message?.content ?? "";
  let parsed: { cypher: string; rationale: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`OpenAI returned non-JSON output: ${text.slice(0, 200)}`);
  }
  if (!parsed.cypher || !parsed.rationale) {
    throw new Error("OpenAI response missing cypher or rationale fields.");
  }
  return { cypher: parsed.cypher, rationale: parsed.rationale };
}

async function generateCypherGemini(opts: {
  question: string;
  apiKey: string;
}): Promise<{ cypher: string; rationale: string }> {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    config: {
      systemInstruction: SCHEMA_BLOCK,
      responseMimeType: "application/json",
    },
    contents: opts.question,
  });

  const text = response.text ?? "";
  let parsed: { cypher: string; rationale: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned non-JSON output: ${text.slice(0, 200)}`);
  }
  if (!parsed.cypher || !parsed.rationale) {
    throw new Error("Gemini response missing cypher or rationale fields.");
  }
  return { cypher: parsed.cypher, rationale: parsed.rationale };
}

// ── Music taste analysis ──────────────────────────────────────────────────────

const TASTE_SYSTEM = `
You are a music taste analyzer for a Spotify recommendation engine backed by a Neo4j graph.
Given any natural language description of music preferences, moods, activities, or feelings,
extract structured music data.

Audio features are all on a 0.0–1.0 scale:
- danceability: 0=not danceable, 1=very danceable
- energy: 0=calm/quiet, 1=loud/intense
- valence: 0=sad/dark/angry, 1=happy/cheerful/euphoric
- acousticness: 0=fully electronic, 1=fully acoustic
- tempo: BPM integer (typical range 60–200)

Respond ONLY with a valid JSON object — no markdown, no explanation:
{
  "artists": ["up to 10 real well-known artist names whose style fits best"],
  "genres": ["up to 8 lowercase genre tags"],
  "danceability": <float 0.0–1.0>,
  "energy": <float 0.0–1.0>,
  "valence": <float 0.0–1.0>,
  "acousticness": <float 0.0–1.0>,
  "tempo": <integer BPM>,
  "playlistName": "<short evocative name for this vibe, 2–5 words>"
}
`.trim();

export interface MusicTasteProfile {
  artists: string[];
  genres: string[];
  danceability: number;
  energy: number;
  valence: number;
  acousticness: number;
  tempo: number;
  playlistName: string;
}

export async function analyzeMusicTaste(description: string): Promise<MusicTasteProfile> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_NOT_CONFIGURED");

  const client = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });
  const response = await client.chat.completions.create({
    model: process.env.GROQ_MODEL ?? DEFAULT_MODEL,
    messages: [
      { role: "system", content: TASTE_SYSTEM },
      { role: "user",   content: description },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 400,
  });

  const text = response.choices[0]?.message?.content ?? "";
  let parsed: MusicTasteProfile;
  try {
    parsed = JSON.parse(text) as MusicTasteProfile;
  } catch {
    throw new Error(`Groq returned non-JSON: ${text.slice(0, 200)}`);
  }

  // Clamp floats to valid range
  const clamp = (n: unknown, lo = 0, hi = 1) =>
    Math.min(hi, Math.max(lo, typeof n === "number" ? n : 0.5));
  return {
    artists:      Array.isArray(parsed.artists)  ? parsed.artists.filter(a => typeof a === "string")  : [],
    genres:       Array.isArray(parsed.genres)   ? parsed.genres.filter(g => typeof g === "string")   : [],
    danceability: clamp(parsed.danceability),
    energy:       clamp(parsed.energy),
    valence:      clamp(parsed.valence),
    acousticness: clamp(parsed.acousticness),
    tempo:        clamp(parsed.tempo, 40, 250),
    playlistName: typeof parsed.playlistName === "string" ? parsed.playlistName : "My Mix",
  };
}

export async function generateCypherWithProvider(opts: {
  question: string;
  apiKey: string;
  provider: Provider;
}): Promise<{ cypher: string; rationale: string }> {
  switch (opts.provider) {
    case "openai":
      return generateCypherOpenAI({ question: opts.question, apiKey: opts.apiKey });
    case "gemini":
      return generateCypherGemini({ question: opts.question, apiKey: opts.apiKey });
    case "groq":
    default:
      return generateCypher({ question: opts.question, apiKey: opts.apiKey });
  }
}
