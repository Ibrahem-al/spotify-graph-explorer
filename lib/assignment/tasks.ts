/**
 * Shared definitions for the 7 Cypher tasks.
 *
 * IMPORTANT SAFETY RULE:
 * - `kind: "read"` tasks are executed against the live Neo4j instance.
 * - `kind: "write"` tasks are NEVER executed. They are simulated:
 *   the server runs a read-only `simulate_query` to verify the node exists,
 *   then synthesizes the row that the `SET` would have produced.
 */

export type TaskKind = "read" | "write";

export interface TaskDefinition {
  id: number;
  title: string;
  summary: string;
  kind: TaskKind;
  query: string;
  simulatedQuery?: string;
  simulatedRow?: Record<string, unknown>;
  resetQuery?: string;
}

export const TASKS: TaskDefinition[] = [
  {
    id: 1,
    title: "Highly popular tracks",
    summary:
      "Return the top 20 tracks with popularity > 80, ordered by popularity descending.",
    kind: "read",
    query: `MATCH (t:Track)
WHERE t.popularity > 80
RETURN t.track_name AS track_name, t.popularity AS popularity
ORDER BY t.popularity DESC
LIMIT 20`,
  },
  {
    id: 2,
    title: "Tracks with 'Love' or 'Dream' in the title",
    summary:
      "Find up to 50 tracks whose title contains 'love' or 'dream' (case-insensitive).",
    kind: "read",
    query: `MATCH (t:Track)
WHERE toLower(t.track_name) CONTAINS 'love'
   OR toLower(t.track_name) CONTAINS 'dream'
RETURN t.track_name AS track_name, t.popularity AS popularity
ORDER BY t.popularity DESC
LIMIT 50`,
  },
  {
    id: 3,
    title: "Tracks by Taylor Swift",
    summary:
      "All tracks connected to the artist 'Taylor Swift' via :PERFORMED_BY.",
    kind: "read",
    query: `MATCH (t:Track)-[:PERFORMED_BY]->(a:Artist {name: 'Taylor Swift'})
RETURN t.track_name AS track_name, t.popularity AS popularity
ORDER BY t.popularity DESC`,
  },
  {
    id: 4,
    title: "Upbeat and happy tracks",
    summary:
      "Tracks with danceability > 0.7, valence > 0.7 and popularity > 60.",
    kind: "read",
    query: `MATCH (t:Track)
WHERE t.danceability > 0.7
  AND t.valence > 0.7
  AND t.popularity > 60
RETURN t.track_name   AS track_name,
       t.popularity   AS popularity,
       t.danceability AS danceability,
       t.valence      AS valence
ORDER BY t.popularity DESC`,
  },
  {
    id: 5,
    title: "Update artist name (Jason Mraz → Jason M.)",
    summary:
      "Rename the artist 'Jason Mraz' to 'Jason M.' — SIMULATED so the cloud graph is not modified.",
    kind: "write",
    query: `MATCH (a:Artist {name: 'Jason Mraz'})
SET a.name = 'Jason M.'
RETURN a.name`,
    simulatedQuery: `MATCH (a:Artist {name: 'Jason Mraz'})
RETURN a.name AS current_name`,
    simulatedRow: { "a.name": "Jason M." },
    resetQuery: `MATCH (a:Artist {name: 'Jason M.'})
SET a.name = 'Jason Mraz'`,
  },
  {
    id: 6,
    title: "Average track popularity by genre",
    summary:
      "For every genre, return the average popularity of its tracks, sorted desc.",
    kind: "read",
    query: `MATCH (t:Track)-[:HAS_GENRE]->(g:Genre)
RETURN g.name AS genre, avg(t.popularity) AS avg_popularity
ORDER BY avg_popularity DESC`,
  },
  {
    id: 7,
    title: "Genre-wise track counts",
    summary:
      "Top 10 genres by the number of tracks connected via :HAS_GENRE.",
    kind: "read",
    query: `MATCH (t:Track)-[:HAS_GENRE]->(g:Genre)
RETURN g.name AS genre, count(t) AS track_count
ORDER BY track_count DESC
LIMIT 10`,
  },
];

export function getTask(id: number): TaskDefinition | undefined {
  return TASKS.find((t) => t.id === id);
}
