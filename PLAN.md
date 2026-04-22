# Spotify Graph Explorer — Implementation Plan

> **Handoff doc.** This plan is intended to be executed by another model after the current conversation ends. It is self-contained: everything needed to build the app from zero to deployed is referenced from here.

## 0. Read order (before writing any code)

1. **`prompt.md`** — locked product contracts (schema, API, guardrails, acceptance examples, error codes).
2. **`design-system/spotify-graph-explorer/MASTER.md`** — visual design system (colors, typography, component specs).
3. **This file (`PLAN.md`)** — implementation roadmap, milestones, code templates.
4. **`cleaning.py`** and **`timing.py`** — reference only, confirms what the 7 CSVs mean.
5. **`Spotify Music Graph in Neo4j (1).html`** — original assignment spec; the CSVs are the "frozen" output of it.

Never edit `prompt.md` without explicit user sign-off. Update `PLAN.md` freely as tasks are ticked.

---

## 1. One-paragraph summary

Build a single-page Next.js 15 app, deployed on Vercel, that lets anyone ask a natural-language question about a pre-loaded Spotify music graph (held in Neo4j Aura Free) and get back (a) an interactive Neo4j-style graph visualization, (b) the exact read-only Cypher that Gemini generated, and (c) metadata about the execution. The maintainer's Gemini key is the default; users can paste their own when quota is exhausted; desktop users can fall back to local Ollama. Phones work out of the box. The entire stack is TypeScript.

**Success** = a phone user opens the deployed URL, taps one of the 6 suggestion chips, and sees a rendered graph with visible Cypher in under 3 seconds, without logging in or installing anything.

---

## 2. Architecture recap (see `prompt.md` for full contracts)

| Layer | Choice |
| --- | --- |
| Frontend + API | Next.js 15 (App Router) + TypeScript + Tailwind |
| Graph viz | `@neo4j-nvl/react` |
| NL → Cypher | Gemini `gemini-2.5-flash` via `@google/genai`, structured JSON output |
| Graph DB | Neo4j Aura Free, accessed via `neo4j-driver` |
| Host | Vercel (serverless API routes hold secrets) |
| Package manager | pnpm |

Flow: user → `POST /api/query` → Gemini generates Cypher → `cypherGuard` validates → `executeRead` on Aura → `shape()` turns records into `{ nodes, edges, rows }` → frontend renders.

---

## 3. Prerequisites (one-time maintainer setup — do first)

### 3.1 Neo4j Aura Free

