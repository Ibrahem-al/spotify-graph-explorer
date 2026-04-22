/**
 * In-memory per-IP token bucket rate limiter.
 * 30 requests per 60-second window.
 * Note: resets per Vercel serverless function instance — acceptable for v1.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRate(ip: string): boolean {
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 1, resetAt: now + WINDOW_MS };
    buckets.set(ip, bucket);
    return true;
  }

  if (bucket.count >= MAX_REQUESTS) {
    return false;
  }

  bucket.count++;
  return true;
}
