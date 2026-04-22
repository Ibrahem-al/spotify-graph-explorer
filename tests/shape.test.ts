import { describe, it, expect } from "vitest";
import { shape, CAPS } from "../lib/shape";
import neo4j from "neo4j-driver";

// Minimal Record mock that matches the neo4j-driver API
function fakeRecord(data: Record<string, unknown>) {
  const keys = Object.keys(data);
  return {
    keys,
    get: (key: string) => data[key],
  };
}

function fakeNode(
  id: number,
  labels: string[],
  properties: Record<string, unknown>
) {
  return {
    identity: neo4j.int(id),
    labels,
    properties,
    elementId: `node:${id}`,
  };
}

function fakeRel(
  id: number,
  type: string,
  start: number,
  end: number
) {
  return {
    identity: neo4j.int(id),
    type,
    start: neo4j.int(start),
    end: neo4j.int(end),
    properties: {},
    elementId: `rel:${id}`,
    startNodeElementId: `node:${start}`,
    endNodeElementId: `node:${end}`,
  };
}

describe("shape — basic extraction", () => {
  it("extracts 1 node from a record", () => {
    const node = fakeNode(1, ["Track"], { track_name: "Song A", popularity: neo4j.int(75) });
    const records = [fakeRecord({ t: node })];
    // @ts-expect-error - using minimal mock
    const result = shape(records);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe("n_1");
    expect(result.nodes[0].label).toBe("Track");
    expect(result.nodes[0].properties.track_name).toBe("Song A");
    expect(result.nodes[0].properties.popularity).toBe(75); // Integer coerced
    expect(result.edges).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
  });

  it("extracts 1 edge from a record", () => {
    const nodeA = fakeNode(1, ["Track"], { track_name: "Song A" });
    const nodeB = fakeNode(2, ["Artist"], { name: "Artist X" });
    const rel = fakeRel(10, "PERFORMED_BY", 1, 2);

    const records = [fakeRecord({ t: nodeA, a: nodeB, r: rel })];
    // @ts-expect-error - using minimal mock
    const result = shape(records);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].type).toBe("PERFORMED_BY");
    expect(result.edges[0].source).toBe("n_1");
    expect(result.edges[0].target).toBe("n_2");
  });

  it("deduplicates nodes that appear in multiple records", () => {
    const node = fakeNode(1, ["Track"], { track_name: "Shared" });
    const records = [fakeRecord({ t: node }), fakeRecord({ t: node })];
    // @ts-expect-error - using minimal mock
    const result = shape(records);

    expect(result.nodes).toHaveLength(1);
    expect(result.rows).toHaveLength(2);
  });

  it("coerces Neo4j Integer to JS number", () => {
    const node = fakeNode(5, ["Track"], {
      popularity: neo4j.int(90),
      danceability: 0.8,
    });
    const records = [fakeRecord({ t: node })];
    // @ts-expect-error - using minimal mock
    const result = shape(records);

    expect(typeof result.nodes[0].properties.popularity).toBe("number");
    expect(result.nodes[0].properties.popularity).toBe(90);
  });
});

describe("shape — caps", () => {
  it("caps rows at CAPS.rows and sets truncated=true", () => {
    const records = Array.from({ length: CAPS.rows + 5 }, (_, i) =>
      fakeRecord({ val: i })
    );
    // @ts-expect-error - using minimal mock
    const result = shape(records);

    expect(result.rows).toHaveLength(CAPS.rows);
    expect(result.meta.truncated).toBe(true);
  });

  it("caps nodes at CAPS.nodes and sets truncated=true", () => {
    const records = Array.from({ length: CAPS.nodes + 5 }, (_, i) =>
      fakeRecord({ n: fakeNode(i, ["Track"], { track_name: `T${i}` }) })
    );
    // @ts-expect-error - using minimal mock
    const result = shape(records.slice(0, CAPS.rows));

    expect(result.nodes.length).toBeLessThanOrEqual(CAPS.nodes);
    expect(result.meta.truncated).toBe(true);
  });
});

describe("shape — primitive values", () => {
  it("handles null values in records", () => {
    const records = [fakeRecord({ val: null })];
    // @ts-expect-error - using minimal mock
    const result = shape(records);
    expect(result.rows[0].val).toBeNull();
  });

  it("handles string, number, and boolean scalars", () => {
    const records = [fakeRecord({ s: "hello", n: 42, b: true })];
    // @ts-expect-error - using minimal mock
    const result = shape(records);
    expect(result.rows[0]).toEqual({ s: "hello", n: 42, b: true });
  });

  it("handles arrays in record values", () => {
    const records = [fakeRecord({ arr: [1, 2, 3] })];
    // @ts-expect-error - using minimal mock
    const result = shape(records);
    expect(result.rows[0].arr).toEqual([1, 2, 3]);
  });
});
