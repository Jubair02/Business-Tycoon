// ============================================
// Bangladesh Business Tycoon - Expansion Formulas
// Phase 5: Business Expansion & Growth System
// ============================================

import { EXPANSION_CONFIG, getLocation, isBusinessTypeSuitable } from './expansion-config';
import type { Location } from './expansion-config';

// ---- Expansion Cost Calculations ----

/**
 * Calculate the total cost to open a new business, accounting for:
 * - Base investment cost
 * - Expansion cost scaling (more businesses = higher cost)
 * - Location modifier
 * - Setup cost
 */
export function calculateExpansionCost(
  baseInvestment: number,
  currentBusinessCount: number,
  locationId: string,
  businessTypeId: string,
): {
  baseCost: number;
  expansionPremium: number;
  locationModifier: number;
  setupCost: number;
  totalCost: number;
} {
  // Base cost scales with number of businesses already owned
  // First business = baseCost, second = baseCost × 1.4, third = baseCost × 1.8, etc.
  const expansionPremium = currentBusinessCount * EXPANSION_CONFIG.expansionCostScaleFactor;
  const scaledBaseCost = baseInvestment * (1 + expansionPremium);

  // Location modifier: premium locations cost more, affordable ones cost less
  const location = getLocation(locationId);
  const locationModifier = location ? (location.rentModifier * 0.4 + 0.6) : 1.0; // Blend: 60% base + 40% location

  // Setup cost: proportional to business size
  const setupCost = Math.round(baseInvestment * 0.15 * locationModifier);

  // Suitability check affects setup cost (unsuitable = more expensive setup)
  const suitability = isBusinessTypeSuitable(locationId, businessTypeId);
  const suitabilityMultiplier = suitability === 'unsuitable' ? 1.5 : 1.0;

  const totalCost = Math.round((scaledBaseCost * locationModifier + setupCost * suitabilityMultiplier));

  return {
    baseCost: Math.round(scaledBaseCost),
    expansionPremium: Math.round(baseInvestment * expansionPremium),
    locationModifier,
    setupCost: Math.round(setupCost * suitabilityMultiplier),
    totalCost,
  };
}

/**
 * Calculate setup days for a new business.
 * More expensive businesses take longer to set up.
 */
export function calculateSetupDays(baseInvestment:(number)): number {
  // Setup days scale with investment: 50K = 3 days, 1M = ~8 days
  const days = EXPANSION_CONFIG.baseSetupDays + Math.floor(Math.log2(baseInvestment / 50000 + 1));
  return Math.min(days, EXPANSION_CONFIG.maxSetupDays);
}

// ---- Expansion Eligibility ----

export interface ExpansionEligibility {
  canExpand: boolean;
  reasons: string[];
  warnings: string[];
}

/**
 * Check if a player is eligible to expand (open a new business).
 * Returns detailed eligibility report with reasons and warnings.
 */
