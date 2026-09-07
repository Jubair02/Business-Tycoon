// ============================================
// Bangladesh Business Tycoon - Game Engine (Optimized)
// Server-authoritative economy simulation
// Phase 0: Tick concurrency lock, stale lock recovery,
//   transaction safety, error handling, net worth consistency
// Phase 1: Economy & Balance Engine
//   - Price sensitivity (demand reacts to pricing)
//   - Product-level demand simulation
//   - COGS tracking
//   - Daily salary (monthly / 30)
//   - Market price retention (events persist)
//   - Business health score
//   - Historical metrics (BusinessMetric)
//   - Business profit distributed to player
// ============================================

import { db } from './db';
import {
  GAME_CONFIG, EVENT_TEMPLATES, PRODUCTS, CITIES, BUSINESS_TYPES, EMPLOYEE_ROLES,
  getRandomName, getCity, getBusinessType
} from './game-data';
import type { EventTemplate } from './game-data';
import { AppError, tickLocked, internalError } from '@/lib/errors';
import { PrismaClient } from '@prisma/client';

// Phase 1: Economy Engine
import {
  calculatePotentialCustomers,
  calculatePriceDemandMultiplier,
  simulateProductSales,
  calculateBusinessExpenses,
  calculateNetProfit,
  calculateBusinessHealth,
  calculateReputationChange,
  calculateROI,
  calculateMarketPriceUpdate,
  classifyDemandLevel,
  roundTaka,
} from './game/economy/formulas';
import { getBusinessEconomyConfig } from './game/economy/business-config';
import { getProductDemandConfig } from './game/economy/product-demand';
import { ECONOMY_CONFIG } from './game/economy/economy-config';
import type { ProductSalesResult, ExpenseBreakdown, BusinessHealthResult } from './game/economy/types';

// ---- Prisma Transaction Client Type ----
type PrismaTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// ---- Tick Concurrency Lock Constants ----
const STALE_TICK_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// ---- Tick Concurrency Lock ----

/**
 * Atomically attempt to acquire the tick lock using the GameState key-value store.
 * Returns true if the lock was acquired, false if it was already held.
 *
 * Stale lock recovery: if the lock has been held for longer than
 * STALE_TICK_TIMEOUT_MS, the lock is stolen and a warning is logged.
 */
export async function acquireTickLock(): Promise<boolean> {
  const now = new Date();

  return db.$transaction(async (tx) => {
    // Read current lock state
    const lockState = await tx.gameState.findUnique({ where: { key: 'tickInProgress' } });
    const startedAtState = await tx.gameState.findUnique({ where: { key: 'tickStartedAt' } });

    const isLocked = lockState?.value === 'true';
    const startedAt = startedAtState?.value ? new Date(startedAtState.value) : null;

    if (isLocked && startedAt) {
      const elapsed = now.getTime() - startedAt.getTime();
      if (elapsed < STALE_TICK_TIMEOUT_MS) {
        return false; // Lock is legitimately held
      }
      console.warn(`[GameEngine] Stale tick lock detected (held for ${Math.round(elapsed / 1000)}s). Stealing lock.`);
    } else if (isLocked) {
      console.warn('[GameEngine] Tick lock held with no timestamp. Stealing lock.');
    }

    // Acquire the lock
    const nowISO = now.toISOString();
    await tx.gameState.upsert({
      where: { key: 'tickInProgress' },
      create: { key: 'tickInProgress', value: 'true' },
      update: { value: 'true' },
    });
    await tx.gameState.upsert({
      where: { key: 'tickStartedAt' },
      create: { key: 'tickStartedAt', value: nowISO },
      update: { value: nowISO },
    });

    // Increment tick version
    const versionState = await tx.gameState.findUnique({ where: { key: 'tickVersion' } });
    const currentVersion = parseInt(versionState?.value || '0', 10);
    await tx.gameState.upsert({
      where: { key: 'tickVersion' },
      create: { key: 'tickVersion', value: '1' },
      update: { value: String(currentVersion + 1) },
    });

    return true;
  });
}

