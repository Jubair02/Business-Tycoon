import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentGameDay } from '@/lib/game/seasons/seasons';
import { BUSINESS_TYPES } from '@/lib/game-data';
import { requirePlayerId, notFound, insufficientFunds, conflict, validationError, handleApiError, createBusinessSchema } from '@/lib/errors';
import {
  EXPANSION_CONFIG,
  buildStartingInventory,
  calculateExpansionCost,
  calculateSetupDays,
  checkExpansionEligibility,
} from '@/lib/game/expansion';
import { awardExperience, PROGRESSION_CONFIG } from '@/lib/game/progression';

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
        // Two fields per shelf, not the whole inventory: the dashboard's
        // first-week guide needs to tell a stocked shop from an empty one, and
        // a price the owner set from the default markup. `_count` alone cannot
        // answer either — it counts rows, including rows holding nothing.
        inventories: {
          select: { quantity: true, priceEdited: true },
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

    const { type, city, name, location } = createBusinessSchema.parse(await request.json());

    const businessType = BUSINESS_TYPES.find((b) => b.id === type);
    if (!businessType) {
      return NextResponse.json({ error: 'Invalid business type' }, { status: 400 });
    }

    // Read outside the transaction: the season clock is not part of this
    // write, and reading it inside only lengthens the transaction.
    const currentGameDay = await getCurrentGameDay();

    const business = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: playerId } });
      if (!player) {
        throw notFound('Player');
      }

      // Phase 5: Expansion eligibility checks
      const currentBusinessCount = await tx.business.count({ where: { playerId } });

      // Check max businesses
      if (currentBusinessCount >= EXPANSION_CONFIG.maxBusinessesPerPlayer) {
        throw conflict(`Maximum ${EXPANSION_CONFIG.maxBusinessesPerPlayer} businesses reached`);
      }

      // Check expansion cooldown
      if (player.lastExpansionAt > 0) {
        const gameDay = currentGameDay;
        const daysSince = gameDay - player.lastExpansionAt;
        if (daysSince < EXPANSION_CONFIG.expansionCooldownDays) {
          throw conflict(`Expansion cooldown: ${EXPANSION_CONFIG.expansionCooldownDays - daysSince} days remaining`);
        }
      }

      // Check level requirement
      const requiredLevel = currentBusinessCount === 0
        ? 1
        : currentBusinessCount === 1
          ? EXPANSION_CONFIG.minLevelForSecondBusiness
          : EXPANSION_CONFIG.minLevelForSecondBusiness + (currentBusinessCount - 1) * EXPANSION_CONFIG.minLevelPerAdditionalBusiness;
      if (player.level < requiredLevel) {
        throw validationError(`Level ${requiredLevel} required for business #${currentBusinessCount + 1}`);
      }

      // Opening stock is priced into costInfo.totalCost below, so it is
      // resolved here and written from the same numbers that were charged.
      const startingInventory = buildStartingInventory(type);

      // Phase 5: Calculate expansion cost with scaling (includes opening stock)
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
        throw validationError(`Need ৳${Math.round(minReserve).toLocaleString()} cash reserve after expansion`);
      }

      // Phase 5: Calculate setup days
      const setupDays = currentBusinessCount === 0 ? 0 : calculateSetupDays(businessType.investment);

      await tx.player.update({
        where: { id: playerId },
        data: {
          cash: { decrement: costInfo.totalCost },
          expansionCount: { increment: 1 },
          lastExpansionAt: currentGameDay,
        },
      });

      const created = await tx.business.create({
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

      // Opening stock. Created inside the same transaction as the payment:
      // it is part of what `costInfo.totalCost` charged for, so a failure here
      // must not leave a paid-for business standing empty.
      if (startingInventory.items.length > 0) {
        // The real Product id, not an empty string.
        //
        // `productId` was hardcoded to '' here, and `POST /inventory/buy`
        // matches an existing shelf on exactly that column. So the first time a
        // player restocked anything they opened with, the lookup missed and a
        // SECOND row was created for the same product — which the tick then
        // treats as a second shelf, drawing its own demand and holding its own
        // price. Found by the end-to-end journey test; no unit test could see
        // it, because the bug lives in the seam between two routes.
        const productRows = await tx.product.findMany({
          where: { name: { in: startingInventory.items.map(item => item.productName) } },
          select: { id: true, name: true },
        });
        const productIdByName = new Map(productRows.map(row => [row.name, row.id]));

        await tx.inventory.createMany({
          data: startingInventory.items.map((item) => ({
            businessId: created.id,
            productId: productIdByName.get(item.productName) ?? '',
            productName: item.productName,
            category: item.category,
            quantity: item.quantity,
            purchasePrice: item.purchasePrice,
            sellPrice: item.sellPrice,
          })),
        });
      }

      // Phase 6: opening a business is a progression milestone.
      await awardExperience(
        tx,
        playerId,
        PROGRESSION_CONFIG.newBusinessXp,
        'NEW_BUSINESS',
        created.id,
      );

      return created;
    });

    return NextResponse.json(business, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
