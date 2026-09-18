import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentGameDay } from '@/lib/game/seasons/seasons';
import { requirePlayerId, handleApiError } from '@/lib/errors';
import { calculatePortfolioSummary } from '@/lib/game/expansion';

/**
 * GET /api/portfolio
 * Returns the player's business portfolio with combined metrics
 * and expansion eligibility info.
 */
export async function GET() {
  try {
    const playerId = await requirePlayerId();

    const [player, businesses] = await Promise.all([
      db.player.findUnique({
        where: { id: playerId },
        select: {
          id: true,
          name: true,
          cash: true,
          netWorth: true,
          level: true,
          experience: true,
          expansionCount: true,
          lastExpansionAt: true,
        },
      }),
      db.business.findMany({
        where: { playerId },
        include: {
          inventories: true,
          employees: true,
          _count: {
            select: {
              campaigns: { where: { status: 'ACTIVE' } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Calculate portfolio summary
    const portfolio = calculatePortfolioSummary(
      businesses.map(b => ({
        id: b.id,
        name: b.name,
        type: b.type,
        city: b.city,
        cash: b.cash,
        dailyRevenue: b.dailyRevenue,
        dailyExpense: b.dailyExpense,
        dailyProfit: b.dailyProfit,
        totalRevenue: b.totalRevenue,
        totalProfit: b.totalProfit,
        healthScore: b.healthScore,
        satisfactionScore: b.satisfactionScore,
        loyaltyScore: b.loyaltyScore,
        employeeCount: b.employees.length,
        inventoryValue: b.inventories.reduce((s, inv) => s + inv.quantity * inv.purchasePrice, 0),
      })),
    );

    // Get game day for expansion eligibility
    const gameDay = await getCurrentGameDay();

    // Business details for UI
    const businessDetails = businesses.map(b => ({
      id: b.id,
      name: b.name,
      type: b.type,
      city: b.city,
      location: b.location,
      level: b.level,
      reputation: b.reputation,
      healthScore: b.healthScore,
      dailyRevenue: b.dailyRevenue,
      dailyExpense: b.dailyExpense,
      dailyProfit: b.dailyProfit,
      totalRevenue: b.totalRevenue,
      totalProfit: b.totalProfit,
      cash: b.cash,
      satisfactionScore: b.satisfactionScore,
      loyaltyScore: b.loyaltyScore,
      npsScore: b.npsScore,
      brandAwareness: b.brandAwareness,
      setupDaysRemaining: b.setupDaysRemaining,
      inventoryCount: b.inventories.length,
      totalStock: b.inventories.reduce((s, inv) => s + inv.quantity, 0),
      employeeCount: b.employees.length,
      activeCampaigns: b._count.campaigns,
    }));

    return NextResponse.json({
      player: {
        id: player.id,
        name: player.name,
        cash: player.cash,
        netWorth: player.netWorth,
        level: player.level,
        experience: player.experience,
        expansionCount: player.expansionCount,
        lastExpansionAt: player.lastExpansionAt,
      },
      portfolio,
      businesses: businessDetails,
      gameDay,
      maxBusinesses: 5,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