export async function releaseTickLock(): Promise<void> {
  await db.gameState.upsert({
    where: { key: 'tickInProgress' },
    create: { key: 'tickInProgress', value: 'false' },
    update: { value: 'false' },
  });
}

// ---- Net Worth Recalculation ----
async function recalculateNetWorth(tx: PrismaTx, playerId: string): Promise<void> {
  const player = await tx.player.findUnique({
    where: { id: playerId },
    select: { id: true, cash: true },
  });
  if (!player) {
    console.error(`[GameEngine] recalculateNetWorth: Player ${playerId} not found`);
    return;
  }

  const allBusinesses = await tx.business.findMany({
    where: { playerId },
    select: { cash: true },
  });
  const totalBusinessCash = allBusinesses.reduce((sum, b) => sum + b.cash, 0);

  const allInventory = await tx.inventory.findMany({
    where: { business: { playerId } },
    select: { quantity: true, purchasePrice: true },
  });
  const totalInventoryValue = allInventory.reduce((sum, inv) => sum + inv.quantity * inv.purchasePrice, 0);

  const activeLoans = await tx.loan.findMany({
    where: { playerId, status: 'ACTIVE' },
    select: { remainingDebt: true },
  });
  const outstandingDebt = activeLoans.reduce((sum, loan) => sum + loan.remainingDebt, 0);

  const netWorth = player.cash + totalBusinessCash + totalInventoryValue - outstandingDebt;
  await tx.player.update({ where: { id: playerId }, data: { netWorth } });
}

// ---- Event Generation ----
export async function generateEvent(): Promise<void> {
  const totalWeight = EVENT_TEMPLATES.reduce((sum, e) => sum + e.weight, 0);
  let random = Math.random() * totalWeight;
  let selected: EventTemplate | null = null;
  for (const event of EVENT_TEMPLATES) {
    random -= event.weight;
    if (random <= 0) {
      selected = event;
      break;
    }
  }
  if (!selected) selected = EVENT_TEMPLATES[0];

  const now = new Date();
  const endAt = new Date(now.getTime() + selected.durationDays * 60 * 1000);
  await db.gameEvent.create({
    data: {
      title: selected.title,
      description: selected.description,
      type: selected.type,
      effects: JSON.stringify(selected.effects),
      active: true,
      startsAt: now,
      endsAt: endAt,
    },
  });
}

// ---- Market Price Updates (Phase 1: Retention-based) ----
/**
 * Phase 1 improvement: Market prices now use retention blending.
 * Previous multiplier is retained (70%) and new random is blended (30%).
 * Event effects are applied on top and persist across updates.
 */
export async function updateMarketPrices(): Promise<void> {
  const allProducts = Object.values(PRODUCTS).flat();
  const cities = CITIES.map(c => c.id);

  // Get active events for price modifiers
  const activeEvents = await db.gameEvent.findMany({ where: { active: true } });
  const categoryPriceMod: Record<string, number> = {};
  let allPriceMod = 0;
  for (const event of activeEvents) {
    const effects = JSON.parse(event.effects) as Record<string, number>;
    for (const [key, value] of Object.entries(effects)) {
      if (key === 'all_price' || key === 'all_imported') allPriceMod += value;
      if (key.endsWith('_price')) {
        const cat = key.replace('_price', '');
        categoryPriceMod[cat] = (categoryPriceMod[cat] || 0) + value;
      }
    }
  }

  const updates: { productName: string; city: string; priceMultiplier: number; demandMultiplier: number }[] = [];

  for (const city of cities) {
    for (const product of allProducts) {
      // Get current market price (for retention)
      const existing = await db.marketPrice.findUnique({
        where: { productName_city: { productName: product.name, city } },
      });
      const previousPriceMult = existing?.priceMultiplier ?? 1;

      // Calculate event price modifier for this product
      const eventPriceMod = allPriceMod + (categoryPriceMod[product.category] || 0);

      // Use Phase 1 retention-based update
      const { priceMultiplier, demandMultiplier } = calculateMarketPriceUpdate(
        previousPriceMult,
        eventPriceMod
      );

      updates.push({ productName: product.name, city, priceMultiplier, demandMultiplier });
    }
  }

  // Batch update in a transaction
  await db.$transaction(async (tx) => {
    for (const upd of updates) {
      await tx.marketPrice.upsert({
        where: { productName_city: { productName: upd.productName, city: upd.city } },
        create: upd,
        update: {
          priceMultiplier: upd.priceMultiplier,
          demandMultiplier: upd.demandMultiplier,
          updatedAt: new Date(),
        },
      });
    }
  });
}

