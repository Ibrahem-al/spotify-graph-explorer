# Spotify Graph Explorer

Ask natural-language questions about a Spotify music graph and get back an interactive Neo4j visualization, the generated Cypher, and execution metadata.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend + API | Next.js 15 (App Router) + TypeScript + Tailwind v4 |
| Graph visualization | `@neo4j-nvl/react` |
| NL → Cypher | Gemini `gemini-2.5-flash` via `@google/genai` |
| Graph DB | Neo4j Aura Free |
| Host | Vercel |

## Local development

### 1. Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Neo4j Aura Free account ([console.neo4j.io](https://console.neo4j.io))
- Gemini API key ([aistudio.google.com](https://aistudio.google.com/app/apikey))

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
GEMINI_API_KEY=<your key>
NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=<your password>
NEO4J_DATABASE=neo4j
ALLOWED_ORIGINS=http://localhost:3000
```

### 4. Load the graph (one-time)

Make sure the 7 CSV files are at the repo root, then:

```bash
pnpm run load-graph
```

Expected runtime: 4–8 minutes on Aura Free. The loader is idempotent — safe to re-run.

Verify in Aura Browser:

```cypher
MATCH (t:Track) RETURN count(t)    // → ~89,740
MATCH (a:Artist) RETURN count(a)   // → ~29,857
```

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Run tests

```bash
pnpm test
```

Unit tests (cypherGuard + shape) run without any live services. Integration tests are skipped unless `NEO4J_URI` and `GEMINI_API_KEY` are set.

To run integration tests against the dev server:

```bash
# In one terminal:
pnpm dev

# In another:
TEST_BASE_URL=http://localhost:3000 pnpm test
```

## Deploying to Vercel

1. Push to a GitHub repo.
2. Connect the repo in the Vercel dashboard.
3. Set all env vars in **Settings → Environment Variables → Production**:
   - `GEMINI_API_KEY`
   - `NEO4J_URI`
   - `NEO4J_USER`
   - `NEO4J_PASSWORD`
   - `NEO4J_DATABASE` = `neo4j`
   - `ALLOWED_ORIGINS` = `https://<your-project>.vercel.app`
4. Deploy. First build takes ~2 minutes.
5. Smoke test: `GET /api/health` → `{ "ok": true }`.

> **Note:** Neo4j Aura Free auto-pauses after 3 days of inactivity. The first query after a pause may take 30+ seconds. Set up a weekly cron (GitHub Action) to hit `/api/health` to keep it warm.

## Architecture

```
User question
  → POST /api/query
    → Gemini gemini-2.5-flash (NL → Cypher JSON)
    → cypherGuard (allow/denylist validation)
    → Neo4j Aura executeRead (with 10s timeout)
    → shape() (records → { nodes, edges, rows })
  ← { cypher, rationale, nodes, edges, rows, meta }
Frontend renders NVL graph + Cypher panel + meta chips
```

## Graph schema

```
(:Track { track_id, track_name, popularity, danceability, valence, acousticness })
(:Artist { name })
(:Album { name })
(:Genre { name })

(:Track)-[:PERFORMED_BY]->(:Artist)
(:Track)-[:BELONGS_TO]->(:Album)
(:Track)-[:HAS_GENRE]->(:Genre)
```

~89,740 tracks · ~29,857 artists · ~46,588 albums · 113 genres