1. Go to [`console.neo4j.io`](https://console.neo4j.io), sign in with Google.
2. **New Instance → AuraDB Free**, pick region closest to expected users (e.g. `us-east-1`).
3. **Download the credentials file immediately** — the password is shown once.
4. Wait ~60 seconds for status to go **Running**.
5. Note: free tier caps at **200k nodes / 400k relationships**. Our graph is ~166k / ~303k — fits with headroom.

Credentials needed for `.env.local`:

```
NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=<generated password>
NEO4J_DATABASE=neo4j
```

### 3.2 Google AI Studio key

1. Go to [`aistudio.google.com/app/apikey`](https://aistudio.google.com/app/apikey).
2. **Create API key** (use a new Google Cloud project labelled e.g. `spotify-graph-explorer`).
3. Copy the key.

```
GEMINI_API_KEY=<key>
```

### 3.3 Vercel

1. Sign in at [`vercel.com`](https://vercel.com) with GitHub.
2. Connect the repo when ready to deploy (after Phase 3).

---

## 4. Scaffold the project

Commands, run once from the workspace root:

```powershell
# Create the Next.js app in place (requires the dir to not already have a package.json)
pnpm create next-app@latest . --typescript --tailwind --app --eslint --import-alias "@/*" --no-src-dir

# Dependencies used at runtime
pnpm add neo4j-driver @google/genai @neo4j-nvl/react @neo4j-nvl/base zod lucide-react clsx tailwind-merge shiki csv-parse

# Dev-only
pnpm add -D vitest @vitest/ui tsx dotenv @types/node
```

Then add to `package.json`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest",
  "load-graph": "tsx scripts/load_graph.ts"
}
```

Create `.env.local.example`:

```
GEMINI_API_KEY=
NEO4J_URI=
NEO4J_USER=neo4j
NEO4J_PASSWORD=
NEO4J_DATABASE=neo4j
ALLOWED_ORIGINS=http://localhost:3000
```

Update `.gitignore`:

```
*.csv
!.gitkeep
.env.local
.vercel
design-system/**/pages/*.md
```

The 7 CSVs are large (20 MB total); they stay local. Only `MASTER.md` and `PLAN.md` are committed for design context.

---

## 5. File-by-file map

Legend: **⚡ critical** · **🧪 tested** · **🎨 design-driven**

| File | Purpose | Depends on | Approx LOC |
| --- | --- | --- | ---: |
| `.env.local.example` | Env template | — | 6 |
| `tailwind.config.ts` | 🎨 Map `MASTER.md` tokens to Tailwind | MASTER.md | 80 |
| `app/globals.css` | 🎨 Font imports, base styles | MASTER.md | 40 |
| `app/layout.tsx` | 🎨 Root, fonts, metadata | globals.css | 40 |
| `app/loading.tsx` | 🎨 Route skeleton | — | 20 |
| `app/error.tsx` | 🎨 Route error boundary | — | 25 |
| `app/page.tsx` | 🎨 Main UI composition, state reducer | all components | 180 |
| `app/api/health/route.ts` | Liveness probe | lib/neo4j | 15 |
| `app/api/query/route.ts` | ⚡ Orchestrates NL → Cypher → graph | all libs | 120 |
| `lib/neo4j.ts` | ⚡ Driver singleton + executeRead | — | 40 |
| `lib/gemini.ts` | ⚡ Gemini client + schema-aware prompt | @google/genai | 90 |
| `lib/cypherGuard.ts` | ⚡🧪 Allow/denylist validator | — | 100 |
| `lib/shape.ts` | ⚡🧪 Records → `{ nodes, edges, rows }` | neo4j-driver | 90 |
| `lib/rateLimit.ts` | In-memory token bucket | — | 40 |
| `lib/errors.ts` | Error-code enum + mappers | — | 50 |
| `components/QueryInput.tsx` | 🎨 Sticky input + submit | — | 80 |
| `components/SuggestionChips.tsx` | 🎨 6 empty-state chips | — | 50 |
| `components/GraphCanvas.tsx` | 🎨 NVL wrapper, dynamic-imported | @neo4j-nvl/react | 100 |
| `components/CypherPanel.tsx` | 🎨 Code + rationale + meta, shiki highlight | shiki | 110 |
| `components/MetaChips.tsx` | 🎨 ms/nodes/edges/truncated | — | 40 |
| `components/ByoKeyModal.tsx` | 🎨 BYO key 3-step guide | hooks/useUserKey | 120 |
| `components/Toast.tsx` | 🎨 Error/success/info toasts | — | 70 |
| `hooks/useUserKey.ts` | localStorage hook | — | 30 |
| `hooks/useIsPhone.ts` | Media-query detection | — | 25 |
| `hooks/useQuery.ts` | useReducer-based query state | lib/errors | 90 |
| `lib/ollama.ts` | Browser → localhost:11434 client | — | 70 |
| `scripts/load_graph.ts` | ⚡ One-shot CSV → Aura loader | neo4j-driver, csv-parse | 180 |
| `tests/cypherGuard.test.ts` | 🧪 Validator unit tests | vitest | 120 |
| `tests/shape.test.ts` | 🧪 Shaper unit tests | vitest | 80 |
| `tests/integration.test.ts` | 🧪 6 acceptance examples | vitest + live Aura | 120 |
| `README.md` | How to run locally + deploy | — | 100 |

Total: ~30 files, ~2300 LOC target. No single file over 200 LOC.

---

## 6. Milestones (phased delivery)

Each phase ends with a **verifiable deliverable**. Don't start the next phase until the current one works.

### Phase 1 — Data foundation

Goal: Aura has our graph; loader is idempotent.

- [ ] 1.1 Sign up for Aura, fill `.env.local`.
- [ ] 1.2 Write `scripts/load_graph.ts` (see §7.3).
- [ ] 1.3 Run `pnpm run load-graph`. Watch progress log.
- [ ] 1.4 Open Aura Browser, verify counts:
  - `MATCH (t:Track) RETURN count(t)` → **89,740**
  - `MATCH (a:Artist) RETURN count(a)` → **29,857**
  - `MATCH (al:Album) RETURN count(al)` → **46,588**
  - `MATCH (g:Genre) RETURN count(g)` → **113**
  - `MATCH ()-[r:PERFORMED_BY]->() RETURN count(r)` → **~123,423**
- [ ] 1.5 Sanity query: `MATCH (t:Track)-[:PERFORMED_BY]->(a:Artist {name:'Taylor Swift'}) RETURN count(t)` → > 0.

### Phase 2 — Backend libs + API routes

Goal: `POST /api/query` returns correct shapes for all 6 acceptance examples when called directly with `curl`.

- [ ] 2.1 `lib/neo4j.ts` — driver singleton.
- [ ] 2.2 `lib/cypherGuard.ts` + `tests/cypherGuard.test.ts` — unit tests cover every clause in both lists.
- [ ] 2.3 `lib/shape.ts` + `tests/shape.test.ts` — handles int/float coercion, applies caps.
- [ ] 2.4 `lib/gemini.ts` — schema-aware prompt, structured output (§7.1).
- [ ] 2.5 `lib/rateLimit.ts` + `lib/errors.ts`.
- [ ] 2.6 `app/api/health/route.ts`.
- [ ] 2.7 `app/api/query/route.ts` — orchestration (§7.5).
- [ ] 2.8 Run `tests/integration.test.ts` — 6 acceptance examples pass end-to-end against real Aura.

### Phase 3 — Frontend shell

Goal: Site renders per MASTER.md on mobile + desktop; query flow works end-to-end.

- [ ] 3.1 `tailwind.config.ts` — import tokens from MASTER.md (colors, fonts, spacing).
- [ ] 3.2 `app/globals.css` — font imports, body defaults, `touch-action: manipulation` on body.
- [ ] 3.3 `app/layout.tsx` — fonts loaded via `next/font/google`, viewport meta.
- [ ] 3.4 `components/QueryInput.tsx`.
- [ ] 3.5 `components/SuggestionChips.tsx` (the 6 acceptance questions).
- [ ] 3.6 `components/MetaChips.tsx`.
- [ ] 3.7 `components/CypherPanel.tsx` — use Shiki with a Cypher-like grammar (fall back to `sql`).
- [ ] 3.8 `components/GraphCanvas.tsx` — dynamic import with `{ ssr: false }`.
- [ ] 3.9 `components/Toast.tsx`.
- [ ] 3.10 `hooks/useQuery.ts` — useReducer with states `idle | thinking | validating | executing | success | error`.
- [ ] 3.11 `app/page.tsx` — composes all.
- [ ] 3.12 Manual check at 375 × 667 and 1440 × 900 — layout matches MASTER.md §6–7.

### Phase 4 — Fallback UX

- [ ] 4.1 `hooks/useUserKey.ts`.
- [ ] 4.2 `hooks/useIsPhone.ts`.
- [ ] 4.3 `components/ByoKeyModal.tsx`.
- [ ] 4.4 `lib/ollama.ts`.
- [ ] 4.5 Wire: `QUOTA_EXHAUSTED` error → open modal. `BAD_USER_KEY` error → reopen modal with inline error. Success with user key → store, keep sending in header.
- [ ] 4.6 On desktop when user clicks "Use Ollama", guide: install Ollama → `ollama pull llama3.1` → set `OLLAMA_ORIGINS`. Then client-side calls Ollama, feeds resulting Cypher to `/api/query` with an `?onlyExecute=1` hint.
- [ ] 4.7 On phone, clearly label Ollama as desktop-only.

### Phase 5 — Tests + polish + deploy

- [ ] 5.1 `tests/cypherGuard.test.ts` — every denylist clause returns `VALIDATION_BLOCKED`; every allowlist clause passes.
- [ ] 5.2 `tests/integration.test.ts` — each of the 6 acceptance examples returns non-empty results with the expected node/edge counts.
- [ ] 5.3 Run Lighthouse mobile — target ≥ 90 on Performance, Accessibility, Best Practices.
- [ ] 5.4 Axe pass — no critical accessibility violations.
- [ ] 5.5 Write `README.md` with screenshots + local run instructions.
- [ ] 5.6 Push to GitHub. Connect Vercel project.
- [ ] 5.7 Set all env vars in Vercel dashboard (Settings → Environment Variables → Production).
- [ ] 5.8 `git push` → Vercel auto-deploys → hit `/api/health` → tap all 6 chips on a real phone.

---

## 7. Code templates for the hard parts

These are **starter templates**. Adjust to match real imports and type signatures. Do not paste them verbatim without reading.

### 7.1 Gemini client (`lib/gemini.ts`)

Key patterns: single `GoogleGenAI` client, schema embedded in the system prompt, enforce JSON via `responseSchema`.

```ts
import { GoogleGenAI, Type } from "@google/genai";

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
- Always include a LIMIT (default 500) unless the user asks for an aggregation.
- When user names an artist/album/genre, match on the 'name' property exactly.
- For substring search on tracks, use toLower(t.track_name) CONTAINS '...'.
- Return projections with AS aliases when returning tabular rows.

Return JSON matching the provided schema: { cypher: string, rationale: string }.
rationale is a single plain sentence explaining what the query returns.
`.trim();

export async function generateCypher(opts: {
  question: string;
  apiKey: string;
}): Promise<{ cypher: string; rationale: string }> {
  const client = new GoogleGenAI({ apiKey: opts.apiKey });
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: opts.question }] }],
    config: {
      systemInstruction: SCHEMA_BLOCK,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          cypher: { type: Type.STRING },
          rationale: { type: Type.STRING },
        },
        required: ["cypher", "rationale"],
      },
      temperature: 0.1,
      maxOutputTokens: 800,
    },
  });
  const text = response.text;
  const parsed = JSON.parse(text);
  return { cypher: parsed.cypher, rationale: parsed.rationale };
}
```

### 7.2 Cypher guard (`lib/cypherGuard.ts`)

Tokenizer-based, not pure regex (so that `//CREATE` in a comment doesn't trigger). Strip string literals and comments first.

```ts
const DENY_CLAUSES = [
  "CREATE", "MERGE", "DELETE", "DETACH", "SET", "REMOVE", "DROP",
  "LOAD", "FOREACH",
];
const DENY_PATTERNS = [
  /\bCALL\s*\{[^}]*\}\s*IN\s+TRANSACTIONS\b/i,
  /\bapoc\.(?!meta\.schema\b)\w+/i,
  /\bdbms\.\w+/i,
  /\bdb\.index\.fulltext\.create\w*/i,
];
const ALLOW_CLAUSES = new Set([
  "MATCH","OPTIONAL","WHERE","WITH","RETURN","ORDER","BY","SKIP","LIMIT","UNWIND","AS","AND","OR","NOT","IN","DISTINCT","CALL","YIELD","STARTS","ENDS","CONTAINS","IS","NULL","COUNT","AVG","SUM","MIN","MAX","COLLECT","TOLOWER","TOUPPER","TRIM","SIZE","ASC","DESC","CASE","WHEN","THEN","ELSE","END",
]);

export type GuardResult =
  | { ok: true; cypher: string }
  | { ok: false; reason: string };

export function guardCypher(raw: string): GuardResult {
  const stripped = raw
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '""');
  for (const clause of DENY_CLAUSES) {
    if (new RegExp(`\\b${clause}\\b`, "i").test(stripped)) {
      return { ok: false, reason: `Write clause '${clause}' not allowed.` };
    }
  }
  for (const pat of DENY_PATTERNS) {
    if (pat.test(stripped)) return { ok: false, reason: `Denied pattern: ${pat}` };
  }
  let cypher = raw.trim().replace(/;\s*$/, "");
  if (!/\bLIMIT\s+\d+/i.test(cypher) && !/\b(count|avg|sum|min|max|collect)\s*\(/i.test(cypher)) {
    cypher += "\nLIMIT 500";
  }
  return { ok: true, cypher };
}
```

`tests/cypherGuard.test.ts` must assert each of `CREATE MERGE DELETE DETACH SET REMOVE DROP LOAD FOREACH` + the 4 patterns is rejected, and each allowlist clause is accepted.

### 7.3 Loader (`scripts/load_graph.ts`)

Streams each CSV, batches 5 000 rows at a time through UNWIND-parameterized MERGE. Idempotent.

```ts
import { parse } from "csv-parse";
import { createReadStream } from "fs";
import neo4j, { Session } from "neo4j-driver";
import { config } from "dotenv";

config({ path: ".env.local" });
const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, NEO4J_DATABASE = "neo4j" } = process.env;