// ---- Apply Event Effects to Market (Phase 1: Integrated into updateMarketPrices) ----
/**
 * Phase 1: Event effects are now integrated into updateMarketPrices()
 * via the retention-based formula. This function is kept for backward
 * compatibility but delegates to the improved market update.
 */
export async function applyEventEffects(): Promise<void> {
  // No-op: Event effects are now handled by the retention-based updateMarketPrices()
  // This function is kept as a no-op to avoid breaking the tick flow.
}

// ---- Business Simulation Tick (Phase 1: Economy Engine) ----

/**
 * Phase 1 business simulation using the new Economy Engine.
 *
 * Flow:
 * 1. Calculate potential customers (layered model)
 * 2. For each inventory item:
 *    a. Get product demand config
 *    b. Calculate product demand (base + events + volatility)
 *    c. Apply price sensitivity (sellPrice vs market price)
 *    d. Calculate actual items sold (constrained by stock)
 *    e. Calculate revenue, COGS, gross profit
 * 3. Calculate expenses (rent + daily salaries + utilities + taxes)
 * 4. Calculate net profit
 * 5. Update reputation
 * 6. Calculate business health score
 * 7. Save daily metrics
 * 8. Distribute profit to player cash (Phase 1 fix)
 * 9. Recalculate net worth
 */
