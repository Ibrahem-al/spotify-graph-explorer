import { NextResponse } from "next/server";
import { verifyConnectivity } from "@/lib/neo4j";

export async function GET() {
  const connected = await verifyConnectivity();
  if (!connected) {
    return NextResponse.json({ ok: false, reason: "Neo4j unreachable" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
