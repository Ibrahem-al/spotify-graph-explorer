import { NextResponse } from "next/server";
import { z } from "zod";
import { getDriver } from "@/lib/neo4j";
import { getTask } from "@/lib/assignment/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  id: z.number().int().min(1).max(7),
  runs: z.number().int().min(1).max(20).optional(),
});

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
      { error: "Body must be { id: 1..7, runs?: 1..20 }." },
      { status: 400 }
    );
  }

  const task = getTask(parsed.data.id);
  if (!task) {
    return NextResponse.json({ error: "Unknown task id." }, { status: 404 });
  }

  const runs = parsed.data.runs ?? 10;

  // For write tasks we never execute the SET. We time the simulated read
  // equivalent so the cloud graph is left untouched.
  const queryToTime = task.kind === "write"
    ? (task.simulatedQuery as string)
    : task.query;

  const driver = getDriver();
  const database = process.env.NEO4J_DATABASE ?? "neo4j";
  // No access-mode restriction so we can call db.clearQueryCaches() (a write op)
  // between timed runs while still using executeRead for the queries themselves.
  const session = driver.session({ database });

  try {
    const times: number[] = [];
    for (let i = 0; i < runs; i++) {
      // Clear the Neo4j query-plan cache before each run so every execution
      // starts cold — no reused compiled plan.
      try {
        await session.executeWrite((tx) => tx.run("CALL db.clearQueryCaches()"));
      } catch { /* silently ignore on restricted editions */ }

      const start = performance.now();
      await session.executeRead((tx) => tx.run(queryToTime, {}));
      const end = performance.now();
      times.push(Math.round((end - start) * 1000) / 1000);
    }

    const sum = times.reduce((a, b) => a + b, 0);
    const avg = sum / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    return NextResponse.json({
      id: task.id,
      title: task.title,
      kind: task.kind,
      simulated: task.kind === "write",
      runs,
      times,
      avgMs: Math.round(avg * 1000) / 1000,
      minMs: min,
      maxMs: max,
      queryTimed: queryToTime,
      note:
        task.kind === "write"
          ? "Simulated timing — the MATCH-only read equivalent was timed so the cloud graph is never modified."
          : null,
    });
  } catch (e: unknown) {
    const msg = (e as Error)?.message ?? "Timing run failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await session.close();
  }
}