async function* batches(path: string, size = 5000): AsyncGenerator<Record<string, string>[]> {
  const parser = createReadStream(path).pipe(parse({ columns: true, trim: true, skip_empty_lines: true }));
  let batch: Record<string, string>[] = [];
  for await (const row of parser) {
    batch.push(row);
    if (batch.length >= size) { yield batch; batch = []; }
  }
  if (batch.length) yield batch;
}

async function runBatches(session: Session, path: string, cypher: string, label: string) {
  let total = 0;
  for await (const rows of batches(path)) {
    await session.executeWrite(tx => tx.run(cypher, { rows }));
    total += rows.length;
    process.stdout.write(`\r${label}: ${total.toLocaleString()}`);
  }
  process.stdout.write("\n");
}

async function main() {
  const driver = neo4j.driver(NEO4J_URI!, neo4j.auth.basic(NEO4J_USER!, NEO4J_PASSWORD!));
  const session = driver.session({ database: NEO4J_DATABASE });
  try {
    await session.run("CREATE CONSTRAINT track_id_unique IF NOT EXISTS FOR (t:Track) REQUIRE t.track_id IS UNIQUE");
    await session.run("CREATE CONSTRAINT artist_name_unique IF NOT EXISTS FOR (a:Artist) REQUIRE a.name IS UNIQUE");
    await session.run("CREATE CONSTRAINT album_name_unique IF NOT EXISTS FOR (a:Album) REQUIRE a.name IS UNIQUE");
    await session.run("CREATE CONSTRAINT genre_name_unique IF NOT EXISTS FOR (g:Genre) REQUIRE g.name IS UNIQUE");

    await runBatches(session, "tracks.csv", `
      UNWIND $rows AS row
      MERGE (t:Track { track_id: row.track_id })
      SET t.track_name = row.track_name,
          t.popularity = toInteger(row.popularity),
          t.danceability = toFloat(row.danceability),
          t.valence = toFloat(row.valence),
          t.acousticness = toFloat(row.acousticness)
    `, "Tracks");

    await runBatches(session, "artists.csv", `
      UNWIND $rows AS row
      WITH row WHERE row.name IS NOT NULL AND trim(row.name) <> ""
      MERGE (:Artist { name: trim(row.name) })
    `, "Artists");

    await runBatches(session, "albums.csv", `
      UNWIND $rows AS row
      WITH row WHERE row.name IS NOT NULL AND trim(row.name) <> ""
      MERGE (:Album { name: trim(row.name) })
    `, "Albums");

    await runBatches(session, "genres.csv", `
      UNWIND $rows AS row
      WITH row WHERE row.name IS NOT NULL AND trim(row.name) <> ""
      MERGE (:Genre { name: trim(row.name) })
    `, "Genres");

    await runBatches(session, "rel_performed_by.csv", `
      UNWIND $rows AS row
      MATCH (t:Track { track_id: row.track_id })
      MATCH (a:Artist { name: trim(row.artist_name) })
      MERGE (t)-[:PERFORMED_BY]->(a)
    `, "PERFORMED_BY");

    await runBatches(session, "rel_belongs_to.csv", `
      UNWIND $rows AS row
      MATCH (t:Track { track_id: row.track_id })
      MATCH (al:Album { name: trim(row.album_name) })
      MERGE (t)-[:BELONGS_TO]->(al)
    `, "BELONGS_TO");

    await runBatches(session, "rel_has_genre.csv", `
      UNWIND $rows AS row
      MATCH (t:Track { track_id: row.track_id })
      MATCH (g:Genre { name: trim(row.track_genre) })
      MERGE (t)-[:HAS_GENRE]->(g)
    `, "HAS_GENRE");

    console.log("Load complete.");
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
```

Expected runtime: ~4–8 minutes on Aura Free.

### 7.4 Shape (`lib/shape.ts`)

Walks Neo4j records, extracts `Node` and `Relationship` values, dedupes by internal id.

```ts
import type { Record as NeoRecord, Integer, Node, Relationship } from "neo4j-driver";

export const CAPS = { rows: 500, nodes: 300, edges: 800 };

type ShapedNode = { id: string; label: string; properties: Record<string, unknown> };
type ShapedEdge = { id: string; source: string; target: string; type: string };

const toInt = (v: unknown) => (typeof v === "object" && v && "toNumber" in (v as Integer) ? (v as Integer).toNumber() : v);

function prop(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map(prop);
  if (typeof v === "object" && "toNumber" in (v as Integer)) return (v as Integer).toNumber();
  return v;
}

export function shape(records: NeoRecord[]) {
  const nodes = new Map<string, ShapedNode>();
  const edges = new Map<string, ShapedEdge>();
  const rows: Record<string, unknown>[] = [];
  let truncated = false;

  const visit = (val: unknown): unknown => {
    if (val === null || val === undefined) return null;
    if (Array.isArray(val)) return val.map(visit);
    if (typeof val === "object") {
      const o = val as Node | Relationship | Record<string, unknown>;
      if ("labels" in o && "identity" in o && "properties" in o) {
        const n = o as Node;
        const id = `n_${toInt(n.identity)}`;
        if (!nodes.has(id) && nodes.size < CAPS.nodes) {
          nodes.set(id, { id, label: n.labels[0], properties: Object.fromEntries(Object.entries(n.properties).map(([k, v]) => [k, prop(v)])) });
        } else if (!nodes.has(id)) truncated = true;
        return { __node: id };
      }
      if ("start" in o && "end" in o && "type" in o && "identity" in o) {
        const r = o as Relationship;
        const id = `e_${toInt(r.identity)}`;
        if (!edges.has(id) && edges.size < CAPS.edges) {
          edges.set(id, { id, source: `n_${toInt(r.start)}`, target: `n_${toInt(r.end)}`, type: r.type });
        } else if (!edges.has(id)) truncated = true;
        return { __edge: id };
      }
      return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, visit(v)]));
    }
    return prop(val);
  };

  for (const rec of records.slice(0, CAPS.rows)) {
    const obj: Record<string, unknown> = {};
    for (const key of rec.keys) obj[String(key)] = visit(rec.get(key));
    rows.push(obj);
  }
  if (records.length > CAPS.rows) truncated = true;

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    rows,
    meta: { nodeCount: nodes.size, edgeCount: edges.size, rowCount: rows.length, truncated },
  };
}
```

### 7.5 Query route (`app/api/query/route.ts`)

Ties everything together. Header-driven key; timeout wrapped around `tx.run`; structured errors.

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateCypher } from "@/lib/gemini";
import { guardCypher } from "@/lib/cypherGuard";
import { getDriver } from "@/lib/neo4j";
import { shape } from "@/lib/shape";
import { errorResponse, ErrorCode } from "@/lib/errors";
import { checkRate } from "@/lib/rateLimit";

const BodySchema = z.object({ question: z.string().min(1).max(400) });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (!checkRate(ip)) return errorResponse(ErrorCode.RATE_LIMITED);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return errorResponse(ErrorCode.GENERATION_FAILED, "Invalid request body.");

  const apiKey = req.headers.get("x-user-gemini-key") || process.env.GEMINI_API_KEY!;
  if (!apiKey) return errorResponse(ErrorCode.QUOTA_EXHAUSTED);

  let cypher: string, rationale: string;
  try {
    const out = await generateCypher({ question: parsed.data.question, apiKey });
    cypher = out.cypher;
    rationale = out.rationale;
  } catch (e: any) {
    const code = String(e?.message).match(/429|quota/i) ? ErrorCode.QUOTA_EXHAUSTED
               : String(e?.message).match(/401|api key/i)  ? ErrorCode.BAD_USER_KEY
               : ErrorCode.GENERATION_FAILED;
    return errorResponse(code, e?.message);
  }

  const guard = guardCypher(cypher);
  if (!guard.ok) return errorResponse(ErrorCode.VALIDATION_BLOCKED, guard.reason);

  const start = performance.now();
  try {
    const session = getDriver().session({ database: process.env.NEO4J_DATABASE || "neo4j" });
    try {
      const result = await session.executeRead(tx => tx.run(guard.cypher, {}, { timeout: 10_000 }));
      const shaped = shape(result.records);
      const ms = Math.round(performance.now() - start);
      return NextResponse.json({ cypher: guard.cypher, rationale, ...shaped, meta: { ...shaped.meta, ms } });
    } finally {
      await session.close();
    }
  } catch (e: any) {
    const code = String(e?.code).includes("Timeout") ? ErrorCode.EXECUTION_TIMEOUT : ErrorCode.EXECUTION_FAILED;
    return errorResponse(code, e?.message);
  }
}
```

