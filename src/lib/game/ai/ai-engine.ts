// ============================================
// Bangladesh Business Tycoon - AI Engine (Main Orchestrator)
// Phase 2: Real AI Competitors & Market Competition
//
// Flow per game tick:
//   For each AI player:
//     1. Build decision context (cash, businesses, inventory, events, market)
//     2. Evaluate possible actions (score-based)
//     3. Select best action
//     4. Execute action (same rules as human player)
//     5. AI businesses also run through simulateBusinessTick()
// ============================================

import { db } from '@/lib/db';
import type { AIDecisionContext, ScoredAction, AIPersonality, AIActionResult } from './types';
import { selectBestAction } from './ai-evaluation';
import { executeAIAction } from './ai-actions';
import { randomPersonality, getPersonalityConfig } from './ai-strategy';
import { BUSINESS_TYPES, CITIES, PRODUCTS } from '@/lib/game-data';
import { roundTaka } from '@/lib/game/economy/formulas';

// ---- AI Tick: Main Entry Point ----

/**
 * Simulate one game tick for all AI players.
 *
 * Replaces the old random cash drift with real decision-making:
 * - AI players evaluate their situation
 * - AI players choose and execute actions
 * - AI businesses are simulated through the SAME economy engine
 * - AI net worth is recalculated from real assets
 *
 * This runs AFTER the regular business simulation in gameTick(),
 * so AI businesses already got their daily revenue/expenses.
 */
export async function simulateAIPlayersTick(gameDay: number): Promise<void> {
  const aiPlayers = await db.player.findMany({
    where: { isAI: true },
    select: {
      id: true,
      name: true,
      cash: true,
      netWorth: true,
      personality: true,
      lastActionAt: true,
    },
  });

  if (aiPlayers.length === 0) return;

  // Process each AI player
  const newsItems: { title: string; content: string }[] = [];

  for (const ai of aiPlayers) {
    try {
      // 1. Build decision context
      const ctx = await buildDecisionContext(ai.id, ai.personality || 'BALANCED', ai.cash, ai.netWorth, gameDay, ai.lastActionAt);

      // 2. Select best action
      const bestAction = selectBestAction(ctx);

      // 3. Execute action
      if (bestAction.action !== 'HOLD') {
        const result = await executeAIAction(ai.id, bestAction, ctx);

        // 4. Update AI player's last action
        if (result.success) {
          await db.player.update({
            where: { id: ai.id },
            data: {
              lastAction: bestAction.action,
              lastActionAt: gameDay,
            },
          });

          // Collect news-worthy events
          if (result.newsWorthy && result.newsTitle) {
            newsItems.push({
              title: `${ai.name}: ${result.newsTitle}`,
              content: result.newsContent || `${ai.name} made a business move.`,
            });
          }
        }
      }

      // 5. Recalculate AI net worth from real assets
      await recalculateAINetWorth(ai.id);
    } catch (err) {
      console.error(`[AI Engine] Error processing AI player ${ai.id}:`, err);
    }
  }

  // Generate news from AI activities (limit to 1-2 per tick to avoid spam)
  if (newsItems.length > 0) {
    const selected = newsItems.slice(0, Math.min(2, Math.ceil(Math.random() * 2)));
    for (const news of selected) {
      try {
        await db.newsArticle.create({
          data: {
            title: news.title,
            content: news.content,
            category: 'BUSINESS',
          },
        });
      } catch (err) {
        console.error('[AI Engine] Failed to create news:', err);
      }
    }
  }
}

// ---- Build Decision Context ----

/**
 * Gather all information an AI needs to make decisions.
 * This is the AI's "view" of the game world.
 */
async function buildDecisionContext(
  playerId: string,
  personality: string,
  cash: number,
  netWorth: number,
  gameDay: number,
  lastActionAt: number,
): Promise<AIDecisionContext> {
  // Get AI's businesses with full detail
  const businesses = await db.business.findMany({
    where: { playerId },
    include: {
      inventories: true,
      employees: true,
    },
  });

  // Get active loans
  const loans = await db.loan.findMany({
    where: { playerId, status: 'ACTIVE' },
  });

  // Get active events
  const events = await db.gameEvent.findMany({
    where: { active: true },
  });

  // Get market prices (simplified — just get all)
  const marketPrices = await db.marketPrice.findMany({});
  const priceMap: Record<string, number> = {};
  for (const mp of marketPrices) {
    priceMap[mp.productName] = mp.priceMultiplier;
  }

  return {
    playerId,
    personality: personality as AIPersonality,
    cash,
    netWorth,
    gameDay,
    lastActionAt,
    businesses: businesses.map(b => ({
      id: b.id,
      type: b.type,
      city: b.city,
      name: b.name,
      level: b.level,
      reputation: b.reputation,
      cash: b.cash,
      dailyRevenue: b.dailyRevenue,
      dailyExpense: b.dailyExpense,
      dailyProfit: b.dailyProfit,
      totalProfit: b.totalProfit,
      healthScore: b.healthScore,
      inventories: b.inventories.map(inv => ({
        id: inv.id,
        productName: inv.productName,
        quantity: inv.quantity,
        maxStock: PRODUCTS[b.type]?.find(p => p.name === inv.productName)?.maxStock || 100,
        purchasePrice: inv.purchasePrice,
        sellPrice: inv.sellPrice,
      })),
      employeeCount: b.employees.length,
    })),
    activeLoans: loans.map(l => ({
      id: l.id,
      amount: l.amount,
      remainingDebt: l.remainingDebt,
      dailyPayment: l.dailyPayment,
      daysRemaining: l.daysRemaining,
    })),
    activeEvents: events.map(e => ({
      title: e.title,
      type: e.type,
      effects: JSON.parse(e.effects) as Record<string, number>,
    })),
    marketPrices: priceMap,
  };
}