export function checkExpansionEligibility(
  playerCash: number,
  playerNetWorth: number,
  playerLevel: number,
  currentBusinessCount: number,
  lastExpansionAt: number,
  currentGameDay: number,
  businessDailyProfits: number[],
  expansionCost: number,
): ExpansionEligibility {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let canExpand = true;

  // Check 1: Maximum businesses
  if (currentBusinessCount >= EXPANSION_CONFIG.maxBusinessesPerPlayer) {
    canExpand = false;
    reasons.push(`Maximum ${EXPANSION_CONFIG.maxBusinessesPerPlayer} businesses reached`);
  }

  // Check 2: Can afford expansion cost
  if (playerCash < expansionCost) {
    canExpand = false;
    reasons.push(`Insufficient cash: need ৳${expansionCost.toLocaleString()}, have ৳${Math.round(playerCash).toLocaleString()}`);
  }

  // Check 3: Cash reserve after expansion
  const cashAfterExpansion = playerCash - expansionCost;
  const minReserve = playerNetWorth * EXPANSION_CONFIG.minCashReserveRatio;
  if (cashAfterExpansion < minReserve) {
    canExpand = false;
    reasons.push(`Need ৳${Math.round(minReserve).toLocaleString()} cash reserve after expansion (cash after: ৳${Math.round(cashAfterExpansion).toLocaleString()})`);
  }

  // Check 4: Player level requirement
  const requiredLevel = currentBusinessCount === 0
    ? 1
    : currentBusinessCount === 1
      ? EXPANSION_CONFIG.minLevelForSecondBusiness
      : EXPANSION_CONFIG.minLevelForSecondBusiness + (currentBusinessCount - 1) * EXPANSION_CONFIG.minLevelPerAdditionalBusiness;
  if (playerLevel < requiredLevel) {
    canExpand = false;
    reasons.push(`Level ${requiredLevel} required for business #${currentBusinessCount + 1} (current: ${playerLevel})`);
  }

  // Check 5: Expansion cooldown
  const daysSinceExpansion = currentGameDay - lastExpansionAt;
  if (lastExpansionAt > 0 && daysSinceExpansion < EXPANSION_CONFIG.expansionCooldownDays) {
    canExpand = false;
    reasons.push(`Expansion cooldown: ${EXPANSION_CONFIG.expansionCooldownDays - daysSinceExpansion} days remaining`);
  }

  // Warnings (don't block expansion but alert player)
  const profitableDays = businessDailyProfits.filter(p => p > 0).length;
  if (profitableDays < EXPANSION_CONFIG.minProfitDaysBeforeExpansion && currentBusinessCount > 0) {
    warnings.push(`Only ${profitableDays} profitable days recently (recommended: ${EXPANSION_CONFIG.minProfitDaysBeforeExpansion}+)`);
  }

  if (cashAfterExpansion < playerNetWorth * 0.25) {
    warnings.push('Low cash reserve after expansion — risky move');
  }

  if (currentBusinessCount >= 3) {
    warnings.push('Managing many businesses increases complexity and risk');
  }

  return { canExpand, reasons, warnings };
}

// ---- Location Effect on Business ----

/**
 * Calculate the location demand modifier for a business.
 * Combines location customer modifier with suitability effects.
 * Range: ~0.7 (unsuitable in poor location) to ~1.7 (suitable in prime location)
 */
export function calculateLocationDemandModifier(
  locationId: string,
  businessTypeId: string,
  cityCustomerMultiplier: number,
): number {
  const location = getLocation(locationId);
  if (!location) return cityCustomerMultiplier;

  // Base: location customer modifier replaces city customer modifier
  // (location is more specific than city, so it supersedes)
  let modifier = location.customerModifier;

  // Suitability effect
  const suitability = isBusinessTypeSuitable(locationId, businessTypeId);
  if (suitability === 'suitable') {
    modifier *= EXPANSION_CONFIG.suitableLocationBonus;
  } else if (suitability === 'unsuitable') {
    modifier *= EXPANSION_CONFIG.unsuitableLocationPenalty;
  }

  return modifier;
}

/**
 * Calculate the location rent modifier for a business.
 * This replaces the city rent modifier with the more granular location modifier.
 */
export function calculateLocationRentModifier(locationId: string, cityRentMultiplier: number): number {
  const location = getLocation(locationId);
  if (!location) return cityRentMultiplier;
  return location.rentModifier;
}

/**
 * Calculate the location operating cost modifier.
 * Affects utilities and maintenance costs.
 */
export function calculateLocationOperatingCostModifier(locationId: string): number {
  const location = getLocation(locationId);
  if (!location) return 1.0;
  return location.operatingCostModifier;
}

// ---- Setup Period Effects ----

/**
 * Calculate the setup period modifier for a business.
 * During setup, the business operates at reduced capacity.
 * Returns a multiplier on revenue and customer count.
 */
export function calculateSetupModifier(setupDaysRemaining: number): number {
  if (setupDaysRemaining <= 0) return 1.0;
  // Linear ramp: 0% on first day, increasing to 100% at end of setup
  // But never below the minimum setup multiplier
  const progress = 1 - (setupDaysRemaining / (setupDaysRemaining + 1));
  return Math.max(EXPANSION_CONFIG.setupRevenueMultiplier, progress);
}

