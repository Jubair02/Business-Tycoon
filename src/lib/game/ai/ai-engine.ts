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
import type { AIDecisionContext, ScoredAction, AIPersonality, AIActionResult, AIEventSnapshot } from './types';
import { selectBestAction } from './ai-evaluation';
import { executeAIAction } from './ai-actions';
import { randomPersonality, getPersonalityConfig } from './ai-strategy';
import { simulateAIMarketingTick } from './ai-marketing';
import { BUSINESS_TYPES, CITIES, PRODUCTS } from '@/lib/game-data';
import { roundTaka } from '@/lib/game/economy/formulas';

// ---- Mandatory Inventory Restocking ----

/**
 * Before taking any strategic action, AI players ALWAYS restock critically
 * low inventory. This is a "background" action — real business owners
 * always prioritize keeping shelves stocked.
 *
 * Rules:
 * - Any inventory item below 20% of maxStock → restock to 40% of maxStock
 * - Only if the player can afford the restock
 * - This does NOT count as a strategic action (no cooldown consumed)
 * - Uses db.$transaction for safety
 */
async function performMandatoryRestock(playerId: string): Promise<void> {
  const MANDATORY_RESTOCK_THRESHOLD = 0.20; // Below 20% → restock
  const MANDATORY_RESTOCK_TARGET = 0.40;    // Restock to 40% of maxStock

  try {
    const player = await db.player.findUnique({
      where: { id: playerId },
      select: { cash: true },
    });
    if (!player || player.cash <= 0) return;

    const businesses = await db.business.findMany({
      where: { playerId },
      include: { inventories: true },
    });

    let totalRestockCost = 0;
    const restockItems: { inventoryId: string; quantityToAdd: number; cost: number }[] = [];

    for (const biz of businesses) {
      const productDefs = PRODUCTS[biz.type] || [];

      for (const inv of biz.inventories) {
        const prodDef = productDefs.find(p => p.name === inv.productName);
        if (!prodDef) continue;

        const maxStock = prodDef.maxStock;
        const stockRatio = inv.quantity / maxStock;

        // Only restock if below threshold
        if (stockRatio >= MANDATORY_RESTOCK_THRESHOLD) continue;

        // Calculate how much to buy (bring to 40% of maxStock)
        const targetQuantity = Math.floor(maxStock * MANDATORY_RESTOCK_TARGET);
        const quantityToAdd = Math.max(0, targetQuantity - inv.quantity);
        if (quantityToAdd <= 0) continue;

        const costPerUnit = prodDef.basePrice;
        const cost = costPerUnit * quantityToAdd;

        // Check if player can afford this restock (with some cash reserve)
        if (player.cash - totalRestockCost - cost < 0) continue;

        totalRestockCost += cost;
        restockItems.push({ inventoryId: inv.id, quantityToAdd, cost });
      }
    }

    // Execute all restocks in a single transaction
    if (restockItems.length > 0) {
      await db.$transaction(async (tx) => {
        // Deduct total cost from player cash
        await tx.player.update({
          where: { id: playerId },
          data: { cash: { decrement: Math.round(totalRestockCost) } },
        });

        // Update each inventory item
        for (const item of restockItems) {
          await tx.inventory.update({
            where: { id: item.inventoryId },
            data: { quantity: { increment: item.quantityToAdd } },
          });
        }
      });
    }
  } catch (err) {
    console.error(`[AI Engine] Mandatory restock failed for ${playerId}:`, err);
  }
}

// ---- AI Tick: Main Entry Point ----

/**
 * Shared context data that is identical for ALL AI players.
 * Fetched once per tick and reused across all AI decision builds.
 *
 * Performance: Avoids N redundant queries for events and market prices
 * when there are N AI players (8 players → saves 14 queries per tick).
 */
interface SharedAIContext {
  activeEvents: AIEventSnapshot[];
  marketPrices: Record<string, number>;
}

/**
 * Fetch game-global data that is the same for all AI players.
 * Called once per tick in simulateAIPlayersTick and passed to buildDecisionContext.
 */
async function fetchSharedAIContext(): Promise<SharedAIContext> {
  const [events, marketPriceRows] = await Promise.all([
    db.gameEvent.findMany({ where: { active: true } }),
    db.marketPrice.findMany({}),
  ]);

  const marketPrices: Record<string, number> = {};
  for (const mp of marketPriceRows) {
    marketPrices[mp.productName] = mp.priceMultiplier;
  }

  return {
    activeEvents: events.map(e => ({
      title: e.title,
      type: e.type,
      effects: JSON.parse(e.effects) as Record<string, number>,
    })),
    marketPrices,
  };
}

/**
 * Simulate one game tick for all AI players.
 *
 * Replaces the old random cash drift with real decision-making:
 * - AI players always restock critically low inventory first (mandatory)
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

  // Fetch shared context once (events + market prices are the same for all AI players)
  // Performance: reduces queries from N×4 to 2 + N×2 (with 8 AI players: 32→18 queries)
  const sharedCtx = await fetchSharedAIContext();

  // Process each AI player
  const newsItems: { title: string; content: string }[] = [];

  for (const ai of aiPlayers) {
    try {
      // 0. Mandatory restocking of critically low inventory (background action)
      await performMandatoryRestock(ai.id);

      // 1. Build decision context (after restock, to reflect updated state)
      const ctx = await buildDecisionContext(ai.id, ai.personality || 'BALANCED', ai.cash, ai.netWorth, gameDay, ai.lastActionAt, sharedCtx);

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

  // Process AI marketing decisions (background action, doesn't consume cooldown)
  await simulateAIMarketingTick(gameDay);

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
 *
 * @param sharedCtx - Pre-fetched game-global data (events, market prices)
 *   that is the same for ALL AI players. Fetched once in simulateAIPlayersTick
 *   and reused to avoid N redundant queries.
 */
