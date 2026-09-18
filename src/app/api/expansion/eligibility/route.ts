import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentGameDay } from '@/lib/game/seasons/seasons';
import { BUSINESS_TYPES } from '@/lib/game-data';
import { requirePlayerId, handleApiError } from '@/lib/errors';
import { EXPANSION_CONFIG, calculateExpansionCost, checkExpansionEligibility, getLocationsForCity } from '@/lib/game/expansion';

/**
 * GET /api/expansion/eligibility
 * Returns expansion eligibility info for the player.
 */
export async function GET() {
  try {
    const playerId = await requirePlayerId();

    const [player, businesses, gameDayState] = await Promise.all([
      db.player.findUnique({
        where: { id: playerId },
        select: { cash: true, netWorth: true, level: true, expansionCount: true, lastExpansionAt: true },
      }),
      db.business.findMany({
        where: { playerId },
        select: { id: true, type: true, dailyProfit: true },
      }),
      getCurrentGameDay(),
    ]);

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const gameDay = gameDayState;
    const currentBusinessCount = businesses.length;

    // Calculate eligibility for each business type
    const expansionOptions = BUSINESS_TYPES.map(bType => {
      const costInfo = calculateExpansionCost(bType.investment, currentBusinessCount, '', bType.id);
      const eligibility = checkExpansionEligibility(
        player.cash,
        player.netWorth,
        player.level,
        currentBusinessCount,
        player.lastExpansionAt,
        gameDay,
        businesses.map(b => b.dailyProfit),
        costInfo.totalCost,
      );

      return {
        businessType: bType.id,
        businessName: bType.name,
        icon: bType.icon,
        cost: costInfo,
        eligibility,
      };
    });

    // Get locations grouped by city
    const locationsByCity: Record<string, ReturnType<typeof getLocationsForCity>> = {};
    for (const cityId of ['DHAKA', 'CHITTAGONG', 'SYLHET', 'RAJSHAHI', 'KHULNA']) {
      locationsByCity[cityId] = getLocationsForCity(cityId);
    }

    return NextResponse.json({
      currentBusinessCount,
      maxBusinesses: EXPANSION_CONFIG.maxBusinessesPerPlayer,
      expansionCooldownDays: EXPANSION_CONFIG.expansionCooldownDays,
      daysSinceLastExpansion: gameDay - player.lastExpansionAt,
      playerLevel: player.level,
      expansionOptions,
      locationsByCity,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
