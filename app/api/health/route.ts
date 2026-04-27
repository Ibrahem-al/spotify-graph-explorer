import { NextResponse } from "next/server";
import { verifyConnectivity } from "@/lib/neo4j";
import { checkRateLimit, getIP } from "@/lib/rateLimit";

export async function GET(req: Request) {
  const limited = checkRateLimit("health", getIP(req));
  if (limited) return limited;

  const connected = await verifyConnectivity();
  if (!connected) {
    return NextResponse.json({ ok: false, reason: "Neo4j unreachable" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