export async function simulateBusinessTick(businessId: string): Promise<void> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    include: {
      inventories: true,
      employees: true,
      player: { select: { id: true, cash: true, netWorth: true } },
    },
  });

  if (!business) return;

  const businessType = getBusinessType(business.type);
  const city = getCity(business.city);
  if (!businessType || !city) return;

  const economyConfig = getBusinessEconomyConfig(business.type);

  // Get active event effects (combined)
  const activeEvents = await db.gameEvent.findMany({
    where: { active: true },
    select: { effects: true },
  });
  const combinedEffects: Record<string, number> = {};
  for (const event of activeEvents) {
    const effects = JSON.parse(event.effects) as Record<string, number>;
    for (const [key, value] of Object.entries(effects)) {
      combinedEffects[key] = (combinedEffects[key] || 0) + value;
    }
  }

  // Get market prices for this city
  const marketPrices = await db.marketPrice.findMany({
    where: { city: business.city },
  });
  const marketPriceMap: Record<string, { priceMultiplier: number; demandMultiplier: number }> = {};
  for (const mp of marketPrices) {
    marketPriceMap[mp.productName] = {
      priceMultiplier: mp.priceMultiplier,
      demandMultiplier: mp.demandMultiplier,
    };
  }

  // ---- Step 1: Calculate potential customers ----
  const totalStock = business.inventories.reduce((sum, inv) => sum + inv.quantity, 0);
  // Max stock capacity: sum of product maxStock values for this business type
  const productDefs = PRODUCTS[business.type] || [];
  const maxStockCapacity = productDefs.reduce((sum, p) => sum + p.maxStock, 0);
  const avgEmployeeSkill = business.employees.length > 0
    ? business.employees.reduce((sum, e) => sum + e.skill, 0) / business.employees.length
    : 0;

  const potentialCustomers = calculatePotentialCustomers({
    baseCustomers: businessType.baseCustomers,
    cityMultiplier: city.customerMultiplier,
    level: business.level,
    reputation: business.reputation,
    totalStock,
    maxStockCapacity,
    employeeCount: business.employees.length,
    avgEmployeeSkill,
    eventCustomerEffect: combinedEffects['all_customers'] || 0,
    businessDemandEffect: combinedEffects[`${businessType.id}_demand`] || 0,
    businessTypeId: business.type,
  });

  // ---- Step 2: Product-level sales simulation ----
  let totalRevenue = 0;
  let totalCOGS = 0;
  const inventoryUpdates: { id: string; quantityDecrement: number }[] = [];
  const salesResults: ProductSalesResult[] = [];

  for (const inventory of business.inventories) {
    if (inventory.quantity <= 0) continue;

    const productDef = productDefs.find(p => p.name === inventory.productName);
    if (!productDef) continue;

    // Product demand config
    const prodDemandConfig = getProductDemandConfig(inventory.productName);

    // Market reference price = typical retail price (basePrice × (1 + suggestedMarkup) × priceMultiplier)
    // This represents what the MARKET typically charges, not the wholesale cost.
    // Players compare their price to market retail price, not to their own cost.
    const mp = marketPriceMap[inventory.productName];
    const typicalRetailPrice = productDef.basePrice * (1 + productDef.suggestedMarkup);
    const marketReferencePrice = Math.round(
      typicalRetailPrice * (mp?.priceMultiplier || 1)
    );

    // Market demand multiplier from events
    const demandMult = mp?.demandMultiplier || 1;

    // Event demand effect for this product's category
    const eventDemandEffect = combinedEffects[`${productDef.category}_demand`] || 0;

    // Run the complete sales pipeline
    const salesResult = simulateProductSales({
      inventoryId: inventory.id,
      productName: inventory.productName,
      quantity: inventory.quantity,
      purchasePrice: inventory.purchasePrice,
      sellPrice: inventory.sellPrice,
      marketReferencePrice,
      baseDemand: prodDemandConfig.baseDemand,
      demandMultiplier: demandMult,
      eventDemandEffect,
      productPriceSensitivity: prodDemandConfig.priceSensitivity,
      productVolatility: prodDemandConfig.volatility,
      businessPriceSensitivity: economyConfig.priceSensitivity,
      potentialCustomers,
    });

    if (salesResult.itemsSold > 0) {
      totalRevenue += salesResult.revenue;
      totalCOGS += salesResult.costOfGoodsSold;
      inventoryUpdates.push({
        id: inventory.id,
        quantityDecrement: salesResult.itemsSold,
      });
    }

    salesResults.push(salesResult);
  }

  // ---- Step 3: Calculate expenses ----
  const totalMonthlySalaries = business.employees.reduce((sum, emp) => sum + emp.salary, 0);
  const grossProfit = totalRevenue - totalCOGS;

  const expenses = calculateBusinessExpenses({
    baseRent: businessType.rent,
    level: business.level,
    cityRentMultiplier: city.rentMultiplier,
    totalMonthlySalaries,
    businessLevel: business.level,
    businessTypeId: business.type,
    revenue: totalRevenue,
    grossProfit,
  });

  // ---- Step 4: Calculate net profit ----
  const dailyProfit = calculateNetProfit(totalRevenue, totalCOGS, expenses.totalExpense);

  // ---- Step 5: Calculate reputation change ----
  const outOfStockRatio = business.inventories.length > 0
    ? business.inventories.filter(inv => inv.quantity <= 0).length / business.inventories.length
    : 0;
  const managers = business.employees.filter(e => e.role === 'MANAGER');
  const cleaners = business.employees.filter(e => e.role === 'CLEANER');

  const reputationChange = calculateReputationChange({
    dailyProfit,
    outOfStockRatio,
    managers: managers.map(m => ({ skill: m.skill })),
    cleaners: cleaners.map(c => ({ skill: c.skill })),
  });

  const newReputation = Math.max(
    ECONOMY_CONFIG.minReputation,
    Math.min(ECONOMY_CONFIG.maxReputation, business.reputation + reputationChange)
  );

  // ---- Step 6: Calculate business health score ----
  const healthResult = calculateBusinessHealth({
    dailyProfit,
    dailyRevenue: totalRevenue,
    businessCash: business.cash + dailyProfit,
    totalStock,
    maxStockCapacity,
    reputation: newReputation,
    businessTypeId: business.type,
  });

  // ---- Step 7: Get game day for metrics ----
  const gameDayState = await db.gameState.findUnique({ where: { key: 'gameDay' } });
  const gameDay = parseInt(gameDayState?.value || '1', 10);

  // ---- Step 8: Execute all updates in a single transaction ----
  await db.$transaction(async (tx) => {
    // Update inventory quantities
    for (const upd of inventoryUpdates) {
      await tx.inventory.update({
        where: { id: upd.id },
        data: { quantity: { decrement: upd.quantityDecrement } },
      });
    }

    // Phase 1 FIX: Distribute business profit to player cash
    // Previously, profit accumulated in business.cash but was never accessible.
    // Now: business profit is transferred to the player each tick.
    const profitToDistribute = dailyProfit;

    // Update business
    await tx.business.update({
      where: { id: business.id },
      data: {
        dailyRevenue: roundTaka(totalRevenue),
        dailyExpense: roundTaka(expenses.totalExpense),
        dailyProfit: roundTaka(dailyProfit),
        dailyCOGS: roundTaka(totalCOGS),
        dailyCustomers: potentialCustomers,
        cash: business.cash + roundTaka(dailyProfit),
        totalRevenue: business.totalRevenue + roundTaka(totalRevenue),
        totalProfit: business.totalProfit + roundTaka(dailyProfit),
        reputation: newReputation,
        healthScore: healthResult.score,
      },
    });

    // Distribute profit to player cash
    await tx.player.update({
      where: { id: business.playerId },
      data: { cash: { increment: roundTaka(profitToDistribute) } },
    });

    // Save daily metrics for analytics
    await tx.businessMetric.upsert({
      where: { businessId_gameDay: { businessId: business.id, gameDay } },
      create: {
        businessId: business.id,
        gameDay,
        revenue: roundTaka(totalRevenue),
        expenses: roundTaka(expenses.totalExpense),
        profit: roundTaka(dailyProfit),
        cogs: roundTaka(totalCOGS),
        customers: potentialCustomers,
        reputation: newReputation,
      },
      update: {
        revenue: roundTaka(totalRevenue),
        expenses: roundTaka(expenses.totalExpense),
        profit: roundTaka(dailyProfit),
        cogs: roundTaka(totalCOGS),
        customers: potentialCustomers,
        reputation: newReputation,
      },
    });

    // Log
    const cogsStr = totalCOGS > 0 ? ` | COGS ৳${roundTaka(totalCOGS).toLocaleString()}` : '';
    await tx.gameLog.create({
      data: {
        playerId: business.playerId,
        businessId: business.id,
        type: dailyProfit >= 0 ? 'PROFIT' : 'LOSS',
        message: `${business.name}: Rev ৳${roundTaka(totalRevenue).toLocaleString()}${cogsStr} | Exp ৳${roundTaka(expenses.totalExpense).toLocaleString()} | ${dailyProfit >= 0 ? 'Profit' : 'Loss'} ৳${Math.abs(roundTaka(dailyProfit)).toLocaleString()} | ${potentialCustomers} customers | Health ${healthResult.score}`,
        amount: dailyProfit,
      },
    });

    // Recalculate net worth within the same transaction
    await recalculateNetWorth(tx, business.playerId);
  });
}

