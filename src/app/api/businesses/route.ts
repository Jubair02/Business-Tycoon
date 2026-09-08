import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { BUSINESS_TYPES, PRODUCTS } from '@/lib/game-data';
import { requirePlayerId, notFound, insufficientFunds, handleApiError, createBusinessSchema } from '@/lib/errors';
import {
  EXPANSION_CONFIG,
  calculateExpansionCost,
  calculateSetupDays,
  checkExpansionEligibility,
} from '@/lib/game/expansion';

export async function GET() {
  try {
    const playerId = await requirePlayerId();

    const businesses = await db.business.findMany({
      where: { playerId },
      include: {
        _count: {
          select: {
            inventories: true,
            employees: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(businesses);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const playerId = await requirePlayerId();

    const body = createBusinessSchema.parse(await request.json());
    const { type, city, name } = body;
    // Phase 5: Optional location field
    const location = (body as Record<string, unknown>).location as string | undefined;

    const businessType = BUSINESS_TYPES.find((b) => b.id === type);
    if (!businessType) {
      return NextResponse.json({ error: 'Invalid business type' }, { status: 400 });
    }

    const business = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: playerId } });
      if (!player) {
        throw notFound('Player');
      }

      // Phase 5: Expansion eligibility checks
      const currentBusinessCount = await tx.business.count({ where: { playerId } });

      // Check max businesses
      if (currentBusinessCount >= EXPANSION_CONFIG.maxBusinessesPerPlayer) {
        throw new Error(`Maximum ${EXPANSION_CONFIG.maxBusinessesPerPlayer} businesses reached`);
      }

      // Check expansion cooldown
      const daysSinceExpansion = 0; // We'd need gameDay from GameState for exact check
      if (player.lastExpansionAt > 0) {
        // Get current game day for cooldown check
        const gameDayState = await tx.gameState.findUnique({ where: { key: 'gameDay' } });
        const gameDay = parseInt(gameDayState?.value || '1', 10);
        const daysSince = gameDay - player.lastExpansionAt;
        if (daysSince < EXPANSION_CONFIG.expansionCooldownDays) {
          throw new Error(`Expansion cooldown: ${EXPANSION_CONFIG.expansionCooldownDays - daysSince} days remaining`);
        }
      }

      // Check level requirement
      const requiredLevel = currentBusinessCount === 0
        ? 1
        : currentBusinessCount === 1
          ? EXPANSION_CONFIG.minLevelForSecondBusiness
          : EXPANSION_CONFIG.minLevelForSecondBusiness + (currentBusinessCount - 1) * EXPANSION_CONFIG.minLevelPerAdditionalBusiness;
      if (player.level < requiredLevel) {
        throw new Error(`Level ${requiredLevel} required for business #${currentBusinessCount + 1}`);
      }

      // Phase 5: Calculate expansion cost with scaling
      const costInfo = calculateExpansionCost(
        businessType.investment,
        currentBusinessCount,
        location || '',
        type,
      );

      // Check affordability
      if (player.cash < costInfo.totalCost) {
        throw insufficientFunds(costInfo.totalCost, player.cash);
      }

      // Phase 5: Check cash reserve after expansion
      const cashAfterExpansion = player.cash - costInfo.totalCost;
      const minReserve = player.netWorth * EXPANSION_CONFIG.minCashReserveRatio;
      if (cashAfterExpansion < minReserve) {
        throw new Error(`Need ৳${Math.round(minReserve).toLocaleString()} cash reserve after expansion`);
      }

      // Phase 5: Calculate setup days
      const setupDays = currentBusinessCount === 0 ? 0 : calculateSetupDays(businessType.investment);

      // Phase 5: Get game day for lastExpansionAt
      const gameDayState2 = await tx.gameState.findUnique({ where: { key: 'gameDay' } });
      const currentGameDay = parseInt(gameDayState2?.value || '1', 10);

      await tx.player.update({
        where: { id: playerId },
        data: {
          cash: { decrement: costInfo.totalCost },
          expansionCount: { increment: 1 },
          lastExpansionAt: currentGameDay,
        },
      });

      return tx.business.create({
        data: {
          playerId,
          type,
          city,
          name,
          level: 1,
          reputation: 50,
          // Phase 5: Expansion fields
          location: location || null,
          setupDaysRemaining: setupDays,
        },
      });
    });

    // Phase 5: Create initial inventory for the new business (was missing before)
    if (business) {
      const productDefs = PRODUCTS[type] || [];
      for (const prod of productDefs) {
        const initialStock = Math.floor(prod.maxStock * 0.4);
        await db.inventory.create({
          data: {
            businessId: business.id,
            productId: '',
            productName: prod.name,
            category: prod.category,
            quantity: initialStock,
            purchasePrice: prod.basePrice,
            sellPrice: Math.round(prod.basePrice * (1 + prod.suggestedMarkup)),
          },
        });
      }
    }

    return NextResponse.json(business, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
