import { describe, it, expect, beforeAll } from "vitest";
import { guardCypher } from "../lib/cypherGuard";

/**
 * Integration tests against a live Neo4j Aura instance.
 * Skipped when NEO4J_URI is not set (e.g., in CI without secrets).
 *
 * These tests call the local dev server's /api/query endpoint.
 * Start the dev server first: pnpm dev
 */

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const NEO4J_URI = process.env.NEO4J_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ACCEPTANCE_EXAMPLES = [
  {
    name: "Top 20 popular tracks",
    question: "Show the top 20 tracks with popularity over 80",
    expectedNodeLabel: "Track",
    minRows: 1,
  },
  {
    name: "Tracks with love or dream",
    question: "Find tracks with 'love' or 'dream' in the title",
    expectedNodeLabel: "Track",
    minRows: 1,
  },
  {
    name: "Taylor Swift tracks",
    question: "List all tracks by Taylor Swift",
    expectedNodeLabel: "Track",
    minRows: 1,
  },
  {
    name: "Upbeat and happy tracks",
    question: "Show upbeat and happy tracks (danceability > 0.7, valence > 0.7, popularity > 60)",
    expectedNodeLabel: "Track",
    minRows: 1,
  },
  {
    name: "Average popularity by genre",
    question: "Average popularity by genre",
    expectedNodeLabel: "Genre",
    minRows: 1,
  },
  {
    name: "Top 10 genres by track count",
    question: "Top 10 genres by track count",
    expectedNodeLabel: "Genre",
    minRows: 1,
  },
];

describe.skipIf(!NEO4J_URI || !GEMINI_API_KEY)(
  "Integration: 6 acceptance examples against live Aura",
  () => {
    beforeAll(() => {
      console.log(`Testing against: ${BASE_URL}`);
    });

    for (const example of ACCEPTANCE_EXAMPLES) {
      it(example.name, async () => {
        const res = await fetch(`${BASE_URL}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: example.question }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();

        // Has a valid cypher
        expect(typeof data.cypher).toBe("string");
        expect(data.cypher.length).toBeGreaterThan(0);

        // Cypher passes the guard
        const guarded = guardCypher(data.cypher);
        expect(guarded.ok).toBe(true);

        // Has results
        expect(data.rows.length).toBeGreaterThanOrEqual(example.minRows);

        // Expected node label is present somewhere
        const nodeLabels = data.nodes.map((n: { label: string }) => n.label);
        expect(nodeLabels).toContain(example.expectedNodeLabel);

        // Meta is reasonable
        expect(data.meta.ms).toBeLessThan(5000);
        expect(typeof data.meta.nodeCount).toBe("number");
      }, 15_000); // 15s timeout per test
    }
  }
);
