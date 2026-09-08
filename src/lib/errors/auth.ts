// ============================================
// Bangladesh Business Tycoon - Auth Helper
// Phase 0: DRY cookie-based authentication for API routes
// ============================================

import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { unauthorized } from './AppError';

/**
 * Get the authenticated player ID from the cookie.
 * Throws AppError(UNAUTHORIZED) if no valid cookie.
 */
export async function requirePlayerId(): Promise<string> {
  const cookieStore = await cookies();
  const playerId = cookieStore.get('playerId')?.value;

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

/**
 * Get the player ID from the cookie, or null if not authenticated.
 * Does NOT throw — useful for optional auth.
 */
export async function getOptionalPlayerId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('playerId')?.value ?? null;
}
