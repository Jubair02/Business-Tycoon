import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { BUSINESS_TYPES } from '@/lib/game-data';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get('playerId')?.value;

    if (!playerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;

    const business = await db.business.findUnique({
      where: { id },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (business.playerId !== playerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const businessType = BUSINESS_TYPES.find((b) => b.id === business.type);
    if (!businessType) {
      return NextResponse.json({ error: 'Invalid business type' }, { status: 400 });
    }

    const upgradeCost = Math.round(businessType.investment * business.level * 0.5);

    const player = await db.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    if (player.cash < upgradeCost) {
      return NextResponse.json(
        { error: `Insufficient cash. Need ৳${upgradeCost.toLocaleString()}, have ৳${player.cash.toLocaleString()}` },
        { status: 400 }
      );
    }

    const newLevel = business.level + 1;
    const newReputation = Math.min(100, business.reputation + 5);

    const updated = await db.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: playerId },
        data: { cash: { decrement: upgradeCost } },
      });

      return tx.business.update({
        where: { id },
        data: {
          level: newLevel,
          reputation: newReputation,
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Upgrade business error:', error);
    return NextResponse.json(
      { error: 'Failed to upgrade business' },
      { status: 500 }
    );
  }
}