// ---- Loan Payment Processing ----

async function processLoanPayments(): Promise<void> {
  const activeLoans = await db.loan.findMany({
    where: { status: 'ACTIVE' },
  });

  if (activeLoans.length === 0) return;

  for (const loan of activeLoans) {
    const payment = loan.dailyPayment;
    const isPaidOff = loan.daysRemaining - 1 <= 0;
    const actualPayment = isPaidOff ? loan.remainingDebt : payment;

    await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({
        where: { id: loan.playerId },
        select: { cash: true },
      });
      if (!player) {
        console.error(`[GameEngine] processLoanPayments: Player ${loan.playerId} not found for loan ${loan.id}`);
        return;
      }

      const deductAmount = Math.min(actualPayment, Math.max(0, player.cash));
      const newRemainingDebt = Math.max(loan.remainingDebt - deductAmount, 0);

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          remainingDebt: newRemainingDebt,
          daysRemaining: Math.max(loan.daysRemaining - 1, 0),
          status: newRemainingDebt <= 0 ? 'PAID_OFF' : 'ACTIVE',
        },
      });

      await tx.player.update({
        where: { id: loan.playerId },
        data: { cash: { decrement: deductAmount } },
      });

      await tx.gameLog.create({
        data: {
          playerId: loan.playerId,
          type: newRemainingDebt <= 0 ? 'LOAN_PAID' : 'LOAN_PAYMENT',
          message: newRemainingDebt <= 0
            ? `Loan of ৳${loan.amount.toLocaleString()} fully repaid! Final deduction: ৳${Math.round(deductAmount).toLocaleString()}`
            : `Loan payment: ৳${Math.round(deductAmount).toLocaleString()} deducted. Remaining debt: ৳${Math.round(newRemainingDebt).toLocaleString()} (${loan.daysRemaining - 1} days left)`,
          amount: -deductAmount,
        },
      });
    });
  }
}