// ---- Net Worth Recalculation ----

/**
 * Recalculate AI player net worth from real assets.
 * Same formula as human player net worth:
 *   cash + businessCash + inventoryValue - outstandingDebt
 */
async function recalculateAINetWorth(playerId: string): Promise<void> {
  try {
    const player = await db.player.findUnique({
      where: { id: playerId },
      include: {
        businesses: {
          include: { inventories: true },
        },
        loans: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    if (!player) return;

    const businessCash = player.businesses.reduce((sum, b) => sum + b.cash, 0);
    const inventoryValue = player.businesses.reduce(
      (sum, b) => sum + b.inventories.reduce((iSum, inv) => iSum + inv.quantity * inv.purchasePrice, 0),
      0,
    );
    const outstandingDebt = player.loans.reduce((sum, l) => sum + l.remainingDebt, 0);

    const netWorth = roundTaka(player.cash + businessCash + inventoryValue - outstandingDebt);

    // Update AI level based on net worth
    let level = 1;
    if (netWorth > 5000000) level = 5;
    else if (netWorth > 2000000) level = 4;
    else if (netWorth > 1000000) level = 3;
    else if (netWorth > 500000) level = 2;

    await db.player.update({
      where: { id: playerId },
      data: { netWorth, level },
    });
  } catch (err) {
    console.error(`[AI Engine] Failed to recalculate net worth for ${playerId}:`, err);
  }
}

// ---- Market Share Calculation ----

/**
 * Calculate market share for all businesses in a city+type market.
 * Uses demand-based allocation (not random).
 */
export async function calculateMarketShare(
  city: string,
  businessType: string,
): Promise<{
  shares: {
    businessId: string;
    businessName: string;
    playerName: string;
    playerId: string;
    isAI: boolean;
    share: number;
    revenue: number;
  }[];
  totalDemand: number;
}> {
  const businesses = await db.business.findMany({
    where: { city, type: businessType },
    include: {
      player: { select: { id: true, name: true, isAI: true } },
    },
  });

  if (businesses.length === 0) return { shares: [], totalDemand: 0 };

  // Calculate "attractiveness" score for each business
  // Higher reputation + higher level + more inventory = more market share
  const scored = businesses.map(b => {
    // Reputation factor: 0-100 → 0.4-1.6
    const repFactor = 0.4 + (b.reputation / 100) * 1.2;
    // Level factor: level 1=1.0, level 5=1.48
    const levelFactor = 1 + (b.level - 1) * 0.12;
    // Health factor: 0-100 → 0.5-1.5
    const healthFactor = 0.5 + (b.healthScore / 100);

    const score = repFactor * levelFactor * healthFactor;
    return {
      businessId: b.id,
      businessName: b.name,
      playerName: b.player.name,
      playerId: b.player.id,
      isAI: b.player.isAI,
      score,
      revenue: b.dailyRevenue,
    };
  });

  const totalScore = scored.reduce((sum, s) => sum + s.score, 0);

  // Convert scores to shares
  const shares = scored.map(s => ({
    ...s,
    share: totalScore > 0 ? s.score / totalScore : 0,
  }));

  // Total demand estimate (based on city customer multiplier)
  const cityData = CITIES.find(c => c.id === city);
  const bType = BUSINESS_TYPES.find(b => b.id === businessType);
  const baseDemand = bType ? bType.baseCustomers * (cityData?.customerMultiplier || 1) : 50;

  return { shares, totalDemand: baseDemand };
}

// ---- Barrel Export ----
export { selectBestAction } from './ai-evaluation';
export { executeAIAction } from './ai-actions';
export { getPersonalityConfig, calculateAIPrice, randomPersonality } from './ai-strategy';
export type * from './types';
