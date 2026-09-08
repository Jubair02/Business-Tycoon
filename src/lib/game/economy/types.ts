// ============================================
// Bangladesh Business Tycoon - Economy Types
// Phase 1: Economy & Balance Engine
// ============================================

/** Risk level for a business type */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/** Health status category */
export type HealthStatus = 'EXCELLENT' | 'HEALTHY' | 'NEEDS_ATTENTION' | 'STRUGGLING' | 'CRITICAL';

/** Demand trend indicator */
export type DemandTrend = 'RISING' | 'STABLE' | 'FALLING';

/** Demand level indicator */
export type DemandLevel = 'VERY_HIGH' | 'HIGH' | 'NORMAL' | 'LOW' | 'VERY_LOW';

// ---- Business Economy Configuration ----

export interface BusinessEconomyConfig {
  /** Business type ID matching game-data BUSINESS_TYPES */
  businessTypeId: string;
  /** Target profit margin for balance calibration (e.g., 0.35 = 35%) */
  targetMargin: number;
  /** How sensitive customers are to price changes (higher = more sensitive) */
  priceSensitivity: number;
  /** Volatility factor for random variation (0.05 = ±5%, 0.15 = ±15%) */
  volatility: number;
  /** Risk level determines volatility range and potential downside */
  riskLevel: RiskLevel;
  /** Maximum growth ceiling multiplier (limits late-game scaling) */
  growthCeiling: number;
  /** Inventory ratio needed for full customer satisfaction (e.g., 0.6 = 60% of max stock) */
  stockTargetRatio: number;
  /** Employee efficiency bonus per employee (e.g., 0.06 = 6% per employee) */
  employeeBonusPer: number;
  /** Utility cost multiplier relative to base */
  utilityMultiplier: number;
  /** Rent scaling factor per level (1.12 = 12% increase per level) */
  rentScalePerLevel: number;
}

// ---- Product Demand Configuration ----

export interface ProductDemandConfig {
  /** Product name (must match inventory productName) */
  productName: string;
  /** Base demand weight relative to other products in same business */
  baseDemand: number;
  /** Price sensitivity for this specific product (higher = customers react more to price) */
  priceSensitivity: number;
  /** Demand volatility (how much demand fluctuates day-to-day) */
  volatility: number;
  /** Product category for event matching */
  category: string;
  /** Whether this is a high-volume low-margin product (e.g., Tea, Rice) */
  isStaple: boolean;
  /** Seasonal demand bonus categories this product responds to */
  seasonalCategories: string[];
}

// ---- Formula Input/Output Types ----

export interface CustomerCalculationInput {
  baseCustomers: number;
  cityMultiplier: number;
  level: number;
  reputation: number;
  totalStock: number;
  maxStockCapacity: number;
  inventoryCount: number;
  employeeCount: number;
  avgEmployeeSkill: number;
  eventCustomerEffect: number;
  businessDemandEffect: number;
  priceSensitivity: number;
  businessPriceSensitivity: number;
  volatility: number;
}

export interface PriceDemandInput {
  sellPrice: number;
  marketReferencePrice: number;
  productPriceSensitivity: number;
  businessPriceSensitivity: number;
}

export interface ProductSalesInput {
  productName: string;
  quantity: number;
  purchasePrice: number;
  sellPrice: number;
  marketReferencePrice: number;
  productDemand: number;
  productPriceSensitivity: number;
  businessPriceSensitivity: number;
  potentialCustomers: number;
  eventDemandEffect: number;
}

export interface ProductSalesResult {
  productName: string;
  demandBeforePrice: number;
  priceDemandMultiplier: number;
  demandAfterPrice: number;
  itemsSold: number;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  profitMargin: number;
  remainingStock: number;
  inventoryId: string;
}

export interface ExpenseBreakdown {
  rent: number;
  salaries: number;
  utilities: number;
  taxes: number;
  totalExpense: number;
  salaryDetails: { monthlySalary: number; dailySalary: number; count: number };
}

export interface BusinessHealthResult {
  score: number;
  status: HealthStatus;
  positiveFactors: string[];
  negativeFactors: string[];
}

export interface ROIResult {
  investment: number;
  averageDailyProfit: number;
  cumulativeProfit: number;
  roiPercentage: number;
  estimatedPaybackDays: number | null; // null = not currently possible
}

export interface DailyBusinessMetrics {
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  rent: number;
  salaries: number;
  utilities: number;
  taxes: number;
  netProfit: number;
  customers: number;
  reputation: number;
}

