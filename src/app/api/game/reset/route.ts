import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { STARTING_CASH } from '@/lib/game-data';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get('playerId')?.value;

    if (!playerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Verify player exists
    const player = await db.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
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

      // Reset player stats
      await tx.player.update({
        where: { id: playerId },
        data: {
          cash: STARTING_CASH,
          netWorth: STARTING_CASH,
          level: 1,
          experience: 0,
        },
      });
    });

    // Clear tutorial flag from localStorage by returning a signal
    return NextResponse.json({ success: true, message: 'Game reset successfully' });
  } catch (error) {
    console.error('Reset game error:', error);
    return NextResponse.json(
      { error: 'Failed to reset game' },
      { status: 500 }
    );
  }
}
