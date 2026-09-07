// ============================================
// Bangladesh Business Tycoon - Economy Formulas
// Phase 1: All reusable, testable, documented formulas
//
// Design Principles:
// 1. No guaranteed profit — poorly managed businesses lose money
// 2. Price has consequences — higher prices reduce demand
// 3. Inventory matters — insufficient stock reduces revenue
// 4. Every business has a strategic identity
// 5. Risk vs reward is meaningful
// 6. Server-authoritative — all authoritative calculations here
// ============================================

import { ECONOMY_CONFIG, HEALTH_THRESHOLDS, DEMAND_THRESHOLDS } from './economy-config';
import { getBusinessEconomyConfig } from './business-config';
import { getProductDemandConfig } from './product-demand';
import type {
  PriceDemandInput,
  ProductSalesInput,
  ProductSalesResult,
  ExpenseBreakdown,
  BusinessHealthResult,
  ROIResult,
  HealthStatus,
  DemandLevel,
  DemandTrend,
  ProductPerformance,
  DailyBusinessMetrics,
} from './types';

// ============================================
// 1. POTENTIAL CUSTOMERS
// ============================================

/**
 * Calculate potential customers for a business.
 *
 * Formula:
 *   customers = baseCustomers
 *     × cityMultiplier
 *     × levelBonus
 *     × reputationMultiplier
 *     × stockAvailability
 *     × employeeEfficiency
 *     × eventEffects
 *     × controlledRandomVariation
 *
 * Each layer is documented below.
 */
export function calculatePotentialCustomers(params: {
  baseCustomers: number;
  cityMultiplier: number;
  level: number;
  reputation: number;
  totalStock: number;
  maxStockCapacity: number;
  employeeCount: number;
  avgEmployeeSkill: number;
  eventCustomerEffect: number;
  businessDemandEffect: number;
  businessTypeId: string;
}): number {
  const config = getBusinessEconomyConfig(params.businessTypeId);
  let customers = params.baseCustomers;

  // Layer 1: City multiplier (Dhaka = 1.4x, Rajshahi = 0.9x)
  customers *= params.cityMultiplier;

  // Layer 2: Level bonus (each level adds 12% more customers)
  // Level 1 = 1.0x, Level 5 = 1.48x, Level 10 = 2.08x
  const levelBonus = 1 + Math.max(0, params.level - 1) * ECONOMY_CONFIG.levelBonusPerLevel;
  customers *= levelBonus;

  // Layer 3: Reputation multiplier (0 → 0.4x, 50 → 1.0x, 100 → 1.6x)
  // Linear interpolation between min and max
  const repNorm = Math.max(0, Math.min(100, params.reputation)) / 100;
  const reputationMultiplier = ECONOMY_CONFIG.reputationMinMultiplier +
    repNorm * (ECONOMY_CONFIG.reputationMaxMultiplier - ECONOMY_CONFIG.reputationMinMultiplier);
  customers *= reputationMultiplier;

  // Layer 4: Stock availability
  // No stock = 20% of customers still visit (habit/location)
  // Full stock = 100% of customers
  // Stock ratio is calculated against the capacity target, not absolute max
  const stockTarget = params.maxStockCapacity * config.stockTargetRatio;
  const stockRatio = stockTarget > 0 ? Math.min(params.totalStock / stockTarget, 1.0) : 0;
  const stockAvailability = ECONOMY_CONFIG.stockFloorMultiplier +
    stockRatio * (ECONOMY_CONFIG.stockCeilingMultiplier - ECONOMY_CONFIG.stockFloorMultiplier);
  customers *= stockAvailability;

  // Layer 5: Employee efficiency
  // Each employee adds bonus%, modified by average skill
  const skillFactor = params.employeeCount > 0
    ? 0.7 + (params.avgEmployeeSkill / 10) * 0.3  // Skill 0→0.7x, Skill 10→1.0x
    : 1.0;
  const employeeBonus = 1 + params.employeeCount * config.employeeBonusPer * skillFactor;
  customers *= employeeBonus;

  // Layer 6: Event effects (additive — multiple events stack)
  const eventMultiplier = 1 + params.eventCustomerEffect + params.businessDemandEffect;
  customers *= Math.max(0, eventMultiplier); // Never negative from events

  // Layer 7: Controlled random variation
  // Volatility determines the range: LOW risk = ±8%, HIGH risk = ±18%
  const variationRange = config.volatility * ECONOMY_CONFIG.variationRange;
  const randomFactor = ECONOMY_CONFIG.variationCenter +
    (Math.random() * 2 - 1) * variationRange; // ±volatility
  customers *= Math.max(0.5, randomFactor); // Clamp to prevent catastrophic randomness

  return Math.max(0, Math.floor(customers));
}

