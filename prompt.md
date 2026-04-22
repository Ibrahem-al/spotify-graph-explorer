# Product brief: natural-language Spotify graph explorer

## North star

A polished, mobile-friendly web app where anyone can type a natural-language question about a Spotify music graph, and instantly get:

- an interactive Neo4j-style graph visualization,
- the exact Cypher query that produced the graph,
- and confidence that results came from real graph execution, not hallucinated structure.

A phone user opens the site and starts querying. No install. No setup. No backend service to babysit.

## Product direction (locked)

- **Audience reality**: many users are phone-only; app must work with nothing but a browser.
- **Architecture**: single Next.js app on Vercel. Serverless API routes hold all secrets and proxy Gemini + Neo4j. No separate Python service.
- **Model provider**: Google AI Studio (Gemini API) by default, with BYO-key fallback and desktop-only Ollama fallback.
- **Safety posture**: read-only graph exploration (even though the original assignment included one write task — see "Source dataset" below).
- **Data scope**: the exact Spotify music graph the maintainer already produced for an assignment — same labels, property names, and relationships — loaded once into Neo4j Aura.

## Source dataset (the graph the user queries)

The graph the site exposes is the exact graph the maintainer built for a prior assignment from the Kaggle Spotify tracks dataset. Cleaning was done in Python (`cleaning.py`) and produced these seven CSV files at the repo root:

```
tracks.csv              # track_id, track_name, popularity, danceability, valence, acousticness, album_name, track_genre, artists
artists.csv             # name
albums.csv              # name
genres.csv              # name
rel_performed_by.csv    # track_id, artist_name
rel_belongs_to.csv      # track_id, album_name
rel_has_genre.csv       # track_id, track_genre
```

Approximate counts after cleaning: **~89,740 tracks · ~29,857 artists · ~46,588 albums · 113 genres · ~123,423 PERFORMED_BY · ~89,740 BELONGS_TO · ~89,740 HAS_GENRE** (one genre per track by design).

Simplifications inherited from the assignment and not to be "fixed":

- Albums are identified by name only; two real albums with the same name merge into one `:Album` node.
- Each track keeps exactly one genre (one row per `track_id` was retained during cleaning).
- `energy` and `tempo` are present in cleaning but are **not** loaded as Track properties.
- Assignment Task 5 (rename `Jason Mraz` → `Jason M.`) is a write. The public website is read-only and will not expose it; it can only be run through the existing `timing.py` locally.

## Locked architecture

| Layer | Choice | Reason |
| --- | --- | --- |
| Frontend + serverless API | Next.js 15 (App Router), TypeScript | Single repo, single deploy, API routes hide secrets |
| Styling | Tailwind CSS | Mobile-first, fast |
| Graph visualization | `@neo4j-nvl/react` (Neo4j Visualization Library) | Native Neo4j look, touch-aware |
| NL → Cypher | Gemini `gemini-2.5-flash` via `@google/genai` | Fast enough for phone latency, cheap |
| Graph database | Neo4j Aura Free | Managed, free tier, real Cypher, no install for end users |
| Host | Vercel (frontend + API routes) | Free, zero-ops |
| Neo4j driver | `neo4j-driver` (JS) | Official, speaks Bolt over TLS |
| Package manager | pnpm | |

Python is not used by the runtime. The existing Python cleaning script (`cleaning.py`) is treated as a one-time authoring step whose artifacts (the 7 CSVs) are the source of truth.

## Why this architecture is required

- Phones cannot run Docker, a JVM, Python, Ollama, or embedded Neo4j. Any "on-device database" path excludes phone users.
- A pure static frontend cannot hide the maintainer's Gemini key — anyone opening DevTools would drain the quota.
- Therefore a minimal server-side hop is mandatory. Next.js API routes on Vercel give that hop without a separate service: same repo, same deploy, free.

"No server at all" is incompatible with "phone-first, hidden default key, real Neo4j queries." Next.js API routes honor the spirit of no-backend (zero ops, one deploy) while satisfying the other constraints.

## Locked graph schema (embedded in the Gemini prompt verbatim)

Node labels and properties (and **only** these):