export interface ProductPerformance {
  productName: string;
  category: string;
  quantitySold: number;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  profitMargin: number;
  remainingStock: number;
  demandScore: DemandLevel;
  priceScore: number; // 0-1, how close to optimal price
}

export interface BusinessAnalytics {
  summary: {
    revenue: number;
    expenses: number;
    profit: number;
    customers: number;
    costOfGoodsSold: number;
    grossProfit: number;
  };
  health: BusinessHealthResult;
  roi: ROIResult;
  productPerformance: ProductPerformance[];
  financialBreakdown: DailyBusinessMetrics;
  demandIndicators: Record<string, { level: DemandLevel; trend: DemandTrend }>;
}

// ============================================
// Phase 3: Customer Experience Types
// ============================================

/** Customer segment IDs */
export type CustomerSegmentId = 'BUDGET' | 'REGULAR' | 'PREMIUM' | 'TOURIST';

/** Loyalty tier IDs */
export type LoyaltyTierId = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

/** Review sentiment */
export type ReviewSentiment = 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE';

/** Review category */
export type ReviewCategory = 'PRICE' | 'SERVICE' | 'QUALITY' | 'STOCKOUT' | 'CLEANLINESS' | 'WAIT_TIME';

// ---- Satisfaction Input/Output ----

export interface SatisfactionInput {
  /** Average sell-price-to-marketReferencePrice ratio across all products.
   *  0-1 where 1 = at or below market, 0 = 3x market */
  priceCompetitiveness: number;
  /** Stock ratio: totalStock / maxStockCapacity.
   *  0-1 where 1.0 = full stock, 0.0 = empty */
  stockAvailability: number;
  /** Employee coverage: number of employees relative to ideal */
  serviceQuality: number;  // 0-1
  /** Product quality based on product performance */
  productQuality: number;  // 0-1
  /** Reputation and cleanliness factor */
  atmosphere: number;  // 0-1
  /** Current satisfaction for smoothing */
  currentSatisfaction: number;  // 0-100
}

export interface SatisfactionResult {
  /** Overall satisfaction score */
  overall: number;  // 0-100
  /** Price satisfaction component */
  priceSatisfaction: number;  // 0-100
  /** Product quality component */
  productQuality: number;  // 0-100
  /** Service quality component */
  serviceQuality: number;  // 0-100
  /** Stock availability component */
  stockAvailability: number;  // 0-100
  /** Atmosphere component */
  atmosphere: number;  // 0-100
  /** Positive factor labels */
  positiveFactors: string[];
  /** Negative factor labels */
  negativeFactors: string[];
}

// ---- Loyalty Input/Output ----

export interface LoyaltyInput {
  /** Current loyalty score */
  currentLoyaltyScore: number;  // 0-100
  /** Current repeat customer rate */
  currentRepeatRate: number;  // 0-1
  /** Was the experience positive this tick? */
  wasPositiveExperience: boolean;
  /** Total customers this tick */
  totalCustomers: number;
  /** Number of reviews */
  numberOfReviews: number;
  /** Average rating 1-5 */
  averageRating: number;
  /** Loyalty multiplier from tier */
  loyaltyMultiplier: number;
}

export interface LoyaltyResult {
  /** Updated loyalty score */
  loyaltyScore: number;  // 0-100
  /** Updated repeat customer rate */
  repeatCustomerRate: number;  // 0-1
  /** Loyalty tier */
  tier: LoyaltyTierId;
  /** Tier multiplier */
  tierMultiplier: number;
  /** Extra customers from loyalty */
  loyaltyCustomerBonus: number;
}

// ---- NPS Result ----

export interface NPSResult {
  /** Net Promoter Score */
  nps: number;  // -100 to 100
  /** Percentage who rated 9-10 */
  promoters: number;
  /** Percentage who rated 7-8 */
  passives: number;
  /** Percentage who rated 1-6 */
  detractors: number;
  /** Total reviews counted */
  totalReviews: number;
}

// ---- Segment Demand Result ----

export interface SegmentDemandResult {
  /** Segment identifier */
  segment: CustomerSegmentId;
  /** Fraction of customers in this segment */
  share: number;
  /** How this segment modifies demand */
  demandMultiplier: number;
  /** How price affects this segment */
  priceFactor: number;
  /** How quality affects this segment */
  qualityFactor: number;
}

// ---- Customer Review ----

export interface CustomerReviewInput {
  businessId: string;
  gameDay: number;
  satisfaction: number;  // 0-100
  sentiment: ReviewSentiment;
  rating: number;  // 1-5
  category: ReviewCategory;
  segment: CustomerSegmentId;
}