// ============================================
// 2. PRICE DEMAND MULTIPLIER
// ============================================

/**
 * Calculate how price affects demand for a product.
 *
 * Core concept: priceRatio = sellPrice / marketReferencePrice
 *
 * When priceRatio = 1.0 (market price): demand is baseline
 * When priceRatio < 1.0 (below market): demand increases
 * When priceRatio > 1.0 (above market): demand decreases
 *
 * Formula: demandMultiplier = baseline / (1 + (priceRatio - 1) × priceSensitivity)^decayRate
 *
 * This gives a smooth, gradual curve instead of hard cliffs.
 * - At market price: multiplier = 1.0
 * - At 20% above with sensitivity 1.0: multiplier ≈ 0.83
 * - At 50% above with sensitivity 1.0: multiplier ≈ 0.67
 * - At 2x price with sensitivity 1.5: multiplier ≈ 0.32
 *
 * The product's own price sensitivity and the business type's sensitivity
 * are combined: effectiveSensitivity = product × business
 */
export function calculatePriceDemandMultiplier(params: PriceDemandInput): number {
  const {
    sellPrice,
    marketReferencePrice,
    productPriceSensitivity,
    businessPriceSensitivity,
  } = params;

  // Safety: avoid division by zero or nonsensical inputs
  const refPrice = Math.max(marketReferencePrice, 1);
  const price = Math.max(sellPrice, 0);

  // Price ratio clamped to prevent extreme values
  const rawRatio = price / refPrice;
  const priceRatio = Math.max(
    ECONOMY_CONFIG.minPriceRatio,
    Math.min(ECONOMY_CONFIG.maxPriceRatio, rawRatio)
  );

  // Combined sensitivity (product × business)
  const effectiveSensitivity = productPriceSensitivity * businessPriceSensitivity;

  // Smooth demand curve using power formula
  // At priceRatio = 1: demand = baseline
  // Above 1: demand decreases exponentially
  // Below 1: demand increases but with diminishing returns
  const deviation = priceRatio - 1; // Positive = above market, Negative = below market
  const demandDenominator = Math.pow(
    1 + Math.abs(deviation) * effectiveSensitivity,
    ECONOMY_CONFIG.priceDecayRate
  );

  let multiplier: number;
  if (deviation >= 0) {
    // Price above market: demand decreases
    multiplier = ECONOMY_CONFIG.baselineDemandAtMarketPrice / demandDenominator;
  } else {
    // Price below market: demand increases with diminishing returns
    // Maximum boost is 50% even at very low prices
    const boost = (demandDenominator - 1) / demandDenominator; // 0 to ~1
    multiplier = ECONOMY_CONFIG.baselineDemandAtMarketPrice * (1 + boost * 0.5);
  }

  // Final clamp: demand never goes below 0.02 (very expensive items still sell occasionally)
  return Math.max(0.02, Math.min(2.0, multiplier));
}

// ============================================
// 3. PRODUCT DEMAND
// ============================================

/**
 * Calculate demand for a specific product, combining base demand,
 * event effects, and product-specific volatility.
 */
export function calculateProductDemand(params: {
  baseDemand: number;
  demandMultiplier: number;  // From market/event effects
  eventDemandEffect: number;
  productVolatility: number;
}): number {
  const { baseDemand, demandMultiplier, eventDemandEffect, productVolatility } = params;

  let demand = baseDemand;

  // Market demand multiplier (from events, market conditions)
  demand *= Math.max(0, demandMultiplier);

  // Event-specific demand effect (additive)
  demand *= Math.max(0, 1 + eventDemandEffect);

  // Product-specific random variation
  const variation = 1 + (Math.random() * 2 - 1) * productVolatility;
  demand *= Math.max(0.3, variation); // Clamp to prevent zero demand from randomness

  return Math.max(0, demand);
}

