// ============================================
// Bangladesh Business Tycoon - Account Sessions
// ============================================
//
// Reading, creating and revoking the server-side sessions that back the
// `bt_session` cookie. Everything that needs to know "who is this request?"
// goes through `resolveSession()`.

import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  AUTH_COOKIE,
  AUTH_COOKIE_OPTIONS,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  sessionIdFromToken,
} from './session';

export interface ResolvedSession {
  sessionId: string;
  userId: string;
  /** The save game for this account. Null only in the window before one exists. */
  playerId: string | null;
}

/** Sessions are extended once they are more than halfway through their life. */
const REFRESH_AFTER_MS = (SESSION_MAX_AGE_SECONDS * 1000) / 2;

function expiryFromNow(): Date {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
}

/**
 * Create a session row for a user and return the raw cookie token.
 * The caller is responsible for setting `AUTH_COOKIE` on its response.
 */
export async function createSession(userId: string, userAgent?: string | null): Promise<string> {
  const { token, id } = createSessionToken();

  await db.authSession.create({
    data: {
      id,
      userId,
      expiresAt: expiryFromNow(),
      userAgent: userAgent?.slice(0, 255) ?? null,
    },
  });

  return token;
}

/**
 * Resolve the session behind the current request.
 *
 * Returns null when the cookie is absent, unknown, or expired. Expired rows are
 * deleted on sight so the table does not accumulate dead sessions.
 */
export async function resolveSession(): Promise<ResolvedSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const sessionId = sessionIdFromToken(token);
  const session = await db.authSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      // The save for the *active* season. An account that has played three
      // seasons has three player rows; only the current one is playable, and
      // the others are read-only archive.
      user: {
        select: {
          players: {
            where: { season: { status: 'ACTIVE' } },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.authSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Sliding expiry: an active player never gets signed out mid-game.
  if (session.expiresAt.getTime() - Date.now() < REFRESH_AFTER_MS) {
    await db.authSession
      .update({
        where: { id: session.id },
        data: { expiresAt: expiryFromNow(), lastUsedAt: new Date() },
      })
      .catch(() => {});
  }

  return {
    sessionId: session.id,
    userId: session.userId,
    playerId: session.user.players[0]?.id ?? null,
  };
}

/** Revoke the session behind the current request, if any. */
export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return;

  await db.authSession
    .delete({ where: { id: sessionIdFromToken(token) } })
    .catch(() => {
      // Already gone (expired sweep, or signed out in another tab).
    });
}

/** Revoke every session for a user — used when a password changes. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await db.authSession.deleteMany({ where: { userId } });
}

/**
 * Put a freshly minted session on a response.
 *
 * The pre-accounts `playerId` cookie is expired at the same time: its save has
 * just been adopted by this account (or was never claimable), and leaving it in
 * the browser would only confuse a later sign-in.
 */
export function attachSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(AUTH_COOKIE, token, AUTH_COOKIE_OPTIONS);
  response.cookies.set(SESSION_COOKIE, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}

/** Expire the session cookie on a response (sign-out). */
export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_COOKIE, '', { ...AUTH_COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
