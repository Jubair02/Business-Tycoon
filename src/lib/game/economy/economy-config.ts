// ============================================
// Bangladesh Business Tycoon - Global Economy Config
// Phase 1: Centralized economy-wide constants
// ============================================

export const ECONOMY_CONFIG = {
  // ---- Price Sensitivity ----
  /** Maximum price ratio before demand drops to near-zero (e.g., 3.0 = 3x market price) */
  maxPriceRatio: 3.0,
  /** Minimum price ratio clamp (e.g., 0.3 = 30% of market price) */
  minPriceRatio: 0.3,
  /** Demand multiplier when price equals market price (baseline) */
  baselineDemandAtMarketPrice: 1.0,
  /** Exponential decay rate for price-demand curve (higher = steeper cliff) */
  priceDecayRate: 1.5,

  // ---- Customer Calculation ----
  /** Base reputation multiplier at reputation 0 */
  reputationMinMultiplier: 0.4,
  /** Reputation multiplier at reputation 100 */
  reputationMaxMultiplier: 1.6,
  /** Level customer bonus per level above 1 */
  levelBonusPerLevel: 0.12,
  /** Stock availability floor multiplier (no stock = this × customers) */
  stockFloorMultiplier: 0.2,
  /** Stock availability ceiling multiplier (full stock = this × customers) */
  stockCeilingMultiplier: 1.0,
  /** Minimum stock ratio to avoid stockout penalty */
  stockoutThreshold: 0.05,

  // ---- Expenses ----
  /** Days per month for salary conversion */
  daysPerMonth: 30,
  // NOTE: utilities have no economy-wide base. Each business type carries its
  // own monthly bill in `BUSINESS_TYPES.utilities`, right next to its rent, so
  // the two largest fixed costs are read on the same basis. See
  // `calculateBusinessExpenses`.
  /** Tax rate on GROSS PROFIT (not revenue) — simpler for game economy */
  taxRateOnProfit: 0.10,   // 10% tax on profit (not revenue)
  /** Minimum tax even when profit is negative (revenue tax floor) */
  revenueTaxFloor: 0.02,   // 2% of revenue as minimum tax
  /** Rent base multiplier per level — controlled by business config */
  baseRentPerLevel: 1.0,   // Each business type controls its own rent scaling

  // ---- Inventory ----
  /** Stock capacity multiplier per product (maxStock × this = capacity) */
  stockCapacityMultiplier: 1.0,

  // ---- Random Variation ----
  /** Random variation center (1.0 = no bias) */
  variationCenter: 1.0,
  /** Default variation range (±this × volatility) */
  variationRange: 1.0,

  // ---- Reputation ----
  /** Reputation gain per day when profitable */
  reputationGainProfitable: 0.5,
  /** Reputation loss per day when losing money */
  reputationLossUnprofitable: 0.8,
  /** Reputation loss per stockout product ratio */
  reputationLossStockout: 2.5,
  /** Reputation gain per manager skill point */
  reputationGainManagerSkill: 0.08,
  /** Reputation gain per cleaner skill point */
  reputationGainCleanerSkill: 0.04,
  /** Natural reputation decay per day */
  reputationDecay: 0.1,
  /** Reputation minimum */
  minReputation: 0,
  /** Reputation maximum */
  maxReputation: 100,

  // ---- Business Health ----
  /** Weight of profitability in health score */
  healthWeightProfitability: 0.35,
  /** Weight of cash flow in health score */
  healthWeightCashFlow: 0.20,
  /** Weight of inventory health in health score */
  healthWeightInventory: 0.25,
  /** Weight of reputation in health score */
  healthWeightReputation: 0.20,

  // ---- Market Price Update ----
  /** Market price base fluctuation range (±this) */
  marketFluctuationRange: 0.08,
  /** How much of the previous price to retain (0 = full overwrite, 1 = no change) */
  marketPriceRetention: 0.7,
  /** How strongly events affect market prices */
  eventMarketEffectStrength: 0.3,

  // ---- AI Players ----
  // NOTE: AI profit tuning was originally planned as aiProfitCenter/aiProfitRange
  // but is now handled per-personality via PERSONALITY_CONFIGS in ai-strategy.ts.
  // These config knobs were removed as they were never consumed by the AI engine.
};

// ---- Health Score Thresholds ----
export const HEALTH_THRESHOLDS = {
  EXCELLENT: 80,
  HEALTHY: 60,
  NEEDS_ATTENTION: 40,
  STRUGGLING: 20,
  // Below 20 = CRITICAL
} as const;

// ---- Demand Level Thresholds ----
export const DEMAND_THRESHOLDS = {
  VERY_HIGH: 1.3,
  HIGH: 1.1,
  NORMAL_LOW: 0.8,
  LOW: 0.5,
  // Below 0.5 = VERY_LOW
} as const;