- `(:Track { track_id: STRING, track_name: STRING, popularity: INTEGER, danceability: FLOAT, valence: FLOAT, acousticness: FLOAT })`
- `(:Artist { name: STRING })`
- `(:Album { name: STRING })`
- `(:Genre { name: STRING })`

Relationships (directed, and **only** these):

- `(:Track)-[:PERFORMED_BY]->(:Artist)`
- `(:Track)-[:BELONGS_TO]->(:Album)`
- `(:Track)-[:HAS_GENRE]->(:Genre)`

Constraints (enforced at load):

```cypher
CREATE CONSTRAINT track_id_unique  IF NOT EXISTS FOR (t:Track)  REQUIRE t.track_id IS UNIQUE;
CREATE CONSTRAINT artist_name_unique IF NOT EXISTS FOR (a:Artist) REQUIRE a.name     IS UNIQUE;
CREATE CONSTRAINT album_name_unique  IF NOT EXISTS FOR (al:Album) REQUIRE al.name    IS UNIQUE;
CREATE CONSTRAINT genre_name_unique  IF NOT EXISTS FOR (g:Genre)  REQUIRE g.name     IS UNIQUE;
```

Notes Gemini must obey:

- Artist/Album/Genre have **only** `name`; there is no `id`, no `releaseYear`, no `duration`.
- Track's genre, album, and artists are reachable **only through relationships** — they are not properties on `:Track`.
- There is no `RELEASED_BY`, no `COLLABORATED_WITH`, no `SIMILAR_TO`. Invented relationships are forbidden.
- Popularity is 0–100 integer; danceability/valence/acousticness are 0.0–1.0 floats.

## Locked request flow

1. User types a question.
2. Browser `POST`s `{ question }` to `/api/query`, optionally with header `X-User-Gemini-Key`.
3. Route selects the Gemini key: user header wins, else `process.env.GEMINI_API_KEY`.
4. Route sends `question` + the schema block above + a short "only read-only Cypher" system instruction to Gemini, demanding JSON output matching `{ cypher: string, rationale: string }`.
5. Route validates generated Cypher against the allow/deny list before any execution.
6. Route executes Cypher against Neo4j Aura inside a **read transaction** with a timeout.
7. Route shapes results into `{ nodes, edges, rows }` with caps applied.
8. Response returns `{ cypher, rationale, nodes, edges, rows, meta }`.
9. Frontend renders the graph (NVL), the Cypher text (syntax-highlighted, copyable), and the metadata chips.

Errors at any step return a structured error that the UI maps to a friendly message and a suggested retry.

## Locked fallback chain (quota and key policy)

| Event | UX |
| --- | --- |
| Default: server `GEMINI_API_KEY` works | Invisible to the user |
| Gemini returns 429 / quota exhausted | Modal: *"Free quota hit. Want to use your own Gemini API key?"* with a 3-step guide: (1) open Google AI Studio, (2) create a key, (3) paste it. Key stored in `localStorage` and sent per-request as `X-User-Gemini-Key`. Never sent to any third party. |
| User declines BYO key + device is desktop | Secondary option: *"Run locally with Ollama instead."* Opens instructions: install Ollama, `ollama pull llama3.1`, set `OLLAMA_ORIGINS=https://<site>.vercel.app`. Browser then calls `http://localhost:11434` directly for generation; generated Cypher is still validated and executed by `/api/query`. |
| User declines BYO key + device is phone | Message: *"Local models need a laptop. Try your own Gemini key, or check back later."* |

Ollama is a clearly-labeled advanced, desktop-only path. It is not a baseline feature.

## Locked Cypher guardrails

**Allowlist** (the only clauses Cypher may contain):
`MATCH`, `OPTIONAL MATCH`, `WHERE`, `WITH`, `RETURN`, `ORDER BY`, `SKIP`, `LIMIT`, `UNWIND`, `CALL db.schema.visualization`, `CALL db.labels`, `CALL db.relationshipTypes`, and aggregations `count`, `avg`, `sum`, `min`, `max`, `collect`, `toLower`, `toUpper`, `trim`, `CONTAINS`, `STARTS WITH`, `ENDS WITH`.

