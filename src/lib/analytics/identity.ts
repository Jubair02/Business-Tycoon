// ============================================
// Bangladesh Business Tycoon - Analytics Identity
// ============================================
//
// Who fired an event. Server-side, because the answer must not be something the
// browser can assert: `userId` comes from the session cookie, never from the
// request body.
//
// The anonymous id exists for one reason — the onboarding funnel starts before
// sign-up, so the first step has no account to attach to. It is a random opaque
// id in a first-party cookie, it carries no personal data, and it stops mattering
// the moment a session exists.

import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { resolveSession } from '@/lib/auth/user-session';
import { db } from '@/lib/db';
import { ANONYMOUS_ID_COOKIE, ANALYTICS_CONFIG } from './config';
import { track, trackOnce, type TrackContext, type EventProps } from './track';
import type { EventName } from './events';

export const ANONYMOUS_ID_COOKIE_OPTIONS = {
  // Readable by script so the client can label its own events without a round
  // trip. It is an opaque random string with nothing to steal.
  httpOnly: false,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * ANALYTICS_CONFIG.anonymousIdDays,
  path: '/',
};

export function newAnonymousId(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * An id supplied by a browser is untrusted, so it is accepted only if it looks
 * like one we issued. Anything else gets replaced rather than stored — an
 * attacker-chosen id could otherwise be used to write into someone's row, and a
 * long one could be used as free storage.
 */
export function isPlausibleAnonymousId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value);
}

/**
 * The analytics context for the current request.
 *
 * Reads only. Setting the cookie needs a response object, so a route that wants
 * to issue one uses the `anonymousId` returned here together with
 * `ANONYMOUS_ID_COOKIE_OPTIONS`.
 */
export async function resolveAnalyticsContext(): Promise<TrackContext & { isNewAnonymous: boolean }> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(ANONYMOUS_ID_COOKIE)?.value;
  const valid = isPlausibleAnonymousId(existing);

  const anonymousId = valid ? existing : newAnonymousId();

  let userId: string | null = null;
  let seasonId: string | null = null;

  try {
    const session = await resolveSession();
    userId = session?.userId ?? null;

    if (session?.playerId) {
      const player = await db.player.findUnique({
        where: { id: session.playerId },
        select: { seasonId: true },
      });
      seasonId = player?.seasonId ?? null;
    }
  } catch {
    // Analytics never fails a request. An unresolvable session just means the
    // event is recorded anonymously.
  }

  return { userId, anonymousId, seasonId, isNewAnonymous: !valid };
}

/**
 * Just the anonymous id, for the one place that needs it before a session
 * exists: sign-up. That event carries both ids, and it is the only thing
 * connecting the pre-signup half of the funnel to the post-signup half.
 */
export async function anonymousIdFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const value = cookieStore.get(ANONYMOUS_ID_COOKIE)?.value;
    return isPlausibleAnonymousId(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Record an event from a route handler, resolving who did it from the session.
 *
 * Fire-and-forget: call sites use `void trackServer(...)` so an analytics write
 * is never on the critical path of a player's action.
 */
export async function trackServer(name: EventName, props?: EventProps): Promise<void> {
  try {
    const context = await resolveAnalyticsContext();
    await track(name, context, props);
  } catch (error) {
    console.error(`[analytics] trackServer ${name} failed:`, error);
  }
}

/** As `trackServer`, but only the first time it happens for this account. */
export async function trackServerOnce(name: EventName, props?: EventProps): Promise<void> {
  try {
    const context = await resolveAnalyticsContext();
    await trackOnce(name, context, props);
  } catch (error) {
    console.error(`[analytics] trackServerOnce ${name} failed:`, error);
  }
}
