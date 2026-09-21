import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { BUSINESS_TYPES } from '@/lib/game-data';
import { requirePlayerId, notFound, forbidden, insufficientFunds, validationError, handleApiError } from '@/lib/errors';
import { awardExperience, calculateUpgradeXp } from '@/lib/game/progression';
import { trackServer } from '@/lib/analytics/identity';
import { EVENTS } from '@/lib/analytics/events';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const playerId = await requirePlayerId();

    const { id } = await params;

    const business = await db.business.findUnique({
      where: { id },
    });

    if (!business) {
      throw notFound('Business');
    }

    if (business.playerId !== playerId) {
      throw forbidden();
    }

    const businessType = BUSINESS_TYPES.find((b) => b.id === business.type);
    if (!businessType) {
      throw validationError('Invalid business type');
    }

    const updated = await db.$transaction(async (tx) => {
      // Re-read business level inside transaction to prevent race conditions
      const currentBusiness = await tx.business.findUnique({ where: { id } });
      if (!currentBusiness) {
        throw notFound('Business');
      }

      if (currentBusiness.level >= 10) {
        throw validationError('Business has reached maximum level (10)');
      }

      const upgradeCost = Math.round(businessType.investment * currentBusiness.level * 0.5);

      const player = await tx.player.findUnique({ where: { id: playerId } });
      if (!player) {
        throw notFound('Player');
      }

      if (player.cash < upgradeCost) {
        throw insufficientFunds(upgradeCost, player.cash);
      }

      const newLevel = currentBusiness.level + 1;
      const newReputation = Math.min(100, currentBusiness.reputation + 5);

      await tx.player.update({
        where: { id: playerId },
        data: { cash: { decrement: upgradeCost } },
      });

      const upgraded = await tx.business.update({
        where: { id },
        data: {
          level: newLevel,
          reputation: newReputation,
        },
      });

      // Phase 6: upgrades award XP scaled by the level reached.
      await awardExperience(
        tx,
        playerId,
        calculateUpgradeXp(newLevel),
        'BUSINESS_UPGRADE',
        id,
      );

      return upgraded;
    });

    void trackServer(EVENTS.BUSINESS_UPGRADED, { level: updated.level });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