/**
 * Decrease setup days remaining by 1 (called each tick).
 * Returns the new setup days remaining value.
 */
export function advanceSetupDay(currentSetupDays: number): number {
  return Math.max(0, currentSetupDays - 1);
}

// ---- Portfolio Calculations ----

export interface PortfolioSummary {
  totalDailyRevenue: number;
  totalDailyExpense: number;
  totalDailyProfit: number;
  totalRevenue: number;
  totalProfit: number;
  totalCash: number;
  totalEmployees: number;
  totalBusinesses: number;
  avgHealthScore: number;
  avgSatisfaction: number;
  avgLoyalty: number;
  bestPerforming: { id: string; name: string; profit: number } | null;
  worstPerforming: { id: string; name: string; profit: number } | null;
  citySpread: Record<string, number>;
  typeSpread: Record<string, number>;
}

/**
 * Calculate portfolio summary from a list of businesses.
 */
export function calculatePortfolioSummary(businesses: {
  id: string;
  name: string;
  type: string;
  city: string;
  cash: number;
  dailyRevenue: number;
  dailyExpense: number;
  dailyProfit: number;
  totalRevenue: number;
  totalProfit: number;
  healthScore: number;
  satisfactionScore: number;
  loyaltyScore: number;
  employeeCount: number;
}[]): PortfolioSummary {
  if (businesses.length === 0) {
    return {
      totalDailyRevenue: 0,
      totalDailyExpense: 0,
      totalDailyProfit: 0,
      totalRevenue: 0,
      totalProfit: 0,
      totalCash: 0,
      totalEmployees: 0,
      totalBusinesses: 0,
      avgHealthScore: 0,
      avgSatisfaction: 0,
      avgLoyalty: 0,
      bestPerforming: null,
      worstPerforming: null,
      citySpread: {},
      typeSpread: {},
    };
  }

  const totalDailyRevenue = businesses.reduce((s, b) => s + b.dailyRevenue, 0);
  const totalDailyExpense = businesses.reduce((s, b) => s + b.dailyExpense, 0);
  const totalDailyProfit = businesses.reduce((s, b) => s + b.dailyProfit, 0);
  const totalRevenue = businesses.reduce((s, b) => s + b.totalRevenue, 0);
  const totalProfit = businesses.reduce((s, b) => s + b.totalProfit, 0);
  const totalCash = businesses.reduce((s, b) => s + b.cash, 0);
  const totalEmployees = businesses.reduce((s, b) => s + b.employeeCount, 0);
  const avgHealthScore = businesses.reduce((s, b) => s + b.healthScore, 0) / businesses.length;
  const avgSatisfaction = businesses.reduce((s, b) => s + b.satisfactionScore, 0) / businesses.length;
  const avgLoyalty = businesses.reduce((s, b) => s + b.loyaltyScore, 0) / businesses.length;

  // Best/worst performing by daily profit
  const sorted = [...businesses].sort((a, b) => b.dailyProfit - a.dailyProfit);
  const bestPerforming = sorted[0] ? { id: sorted[0].id, name: sorted[0].name, profit: sorted[0].dailyProfit } : null;
  const worstPerforming = sorted[sorted.length - 1] ? { id: sorted[sorted.length - 1].id, name: sorted[sorted.length - 1].name, profit: sorted[sorted.length - 1].dailyProfit } : null;

  // Spread
  const citySpread: Record<string, number> = {};
  const typeSpread: Record<string, number> = {};
  for (const b of businesses) {
    citySpread[b.city] = (citySpread[b.city] || 0) + 1;
    typeSpread[b.type] = (typeSpread[b.type] || 0) + 1;
  }

  return {
    totalDailyRevenue,
    totalDailyExpense,
    totalDailyProfit,
    totalRevenue,
    totalProfit,
    totalCash,
    totalEmployees,
    totalBusinesses: businesses.length,
    avgHealthScore,
    avgSatisfaction,
    avgLoyalty,
    bestPerforming,
    worstPerforming,
    citySpread,
    typeSpread,
  };
}