async function buildDecisionContext(
  playerId: string,
  personality: string,
  cash: number,
  netWorth: number,
  gameDay: number,
  lastActionAt: number,
  sharedCtx: SharedAIContext,
): Promise<AIDecisionContext> {
  // Fetch player-specific data only (businesses + loans)
  // These are different for each AI player and cannot be shared.
  const [businesses, loans, playerData] = await Promise.all([
    db.business.findMany({
      where: { playerId },
      include: {
        inventories: true,
        employees: true,
      },
    }),
    db.loan.findMany({
      where: { playerId, status: 'ACTIVE' },
    }),
    db.player.findUnique({
      where: { id: playerId },
      select: { level: true, expansionCount: true, lastExpansionAt: true },
    }),
  ]);

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
      // Phase 3: Customer Experience
      satisfactionScore: b.satisfactionScore,
      loyaltyScore: b.loyaltyScore,
      repeatCustomerRate: b.repeatCustomerRate,
      // Phase 5: Expansion
      location: b.location,
      setupDaysRemaining: b.setupDaysRemaining,
    })),
    activeLoans: loans.map(l => ({
      id: l.id,
      amount: l.amount,
      remainingDebt: l.remainingDebt,
      dailyPayment: l.dailyPayment,
      daysRemaining: l.daysRemaining,
    })),
    // Reuse pre-fetched shared context (events + market prices)
    activeEvents: sharedCtx.activeEvents,
    marketPrices: sharedCtx.marketPrices,
    // Phase 5: Expansion context
    expansionCount: playerData?.expansionCount ?? 0,
    lastExpansionAt: playerData?.lastExpansionAt ?? 0,
    playerLevel: playerData?.level ?? 1,
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
      inventories: true,
    },
  });

  if (businesses.length === 0) return { shares: [], totalDemand: 0 };

  // Pre-compute market-wide averages for relative factors
  const totalRevenue = businesses.reduce((sum, b) => sum + b.dailyRevenue, 0);
  const avgRevenue = businesses.length > 0 ? totalRevenue / businesses.length : 1;

  // Compute average sell price across all businesses for pricing factor
  const allPrices: number[] = [];
  for (const b of businesses) {
    for (const inv of b.inventories) {
      if (inv.sellPrice > 0) allPrices.push(inv.sellPrice);
    }
  }
  const avgMarketPrice = allPrices.length > 0
    ? allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length
    : 1;

  // Calculate "attractiveness" score for each business
  // score = repFactor × levelFactor × healthFactor × inventoryFactor × pricingFactor × revenueFactor
  const scored = businesses.map(b => {
    // Reputation factor: 0-100 → 0.4-1.6
    const repFactor = 0.4 + (b.reputation / 100) * 1.2;
    // Level factor: level 1=1.0, level 5=1.48
    const levelFactor = 1 + (b.level - 1) * 0.12;
    // Health factor: 0-100 → 0.5-1.5
    const healthFactor = 0.5 + (b.healthScore / 100);

    // Inventory factor: stocked stores attract more customers
    // 0.3 + (totalStock / maxStockCapacity) * 0.7  (range 0.3-1.0)
    const totalStock = b.inventories.reduce((sum, inv) => sum + inv.quantity, 0);
    const maxStockCapacity = b.inventories.reduce((sum, inv) => {
      const prodDef = PRODUCTS[b.type]?.find(p => p.name === inv.productName);
      return sum + (prodDef?.maxStock || 100);
    }, 0);
    const stockRatio = maxStockCapacity > 0 ? totalStock / maxStockCapacity : 0;
    const inventoryFactor = 0.3 + stockRatio * 0.7;

    // Pricing factor: lower prices attract more customers
    // Compare average sell price to market average; cheaper = more attractive
    const bizPrices = b.inventories
      .filter(inv => inv.sellPrice > 0)
      .map(inv => inv.sellPrice);
    const avgBizPrice = bizPrices.length > 0
      ? bizPrices.reduce((sum, p) => sum + p, 0) / bizPrices.length
      : avgMarketPrice;
    // If price is at market average → factor = 1.0
    // If price is 20% below market → factor = 1.2
    // If price is 20% above market → factor = 0.8
    // Clamped to [0.5, 1.5]
    const pricingFactor = Math.max(0.5, Math.min(1.5, avgMarketPrice / Math.max(avgBizPrice, 1)));

    // Revenue factor: businesses selling more attract more customers (momentum)
    // 0.5 + min(dailyRevenue / avgRevenue, 2.0) * 0.25  (range ~0.5-1.0)
    const revenueFactor = 0.5 + Math.min(b.dailyRevenue / Math.max(avgRevenue, 1), 2.0) * 0.25;

    // Phase 3: Satisfaction factor — satisfied customers attract more via word-of-mouth
    // satisfaction 50 → 1.0, satisfaction 80 → 1.12, satisfaction 20 → 0.84
    const satisfactionFactor = 0.6 + (b.satisfactionScore / 100) * 0.6;

    const score = repFactor * levelFactor * healthFactor * inventoryFactor * pricingFactor * revenueFactor * satisfactionFactor;
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