// ============================================
// 4. ITEMS SOLD (with inventory constraint)
// ============================================

/**
 * Calculate actual items sold, constrained by available inventory.
 *
 * CRITICAL: Sales NEVER exceed available inventory.
 * Inventory NEVER becomes negative.
 */
export function calculateItemsSold(
  calculatedDemand: number,
  availableStock: number
): number {
  const demanded = Math.floor(calculatedDemand);
  const stock = Math.max(0, Math.floor(availableStock));
  return Math.max(0, Math.min(demanded, stock));
}

// ============================================
// 5. REVENUE
// ============================================

/**
 * Calculate revenue from actual items sold.
 * Revenue = itemsSold × sellPrice
 */
export function calculateRevenue(itemsSold: number, sellPrice: number): number {
  return Math.max(0, itemsSold * sellPrice);
}

// ============================================
// 6. COST OF GOODS SOLD (COGS)
// ============================================

/**
 * Calculate cost of goods sold.
 * COGS = itemsSold × purchasePrice (cost basis)
 */
export function calculateCostOfGoodsSold(itemsSold: number, purchasePrice: number): number {
  return Math.max(0, itemsSold * purchasePrice);
}

// ============================================
// 7. BUSINESS EXPENSES
// ============================================

/**
 * Calculate all business expenses for one game day.
 *
 * Rent: baseRent × rentScalePerLevel^(level-1) × cityRentMultiplier
 *   - Uses business-specific scaling, not one-size-fits-all
 *
 * Salaries: SUM(employee.salary) / daysPerMonth
 *   - CRITICAL: Salaries are MONTHLY but ticks are DAILY
 *   - Must divide by 30 to get daily salary expense
 *
 * Utilities: baseUtilityCost × level × businessUtilityMultiplier
 *
 * Taxes: max(profit × taxRateOnProfit, revenue × revenueTaxFloor)
 *   - Tax on profit, with a minimum revenue tax floor
 *   - This ensures businesses pay some tax even with deductions
 */
export function calculateBusinessExpenses(params: {
  baseRent: number;
  level: number;
  cityRentMultiplier: number;
  totalMonthlySalaries: number;
  businessLevel: number;
  businessTypeId: string;
  revenue: number;
  grossProfit: number;
}): ExpenseBreakdown {
  const config = getBusinessEconomyConfig(params.businessTypeId);

  // Rent: base × scale^level × city / daysPerMonth
  // Rent values in game-data are MONTHLY (like salaries), convert to daily
  const monthlyRent = Math.round(
    params.baseRent *
    Math.pow(config.rentScalePerLevel, params.level - 1) *
    params.cityRentMultiplier
  );
  const rent = Math.round(monthlyRent / ECONOMY_CONFIG.daysPerMonth);

  // Salaries: monthly → daily conversion
  const totalMonthlySalaries = params.totalMonthlySalaries;
  const dailySalaries = totalMonthlySalaries / ECONOMY_CONFIG.daysPerMonth;
  const salaries = Math.round(dailySalaries);

  // Utilities: base × level × business type multiplier
  const utilities = Math.round(
    ECONOMY_CONFIG.baseUtilityCostPerLevel *
    params.businessLevel *
    config.utilityMultiplier
  );

  // Taxes: profit-based with revenue floor
  const profitTax = Math.max(0, params.grossProfit) * ECONOMY_CONFIG.taxRateOnProfit;
  const revenueFloorTax = params.revenue * ECONOMY_CONFIG.revenueTaxFloor;
  const taxes = Math.round(Math.max(profitTax, revenueFloorTax));

  const totalExpense = rent + salaries + utilities + taxes;

  return {
    rent,
    salaries,
    utilities,
    taxes,
    totalExpense,
    salaryDetails: {
      monthlySalary: totalMonthlySalaries,
      dailySalary: dailySalaries,
      count: 0, // filled by caller if needed
    },
  };
}

