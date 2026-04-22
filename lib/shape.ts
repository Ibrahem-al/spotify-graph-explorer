import type { Record as NeoRecord, Integer } from "neo4j-driver";
import { isInt } from "neo4j-driver";

export const CAPS = { rows: 500, nodes: 300, edges: 800 };

export type ShapedNode = {
  id: string;
  label: string;
  properties: Record<string, unknown>;
};

export type ShapedEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
};

export type ShapeResult = {
  nodes: ShapedNode[];
  edges: ShapedEdge[];
  rows: Record<string, unknown>[];
  meta: {
    nodeCount: number;
    edgeCount: number;
    rowCount: number;
    truncated: boolean;
  };
};

function coerce(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map(coerce);
  if (isInt(v as Integer)) return (v as Integer).toNumber();
  if (typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, coerce(val)])
    );
  }
  return v;
}

export function shape(records: NeoRecord[]): ShapeResult {
  const nodes = new Map<string, ShapedNode>();
  const edges = new Map<string, ShapedEdge>();
  const rows: Record<string, unknown>[] = [];
  let truncated = false;

  function visit(val: unknown): unknown {
    if (val === null || val === undefined) return null;
    if (Array.isArray(val)) return val.map(visit);

    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;

      // Neo4j Node
      if ("labels" in obj && "identity" in obj && "properties" in obj) {
        const rawId = obj.identity as Integer;
        const identity = isInt(rawId) ? rawId.toNumber() : rawId;
        const id = `n_${identity}`;
        if (!nodes.has(id)) {
          if (nodes.size < CAPS.nodes) {
            const labels = obj.labels as string[];
            nodes.set(id, {
              id,
              label: labels[0] ?? "Unknown",
              properties: Object.fromEntries(
                Object.entries(obj.properties as Record<string, unknown>).map(([k, v]) => [
                  k,
                  coerce(v),
                ])
              ),
            });
          } else {
            truncated = true;
          }
        }
        return { __node: id };
      }

      // Neo4j Relationship
      if ("start" in obj && "end" in obj && "type" in obj && "identity" in obj) {
        const rawId = obj.identity as Integer;
        const rawStart = obj.start as Integer;
        const rawEnd = obj.end as Integer;
        const identity = isInt(rawId) ? rawId.toNumber() : rawId;
        const startId = isInt(rawStart) ? rawStart.toNumber() : rawStart;
        const endId = isInt(rawEnd) ? rawEnd.toNumber() : rawEnd;
        const id = `e_${identity}`;
        const sourceId = `n_${startId}`;
        const targetId = `n_${endId}`;
        if (!edges.has(id) && nodes.has(sourceId) && nodes.has(targetId)) {
          if (edges.size < CAPS.edges) {
            edges.set(id, {
              id,
              source: sourceId,
              target: targetId,
              type: obj.type as string,
            });
          } else {
            truncated = true;
          }
        }
        return { __edge: id };
      }

      return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, visit(v)]));
    }

    return coerce(val);
  }

  const capped = records.slice(0, CAPS.rows);
  if (records.length > CAPS.rows) truncated = true;

  for (const rec of capped) {
    const row: Record<string, unknown> = {};
    for (const key of rec.keys as string[]) {
      row[key] = visit(rec.get(key));
    }
    rows.push(row);
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    rows,
    meta: {
      nodeCount: nodes.size,
      edgeCount: edges.size,
      rowCount: rows.length,
      truncated,
    },
  };
}
