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