// ============================================
// 8. NET PROFIT
// ============================================

/**
 * Calculate net profit.
 * netProfit = revenue - COGS - expenses
 *
 * Or equivalently: netProfit = grossProfit - expenses
 * where grossProfit = revenue - COGS
 */
export function calculateNetProfit(
  revenue: number,
  costOfGoodsSold: number,
  totalExpenses: number
): number {
  return revenue - costOfGoodsSold - totalExpenses;
}

// ============================================
// 9. BUSINESS HEALTH SCORE
// ============================================

/**
 * Calculate business health score (0-100).
 *
 * Score is a weighted combination of:
 * - Profitability: Is the business making money?
 * - Cash Flow: Is business cash positive?
 * - Inventory Health: Is stock adequate?
 * - Reputation: Is reputation good?
 *
 * The formula is explainable — positive and negative factors are returned.
 */
export function calculateBusinessHealth(params: {
  dailyProfit: number;
  dailyRevenue: number;
  businessCash: number;
  totalStock: number;
  maxStockCapacity: number;
  reputation: number;
  businessTypeId: string;
}): BusinessHealthResult {
  const config = getBusinessEconomyConfig(params.businessTypeId);
  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];

  // Profitability score (0-100)
  // Based on profit margin relative to target margin
  const profitMargin = params.dailyRevenue > 0
    ? params.dailyProfit / params.dailyRevenue
    : -1;
  let profitabilityScore: number;
  if (profitMargin >= config.targetMargin) {
    profitabilityScore = 80 + Math.min(20, (profitMargin - config.targetMargin) * 100);
    positiveFactors.push(`Profit margin ${(profitMargin * 100).toFixed(0)}% exceeds target`);
  } else if (profitMargin > 0) {
    profitabilityScore = 40 + (profitMargin / config.targetMargin) * 40;
    positiveFactors.push('Business is profitable');
  } else {
    profitabilityScore = Math.max(0, 40 + profitMargin * 200);
    negativeFactors.push('Business is losing money');
  }

  // Cash flow score (0-100)
  const cashFlowScore = params.businessCash >= 0
    ? Math.min(100, 60 + (params.businessCash / Math.max(params.dailyRevenue, 1)) * 10)
    : Math.max(0, 60 + (params.businessCash / Math.max(params.dailyRevenue, 1)) * 20);
  if (params.businessCash < 0) {
    negativeFactors.push('Negative cash balance');
  } else if (params.businessCash > params.dailyRevenue * 3) {
    positiveFactors.push('Strong cash reserves');
  }

  // Inventory health score (0-100)
  const stockRatio = params.maxStockCapacity > 0
    ? params.totalStock / params.maxStockCapacity
    : 0;
  const inventoryScore = Math.min(100, stockRatio * 150); // 67% stock = 100 score
  if (stockRatio < 0.1) {
    negativeFactors.push('Very low inventory');
  } else if (stockRatio > 0.5) {
    positiveFactors.push('Good inventory levels');
  }

  // Reputation score (0-100) — direct mapping
  const reputationScore = params.reputation;
  if (params.reputation >= 70) {
    positiveFactors.push('Strong reputation');
  } else if (params.reputation < 30) {
    negativeFactors.push('Low reputation');
  }

  // Weighted combination
  const score = Math.round(
    profitabilityScore * ECONOMY_CONFIG.healthWeightProfitability +
    cashFlowScore * ECONOMY_CONFIG.healthWeightCashFlow +
    inventoryScore * ECONOMY_CONFIG.healthWeightInventory +
    reputationScore * ECONOMY_CONFIG.healthWeightReputation
  );

  const clampedScore = Math.max(0, Math.min(100, score));

  let status: HealthStatus;
  if (clampedScore >= HEALTH_THRESHOLDS.EXCELLENT) status = 'EXCELLENT';
  else if (clampedScore >= HEALTH_THRESHOLDS.HEALTHY) status = 'HEALTHY';
  else if (clampedScore >= HEALTH_THRESHOLDS.NEEDS_ATTENTION) status = 'NEEDS_ATTENTION';
  else if (clampedScore >= HEALTH_THRESHOLDS.STRUGGLING) status = 'STRUGGLING';
  else status = 'CRITICAL';

  return { score: clampedScore, status, positiveFactors, negativeFactors };
}