**Denylist** (rejected before execution via tokenizer + regex; unit-tested):
`CREATE`, `MERGE`, `DELETE`, `DETACH`, `SET`, `REMOVE`, `DROP`, `LOAD CSV`, `FOREACH`, `CALL { … } IN TRANSACTIONS`, any `apoc.*` procedure except `apoc.meta.schema`, any `db.index.fulltext.create*`, any `dbms.*`.

**Execution constraints**:

- Read transaction only (`session.executeRead`).
- Query timeout: **10 s** (`tx.run(..., { timeout: 10000 })`).
- Row cap: **500** (auto-append `LIMIT 500` if the generated query omits a limit).
- Node cap in response: **300**. Edge cap: **800**. Overage sets `meta.truncated = true`.
- Database name: `process.env.NEO4J_DATABASE ?? "neo4j"` (assignment preferred `spotifydb`; Aura Free only allows one DB named `neo4j`, so default is `neo4j`).

## Locked API contract

### `POST /api/query`

Request body:

```json
{ "question": "string" }
```

Optional header: `X-User-Gemini-Key: <gemini api key>`

Success response (`200`):

```json
{
  "cypher": "MATCH (t:Track) WHERE t.popularity > 80 RETURN t ORDER BY t.popularity DESC LIMIT 20",
  "rationale": "Returns the 20 highest-popularity tracks.",
  "nodes": [
    { "id": "t_5SuOikwiRyPMVoIQDJUgSV", "label": "Track", "properties": { "track_id": "5Su...", "track_name": "Comedy", "popularity": 73, "danceability": 0.676, "valence": 0.715, "acousticness": 0.0322 } }
  ],
  "edges": [
    { "id": "e_1", "source": "t_5Su...", "target": "a_Gen_Hoshino", "type": "PERFORMED_BY" }
  ],
  "rows": [{ "t": { "track_id": "5Su...", "track_name": "Comedy", "popularity": 73 } }],
  "meta": { "ms": 412, "nodeCount": 20, "edgeCount": 0, "rowCount": 20, "truncated": false }
}
```

Error response (`400` / `429` / `500`):

```json
{
  "error": {
    "code": "VALIDATION_BLOCKED",
    "message": "Write clause detected in generated Cypher.",
    "hint": "Try rephrasing as a read-only question."
  }
}
```

Error codes:

`GENERATION_FAILED` · `VALIDATION_BLOCKED` · `EXECUTION_TIMEOUT` · `EXECUTION_FAILED` · `RESULT_TOO_LARGE` · `QUOTA_EXHAUSTED` · `BAD_USER_KEY` · `RATE_LIMITED`.

### `GET /api/health`

Returns `{ ok: true }` once the Neo4j driver is connected. Used for uptime checks.

## Locked UI contract

- Single page. Query input sticky at top.
- Empty state shows 6 suggestion chips (below) so phone users always have something to tap.
- Graph panel is full-viewport on phones; left 2/3 on desktop (≥ 1024 px).
- Cypher panel: swipe-up bottom sheet on phones; right 1/3 on desktop. Always shows the executed Cypher with copy button.
- Metadata chip row: `412 ms · 12 nodes · 17 edges · truncated=false`.
- Errors render as a toast + an inline hint under the input; never block re-typing.
- All state changes animate under 200 ms.

Suggestion chips for empty state (mapped to the 6 read-only assignment tasks so the demo is guaranteed to succeed against the loaded data):

1. *"Show the top 20 tracks with popularity over 80"*
2. *"Find tracks with 'love' or 'dream' in the title"*
3. *"List all tracks by Taylor Swift"*
4. *"Show upbeat and happy tracks (danceability > 0.7, valence > 0.7, popularity > 60)"*
5. *"Average popularity by genre"*
6. *"Top 10 genres by track count"*

Mobile interactions in the graph:

- Pinch to zoom.
- One-finger pan.
- Tap to select a node (highlights neighbors).
- Long-press opens a detail sheet with properties.
- Double-tap to fit-to-screen.

## Acceptance examples (v1 must ship all six working)

These mirror the assignment's timed tasks 1, 2, 3, 4, 6, 7 (Task 5 is a write and is out of scope for the website).

