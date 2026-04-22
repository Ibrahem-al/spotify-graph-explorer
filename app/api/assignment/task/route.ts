import { NextResponse } from "next/server";
import { z } from "zod";
import { getDriver } from "@/lib/neo4j";
import { getTask, type TaskDefinition } from "@/lib/assignment/tasks";
import { isInt } from "neo4j-driver";
import type { Integer } from "neo4j-driver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  id: z.number().int().min(1).max(7),
});

const ROW_CAP = 500;

function coerce(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map(coerce);
  if (isInt(v as Integer)) return (v as Integer).toNumber();
  if (typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) => [
        k,
        coerce(val),
      ])
    );
  }
  return v;
}

async function runRead(
  task: TaskDefinition
): Promise<{
  rows: Record<string, unknown>[];
  ms: number;
  truncated: boolean;
  columns: string[];
}> {
  const driver = getDriver();
  const database = process.env.NEO4J_DATABASE ?? "neo4j";
  const session = driver.session({ database, defaultAccessMode: "READ" });
  try {
    const started = performance.now();
    const result = await session.executeRead((tx) => tx.run(task.query, {}));
    const ms = Math.round(performance.now() - started);

    const records = result.records;
    const capped = records.slice(0, ROW_CAP);
    const truncated = records.length > ROW_CAP;

    const rows = capped.map((rec) => {
      const obj: Record<string, unknown> = {};
      for (const k of rec.keys as string[]) obj[k] = coerce(rec.get(k));
      return obj;
    });

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return { rows, ms, truncated, columns };
  } finally {
    await session.close();
  }
}

async function simulateWrite(task: TaskDefinition): Promise<{
  rows: Record<string, unknown>[];
  ms: number;
  columns: string[];
  simulatedFrom: Record<string, unknown> | null;
  artistFound: boolean;
}> {
  const driver = getDriver();
  const database = process.env.NEO4J_DATABASE ?? "neo4j";
  const session = driver.session({ database, defaultAccessMode: "READ" });

  try {
    const started = performance.now();

    let simulatedFrom: Record<string, unknown> | null = null;
    let artistFound = false;

    if (task.simulatedQuery) {
      const probe = await session.executeRead((tx) =>
        tx.run(task.simulatedQuery as string, {})
      );
      if (probe.records.length > 0) {
        const rec = probe.records[0];
        const obj: Record<string, unknown> = {};
        for (const k of rec.keys as string[]) obj[k] = coerce(rec.get(k));
        simulatedFrom = obj;
        artistFound = true;
      }
    }

    const ms = Math.round(performance.now() - started);

    const simulatedRow = task.simulatedRow ?? { simulated: true };
    const rows = artistFound ? [simulatedRow] : [];
    const columns = Object.keys(simulatedRow);

    return { rows, ms, columns, simulatedFrom, artistFound };
  } finally {
    await session.close();
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body must be { id: 1..7 }." },
      { status: 400 }
    );
  }

  const task = getTask(parsed.data.id);
  if (!task) {
    return NextResponse.json({ error: "Unknown task id." }, { status: 404 });
  }

  try {
    if (task.kind === "write") {
      const sim = await simulateWrite(task);
      return NextResponse.json({
        id: task.id,
        title: task.title,
        kind: task.kind,
        query: task.query,
        simulated: true,
        simulatedQuery: task.simulatedQuery ?? null,
        simulatedFrom: sim.simulatedFrom,
        artistFound: sim.artistFound,
        rows: sim.rows,
        columns: sim.columns,
        ms: sim.ms,
        truncated: false,
        note: sim.artistFound
          ? "Simulated update — the cloud graph was NOT modified. This is the row the SET would have produced."
          : "Simulated update — 'Jason Mraz' was not found in the cloud graph, so nothing would change.",
      });
    }

    const res = await runRead(task);
    return NextResponse.json({
      id: task.id,
      title: task.title,
      kind: task.kind,
      query: task.query,
      simulated: false,
      rows: res.rows,
      columns: res.columns,
      ms: res.ms,
      truncated: res.truncated,
      note: null,
    });
  } catch (e: unknown) {
    const msg = (e as Error)?.message ?? "Execution failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
