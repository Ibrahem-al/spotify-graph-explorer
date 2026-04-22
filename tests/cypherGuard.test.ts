import { describe, it, expect } from "vitest";
import { guardCypher } from "../lib/cypherGuard";

const SAFE_WRAPPER = (clause: string) => `MATCH (n) ${clause} RETURN n`;

describe("guardCypher — denylist", () => {
  const denyList = [
    "CREATE",
    "MERGE",
    "DELETE",
    "DETACH DELETE",
    "SET",
    "REMOVE",
    "DROP",
    "LOAD CSV",
    "FOREACH",
  ];

  for (const clause of denyList) {
    it(`rejects '${clause}'`, () => {
      const result = guardCypher(`${clause} (n:Foo) RETURN n`);
      expect(result.ok).toBe(false);
    });
  }

  it("rejects CALL { } IN TRANSACTIONS", () => {
    const result = guardCypher(
      "CALL { MATCH (n) RETURN n } IN TRANSACTIONS RETURN n"
    );
    expect(result.ok).toBe(false);
  });

  it("rejects apoc.* (non-meta)", () => {
    const result = guardCypher("CALL apoc.refactor.mergeNodes([n, m]) YIELD node RETURN node");
    expect(result.ok).toBe(false);
  });

  it("rejects dbms.*", () => {
    const result = guardCypher("CALL dbms.procedures() YIELD name RETURN name");
    expect(result.ok).toBe(false);
  });

  it("rejects db.index.fulltext.create*", () => {
    const result = guardCypher(
      "CALL db.index.fulltext.createNodeIndex('idx', ['Track'], ['track_name'])"
    );
    expect(result.ok).toBe(false);
  });
});

describe("guardCypher — allowlist", () => {
  it("allows MATCH / RETURN", () => {
    const result = guardCypher("MATCH (t:Track) RETURN t LIMIT 10");
    expect(result.ok).toBe(true);
  });

  it("allows OPTIONAL MATCH", () => {
    const result = guardCypher(
      "MATCH (a:Artist) OPTIONAL MATCH (a)<-[:PERFORMED_BY]-(t:Track) RETURN a, t LIMIT 20"
    );
    expect(result.ok).toBe(true);
  });

  it("allows WHERE, ORDER BY, SKIP, LIMIT", () => {
    const result = guardCypher(
      "MATCH (t:Track) WHERE t.popularity > 80 RETURN t ORDER BY t.popularity DESC SKIP 0 LIMIT 20"
    );
    expect(result.ok).toBe(true);
  });

  it("allows aggregations (count, avg, sum, min, max, collect)", () => {
    const result = guardCypher(
      "MATCH (t:Track)-[:HAS_GENRE]->(g:Genre) RETURN g.name, count(t) AS cnt, avg(t.popularity) AS avgPop ORDER BY cnt DESC"
    );
    expect(result.ok).toBe(true);
  });

  it("allows WITH and UNWIND", () => {
    const result = guardCypher(
      "WITH ['pop', 'rock'] AS genres UNWIND genres AS g MATCH (genre:Genre {name: g}) RETURN genre"
    );
    expect(result.ok).toBe(true);
  });

  it("allows CONTAINS, STARTS WITH, ENDS WITH", () => {
    const result = guardCypher(
      "MATCH (t:Track) WHERE toLower(t.track_name) CONTAINS 'love' RETURN t LIMIT 50"
    );
    expect(result.ok).toBe(true);
  });

  it("allows apoc.meta.schema", () => {
    const result = guardCypher("CALL apoc.meta.schema() YIELD value RETURN value");
    expect(result.ok).toBe(true);
  });
});

describe("guardCypher — comment and string handling", () => {
  it("ignores CREATE inside a // comment", () => {
    const result = guardCypher(
      "// CREATE this is a comment\nMATCH (t:Track) RETURN t LIMIT 10"
    );
    expect(result.ok).toBe(true);
  });

  it("ignores CREATE inside a /* block comment */", () => {
    const result = guardCypher(
      "/* CREATE is not allowed */ MATCH (t:Track) RETURN t LIMIT 10"
    );
    expect(result.ok).toBe(true);
  });

  it("ignores DELETE inside a string literal", () => {
    const result = guardCypher(
      "MATCH (t:Track) WHERE t.track_name = 'DELETE me' RETURN t LIMIT 10"
    );
    expect(result.ok).toBe(true);
  });
});

describe("guardCypher — LIMIT auto-append", () => {
  it("appends LIMIT 500 when no LIMIT present and no aggregation", () => {
    const result = guardCypher("MATCH (t:Track) RETURN t");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cypher).toMatch(/LIMIT 500/i);
    }
  });

  it("does NOT append LIMIT when LIMIT already present", () => {
    const result = guardCypher("MATCH (t:Track) RETURN t LIMIT 20");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cypher.match(/LIMIT/gi)?.length).toBe(1);
    }
  });

  it("does NOT append LIMIT for aggregation queries", () => {
    const result = guardCypher(
      "MATCH (t:Track)-[:HAS_GENRE]->(g:Genre) RETURN g.name, count(t) AS cnt"
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cypher).not.toMatch(/LIMIT/i);
    }
  });

  it("strips trailing semicolon", () => {
    const result = guardCypher("MATCH (t:Track) RETURN t LIMIT 10;");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cypher).not.toMatch(/;/);
    }
  });
});