// ============================================
// 10. ROI & PAYBACK
// ============================================

/**
 * Calculate Return on Investment and estimated payback period.
 *
 * ROI = (cumulativeProfit / investment) × 100
 * Payback = investment / averageDailyProfit (if positive)
 */
export function calculateROI(params: {
  investment: number;
  cumulativeProfit: number;
  averageDailyProfit: number;
  daysActive: number;
}): ROIResult {
  const { investment, cumulativeProfit, averageDailyProfit, daysActive } = params;

  // ROI based on cumulative profit vs investment
  const roiPercentage = investment > 0
    ? (cumulativeProfit / investment) * 100
    : 0;

  // Payback period
  let estimatedPaybackDays: number | null;
  if (averageDailyProfit > 0) {
    estimatedPaybackDays = Math.ceil(investment / averageDailyProfit);
  } else {
    estimatedPaybackDays = null; // Not currently possible
  }

  return {
    investment,
    averageDailyProfit: Math.round(averageDailyProfit),
    cumulativeProfit: Math.round(cumulativeProfit),
    roiPercentage: Math.round(roiPercentage * 10) / 10, // 1 decimal
    estimatedPaybackDays,
  };
}

// ============================================
// 11. DEMAND INDICATORS
// ============================================

/**
 * Classify demand level based on demand multiplier.
 */
export function classifyDemandLevel(multiplier: number): DemandLevel {
  if (multiplier >= DEMAND_THRESHOLDS.VERY_HIGH) return 'VERY_HIGH';
  if (multiplier >= DEMAND_THRESHOLDS.HIGH) return 'HIGH';
  if (multiplier >= DEMAND_THRESHOLDS.NORMAL_LOW) return 'NORMAL';
  if (multiplier >= DEMAND_THRESHOLDS.LOW) return 'LOW';
  return 'VERY_LOW';
}

/**
 * Determine demand trend based on current vs previous value.
 */
export function classifyDemandTrend(current: number, previous: number): DemandTrend {
  const change = (current - previous) / Math.max(previous, 0.01);
  if (change > 0.05) return 'RISING';
  if (change < -0.05) return 'FALLING';
  return 'STABLE';
}

// ============================================
// 12. REPUTATION CHANGE
// ============================================

/**
 * Calculate daily reputation change for a business.
 */
export function calculateReputationChange(params: {
  dailyProfit: number;
  outOfStockRatio: number;  // 0-1, fraction of products out of stock
  managers: { skill: number }[];
  cleaners: { skill: number }[];
}): number {
  let change = 0;

  // Profit reward / loss penalty
  if (params.dailyProfit > 0) {
    change += ECONOMY_CONFIG.reputationGainProfitable;
  } else {
    change -= ECONOMY_CONFIG.reputationLossUnprofitable;
  }

  // Stockout penalty
  if (params.outOfStockRatio > 0) {
    change -= ECONOMY_CONFIG.reputationLossStockout * params.outOfStockRatio;
  }

  // Manager bonus
  change += params.managers.reduce(
    (sum, m) => sum + m.skill * ECONOMY_CONFIG.reputationGainManagerSkill,
    0
  );

  // Cleaner bonus
  change += params.cleaners.reduce(
    (sum, c) => sum + c.skill * ECONOMY_CONFIG.reputationGainCleanerSkill,
    0
  );

  // Natural decay
  change -= ECONOMY_CONFIG.reputationDecay;

  return change;
}

// ============================================
// 13. PRODUCT SALES SIMULATION (Complete Pipeline)
// ============================================

/**
 * Run the complete product sales pipeline for a single inventory item.
 *
 * Pipeline:
 *   1. Calculate product demand (base + events + volatility)
 *   2. Apply price sensitivity (compare sellPrice vs market price)
 *   3. Scale by potential customers
 *   4. Constrain by available stock
 *   5. Calculate revenue and COGS
 *   6. Return detailed results
 */