// ---- Full Game Tick ----

export async function gameTick(): Promise<void> {
  // NOTE: The tick lock is managed by the API route handler.
  // gameTick() is the pure simulation function and does NOT acquire/release the lock.

  // Log tick start
  await db.gameLog.create({
    data: {
      type: 'GAME_TICK_STARTED',
      message: `Game tick started at ${new Date().toISOString()}`,
    },
  });

  // 0. Game state housekeeping
  const tickState = await db.gameState.findUnique({ where: { key: 'tickCount' } });
  const tickNum = parseInt(tickState?.value || '0');

  await db.$transaction(async (tx) => {
    // Expire old events
    await tx.gameEvent.updateMany({
      where: { active: true, endsAt: { lt: new Date() } },
      data: { active: false },
    });

    // Update game state
    const now = new Date().toISOString();
    await tx.gameState.upsert({
      where: { key: 'lastTick' },
      create: { key: 'lastTick', value: now },
      update: { value: now },
    });
    await tx.gameState.upsert({
      where: { key: 'tickCount' },
      create: { key: 'tickCount', value: '1' },
      update: { value: String(tickNum + 1) },
    });
    const dayState = await tx.gameState.findUnique({ where: { key: 'gameDay' } });
    await tx.gameState.upsert({
      where: { key: 'gameDay' },
      create: { key: 'gameDay', value: '1' },
      update: { value: String(parseInt(dayState?.value || '0') + 1) },
    });
  });

  // Generate new events (20% chance)
  if (Math.random() < 0.2) {
    try {
      await generateEvent();
    } catch (err) {
      console.error('[GameEngine] Failed to generate event:', err);
    }
  }

  // Update market prices (every 3 ticks)
  // Phase 1: This now uses retention-based updates with event effects integrated
  if (tickNum % 3 === 0) {
    try {
      await updateMarketPrices();
    } catch (err) {
      console.error('[GameEngine] Failed to update market prices:', err);
    }
    // applyEventEffects() is now a no-op — events handled in updateMarketPrices()
  }

  // 1. Simulate all businesses
  const businesses = await db.business.findMany({ select: { id: true } });
  for (const business of businesses) {
    try {
      await simulateBusinessTick(business.id);
    } catch (err) {
      console.error(`[GameEngine] Failed to simulate business ${business.id}:`, err);
    }
  }

  // 2. Process loan payments
  try {
    await processLoanPayments();
  } catch (err) {
    console.error('[GameEngine] Failed to process loan payments:', err);
  }

  // 3. Simulate AI player activity
  try {
    await simulateAITick();
  } catch (err) {
    console.error('[GameEngine] Failed to simulate AI tick:', err);
  }

  // 4. Generate news (50% chance)
  if (Math.random() < 0.5) {
    try {
      await generateNews();
    } catch (err) {
      console.error('[GameEngine] Failed to generate news:', err);
    }
  }

  // Log tick completion
  await db.gameLog.create({
    data: {
      type: 'GAME_TICK_COMPLETED',
      message: `Game tick completed at ${new Date().toISOString()}`,
    },
  });
}

