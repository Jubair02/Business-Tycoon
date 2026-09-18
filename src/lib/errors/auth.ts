// ============================================
// Bangladesh Business Tycoon - Auth Helper
// Cookie-based authentication for API routes, backed by account sessions
// ============================================

import { db } from '@/lib/db';
import { resolveSession } from '@/lib/auth/user-session';
import { unauthorized } from './AppError';

/**
 * Resolve the player id behind the current request's account session.
 * Returns null when there is no session cookie, the session has expired, or the
 * account has no save attached yet.
 */
export async function getOptionalPlayerId(): Promise<string | null> {
  const session = await resolveSession();
  return session?.playerId ?? null;
}

/**
 * Get the authenticated player ID from the cookie.
 * Throws AppError(UNAUTHORIZED) if no valid cookie.
 */
export async function requirePlayerId(): Promise<string> {
  const playerId = await getOptionalPlayerId();

  if (!playerId) {
    throw unauthorized();
  }

  return playerId;
}

/**
 * Get the authenticated player from the cookie, with full player data.
 * Throws AppError(UNAUTHORIZED) if no cookie or player not found.
 */
export async function requirePlayer() {
  const playerId = await requirePlayerId();

  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) {
    throw unauthorized('Player not found');
  }

  return player;
}