| # | Question | Expected Cypher (canonical form) | Expected response shape |
| - | --- | --- | --- |
| 1 | *"Show the top 20 tracks with popularity over 80"* | `MATCH (t:Track) WHERE t.popularity > 80 RETURN t.track_name AS track_name, t.popularity AS popularity ORDER BY t.popularity DESC LIMIT 20` | 20 rows, Track nodes rendered |
| 2 | *"Find tracks with 'love' or 'dream' in the title"* | `MATCH (t:Track) WHERE toLower(t.track_name) CONTAINS 'love' OR toLower(t.track_name) CONTAINS 'dream' RETURN t.track_name AS track_name, t.popularity AS popularity ORDER BY t.popularity DESC LIMIT 50` | Up to 50 rows |
| 3 | *"List all tracks by Taylor Swift"* | `MATCH (t:Track)-[:PERFORMED_BY]->(a:Artist {name: 'Taylor Swift'}) RETURN t.track_name AS track_name, t.popularity AS popularity ORDER BY t.popularity DESC` | Track + Artist graph, 1 Artist node, many Track nodes |
| 4 | *"Show upbeat and happy tracks (danceability > 0.7, valence > 0.7, popularity > 60)"* | `MATCH (t:Track) WHERE t.danceability > 0.7 AND t.valence > 0.7 AND t.popularity > 60 RETURN t.track_name AS track_name, t.popularity AS popularity, t.danceability AS danceability, t.valence AS valence ORDER BY t.popularity DESC` | Track nodes |
| 5 | *"Average popularity by genre"* | `MATCH (t:Track)-[:HAS_GENRE]->(g:Genre) RETURN g.name AS genre, avg(t.popularity) AS avg_popularity ORDER BY avg_popularity DESC` | 113 rows; Genre nodes |
| 6 | *"Top 10 genres by track count"* | `MATCH (t:Track)-[:HAS_GENRE]->(g:Genre) RETURN g.name AS genre, count(t) AS track_count ORDER BY track_count DESC LIMIT 10` | 10 rows; Genre nodes |

The backend unit tests run these 6 against the loaded Aura graph as integration tests before every deploy.

## Environment variables

Server-side only, set in Vercel dashboard and `.env.local` for dev:

- `GEMINI_API_KEY` — maintainer's default Gemini key.
- `NEO4J_URI` — e.g. `neo4j+s://xxxxxxxx.databases.neo4j.io`.
- `NEO4J_USER` — usually `neo4j`.
- `NEO4J_PASSWORD` — Aura password.
- `NEO4J_DATABASE` — usually `neo4j` (Aura Free); set to `spotifydb` only if the target Neo4j instance allows multi-db.
- `ALLOWED_ORIGINS` — comma-separated; dev convenience.

Never logged. Never returned to the client. Never committed. `.env.local.example` ships with blanks.

## Folder layout

```
/
├─ app/
│  ├─ page.tsx                 # main query UI
│  ├─ layout.tsx
│  └─ api/
│     ├─ query/route.ts        # POST — NL -> graph
│     └─ health/route.ts       # GET  — liveness
├─ components/
│  ├─ GraphCanvas.tsx          # @neo4j-nvl/react wrapper
│  ├─ QueryInput.tsx
│  ├─ CypherPanel.tsx
│  ├─ SuggestionChips.tsx
│  └─ ByoKeyModal.tsx
├─ lib/
│  ├─ gemini.ts                # @google/genai client + schema-aware prompt
│  ├─ neo4j.ts                 # driver singleton
│  ├─ cypherGuard.ts           # allow/denylist validator + unit tests
│  ├─ shape.ts                 # Neo4j result -> { nodes, edges, rows }
│  └─ rateLimit.ts             # per-IP token bucket
├─ scripts/
│  └─ load_graph.ts            # one-shot loader: reads local CSVs, UNWIND-batches into Aura
├─ tests/
│  └─ cypherGuard.test.ts      # denylist must cover all 10 clauses
├─ tracks.csv                  # existing, from cleaning.py (git-ignored due to size)
├─ artists.csv
├─ albums.csv
├─ genres.csv
├─ rel_performed_by.csv
├─ rel_belongs_to.csv
├─ rel_has_genre.csv
├─ cleaning.py                 # unchanged; documented as the source of the CSVs
├─ timing.py                   # unchanged; developer-only benchmark, not used by the web app
├─ .env.local.example
├─ .gitignore                  # ignores *.csv (except the schema README) and .env.local
├─ package.json
├─ tailwind.config.ts
├─ tsconfig.json
└─ next.config.ts
```

