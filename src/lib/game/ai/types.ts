// ============================================
// Bangladesh Business Tycoon - AI Competitor Types
// Phase 2: Real AI Competitors & Market Competition
// ============================================

/** AI personality determines decision-making strategy */
export type AIPersonality = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'TRADER' | 'EXPANSIONIST';

/** Actions an AI can take each tick */
export type AIAction =
  | 'BUY_INVENTORY'
  | 'CHANGE_PRICE'
  | 'HIRE_EMPLOYEE'
  | 'UPGRADE_BUSINESS'
  | 'CREATE_BUSINESS'
  | 'SELL_BUSINESS'
  | 'TAKE_LOAN'
  | 'REPAY_LOAN'
  | 'HOLD';

/** AI pricing strategy for their businesses */
export type AIPricingStrategy = 'LOW_PRICE' | 'MARKET_PRICE' | 'PREMIUM' | 'DYNAMIC';

/** Scored action ready for execution */
export interface ScoredAction {
  action: AIAction;
  score: number;
  target?: string; // businessId, productId, city, etc.
  params?: Record<string, unknown>;
}

/** AI decision context — everything the AI considers before deciding */
export interface AIDecisionContext {
  playerId: string;
  personality: AIPersonality;
  cash: number;
  netWorth: number;
  gameDay: number;
  lastActionAt: number; // gameDay of last action
  businesses: AIBusinessSnapshot[];
  activeLoans: AILoanSnapshot[];
  activeEvents: AIEventSnapshot[];
  marketPrices: Record<string, number>; // productName -> priceMultiplier
}

/** Simplified business snapshot for AI decision-making */
export interface AIBusinessSnapshot {
  id: string;
  type: string;
  city: string;
  name: string;
  level: number;
  reputation: number;
  cash: number;
  dailyRevenue: number;
  dailyExpense: number;
  dailyProfit: number;
  totalProfit: number;
  healthScore: number;
  inventories: AIInventorySnapshot[];
  employeeCount: number;
}

/** Simplified inventory snapshot */
export interface AIInventorySnapshot {
  id: string;
  productName: string;
  quantity: number;
  maxStock: number;
  purchasePrice: number;
  sellPrice: number;
}

/** Simplified loan snapshot */
export interface AILoanSnapshot {
  id: string;
  amount: number;
  remainingDebt: number;
  dailyPayment: number;
  daysRemaining: number;
}

/** Simplified event snapshot */
export interface AIEventSnapshot {
  title: string;
  type: string;
  effects: Record<string, number>;
}

/** Personality configuration weights */
export interface PersonalityConfig {
  /** Display name */
  name: string;
  /** Icon/emoji */
  icon: string;
  /** How much cash to keep as reserve (fraction of netWorth) */
  cashReserveRatio: number;
  /** Loan willingness (0 = never, 1 = very willing) */
  loanWillingness: number;
  /** Price strategy preference */
  defaultPricingStrategy: AIPricingStrategy;
  /** Upgrade eagerness (0 = never, 1 = upgrade ASAP) */
  upgradeEagerness: number;
  /** Expansion eagerness (0 = never expand, 1 = expand aggressively) */
  expansionEagerness: number;
  /** Inventory buy threshold (buy when stock falls below this ratio of max) */
  inventoryBuyThreshold: number;
  /** How many game days between actions (cooldown) */
  actionCooldownDays: number;
  /** Risk tolerance (0 = risk averse, 1 = risk seeking) */
  riskTolerance: number;
  /** Price adjustment frequency (0 = rarely, 1 = daily) */
  priceAdjustFrequency: number;
  /** Employee hiring preference (0 = minimal, 1 = hire max) */
  hiringPreference: number;
  /** Reaction strength to events (0 = ignore, 1 = react strongly) */
  eventReactivity: number;
}

/** Market share data for a business in a city+type market */
export interface MarketShareEntry {
  businessId: string;
  businessName: string;
  playerName: string;
  playerId: string;
  isAI: boolean;
  city: string;
  businessType: string;
  estimatedDemandShare: number; // 0-1 fraction of total market demand
  revenue: number;
  reputation: number;
  level: number;
}

/** Competition summary for a market (city + business type) */
export interface CompetitionSummary {
  city: string;
  businessType: string;
  totalDemand: number;
  totalBusinesses: number;
  playerBusinesses: number;
  aiBusinesses: number;
  shares: MarketShareEntry[];
  averagePrice: number;
  playerMarketShare: number; // 0-1
  playerRank: number;
}