### 7.6 Page composition (`app/page.tsx`)

State shape:

```ts
type State =
  | { status: "idle" }
  | { status: "thinking", question: string }
  | { status: "success", question: string, cypher: string, rationale: string, nodes, edges, rows, meta }
  | { status: "error", question: string, code: ErrorCode, message: string };
```

Event flow:

- Chip tap / input submit → `{ status: "thinking", question }` → `POST /api/query` → `success` or `error`.
- On `QUOTA_EXHAUSTED` → open ByoKeyModal; on modal submit, retry with key in localStorage + header.
- On `BAD_USER_KEY` → reopen modal with inline error.
- On success, render Graph + Cypher panel + meta chips.

Include `<html lang="en">`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`, and `<body class="overscroll-contain touch-manipulation">`.

### 7.7 Tailwind tokens (`tailwind.config.ts` excerpt)

```ts
theme: {
  extend: {
    colors: {
      bg: "#0F172A",
      surface: { 1: "#1E293B", 2: "#334155" },
      border: "#475569",
      brand: { DEFAULT: "#22C55E", hover: "#16A34A" },
      node: { track: "#22C55E", artist: "#A78BFA", album: "#FB923C", genre: "#F472B6" },
    },
    fontFamily: {
      sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
      mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
    },
    boxShadow: {
      "glow-accent": "0 0 20px rgba(34, 197, 94, 0.25)",
    },
    animation: {
      "pulse-soft": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
    },
  },
},
```

---

## 8. Testing strategy

### 8.1 Unit (`vitest`)

- `cypherGuard.test.ts`:
  - ✅ Accept each allowlist clause wrapped in `MATCH (n) RETURN n`.
  - ❌ Reject each denylist clause.
  - Handle `// comment` and `/* comment */` — a write keyword inside a comment is allowed.
  - String literals containing `DELETE` are allowed.
  - Auto-appends `LIMIT 500` to non-aggregation queries without existing LIMIT.