## One-shot loader (`scripts/load_graph.ts`)

Purpose: mirror the assignment's `LOAD CSV` steps into Neo4j Aura using the JS driver, because Aura has no local `import/` directory.

Behavior:

1. Read env: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `NEO4J_DATABASE`.
2. Create the 4 uniqueness constraints listed above.
3. Stream each CSV with `csv-parse` and batch rows (10,000 at a time) through parameterized `UNWIND $rows AS row MERGE …` statements that replicate the assignment's `MERGE` patterns exactly:
   - Tracks: `MERGE (t:Track {track_id: row.track_id}) SET t.track_name = row.track_name, t.popularity = toInteger(row.popularity), t.danceability = toFloat(row.danceability), t.valence = toFloat(row.valence), t.acousticness = toFloat(row.acousticness)`
   - Artists: `MERGE (:Artist {name: trim(row.name)})`
   - Albums: `MERGE (:Album {name: trim(row.name)})`
   - Genres: `MERGE (:Genre {name: trim(row.name)})`
   - PERFORMED_BY: `MATCH (t:Track {track_id: row.track_id}), (a:Artist {name: trim(row.artist_name)}) MERGE (t)-[:PERFORMED_BY]->(a)`
   - BELONGS_TO: `MATCH (t:Track {track_id: row.track_id}), (al:Album {name: trim(row.album_name)}) MERGE (t)-[:BELONGS_TO]->(al)`
   - HAS_GENRE: `MATCH (t:Track {track_id: row.track_id}), (g:Genre {name: trim(row.track_genre)}) MERGE (t)-[:HAS_GENRE]->(g)`
4. Print progress per CSV and a final summary with node/edge counts.
5. Idempotent: safe to re-run; uses `MERGE`, so duplicate runs do not double-insert.
6. Skip rows where required columns are null or empty (matches assignment `WHERE` guards).

Run once: `pnpm run load-graph`.

## Dev flow

```bash
pnpm install
cp .env.local.example .env.local      # fill Aura + Gemini values
pnpm run load-graph                   # one-time load of the 7 CSVs into Aura
pnpm dev                              # http://localhost:3000
pnpm test                             # runs cypherGuard + integration tests
```

Production: `git push` to the repo connected to Vercel; Vercel builds and deploys automatically. The loader is **not** run on Vercel — it is a maintainer-only step against Aura.

## Rate limiting and observability

- Per-IP token bucket: **30 requests / minute**. Overflow returns `RATE_LIMITED`. Implemented in-memory per Vercel function instance; acceptable for v1.
- Structured JSON logs per request: `{ ts, ip_hash, route, ms, status, errorCode? }`. The user's question is **not** logged; the user's Gemini key is **never** logged; query results are **never** logged.
- Tiny in-memory response cache: key = SHA-256 of `(question + schemaVersion)`, TTL = 60 s. Absorbs accidental double-taps on phones without extra Gemini or Neo4j calls.

## Success criteria

- A first-time phone visitor taps a suggestion chip and sees a rendered graph with visible Cypher within 3 s on mid-tier mobile.
- All 6 acceptance examples pass end-to-end against the loaded Aura snapshot.
- Unit tests confirm every clause in the denylist is rejected before execution.
- When `GEMINI_API_KEY` is force-exhausted in testing, the BYO-key modal appears and a pasted key successfully drives a query.
- Portrait and landscape both usable; Cypher panel reachable on phones via swipe-up.
- Gemini never generates Cypher referring to a label, property, or relationship outside the locked schema. (Tested with a prompt injection attempt such as "use the RELEASED_BY relationship" — expected: route validates against schema and blocks or Gemini refuses.)

## Non-goals for v1

- Local Docker Neo4j or on-device DB as a default path.
- Any write operation on the graph (including a web version of assignment Task 5).
- Multi-dataset ingestion or live upstream refresh.
- Ollama on phones.
- Accounts, authentication, or saved query history (nice to have, not shipped in v1).

---

This brief is locked on product, architecture, schema, guardrails, contracts, and acceptance examples. An implementer should have no ambiguity left to invent around.