// ---- News Generation ----

async function generateNews(): Promise<void> {
  const newsTemplates = [
    { title: 'Market Update: Rice prices {direction} in {city}', category: 'MARKET' },
    { title: 'Business Report: {business_type} sector showing {trend}', category: 'BUSINESS' },
    { title: 'Economic Outlook: Consumer confidence {direction}', category: 'ECONOMY' },
    { title: 'Weather Update: {weather} expected in {city} region', category: 'WEATHER' },
    { title: 'Trade News: Import costs for electronics {direction}', category: 'TRADE' },
  ];

  const randomCity = CITIES[Math.floor(Math.random() * CITIES.length)].name;
  const randomBusiness = BUSINESS_TYPES[Math.floor(Math.random() * BUSINESS_TYPES.length)].name;
  const direction = Math.random() > 0.5 ? 'increased' : 'decreased';
  const trend = Math.random() > 0.5 ? 'strong growth' : 'slight decline';
  const weatherOptions = ['heavy rain', 'clear skies', 'heatwave', 'mild weather', 'thunderstorms'];
  const weather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];

  const template = newsTemplates[Math.floor(Math.random() * newsTemplates.length)];
  const title = template.title
    .replace('{city}', randomCity)
    .replace('{business_type}', randomBusiness)
    .replace('{direction}', direction)
    .replace('{trend}', trend)
    .replace('{weather}', weather);

  const contents: Record<string, string> = {
    MARKET: `Sources report that commodity prices have ${direction} in ${randomCity}. Traders are advising businesses to adjust their inventory strategies accordingly.`,
    BUSINESS: `The ${randomBusiness} sector is currently showing ${trend} according to industry analysts. Business owners should monitor market trends closely.`,
    ECONOMY: `Consumer confidence has ${direction} this quarter. Economic indicators suggest that spending patterns may shift in the coming days.`,
    WEATHER: `${weather.charAt(0).toUpperCase() + weather.slice(1)} conditions are expected in the ${randomCity} region. Businesses should prepare for potential changes in customer footfall.`,
    TRADE: `International trade reports indicate that import costs have ${direction}. This may affect pricing strategies for businesses dealing with imported goods.`,
  };

  await db.newsArticle.create({
    data: {
      title,
      content: contents[template.category] || contents['ECONOMY'],
      category: template.category,
    },
  });

  // Keep only last 50 news articles
  const totalNews = await db.newsArticle.count();
  if (totalNews > 50) {
    const oldNews = await db.newsArticle.findMany({
      orderBy: { createdAt: 'asc' },
      take: totalNews - 50,
      select: { id: true },
    });
    const ids = oldNews.map(n => n.id);
    await db.newsArticle.deleteMany({ where: { id: { in: ids } } });
  }
}

// ---- Seed Data ----

export async function seedInitialData(): Promise<void> {
  // Seed products
  const allProducts = Object.values(PRODUCTS).flat();
  for (const product of allProducts) {
    await db.product.upsert({
      where: { name: product.name },
      create: {
        name: product.name,
        category: product.category,
        basePrice: product.basePrice,
        baseDemand: product.baseDemand,
        icon: product.icon,
      },
      update: {},
    });
  }

  // Seed initial market prices
  const cities = CITIES.map(c => c.id);
  for (const city of cities) {
    for (const product of allProducts) {
      await db.marketPrice.upsert({
        where: { productName_city: { productName: product.name, city } },
        create: { productName: product.name, city, priceMultiplier: 1, demandMultiplier: 1 },
        update: {},
      });
    }
  }

  // Game state
  await db.gameState.upsert({ where: { key: 'lastTick' }, create: { key: 'lastTick', value: new Date().toISOString() }, update: {} });
  await db.gameState.upsert({ where: { key: 'tickCount' }, create: { key: 'tickCount', value: '0' }, update: {} });
  await db.gameState.upsert({ where: { key: 'gameDay' }, create: { key: 'gameDay', value: '1' }, update: {} });
  await db.gameState.upsert({ where: { key: 'tickInProgress' }, create: { key: 'tickInProgress', value: 'false' }, update: {} });
  await db.gameState.upsert({ where: { key: 'tickVersion' }, create: { key: 'tickVersion', value: '0' }, update: {} });

  // Generate initial news
  for (let i = 0; i < 5; i++) {
    await generateNews();
  }

  // Generate initial event
  await generateEvent();
}

