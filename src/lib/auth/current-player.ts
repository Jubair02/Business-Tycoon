import { db } from '@/lib/db';
import { resolveSession } from './user-session';

/**
 * Resolve the signed-in player for use in server components.
 *
 * Returns null when there is no account session, it has expired, or the save it
 * points at no longer exists (e.g. the database was reset underneath an old
 * cookie). Route guards use this to decide between the sign-in screen and the
 * game, so the check is made on the server before any game screen renders.
 */
export async function getCurrentPlayer() {
  const session = await resolveSession();
  if (!session?.playerId) return null;

  return db.player.findUnique({
    where: { id: session.playerId },
    select: { id: true, name: true, avatar: true },
  });
}