- `shape.test.ts`:
  - Given a fake `Record` with a Node and a Relationship, produces 1 node + 1 edge + 1 row.
  - Caps kick in at 300 nodes / 800 edges / 500 rows and set `truncated=true`.
  - Neo4j `Integer` values are coerced to JS numbers.

### 8.2 Integration (`tests/integration.test.ts`)

Runs against a live Aura instance loaded via Phase 1. For each of the 6 acceptance examples:

1. Call `POST /api/query` with the suggestion-chip text.
2. Assert response has `cypher` that validates under `guardCypher`.
3. Assert `rows.length > 0` and expected node labels appear.
4. Assert `meta.ms < 5000`.

Skip in CI if `NEO4J_URI` env var is not set (so PRs from forks don't fail).

### 8.3 Manual QA before deploy

At 375 × 667 (iPhone SE), 768 × 1024 (iPad), 1440 × 900 (laptop):

- Input reachable, chips fit, graph scrollable.
- Cypher panel: bottom sheet on phone, sidebar on desktop.
- Touch targets measured ≥ 44 px.
- Tab order: input → submit → chips → cypher copy → graph.
- DevTools Lighthouse mobile: Perf ≥ 90, A11y ≥ 95, Best Practices ≥ 95.
- Axe DevTools: 0 critical violations.
- `prefers-reduced-motion: reduce` → graph physics off.
- Force quota error (set `GEMINI_API_KEY` to `invalid`) → BYO modal opens.
- Paste a working user key → query succeeds.

---

## 9. Deployment

### 9.1 Vercel

1. Push to GitHub (public or private).
2. Vercel dashboard → **Add New → Project** → select repo.
3. Framework preset: Next.js (auto).
4. **Environment Variables** (Settings → Environment Variables → Production):
   - `GEMINI_API_KEY`
   - `NEO4J_URI`
   - `NEO4J_USER`
   - `NEO4J_PASSWORD`
   - `NEO4J_DATABASE` = `neo4j`
   - `ALLOWED_ORIGINS` = `https://<your-project>.vercel.app`
5. **Deploy**. First build ~2 minutes.

### 9.2 Smoke test on production URL

- `GET /api/health` → `{ "ok": true }`
- Tap each of the 6 chips on an actual phone (not DevTools simulation).
- All 6 return a rendered graph + visible Cypher in under 3 s.
- Verify `Content-Security-Policy` response header blocks inline scripts.

### 9.3 Ongoing

- Free Aura pauses after 3 days of inactivity. Set a weekly cron (GitHub Action) to hit `/api/health` to keep it warm.
- Monitor Gemini quota at `aistudio.google.com` — free tier is 1,500 RPM / 1M tokens per day for `gemini-2.5-flash` as of 2026.

---

## 10. Handoff notes (for the next model to read first)

### 10.1 Current state of the repo (as of this PLAN.md)

- `prompt.md`, `PLAN.md`, `design-system/spotify-graph-explorer/MASTER.md` are committed and frozen.
- `cleaning.py`, `timing.py`, and the **7 CSVs** exist at repo root (they are the data source of truth, not committed to git).
- `.cursor/skills/ui-ux-pro-max/` is installed and accessible via `py .cursor\skills\ui-ux-pro-max\scripts\search.py`. Use it to pull more design guidance if needed.
- No Next.js project has been scaffolded yet. Start at §4.

### 10.2 Priority order if constrained on time

Minimum viable path (~1 day for a fast model):

1. Phase 1 (data) — without data nothing works.
2. `lib/neo4j.ts` + `lib/cypherGuard.ts` + `lib/gemini.ts` + `lib/shape.ts` + `app/api/query/route.ts`.
3. The three biggest components: `QueryInput`, `GraphCanvas`, `CypherPanel`.
4. `app/page.tsx` with a single text input and a graph below. Skip fancy polish until end-to-end works.
5. Deploy to Vercel.
6. Come back for BYO key modal, Ollama, animations, Lighthouse tuning.

### 10.3 Common gotchas

- **NVL is client-only.** `import dynamic from "next/dynamic"` + `{ ssr: false }`. Otherwise Vercel build fails.
- **Neo4j `Integer` is not a JS number.** Always coerce via `.toNumber()` or check `neo4j.isInt()`. Silent breakage otherwise.
- **Aura uses `neo4j+s://` not `bolt://`.** TLS is mandatory.
- **Gemini structured output**: use `responseMimeType` + `responseSchema`. Prompt-only JSON requests will break.
- **`cypherGuard` must strip strings and comments first.** Otherwise a user question like *"search for 'DELETE' in titles"* will be rejected.
- **`app/api/*` routes can't use `'use client'`.** Keep components in `components/` as `"use client"` only when they need state/effects.
- **CSV size**: tracks.csv is 10 MB. Don't commit. Already covered by `.gitignore`.
- **Free Aura auto-pauses.** First query after pause takes 30+ s; UI should show a "warming up" hint after 5 s.
- **Windows PowerShell** doesn't keep `$env:Path` changes across Shell-tool calls. Prefix with `$env:Path = "$env:APPDATA\npm;$env:Path"` when invoking globally-installed binaries like `uipro` or `tsx` if they're not auto-resolved.

### 10.4 Done definition

- All 5 phase checklists ticked.
- Production URL returns 200 on `/api/health`.
- All 6 suggestion chips return a rendered graph + visible Cypher in under 3 s on a mid-tier phone.
- `pnpm test` passes.
- `prompt.md` and `MASTER.md` untouched.

---

## 11. Useful references

- Next.js App Router: https://nextjs.org/docs/app
- Neo4j JS driver: https://neo4j.com/docs/javascript-manual/current/
- Neo4j NVL React: https://neo4j.com/docs/nvl/current/
- Google GenAI SDK (TS): https://googleapis.github.io/js-genai/release_docs/
- Tailwind CSS: https://tailwindcss.com/docs
- shiki (syntax highlight): https://shiki.style/
- Cypher reference: https://neo4j.com/docs/cypher-manual/current/
- Vercel env vars: https://vercel.com/docs/projects/environment-variables

---

This plan is model-agnostic. Any capable coding agent should reproduce the same app by following it in order.
