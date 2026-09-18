import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { STARTING_CASH } from '@/lib/game-data';
import { requirePlayerId, notFound, handleApiError } from '@/lib/errors';

export async function POST() {
  try {
    const playerId = await requirePlayerId();

    // Verify player exists
    const player = await db.player.findUnique({ where: { id: playerId } });
    if (!player) {
      throw notFound('Player');
    }

    // Delete all player data in transaction
    await db.$transaction(async (tx) => {
      // Delete game logs
      await tx.gameLog.deleteMany({ where: { playerId } });

      // Delete loans
      await tx.loan.deleteMany({ where: { playerId } });

      // Delete employees (through businesses)
      const businesses = await tx.business.findMany({
        where: { playerId },
        select: { id: true },
      });
      const bizIds = businesses.map((b) => b.id);

      if (bizIds.length > 0) {
        await tx.employee.deleteMany({
          where: { businessId: { in: bizIds } },
        });
        await tx.inventory.deleteMany({
          where: { businessId: { in: bizIds } },
        });
        await tx.business.deleteMany({
          where: { id: { in: bizIds } },
        });
      }

      // Reset player stats.
      // expansionCount/lastExpansionAt must be cleared too: leaving them set
      // left the player with zero businesses but still inside the expansion
      // cooldown, which made it impossible to create a business after a reset.
      await tx.player.update({
        where: { id: playerId },
        data: {
          cash: STARTING_CASH,
          netWorth: STARTING_CASH,
          level: 1,
          experience: 0,
          expansionCount: 0,
          lastExpansionAt: 0,
          lastAction: null,
          lastActionAt: 0,
        },
      });
    });

    // Clear tutorial flag from localStorage by returning a signal
    return NextResponse.json({ success: true, message: 'Game reset successfully' });
  } catch (error) {
    return handleApiError(error);
  }
}
