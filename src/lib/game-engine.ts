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

import { Prisma } from '@prisma/client';
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
import {
  calculateCompetitionPressure,
  calculatePriceIndex,
} from './game/economy/competition';
import type { RivalShopSnapshot } from './game/economy/types';
import { getProductDemandConfig } from './game/economy/product-demand';
import { ECONOMY_CONFIG } from './game/economy/economy-config';
import type { ProductSalesResult, ExpenseBreakdown, BusinessHealthResult } from './game/economy/types';

// Phase 2: AI Competitors Engine
import { simulateAIPlayersTick, randomPersonality, getPersonalityConfig, calculateAIPrice } from './game/ai';

// Phase 3: Customer Experience Engine
import {
  calculateSatisfaction,
  calculateLoyalty,
  calculateNPS,
  calculateSegmentDemands,
  calculateSegmentDemandModifier,
  generateReviews,
  calculatePriceCompetitiveness,
  calculateServiceQuality,
  calculateCXDemandModifier,
  getLoyaltyTier,
} from './game/economy/cx-formulas';
import { REVIEW_CONFIG } from './game/economy/cx-config';

// Phase 4: Marketing System
import {
  calculateCampaignDailySpend,
  calculateCampaignReach,
  calculateCampaignConversions,
  calculateCampaignDemandModifier,
  calculateCombinedMarketingModifier,
  calculateBrandAwareness,
  calculateBrandAwarenessDemandBonus,
  calculateCampaignEffectiveness,
} from './game/marketing/marketing-formulas';
import { MARKETING_CONFIG } from './game/marketing/marketing-config';

// Phase 5: Expansion & Location System
import {
  calculateLocationDemandModifier,
  calculateLocationRentModifier,
  calculateLocationOperatingCostModifier,
  calculateSetupModifier,
  advanceSetupDay,
  getRandomLocationForCity,
  calculateSetupDays,
} from './game/expansion';

// Phase 7: Standing restock orders
import { runAutoRestockForTick } from './game/operations/auto-restock';

// Phase 7: Offline progression — which shops are open this tick
import { resolveTradingBusinesses } from './game/offline/offline-progression';
import { recordTickMilestones } from './analytics/milestones';
import { deliverDuePreOrders, expireGodowns } from './game/storage/storage-service';
import {
  applySpoilage,
  settleSupplierCredit,
  outstandingSupplierDebt,
} from './game/supply/supply-service';
import { sellableStock } from './game/storage/capacity';
import { seasonalDemandMultiplier } from './calendar/seasonal-demand';
import { gameDayToCivilDate } from './calendar/game-clock';
import type { TradeId as CalendarTradeId } from './calendar/observances';
import { pruneOldEvents } from './analytics/track';

// Phase 8: Seasons — the day belongs to a season, not to the world
import {
  ensureActiveSeason,
  advanceSeasonDay,
  getActiveSeason,
  rollOverSeason,
} from './game/seasons/seasons';
import { daysRemaining } from './game/seasons/season-config';

// Phase 8: Push notifications — the few things worth interrupting someone for
import { notifyOutOfStock, notifySeasonEnding } from './push/notifications';

// Phase 8: Season pass — cosmetic track progress, separate from player level
import { awardPassXp } from './commerce/award-pass-xp';

// Phase 8: Brand sponsorship — branded lines on real shelves, counted honestly
import { openLedger, type SponsorshipLedger } from './sponsorship/tracking';
import { PASS_XP } from './commerce/season-pass';

