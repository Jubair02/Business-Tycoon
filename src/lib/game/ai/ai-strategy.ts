// ============================================
// Bangladesh Business Tycoon - AI Strategy & Personalities
// Phase 2: Personality-driven decision weights
// ============================================

import type { AIPersonality, PersonalityConfig, AIPricingStrategy } from './types';

/**
 * Each personality has unique decision-making characteristics.
 * These weights drive the scoring system in ai-evaluation.ts.
 */
export const PERSONALITY_CONFIGS: Record<AIPersonality, PersonalityConfig> = {
  CONSERVATIVE: {
    name: 'Conservative',
    icon: '🛡️',
    cashReserveRatio: 0.4,        // Keep 40% of netWorth as cash reserve
    loanWillingness: 0.15,         // Rarely takes loans
    defaultPricingStrategy: 'MARKET_PRICE',
    upgradeEagerness: 0.25,        // Upgrades slowly and carefully
    expansionEagerness: 0.15,      // Rarely opens new businesses
    inventoryBuyThreshold: 0.3,    // Buys when stock drops below 30%
    actionCooldownDays: 2,         // Acts every 2 days (was 3, too slow for game pace)
    riskTolerance: 0.2,            // Very risk averse
    priceAdjustFrequency: 0.2,     // Rarely adjusts prices
    hiringPreference: 0.3,         // Hires minimally
    eventReactivity: 0.6,          // Moderate event reaction
    marketingEagerness: 0.15,       // Rarely markets
  },
  BALANCED: {
    name: 'Balanced',
    icon: '⚖️',
    cashReserveRatio: 0.25,
    loanWillingness: 0.35,
    defaultPricingStrategy: 'DYNAMIC',
    upgradeEagerness: 0.45,
    expansionEagerness: 0.35,
    inventoryBuyThreshold: 0.4,
    actionCooldownDays: 2,
    riskTolerance: 0.5,
    priceAdjustFrequency: 0.5,
    hiringPreference: 0.5,
    eventReactivity: 0.7,
    marketingEagerness: 0.3,
  },
  AGGRESSIVE: {
    name: 'Aggressive',
    icon: '🔥',
    cashReserveRatio: 0.1,         // Keeps very little cash
    loanWillingness: 0.7,          // Frequently takes loans
    defaultPricingStrategy: 'PREMIUM',
    upgradeEagerness: 0.75,        // Upgrades eagerly
    expansionEagerness: 0.65,      // Often opens new businesses
    inventoryBuyThreshold: 0.5,    // Buys more aggressively
    actionCooldownDays: 1,         // Acts every day
    riskTolerance: 0.85,           // Risk seeking
    priceAdjustFrequency: 0.7,
    hiringPreference: 0.7,
    eventReactivity: 0.8,
    marketingEagerness: 0.6,
  },
  TRADER: {
    name: 'Trader',
    icon: '📊',
    cashReserveRatio: 0.2,
    loanWillingness: 0.3,
    defaultPricingStrategy: 'DYNAMIC',
    upgradeEagerness: 0.3,
    expansionEagerness: 0.2,
    inventoryBuyThreshold: 0.45,   // Keeps stock high for trading
    actionCooldownDays: 1,         // Acts frequently (trading!)
    riskTolerance: 0.45,
    priceAdjustFrequency: 0.9,     // Adjusts prices VERY frequently
    hiringPreference: 0.4,
    eventReactivity: 0.9,          // Reacts strongly to market events
    marketingEagerness: 0.2,
  },
  EXPANSIONIST: {
    name: 'Expansionist',
    icon: '🌐',
    cashReserveRatio: 0.15,
    loanWillingness: 0.55,
    defaultPricingStrategy: 'LOW_PRICE',
    upgradeEagerness: 0.4,
    expansionEagerness: 0.85,      // Highest expansion drive
    inventoryBuyThreshold: 0.35,
    actionCooldownDays: 2,
    riskTolerance: 0.6,
    priceAdjustFrequency: 0.3,
    hiringPreference: 0.6,         // Hires to support expansion
    eventReactivity: 0.5,
    marketingEagerness: 0.5,
  },
};

