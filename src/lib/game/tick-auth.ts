// ============================================
// Bangladesh Business Tycoon - Tick Endpoint Auth
// ============================================
//
// `/api/game/tick` advances the clock for every player and every AI, so it is
// not a player-facing action. It used to require only a session, which meant
// any signed-in player could fast-forward the shared world by looping it.
//
// It is now a service entrypoint: the in-process scheduler calls `gameTick()`
// directly, and this endpoint exists for an external cron that authenticates
// with a shared secret.

import { createHash, timingSafeEqual } from 'crypto';

export type TickAuthResult =
  | { authorized: true; via: 'secret' | 'development' }
  | { authorized: false; reason: string };

/** Constant-time compare of two secrets of any length. */
function secretsMatch(a: string, b: string): boolean {
  // Hash first so the comparison operates on equal-length buffers; comparing
  // raw strings of different lengths would leak the length via the early exit.
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Extract the presented secret from either header form.
 * `Authorization: Bearer <secret>` suits most cron runners; `x-cron-secret`
 * suits the ones that cannot set an Authorization header.
 */
function presentedSecret(headers: Headers): string | null {
  const auth = headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  const direct = headers.get('x-cron-secret');
  return direct?.trim() || null;
}

/**
 * Decide whether a request may run a tick.
 *
 * With `CRON_SECRET` set, the secret must match. Without it, the endpoint is
 * refused in production — an unauthenticated global mutation is not something
 * to leave open by default — but allowed in development so the route stays
 * usable locally without ceremony.
 */
export function authorizeTickRequest(
  headers: Headers,
  env: { CRON_SECRET?: string; NODE_ENV?: string } = process.env,
): TickAuthResult {
  const expected = env.CRON_SECRET?.trim();

  if (!expected) {
    if (env.NODE_ENV === 'production') {
      return {
        authorized: false,
        reason:
          'CRON_SECRET is not configured, so this endpoint is closed. ' +
          'The in-process scheduler advances the game without it.',
      };
    }
    return { authorized: true, via: 'development' };
  }

  const presented = presentedSecret(headers);
  if (!presented) {
    return { authorized: false, reason: 'Missing tick credentials.' };
  }

  if (!secretsMatch(presented, expected)) {
    return { authorized: false, reason: 'Invalid tick credentials.' };
  }

  return { authorized: true, via: 'secret' };
}