// Phase 6: Player Progression (XP & levelling)
import {
  awardExperience,
  calculateProfitableDayXp,
  crossedFirstProfit,
  PROGRESSION_CONFIG,
} from './game/progression';

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

  // The lock is read-then-written, so it is only safe under an isolation level
  // that rejects write skew. Under the default Read Committed, two concurrent
  // ticks both read "not locked" and both acquire it — which double-processed
  // every business and lost the tickCount increment. Serializable makes the
  // loser abort; we translate that abort into "someone else holds the lock".
  try {
    return await db.$transaction(async (tx) => {
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
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    // P2034 = transaction conflict/deadlock: another tick won the race.
    const code = (error as { code?: string })?.code;
    if (code === 'P2034' || code === 'P2028') {
      return false;
    }
    throw error;
  }
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

  // Goods taken on supplier terms are owed for, exactly as a loan is. Leaving
  // them out would let a player inflate net worth simply by buying everything
  // on thirty days and never settling.
  const supplierDebt = await outstandingSupplierDebt(tx, playerId);

  const netWorth =
    player.cash + totalBusinessCash + totalInventoryValue - outstandingDebt - supplierDebt;
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

  // One read for every market instead of 28 products x 5 cities sequential
  // findUnique calls, which alone cost ~140 round trips per tick.
  const existingRows = await db.marketPrice.findMany({
    select: { productName: true, city: true, priceMultiplier: true },
  });
  const previousByKey = new Map(
    existingRows.map(row => [`${row.productName}|${row.city}`, row.priceMultiplier])
  );

  for (const city of cities) {
    for (const product of allProducts) {
      // Current market price (for retention)
      const previousPriceMult = previousByKey.get(`${product.name}|${city}`) ?? 1;

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

  if (updates.length === 0) return;

  // Single bulk upsert. This was a loop of ~140 sequential upserts inside one
  // interactive transaction, which exceeded Prisma's 5s transaction budget
  // against a remote database and aborted the whole tick with P2028 — market
  // prices never updated and every later step of the tick was skipped.
  const now = new Date();
  await db.$executeRaw`
    INSERT INTO "MarketPrice" ("id", "productName", "city", "priceMultiplier", "demandMultiplier", "updatedAt")
    SELECT
      gen_random_uuid()::text,
      u."productName",
      u."city",
      u."priceMultiplier",
      u."demandMultiplier",
      ${now}
    FROM UNNEST(
      ${updates.map(u => u.productName)}::text[],
      ${updates.map(u => u.city)}::text[],
      ${updates.map(u => u.priceMultiplier)}::double precision[],
      ${updates.map(u => u.demandMultiplier)}::double precision[]
    ) AS u("productName", "city", "priceMultiplier", "demandMultiplier")
    ON CONFLICT ("productName", "city") DO UPDATE SET
      "priceMultiplier" = EXCLUDED."priceMultiplier",
      "demandMultiplier" = EXCLUDED."demandMultiplier",
      "updatedAt" = EXCLUDED."updatedAt"
  `;
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

// ---- Marketing Tick Processing (Phase 4: Marketing System) ----

/**
 * Process all active marketing campaigns for a business.
 * Called within simulateBusinessTick.
 *
 * Returns the marketing effect to apply to demand.
 */
async function processMarketingTick(
  businessId: string,
  businessLevel: number,
  satisfactionScore: number,
  loyaltyScore: number,
  repeatCustomerRate: number,
  currentBrandAwareness: number,
  segmentDemands: { segment: string; demandMultiplier: number }[],
  gameDay: number,
): Promise<{
  combinedDemandModifier: number;
  totalMarketingSpend: number;
  newBrandAwareness: number;
  totalConversions: number;
  totalReach: number;
  campaignIds: string[];  // IDs of campaigns processed this tick (for revenue attribution)
}> {
  // Fetch active campaigns
  const activeCampaigns = await db.marketingCampaign.findMany({
    where: { businessId, status: 'ACTIVE' },
  });

  if (activeCampaigns.length === 0) {
    // No campaigns — just decay brand awareness
    const newAwareness = calculateBrandAwareness(currentBrandAwareness, 0);
    return {
      combinedDemandModifier: 1.0,
      totalMarketingSpend: 0,
      newBrandAwareness: newAwareness,
      totalConversions: 0,
      totalReach: 0,
      campaignIds: [],
    };
  }

  const campaignModifiers: number[] = [];
  const processedCampaignIds: string[] = [];  // Track which campaigns were processed
  let totalSpend = 0;
  let totalReach = 0;
  let totalConversions = 0;

  for (const campaign of activeCampaigns) {
    // Calculate daily spend (clamped to remaining budget)
    const dailySpend = calculateCampaignDailySpend(
      campaign.dailyBudget,
      campaign.totalSpend,
      campaign.totalBudget,
    );

    if (dailySpend <= 0) {
      // Budget exhausted — complete the campaign
      await db.marketingCampaign.update({
        where: { id: campaign.id },
        data: { status: 'COMPLETED' },
      });
      continue;
    }

    // Calculate reach
    const reach = calculateCampaignReach(
      campaign.channel as any,
      dailySpend,
      businessLevel,
    );

    // Calculate conversions
    const conversions = calculateCampaignConversions(
      campaign.channel as any,
      reach,
      satisfactionScore,
      campaign.targetSegment as any,
      segmentDemands,
    );

    // Calculate this campaign's demand modifier
    // Use a reasonable baseline for scaling (business type base customers × city multiplier)
    const baselineForScaling = 50; // Reasonable default
    const demandMod = calculateCampaignDemandModifier(conversions, baselineForScaling);
    campaignModifiers.push(demandMod);

    // Calculate effectiveness
    const newTotalSpend = campaign.totalSpend + dailySpend;
    const newTotalConversions = campaign.totalConversions + conversions;
    const newTotalReach = campaign.totalReach + reach;
    const effectiveness = calculateCampaignEffectiveness(
      newTotalConversions,
      newTotalReach,
      newTotalSpend,
      campaign.revenueInfluenced, // Will be updated later when we know revenue
    );

    // Update campaign
    const newDaysRun = campaign.daysRun + 1;
    const isExpired = newDaysRun >= campaign.duration;

    await db.marketingCampaign.update({
      where: { id: campaign.id },
      data: {
        daysRun: newDaysRun,
        totalSpend: newTotalSpend,
        totalReach: newTotalReach,
        totalConversions: newTotalConversions,
        effectiveness,
        status: isExpired ? 'COMPLETED' : 'ACTIVE',
      },
    });

    // Create daily metric
    await db.campaignMetric.create({
      data: {
        campaignId: campaign.id,
        gameDay,
        dailySpend,
        dailyReach: reach,
        dailyConversions: conversions,
        demandModifier: demandMod,
      },
    });

    totalSpend += dailySpend;
    totalReach += reach;
    totalConversions += conversions;
    processedCampaignIds.push(campaign.id);
  }

  // Combined demand modifier with stacking diminishing returns
  const combinedDemandModifier = calculateCombinedMarketingModifier(campaignModifiers);

  // Brand awareness update
  const newBrandAwareness = calculateBrandAwareness(currentBrandAwareness, totalReach);

  return {
    combinedDemandModifier,
    totalMarketingSpend: totalSpend,
    newBrandAwareness,
    totalConversions,
    totalReach,
    campaignIds: processedCampaignIds,
  };
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
export async function simulateBusinessTick(
  businessId: string,
  /**
   * The day's sponsorship ledger, when the tick is driving. Optional so the
   * function stays callable on its own — a sponsored shelf is not a reason for
   * a single-business simulation to need a ledger.
   */
  sponsorLedger?: SponsorshipLedger,
): Promise<void> {
  // ---- Step 0: Deliveries, then the standing restock order ----
  //
  // Pre-orders land first, because stock ordered *for* the morning of Eid has
  // to be on the shelves for that day's customers rather than the next one.
  // The standing order then tops up whatever the delivery did not cover, and
  // both run before anything below reads the shelves.
  //
  // The season is read once here rather than twice: the delivery needs the day
  // before anything else runs, and the marketing and calendar steps below
  // needed it anyway.
  const activeSeason = await getActiveSeason();
  const gameDay = activeSeason?.gameDay ?? 1;

  await deliverDuePreOrders(businessId, gameDay);
  await runAutoRestockForTick(businessId);

  // Fresh goods go off. Runs after stock arrives — so this morning's delivery
  // is fresh for today's customers — and before the shelves are read, so
  // yesterday's fish is in the bin rather than sold to someone.
  await applySpoilage(businessId);

  const business = await db.business.findUnique({
    where: { id: businessId },
    include: {
      inventories: true,
      employees: true,
      player: { select: { id: true, cash: true, netWorth: true, userId: true, isAI: true } },
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

  // ---- Step 0.5: CX Demand Modifier (from previous tick) ----
  // Use the business's existing satisfaction/loyalty/reputation to calculate
  // how CX affects THIS tick's customer count. This avoids circular dependency
  // because we use previous-tick CX values to influence current-tick demand.
  const previousCxDemandModifier = calculateCXDemandModifier(
    business.satisfactionScore,
    business.repeatCustomerRate,
    getLoyaltyTier(business.loyaltyScore).multiplier,
  );

  // Calculate segment demand modifier from previous-tick data
  // Segments react differently to quality, service, reputation
  // NOTE: priceCompetitiveness is NOT passed to segment demands because price is already
  // handled by per-product priceDemandMultiplier AND satisfaction's priceCompetitiveness.
  // Passing it here would triple-count price effects.
  // Similarly, reputation is already in calculatePotentialCustomers Layer 3 AND satisfaction's
  // atmosphere factor, so we use a moderate value to avoid quadruple-counting.
  const previousCxServiceQuality = calculateServiceQuality(
    business.employees.length,
    business.employees.length > 0
      ? business.employees.reduce((sum, e) => sum + e.skill, 0) / business.employees.length
      : 0,
    2 + business.level,
  );
  // The per-segment breakdown, for the metrics row and the CX screen.
  const segmentDemands = calculateSegmentDemands({
    priceCompetitiveness: 1.0,  // Price already handled by priceDemandMultiplier + satisfaction
    productQuality: Math.max(0, Math.min(1, business.healthScore / 100)), // Use health as quality proxy from previous tick
    serviceQuality: previousCxServiceQuality,
    reputation: Math.min(100, business.reputation * 0.5 + 50),  // Dampened: avg 50 ± 25 from reputation
  });

  // What actually multiplies into demand. Summing the raw segment scores gave a
  // number that was ~0.10 for a new shop and 1.0 only if every factor were
  // perfect — a penalty wearing a modifier's name, and the bulk of the 12x
  // suppression recorded as U2. This is normalised so an ordinary shop reads
  // 1.0. See `calculateSegmentDemandModifier`.
  const segmentDemandModifier = calculateSegmentDemandModifier({
    productQuality: Math.max(0, Math.min(1, business.healthScore / 100)),
    serviceQuality: previousCxServiceQuality,
    reputation: business.reputation,
  });

  // ---- Step 0.6: Marketing Demand Modifier (Phase 4) ----
  // Fetch gameDay early (needed for marketing metrics and later for business metrics)
  // The world's Bangladeshi date is the season's start date plus the day — see
  // `calendar/game-clock.ts`. `activeSeason` and `gameDay` were read at Step 0.
  const worldDate = gameDayToCivilDate(activeSeason?.startedAt, gameDay);

  const marketingEffect = await processMarketingTick(
    business.id,
    business.level,
    business.satisfactionScore,
    business.loyaltyScore,
    business.repeatCustomerRate,
    business.brandAwareness,
    segmentDemands,
    gameDay,
  );

  // ---- Step 1: Calculate potential customers ----
  // What the demand model may count. Each product contributes at most its own
  // shelf space, so goods stockpiled in a rented godown raise what the shop can
  // *hold* without raising what it appears able to *sell* — see
  // `storage/capacity.ts`. For a shop inside its shelf limits this is exactly
  // the old sum, so ordinary play is unchanged.
  const totalStock = sellableStock(business.inventories, PRODUCTS[business.type] || []);
  /** Everything on hand, godown included. Used for the "sold out" check only. */
  const stockOnHand = business.inventories.reduce((sum, inv) => sum + inv.quantity, 0);
  // Max stock capacity: sum of product maxStock values for this business type
  const productDefs = PRODUCTS[business.type] || [];
  const maxStockCapacity = productDefs.reduce((sum, p) => sum + p.maxStock, 0);
  const avgEmployeeSkill = business.employees.length > 0
    ? business.employees.reduce((sum, e) => sum + e.skill, 0) / business.employees.length
    : 0;

  // Phase 5: Location demand modifier (replaces city multiplier with more granular location data)
  const locationDemandModifier = calculateLocationDemandModifier(
    business.location || '',
    business.type,
    city.customerMultiplier,
  );

  const basePotentialCustomers = calculatePotentialCustomers({
    baseCustomers: businessType.baseCustomers,
    cityMultiplier: locationDemandModifier, // Phase 5: Location modifier instead of raw city multiplier
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

  // ---- Step 1.5: Competitive pressure ----
  // Shops of the same trade in the same city draw on one pool of customers.
  // Before this existed, a rival undercutting you cost you nothing, which is
  // why the AI ignoring the player did not matter: there was nothing for it to
  // compete over. Price and reputation now decide the split.
  const rivalBusinesses = await db.business.findMany({
    where: {
      city: business.city,
      type: business.type,
      id: { not: business.id },
      // A shop still being fitted out is not trading yet, and a shop shuttered
      // because its owner is away is not taking custom from anyone.
      setupDaysRemaining: 0,
      dormantSinceDay: null,
    },
    select: {
      id: true,
      reputation: true,
      level: true,
      player: { select: { isAI: true } },
      inventories: { select: { productName: true, sellPrice: true } },
    },
  });

  const priceMultipliersForMarket: Record<string, number> = {};
  for (const [name, mp] of Object.entries(marketPriceMap)) {
    priceMultipliersForMarket[name] = mp.priceMultiplier;
  }

  const selfSnapshot: RivalShopSnapshot = {
    businessId: business.id,
    priceIndex: calculatePriceIndex(business.inventories, productDefs, priceMultipliersForMarket),
    reputation: business.reputation,
    level: business.level,
    isPlayerOwned: true,
  };
  const rivalSnapshots: RivalShopSnapshot[] = rivalBusinesses.map(r => ({
    businessId: r.id,
    priceIndex: calculatePriceIndex(r.inventories, productDefs, priceMultipliersForMarket),
    reputation: r.reputation,
    level: r.level,
    isPlayerOwned: !r.player.isAI,
  }));

  const competition = calculateCompetitionPressure({
    self: selfSnapshot,
    rivals: rivalSnapshots,
  });

  // Apply CX demand modifier, segment demand modifier, and marketing modifiers
  // CX modifier: satisfaction/loyalty affect how many customers visit (0.2-2.0 range)
  // Segment modifier: different customer segments find the business more/less attractive
  // Phase 4: Marketing demand modifier and brand awareness bonus
  // Phase 5: Setup period modifier (reduced capacity during setup)
  const marketingDemandModifier = marketingEffect.combinedDemandModifier;
  const brandAwarenessBonus = calculateBrandAwarenessDemandBonus(marketingEffect.newBrandAwareness);
  const setupModifier = calculateSetupModifier(business.setupDaysRemaining);

  // ---- The Bangladeshi calendar ----
  // Eid, Pohela Boishakh, the monsoon. Safe to multiply into a chain this deep
  // only because its annual mean is exactly 1.0 by construction: it moves a
  // year's custom around the year without adding or removing any of it. See
  // `calendar/seasonal-demand.ts`, and INVARIANTS.md CAL4.
  const seasonalDemandModifier = seasonalDemandMultiplier(
    worldDate,
    business.type as CalendarTradeId,
  );

  const potentialCustomers = Math.max(0, Math.floor(
    basePotentialCustomers * previousCxDemandModifier * segmentDemandModifier * marketingDemandModifier * brandAwarenessBonus * setupModifier * competition.pressure * seasonalDemandModifier
  ));

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

    // A branded line counts as seen when the shop actually stocked and
    // displayed it that day, and as engaged when units of it sold. Both are
    // observed server-side, so neither depends on a beacon an ad blocker eats.
    if (sponsorLedger) {
      const placement = sponsorLedger.placementFor(
        'PRODUCT',
        inventory.productName,
        `${business.id}:${inventory.productName}`,
      );
      if (placement) {
        sponsorLedger.record(
          placement.id,
          business.player.isAI ? null : business.player.userId,
          salesResult.itemsSold > 0,
        );
      }
    }

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

  // Phase 5: Location modifiers for rent and operating costs
  const locationRentModifier = calculateLocationRentModifier(business.location || '', city.rentMultiplier);
  const locationOperatingCostModifier = calculateLocationOperatingCostModifier(business.location || '');

  const expenses = calculateBusinessExpenses({
    baseRent: businessType.rent,
    baseUtilities: businessType.utilities,
    level: business.level,
    cityRentMultiplier: locationRentModifier, // Phase 5: Location rent modifier
    totalMonthlySalaries,
    businessLevel: business.level,
    businessTypeId: business.type,
    revenue: totalRevenue,
    grossProfit,
  });

  // Phase 5: Apply location operating cost modifier to utilities
  // This is a post-hoc modifier on the total expense (before marketing)
  const locationAdjustedExpenses = expenses.totalExpense * locationOperatingCostModifier;

  // ---- Step 4: Calculate net profit ----
  // Phase 4: Include marketing spend in total expenses
  // Phase 5: Use location-adjusted expenses
  const totalExpenseWithMarketing = locationAdjustedExpenses + marketingEffect.totalMarketingSpend;
  const dailyProfit = calculateNetProfit(totalRevenue, totalCOGS, totalExpenseWithMarketing);

  // ---- Step 5: Calculate reputation change ----
  // Empty shelves are the one thing a player genuinely wants waking up for:
  // the shop is still paying rent and earning nothing. Rate-limited to once
  // every six hours per account inside the notifier.
  if (!business.player.isAI && business.player.userId && stockOnHand <= 0) {
    void notifyOutOfStock(business.player.userId, business.name, business.id).catch(() => {
      // A notification is never worth failing a tick for.
    });
  }

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
    // The till is swept to the player every tick (see Step 8), so a business
    // never holds a balance of its own. The liquidity that actually backs this
    // shop's rent and restocking is the owner's cash, so that is what the
    // cash-flow factor is measured against.
    businessCash: business.player.cash + business.cash + dailyProfit,
    totalStock,
    maxStockCapacity,
    reputation: newReputation,
    businessTypeId: business.type,
  });

  // ---- Step 6.5: Customer Experience (Phase 3) ----
  // Calculate price competitiveness across all products
  const cxPriceCompetitiveness = calculatePriceCompetitiveness(
    business.inventories.map(inv => ({ productName: inv.productName, sellPrice: inv.sellPrice })),
    productDefs.map(p => ({ name: p.name, basePrice: p.basePrice, suggestedMarkup: p.suggestedMarkup })),
    marketPriceMap,
  );

  // Calculate service quality from employees
  const idealEmployeeCount = 2 + business.level; // Base 2 + 1 per level
  const cxServiceQuality = calculateServiceQuality(
    business.employees.length,
    avgEmployeeSkill,
    idealEmployeeCount,
  );

  // Calculate product quality from margin (higher margin = better products)
  const cxProductQuality = totalRevenue > 0
    ? Math.min(1, Math.max(0, (totalRevenue - totalCOGS) / totalRevenue / 0.3))
    : 0.5;

  // Calculate satisfaction
  const cxSatisfaction = calculateSatisfaction({
    priceCompetitiveness: cxPriceCompetitiveness,
    stockAvailability: maxStockCapacity > 0 ? totalStock / maxStockCapacity : 0,
    serviceQuality: cxServiceQuality,
    productQuality: cxProductQuality,
    atmosphere: newReputation / 100,
    currentSatisfaction: business.satisfactionScore,
  });

  // Determine if this was a positive experience
  const wasPositiveExperience = cxSatisfaction.overall >= 50 && dailyProfit >= 0;

  // Calculate loyalty
  const cxLoyalty = calculateLoyalty({
    currentLoyaltyScore: business.loyaltyScore,
    currentRepeatRate: business.repeatCustomerRate,
    wasPositiveExperience,
    totalCustomers: potentialCustomers,
    numberOfReviews: business.totalReviews,
    averageRating: business.avgReviewRating,
    loyaltyMultiplier: getLoyaltyTier(business.loyaltyScore).multiplier,
  });

  // ---- Step 7: Get game day for metrics ----
  // (gameDay already fetched at Step 0.6 for marketing processing)

  // ---- Step 8: Execute all updates in a single transaction ----
  await db.$transaction(async (tx) => {
    // Update inventory quantities
    for (const upd of inventoryUpdates) {
      await tx.inventory.update({
        where: { id: upd.id },
        data: { quantity: { decrement: upd.quantityDecrement } },
      });
    }

    // Distribute business profit to player cash.
    //
    // This used to *add* the day's profit to `Business.cash` and *also*
    // increment `Player.cash` by the same amount. Since net worth sums
    // `player.cash + SUM(business.cash) + inventory - debt`, every taka of
    // profit was counted twice and net worth grew at double the true rate
    // (losses compounded twice as fast too).
    //
    // The till is now swept: the business ends each tick at zero and the
    // player holds everything it earned. Sweeping the *existing* balance as
    // well as today's profit also drains the stranded balances older saves
    // accumulated — that money was already inside their net worth but was
    // unreachable, so this moves it without changing the total.
    const profitToDistribute = roundTaka(business.cash + dailyProfit);

    // Update business (including Phase 3 CX fields, Phase 4 Marketing fields, Phase 5 Expansion fields)
    // Phase 5: Advance setup days remaining
    const newSetupDaysRemaining = advanceSetupDay(business.setupDaysRemaining);

    await tx.business.update({
      where: { id: business.id },
      data: {
        dailyRevenue: roundTaka(totalRevenue),
        dailyExpense: roundTaka(totalExpenseWithMarketing),
        dailyProfit: roundTaka(dailyProfit),
        dailyCOGS: roundTaka(totalCOGS),
        dailyCustomers: potentialCustomers,
        cash: 0,  // swept to the player below
        totalRevenue: business.totalRevenue + roundTaka(totalRevenue),
        totalProfit: business.totalProfit + roundTaka(dailyProfit),
        reputation: newReputation,
        healthScore: healthResult.score,
        // Phase 3: CX fields
        satisfactionScore: cxSatisfaction.overall,
        loyaltyScore: cxLoyalty.loyaltyScore,
        repeatCustomerRate: cxLoyalty.repeatCustomerRate,
        // Phase 4: Marketing fields
        brandAwareness: marketingEffect.newBrandAwareness,
        // Phase 5: Expansion fields
        setupDaysRemaining: newSetupDaysRemaining,
      },
    });

    // Sweep the till to the player.
    await tx.player.update({
      where: { id: business.playerId },
      data: { cash: { increment: profitToDistribute } },
    });

    // ---- Phase 6: Player progression ----
    // XP is the gate on expansion (a second business needs level 2), so it is
    // awarded here, inside the same transaction as the day's result: a tick
    // that rolls back must not leave the player holding XP for a day that
    // never happened.
    const newTotalProfit = business.totalProfit + roundTaka(dailyProfit);
    const dayXp = calculateProfitableDayXp(dailyProfit);
    if (dayXp > 0) {
      await awardExperience(tx, business.playerId, dayXp, 'PROFITABLE_DAY', business.id);
      // The cosmetic track advances alongside the player's level, but they are
      // separate currencies: level gates expansion and borrowing, pass XP buys
      // nothing but signage.
      await awardPassXp(tx, business.playerId, PASS_XP.profitableDay);
    }
    if (crossedFirstProfit(business.totalProfit, newTotalProfit)) {
      await awardExperience(
        tx,
        business.playerId,
        PROGRESSION_CONFIG.firstProfitXp,
        'FIRST_PROFIT',
        business.id,
      );
    }

    // Phase 4: Attribute revenue to campaigns for ROI analytics
    // NOTE: Marketing spend is already included in totalExpenseWithMarketing
    // which reduced dailyProfit, so it's already deducted from player cash
    // via the profitToDistribute above. Do NOT deduct again.
    if (marketingEffect.totalMarketingSpend > 0 && totalRevenue > 0 && marketingEffect.campaignIds.length > 0) {
      // Fetch campaigns that were processed this tick (using IDs from processMarketingTick)
      const processedCampaigns = await tx.marketingCampaign.findMany({
        where: { id: { in: marketingEffect.campaignIds } },
        select: { id: true, totalSpend: true },
      });
      const totalCampaignSpend = processedCampaigns.reduce((sum, c) => sum + c.totalSpend, 0);
      if (totalCampaignSpend > 0) {
        // Only attribute the "extra" revenue from marketing (not base revenue)
        // Correct formula: total boost = marketingDemandModifier × brandAwarenessBonus
        // Extra fraction = 1 - 1/totalBoost (how much of revenue is due to marketing)
        const totalMarketingBoost = marketingDemandModifier * brandAwarenessBonus;
        const extraFraction = totalMarketingBoost > 1 ? (1 - 1 / totalMarketingBoost) : 0;
        const marketingRevenue = totalRevenue * extraFraction;

        for (const campaign of processedCampaigns) {
          const spendShare = campaign.totalSpend / totalCampaignSpend;
          const attributedRevenue = Math.max(0, marketingRevenue * spendShare);
          if (attributedRevenue > 0) {
            await tx.marketingCampaign.update({
              where: { id: campaign.id },
              data: { revenueInfluenced: { increment: roundTaka(attributedRevenue) } },
            });
          }
        }
      }
    }

    // Save daily metrics for analytics (including Phase 3 CX metrics)
    await tx.businessMetric.upsert({
      where: { businessId_gameDay: { businessId: business.id, gameDay } },
      create: {
        businessId: business.id,
        gameDay,
        revenue: roundTaka(totalRevenue),
        expenses: roundTaka(totalExpenseWithMarketing),
        profit: roundTaka(dailyProfit),
        cogs: roundTaka(totalCOGS),
        customers: potentialCustomers,
        reputation: newReputation,
        // Phase 3: CX metrics
        satisfaction: cxSatisfaction.overall,
        loyalty: cxLoyalty.loyaltyScore,
        nps: business.npsScore,
      },
      update: {
        revenue: roundTaka(totalRevenue),
        expenses: roundTaka(totalExpenseWithMarketing),
        profit: roundTaka(dailyProfit),
        cogs: roundTaka(totalCOGS),
        customers: potentialCustomers,
        reputation: newReputation,
        // Phase 3: CX metrics
        satisfaction: cxSatisfaction.overall,
        loyalty: cxLoyalty.loyaltyScore,
        nps: business.npsScore,
      },
    });

    // Log (with Phase 3 CX info and Phase 5 setup info)
    const cogsStr = totalCOGS > 0 ? ` | COGS ৳${roundTaka(totalCOGS).toLocaleString()}` : '';
    const setupStr = business.setupDaysRemaining > 0 ? ` | Setup ${business.setupDaysRemaining}d` : '';
    await tx.gameLog.create({
      data: {
        playerId: business.playerId,
        businessId: business.id,
        type: dailyProfit >= 0 ? 'PROFIT' : 'LOSS',
        message: `${business.name}: Rev ৳${roundTaka(totalRevenue).toLocaleString()}${cogsStr} | Exp ৳${roundTaka(totalExpenseWithMarketing).toLocaleString()} | ${dailyProfit >= 0 ? 'Profit' : 'Loss'} ৳${Math.abs(roundTaka(dailyProfit)).toLocaleString()} | ${potentialCustomers} customers | Health ${healthResult.score} | Sat ${Math.round(cxSatisfaction.overall)} | Loy ${cxLoyalty.tier} | Mkt ৳${roundTaka(marketingEffect.totalMarketingSpend).toLocaleString()}${setupStr}`,
        amount: dailyProfit,
      },
    });

    // Phase 3: Generate and persist customer reviews
    const cxReviews = generateReviews(business.id, gameDay, cxSatisfaction, REVIEW_CONFIG.maxPerTick);
    for (const review of cxReviews) {
      await tx.customerReview.create({
        data: {
          businessId: review.businessId,
          gameDay: review.gameDay,
          rating: review.rating,
          sentiment: review.sentiment,
          category: review.category,
          comment: review.comment,
          segment: review.segment,
        },
      });
    }

    // Phase 3: Update NPS and review stats
    if (cxReviews.length > 0) {
      const allReviews = await tx.customerReview.findMany({
        where: { businessId: business.id },
        select: { rating: true },
        orderBy: { createdAt: 'desc' },
        take: REVIEW_CONFIG.keepLast,
      });
      const npsResult = calculateNPS(allReviews);
      const totalReviews = allReviews.length;
      const avgRating = totalReviews > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

      await tx.business.update({
        where: { id: business.id },
        data: {
          npsScore: npsResult.nps,
          totalReviews,
          avgReviewRating: Math.round(avgRating * 100) / 100,
        },
      });

      // Prune old reviews (keep only last N)
      const reviewCount = await tx.customerReview.count({
        where: { businessId: business.id },
      });
      if (reviewCount > REVIEW_CONFIG.keepLast) {
        const oldReviews = await tx.customerReview.findMany({
          where: { businessId: business.id },
          orderBy: { createdAt: 'asc' },
          take: reviewCount - REVIEW_CONFIG.keepLast,
          select: { id: true },
        });
        for (const old of oldReviews) {
          await tx.customerReview.delete({ where: { id: old.id } });
        }
      }
    }

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

      // Phase 6: clearing a loan is a one-off milestone. Keyed on the
      // ACTIVE -> cleared transition, so it fires once per loan.
      if (newRemainingDebt <= 0) {
        await awardExperience(
          tx,
          loan.playerId,
          PROGRESSION_CONFIG.loanClearedXp,
          'LOAN_CLEARED',
        );
      }
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
  const season = await ensureActiveSeason();
  const tickNum = season.tickCount;

  // Expire old events
  await db.gameEvent.updateMany({
    where: { active: true, endsAt: { lt: new Date() } },
    data: { active: false },
  });

  // The day belongs to the season now, not to the world. `lastTick` is still
  // written to GameState because the clock UI polls it and it is genuinely
  // world-level — the scheduler runs one clock, whichever season is active.
  const { gameDay: currentDay, finished: seasonFinished } = await advanceSeasonDay();
  await db.gameState.upsert({
    where: { key: 'lastTick' },
    create: { key: 'lastTick', value: new Date().toISOString() },
    update: { value: new Date().toISOString() },
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

  // 1. Simulate the businesses that are open today.
  //
  // A human owner's shops trade while the owner is inside the offline grace
  // window and are shuttered past it, so a player who closes the tab overnight
  // comes back to a paused chain rather than to hundreds of unattended days of
  // rent. AI competitors always trade. See `game/offline/offline-progression`.
  // Rentals that have run their term close here, before anyone trades, so a
  // shop's capacity for the day is settled before deliveries are measured
  // against it. Stock already in a lapsed godown is kept, not confiscated.
  try {
    await expireGodowns(currentDay);
  } catch (err) {
    console.error('[GameEngine] Failed to close expired rentals:', err);
  }

  const tradingBusinessIds = await resolveTradingBusinesses(currentDay);
  // Sponsorship counts accumulate in memory across the whole day's businesses
  // and are written once at the end — see `sponsorship/tracking.ts` for why a
  // row per impression would be the wrong shape.
  const sponsorLedger = await openLedger(currentDay);

  for (const businessId of tradingBusinessIds) {
    try {
      await simulateBusinessTick(businessId, sponsorLedger);
    } catch (err) {
      console.error(`[GameEngine] Failed to simulate business ${businessId}:`, err);
    }
  }

  try {
    await sponsorLedger.flush();
  } catch (err) {
    console.error('[GameEngine] Failed to write sponsorship stats:', err);
  }

  // 2. Process loan payments
  try {
    await processLoanPayments();
  } catch (err) {
    console.error('[GameEngine] Failed to process loan payments:', err);
  }

  // 2.5 Supplier bills. A player who cannot pay does not lose their shop —
  // the bill goes overdue, accrues a late fee, and no supplier will sell them
  // on terms until it is cleared.
  try {
    await settleSupplierCredit(currentDay);
  } catch (err) {
    console.error('[GameEngine] Failed to settle supplier credit:', err);
  }

  // 3. Simulate AI player activity (Phase 2: Real AI decisions)
  try {
    await simulateAIPlayersTick(currentDay);
  } catch (err) {
    console.error('[GameEngine] Failed to simulate AI tick:', err);
  }

  // 3.5 Onboarding milestones the simulation just produced. `first_profit` and
  // `first_week_completed` have no request behind them, so they are detected
  // here rather than in a route handler.
  try {
    await recordTickMilestones(currentDay, season.id);
  } catch (err) {
    console.error('[GameEngine] Failed to record analytics milestones:', err);
  }

  // A game day is a real minute, so the event table grows steadily. Pruned once
  // a game month rather than every tick.
  if (tickNum % 30 === 0) {
    void pruneOldEvents().catch(() => {});
  }

  // 4. Generate news (50% chance)
  if (Math.random() < 0.5) {
    try {
      await generateNews();
    } catch (err) {
      console.error('[GameEngine] Failed to generate news:', err);
    }
  }

  // 4.5 Warn about a season that is nearly over, so a player can make a last
  // push at the ladder rather than discovering it closed.
  if (daysRemaining(currentDay, season.lengthDays) <= 7) {
    try {
      const owners = await db.player.findMany({
        where: { seasonId: season.id, isAI: false, userId: { not: null } },
        select: { userId: true },
      });
      const left = daysRemaining(currentDay, season.lengthDays);
      for (const owner of owners) {
        void notifySeasonEnding(owner.userId!, season.name, left).catch(() => {});
      }
    } catch (err) {
      console.error('[GameEngine] Season-ending notifications failed:', err);
    }
  }

  // 5. Close the season if it has run its course.
  //
  // Last, so the day that ends a season is simulated in full before the books
  // are closed on it — a player's final day should count.
  if (seasonFinished) {
    try {
      const rollover = await rollOverSeason();
      if (rollover) {
        console.info(
          `[GameEngine] Season ${rollover.endedSeasonNumber} ended; ` +
            `season ${rollover.newSeasonNumber} started. ${rollover.archived} archived.`,
        );
        // A new season needs its own cohort of competitors.
        await seedAIPlayers();
      }
    } catch (err) {
      console.error('[GameEngine] Season rollover failed:', err);
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

/** Bumped when the seed content changes and needs to be re-applied. */
const SEED_VERSION = '1';

export async function seedInitialData(): Promise<void> {
  // Fast path: this used to run ~175 sequential upserts on *every* page load,
  // which took ~50s against a remote database and left the UI on a skeleton
  // until it finished. One indexed read now short-circuits the whole thing.
  const seeded = await db.gameState.findUnique({ where: { key: 'seedVersion' } });
  if (seeded?.value === SEED_VERSION) return;

  const allProducts = Object.values(PRODUCTS).flat();
  const cities = CITIES.map(c => c.id);

  // Bulk insert instead of per-row upserts: two round trips rather than ~170.
  await db.product.createMany({
    data: allProducts.map(product => ({
      name: product.name,
      category: product.category,
      basePrice: product.basePrice,
      baseDemand: product.baseDemand,
      icon: product.icon,
    })),
    skipDuplicates: true,
  });

  await db.marketPrice.createMany({
    data: cities.flatMap(city =>
      allProducts.map(product => ({
        productName: product.name,
        city,
        priceMultiplier: 1,
        demandMultiplier: 1,
      }))
    ),
    skipDuplicates: true,
  });

  // Game state
  await db.gameState.createMany({
    data: [
      { key: 'lastTick', value: new Date().toISOString() },
      { key: 'tickCount', value: '0' },
      { key: 'gameDay', value: '1' },
      { key: 'tickInProgress', value: 'false' },
      { key: 'tickVersion', value: '0' },
    ],
    skipDuplicates: true,
  });

  // Generate initial news
  for (let i = 0; i < 5; i++) {
    await generateNews();
  }

  // Generate initial event
  await generateEvent();

  // Recorded last: if anything above throws, the next call retries the seed.
  await db.gameState.upsert({
    where: { key: 'seedVersion' },
    create: { key: 'seedVersion', value: SEED_VERSION },
    update: { value: SEED_VERSION },
  });
}

// ---- Create AI Players for Competition (Phase 2: Real Competitors) ----

/**
 * Phase 2: Seed AI players with real personalities, businesses, inventory, and employees.
 * These are no longer decorative — they compete in the real economy.
 */
export async function seedAIPlayers(): Promise<void> {
  // Competitors belong to a season, like everyone else. Each new season gets a
  // fresh cohort rather than inheriting the last one's empires — otherwise the
  // reset would apply to the players and not to the rivals they are measured
  // against, which is worse than not resetting at all.
  const season = await ensureActiveSeason();

  const existingAI = await db.player.count({ where: { isAI: true, seasonId: season.id } });
  if (existingAI > 0) return; // Already seeded for this season

  const aiDefinitions = [
    { name: 'Rahim Enterprises', email: 'ai-rahim@game.local', personality: 'CONSERVATIVE' as const },
    { name: 'Fatima Holdings', email: 'ai-fatima@game.local', personality: 'AGGRESSIVE' as const },
    { name: 'Khan & Sons', email: 'ai-khan@game.local', personality: 'BALANCED' as const },
    { name: 'Chowdhury Corp', email: 'ai-chowdhury@game.local', personality: 'TRADER' as const },
    { name: 'Sylhet Trading Co', email: 'ai-sylhet@game.local', personality: 'EXPANSIONIST' as const },
    { name: 'Dhaka Business Group', email: 'ai-dhaka@game.local', personality: 'BALANCED' as const },
    { name: 'Bengal Ventures', email: 'ai-bengal@game.local', personality: 'AGGRESSIVE' as const },
    { name: 'Padma Industries', email: 'ai-padma@game.local', personality: 'CONSERVATIVE' as const },
  ];

  for (const ai of aiDefinitions) {
    const config = getPersonalityConfig(ai.personality);
    // Starting cash varies by personality
    const baseCash = 600000 + Math.random() * 600000; // 600K-1.2M starting cash
    const netWorth = baseCash;

    const player = await db.player.create({
      data: {
        name: ai.name,
        // `Player.email` is unique, so a competitor's address has to carry the
        // season it belongs to or season 2 could not seed at all.
        email: ai.email.replace('@', `-s${season.number}@`),
        seasonId: season.id,
        cash: baseCash,
        netWorth,
        level: 1,
        isAI: true,
        personality: ai.personality,
        lastActionAt: 0,
      },
    });

    // Track remaining cash for affordability checks
    let remainingCash = baseCash;

    // Each AI starts with 1-2 businesses (depending on personality)
    const numBusinesses = ai.personality === 'EXPANSIONIST' ? 2 : 1;
    const usedTypes = new Set<string>();

    for (let i = 0; i < numBusinesses; i++) {
      let bType: typeof BUSINESS_TYPES[number] | undefined;

      if (i === 0) {
        // First business: prefer cheaper, stable types (TEA_STALL, GROCERY)
        const starterTypes = BUSINESS_TYPES.filter(b => b.investment <= 300000);
        bType = starterTypes.length > 0
          ? starterTypes[Math.floor(Math.random() * starterTypes.length)]
          : BUSINESS_TYPES[0]; // fallback
      } else {
        // Second business (EXPANSIONIST only): any affordable type keeping 200K cash reserve
        const affordableTypes = BUSINESS_TYPES.filter(b => !usedTypes.has(b.id) && remainingCash > b.investment + 200000);
        if (affordableTypes.length === 0) break; // Can't afford any second business
        bType = affordableTypes[Math.floor(Math.random() * affordableTypes.length)];
      }

      if (!bType) break;
      usedTypes.add(bType.id);

      // Pick city
      const city = CITIES[Math.floor(Math.random() * CITIES.length)];

      // Phase 5: Pick location within city
      const aiLocation = getRandomLocationForCity(city.id);
      const aiLocationId = aiLocation?.id || null;

      // Deduct investment from AI cash
      const investmentCost = bType.investment;
      remainingCash -= investmentCost;

      // Create business
      const business = await db.business.create({
        data: {
          playerId: player.id,
          type: bType.id,
          city: city.id,
          name: `${bType.name} - ${city.name}`,
          level: 1,
          reputation: 40 + Math.random() * 20, // Start at 40-60
          cash: 0,
          // Phase 5: Location and setup
          location: aiLocationId,
          setupDaysRemaining: 0, // AI initial businesses start fully operational
        },
      });

      // Deduct investment
      await db.player.update({
        where: { id: player.id },
        data: { cash: { decrement: investmentCost } },
      });

      // Create initial inventory for all products of this business type
      const productDefs = PRODUCTS[bType.id] || [];
      for (const prod of productDefs) {
        const initialStock = Math.floor(prod.maxStock * 0.4); // 40% stock
        const costPerUnit = prod.basePrice;

        // Calculate AI sell price using personality
        const marketRef = prod.basePrice * (1 + prod.suggestedMarkup);
        const sellPrice = calculateAIPrice(marketRef, ai.personality, config.defaultPricingStrategy, 50, 0.4);

        const invCost = Math.round(costPerUnit * initialStock);
        remainingCash -= invCost;

        await db.inventory.create({
          data: {
            businessId: business.id,
            productId: '',
            productName: prod.name,
            category: prod.category,
            quantity: initialStock,
            purchasePrice: costPerUnit,
            sellPrice,
          },
        });

        // Deduct inventory cost
        await db.player.update({
          where: { id: player.id },
          data: { cash: { decrement: invCost } },
        });
      }

      // Hire 1-2 employees based on personality
      const hireCount = config.hiringPreference > 0.5 ? 2 : 1;
      const rolesToHire = ['SALESPERSON', 'CASHIER'].slice(0, hireCount);
      for (const role of rolesToHire) {
        const roleDef = EMPLOYEE_ROLES.find(r => r.role === role);
        if (roleDef) {
          await db.employee.create({
            data: {
              businessId: business.id,
              role: roleDef.role,
              name: getRandomName(),
              salary: roleDef.baseSalary,
              skill: 4 + Math.random() * 4, // 4-8 skill
              efficiency: 0.6 + Math.random() * 0.3, // 0.6-0.9
            },
          });
        }
      }
    }

    // Recalculate net worth after all purchases
    await recalculateNetWorth(db as any, player.id);
  }
}

// ---- AI Business Activity (Phase 2: Delegated to AI Engine) ----
/**
 * Phase 2: AI simulation is now handled by the AI Engine.
 * This function is kept as a compatibility wrapper but delegates
 * to simulateAIPlayersTick() in lib/game/ai/.
 *
 * The actual AI tick runs inside gameTick() where it has access to gameDay.
 * This function is no longer called directly.
 */
export async function simulateAITick(): Promise<void> {
  // Phase 2: This is now handled inside gameTick() directly
  // via simulateAIPlayersTick(gameDay). Kept as no-op for safety.
}