export function simulateProductSales(params: {
  inventoryId: string;
  productName: string;
  quantity: number;
  purchasePrice: number;
  sellPrice: number;
  marketReferencePrice: number;
  baseDemand: number;
  demandMultiplier: number;
  eventDemandEffect: number;
  productPriceSensitivity: number;
  productVolatility: number;
  businessPriceSensitivity: number;
  potentialCustomers: number;
}): ProductSalesResult {
  // Step 1: Calculate product demand
  const demandBeforePrice = calculateProductDemand({
    baseDemand: params.baseDemand,
    demandMultiplier: params.demandMultiplier,
    eventDemandEffect: params.eventDemandEffect,
    productVolatility: params.productVolatility,
  });

  // Step 2: Apply price sensitivity
  const priceDemandMultiplier = calculatePriceDemandMultiplier({
    sellPrice: params.sellPrice,
    marketReferencePrice: params.marketReferencePrice,
    productPriceSensitivity: params.productPriceSensitivity,
    businessPriceSensitivity: params.businessPriceSensitivity,
  });

  // Step 3: Total demand = customers × demand × priceEffect
  const totalDemand = params.potentialCustomers * demandBeforePrice * priceDemandMultiplier;
  const demandAfterPrice = totalDemand;

  // Step 4: Constrain by inventory
  const itemsSold = calculateItemsSold(totalDemand, params.quantity);

  // Step 5: Revenue and COGS
  const revenue = calculateRevenue(itemsSold, params.sellPrice);
  const costOfGoodsSold = calculateCostOfGoodsSold(itemsSold, params.purchasePrice);

  // Step 6: Profit analysis
  const grossProfit = revenue - costOfGoodsSold;
  const profitMargin = revenue > 0 ? grossProfit / revenue : 0;

  return {
    productName: params.productName,
    demandBeforePrice,
    priceDemandMultiplier,
    demandAfterPrice,
    itemsSold,
    revenue,
    costOfGoodsSold,
    grossProfit,
    profitMargin,
    remainingStock: Math.max(0, params.quantity - itemsSold),
    inventoryId: params.inventoryId,
  };
}

// ============================================
// 14. MARKET PRICE UPDATE (Improved)
// ============================================

/**
 * Calculate new market price with retention of previous value.
 *
 * OLD: priceMultiplier = 1 + (random - 0.5) * 0.1  (full overwrite)
 * NEW: priceMultiplier = previous * retention + freshRandom * (1 - retention)
 *
 * This ensures event effects persist instead of being wiped out.
 */
export function calculateMarketPriceUpdate(
  previousMultiplier: number,
  eventPriceModifier: number
): { priceMultiplier: number; demandMultiplier: number } {
  const retention = ECONOMY_CONFIG.marketPriceRetention;

  // Fresh random fluctuation
  const freshPrice = 1 + (Math.random() - 0.5) * ECONOMY_CONFIG.marketFluctuationRange * 2;
  const freshDemand = 1 + (Math.random() - 0.5) * ECONOMY_CONFIG.marketFluctuationRange * 2;

  // Blend: previous × retention + fresh × (1 - retention)
  let priceMultiplier = previousMultiplier * retention + freshPrice * (1 - retention);

  // Apply event effects on top
  if (eventPriceModifier !== 0) {
    priceMultiplier += eventPriceModifier * ECONOMY_CONFIG.eventMarketEffectStrength;
  }

  // Demand multiplier: similar treatment with retention
  const demandMultiplier = 1 * retention + freshDemand * (1 - retention);

  // Clamp to safe ranges (0.5 to 2.0)
  return {
    priceMultiplier: Math.max(0.5, Math.min(2.0, priceMultiplier)),
    demandMultiplier: Math.max(0.5, Math.min(2.0, demandMultiplier)),
  };
}

// ============================================
// 15. UTILITY: Money Rounding
// ============================================

/**
 * Round money to whole taka (Bangladeshi taka has no paisa in practice for game).
 * Consistent rounding prevents floating-point accumulation errors.
 */
export function roundTaka(amount: number): number {
  return Math.round(amount);
}

/**
 * Safe division that prevents division by zero.
 */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  return denominator !== 0 ? numerator / denominator : fallback;
}