// ---- Create AI Players for Leaderboard ----

export async function seedAIPlayers(): Promise<void> {
  const existingPlayers = await db.player.count();
  if (existingPlayers > 1) return;

  const aiNames = [
    { name: 'Rahim Enterprises', email: 'ai-rahim@game.local' },
    { name: 'Fatima Holdings', email: 'ai-fatima@game.local' },
    { name: 'Khan & Sons', email: 'ai-khan@game.local' },
    { name: 'Chowdhury Corp', email: 'ai-chowdhury@game.local' },
    { name: 'Sylhet Trading Co', email: 'ai-sylhet@game.local' },
    { name: 'Dhaka Business Group', email: 'ai-dhaka@game.local' },
    { name: 'Bengal Ventures', email: 'ai-bengal@game.local' },
    { name: 'Padma Industries', email: 'ai-padma@game.local' },
  ];

  for (const ai of aiNames) {
    const netWorth = 500000 + Math.random() * 3000000;
    await db.player.create({
      data: {
        name: ai.name,
        email: ai.email,
        cash: netWorth * 0.6,
        netWorth,
        level: Math.floor(Math.random() * 5) + 1,
      },
    });
  }

  // Create some AI businesses
  const aiPlayers = await db.player.findMany({
    where: { email: { contains: 'ai-' } },
    select: { id: true },
  });
  for (const player of aiPlayers) {
    const numBusinesses = Math.floor(Math.random() * 3) + 1;
    const usedTypes = new Set<string>();
    for (let i = 0; i < numBusinesses; i++) {
      let bType = BUSINESS_TYPES[Math.floor(Math.random() * BUSINESS_TYPES.length)];
      while (usedTypes.has(bType.id)) {
        bType = BUSINESS_TYPES[Math.floor(Math.random() * BUSINESS_TYPES.length)];
      }
      usedTypes.add(bType.id);

      const city = CITIES[Math.floor(Math.random() * CITIES.length)];
      await db.business.create({
        data: {
          playerId: player.id,
          type: bType.id,
          city: city.id,
          name: `${bType.name} - ${city.name}`,
          level: Math.floor(Math.random() * 3) + 1,
          reputation: 30 + Math.random() * 60,
          cash: Math.random() * 100000,
          dailyRevenue: 10000 + Math.random() * 50000,
          dailyExpense: 5000 + Math.random() * 25000,
          dailyProfit: 5000 + Math.random() * 25000,
          totalRevenue: Math.random() * 500000,
          totalProfit: Math.random() * 200000,
        },
      });
    }
  }
}

// ---- Generate AI Business Activity ----
/**
 * Phase 1: AI players now have a slight negative bias (centered at -0.05)
 * and reduced range to be more balanced with real players.
 */
export async function simulateAITick(): Promise<void> {
  const aiPlayers = await db.player.findMany({
    where: { email: { contains: 'ai-' } },
    select: { id: true },
  });

  if (aiPlayers.length === 0) return;

  await db.$transaction(async (tx) => {
    for (const player of aiPlayers) {
      // Phase 1: Slight negative bias, reduced range
      const profitChange = (Math.random() + ECONOMY_CONFIG.aiProfitCenter) * ECONOMY_CONFIG.aiProfitRange;
      await tx.player.update({
        where: { id: player.id },
        data: {
          cash: { increment: profitChange },
          netWorth: { increment: profitChange * 0.8 },
        },
      });
    }
  });
}
