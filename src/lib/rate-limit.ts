// ============================================
// Bangladesh Business Tycoon - Rate Limiting
// ============================================
//
// In-memory fixed-window limiter. This is per-process, so it does not hold
// across a multi-instance deployment — it exists to stop trivial abuse of the
// routes that create rows or advance global state. A shared store (Redis) would
// be needed for a real multi-instance deployment.

import type { NextRequest } from 'next/server';
import { AppError } from './errors/AppError';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/** Drop expired buckets so the map does not grow without bound. */
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Best-effort client identity. Behind a proxy this relies on x-forwarded-for,
 * which a client can spoof — it is a speed bump, not an authorization control.
 */
export function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

/**
 * Consume one unit from the caller's bucket.
 * Throws AppError(RATE_LIMITED) when the window budget is exhausted.
 */
export function enforceRateLimit(
  request: NextRequest,
  scope: string,
  { limit, windowMs }: RateLimitOptions
): void {
  const now = Date.now();
  sweep(now);

  const key = `${scope}:${clientKey(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const retryInSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw new AppError('RATE_LIMITED', `Too many requests. Try again in ${retryInSeconds}s.`);
  }
}

/** Test/reset helper. */
export function resetRateLimits(): void {
  buckets.clear();
}