/** Get personality config, falling back to BALANCED */
export function getPersonalityConfig(personality: string): PersonalityConfig {
  return PERSONALITY_CONFIGS[personality as AIPersonality] ?? PERSONALITY_CONFIGS.BALANCED;
}

/**
 * Calculate AI pricing based on personality and market conditions.
 * Returns a sell price for a product given the market reference price.
 */
export function calculateAIPrice(
  marketReferencePrice: number,
  personality: AIPersonality,
  strategy: AIPricingStrategy,
  businessHealth: number,   // 0-100
  stockRatio: number,       // 0-1 current stock / max stock
): number {
  const config = PERSONALITY_CONFIGS[personality];

  let priceMultiplier: number;

  switch (strategy) {
    case 'LOW_PRICE':
      // Sell below market to gain market share (85-98% of market)
      priceMultiplier = 0.85 + Math.random() * 0.13;
      break;

    case 'MARKET_PRICE':
      // Sell at market price (98-105% of market)
      priceMultiplier = 0.98 + Math.random() * 0.07;
      break;

    case 'PREMIUM':
      // Sell above market (105-120% of market)
      priceMultiplier = 1.05 + Math.random() * 0.15;
      break;

    case 'DYNAMIC':
    default:
      // React to conditions
      if (businessHealth < 30) {
        // Struggling: cut prices to attract customers
        priceMultiplier = 0.88 + Math.random() * 0.07;
      } else if (stockRatio > 0.8) {
        // Overstocked: slight discount to move inventory
        priceMultiplier = 0.93 + Math.random() * 0.07;
      } else if (stockRatio < 0.2) {
        // Low stock: can charge premium
        priceMultiplier = 1.05 + Math.random() * 0.1;
      } else if (businessHealth > 70) {
        // Healthy: market price
        priceMultiplier = 0.98 + Math.random() * 0.07;
      } else {
        // Normal
        priceMultiplier = 0.95 + Math.random() * 0.1;
      }
      break;
  }

  // Personality modifier: Aggressive tends to price higher, Conservative lower
  if (personality === 'AGGRESSIVE') priceMultiplier *= 1.02;
  if (personality === 'CONSERVATIVE') priceMultiplier *= 0.98;

  return Math.round(marketReferencePrice * priceMultiplier);
}

/**
 * Determine which pricing strategy an AI should use.
 * Traders use DYNAMIC, Aggressive uses PREMIUM, Expansionist uses LOW_PRICE, etc.
 * But this can change based on conditions.
 */
export function selectPricingStrategy(
  personality: AIPersonality,
  businessHealth: number,
  stockRatio: number,
): AIPricingStrategy {
  const config = PERSONALITY_CONFIGS[personality];

  // If business is struggling, switch to LOW_PRICE regardless
  if (businessHealth < 25) return 'LOW_PRICE';

  // If low stock, can charge more
  if (stockRatio < 0.15 && config.riskTolerance > 0.3) return 'PREMIUM';

  // Default from personality
  return config.defaultPricingStrategy;
}

/** All AI personality types */
export const ALL_PERSONALITIES: AIPersonality[] = [
  'CONSERVATIVE', 'BALANCED', 'AGGRESSIVE', 'TRADER', 'EXPANSIONIST',
];

/** Pick a random personality (weighted toward BALANCED) */
export function randomPersonality(): AIPersonality {
  const weights: Record<AIPersonality, number> = {
    CONSERVATIVE: 2,
    BALANCED: 3,
    AGGRESSIVE: 2,
    TRADER: 2,
    EXPANSIONIST: 1,
  };
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  let roll = Math.random() * total;
  for (const [p, w] of Object.entries(weights)) {
    roll -= w;
    if (roll <= 0) return p as AIPersonality;
  }
  return 'BALANCED';
}
