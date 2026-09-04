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

    const updated = await db.$transaction(async (tx) => {
      // Re-read business level inside transaction to prevent race conditions
      const currentBusiness = await tx.business.findUnique({ where: { id } });
      if (!currentBusiness) {
        throw new Error('Business not found');
      }

      if (currentBusiness.level >= 10) {
        throw new Error('Business has reached maximum level (10)');
      }

      const upgradeCost = Math.round(businessType.investment * currentBusiness.level * 0.5);

      const player = await tx.player.findUnique({ where: { id: playerId } });
      if (!player) {
        throw new Error('Player not found');
      }

      if (player.cash < upgradeCost) {
        throw new Error(`Insufficient cash. Need ৳${upgradeCost.toLocaleString()}, have ৳${player.cash.toLocaleString()}`);
      }

      const newLevel = currentBusiness.level + 1;
      const newReputation = Math.min(100, currentBusiness.reputation + 5);

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
    if (error instanceof Error) {
      if (error.message === 'Business not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message === 'Player not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.startsWith('Insufficient cash') || error.message.startsWith('Business has reached')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    console.error('Upgrade business error:', error);
    return NextResponse.json(
      { error: 'Failed to upgrade business' },
      { status: 500 }
    );
  }
}
