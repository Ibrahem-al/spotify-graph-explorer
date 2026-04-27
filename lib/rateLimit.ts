import { NextResponse } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

interface LimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

function makeLimiter(max: number, windowMs: number) {
  const store = new Map<string, Bucket>();
  return (ip: string): LimitResult => {
    const now = Date.now();
    let b = store.get(ip);
    if (!b || now >= b.resetAt) {
      b = { count: 1, resetAt: now + windowMs };
      store.set(ip, b);
      return { allowed: true, remaining: max - 1, limit: max, resetAt: b.resetAt };
    }
    if (b.count >= max) {
      return { allowed: false, remaining: 0, limit: max, resetAt: b.resetAt };
    }
    b.count++;
    return { allowed: true, remaining: max - b.count, limit: max, resetAt: b.resetAt };
  };
}

// Hard ceiling across all endpoints — stops total flooding from one IP
const globalLimiter = makeLimiter(300, 60_000);

// Per-endpoint limiters — tuned to how expensive each endpoint is
const endpointLimiters = {
  query:      makeLimiter(30,  60_000), // LLM + Neo4j
  task:       makeLimiter(60,  60_000), // single Neo4j read
  timing:     makeLimiter(5,   60_000), // up to 20 Neo4j queries + cache clears per call
  clean:      makeLimiter(5,   60_000), // spawns a Python subprocess
  csvPreview: makeLimiter(120, 60_000), // static file read
  health:     makeLimiter(30,  60_000), // DB ping
  recommend:  makeLimiter(10,  60_000), // multiple Spotify API calls + Neo4j query
} as const;

export type EndpointKey = keyof typeof endpointLimiters;

function make429(result: LimitResult): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests.",
        hint: "Wait a moment and try again.",
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    }
  );
}

/**
 * Returns null if the request is allowed, or a 429 NextResponse if rate limited.
 * Checks the global hard cap first, then the per-endpoint limit.
 */
export function checkRateLimit(endpoint: EndpointKey, ip: string): NextResponse | null {
  const global = globalLimiter(ip);
  if (!global.allowed) return make429(global);

  const local = endpointLimiters[endpoint](ip);
  if (!local.allowed) return make429(local);

  return null;
}

export function getIP(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
}

// Kept for backward compatibility — used by /api/query
export function checkRate(ip: string): boolean {
  return checkRateLimit("query", ip) === null;
}
