// ============================================
// Bangladesh Business Tycoon - Customer Experience Config
// Phase 3: CX constants, weights, and segment definitions
// ============================================

// ---- Satisfaction Weights ----
// How much each factor contributes to overall satisfaction (must sum to 1.0)
export const SATISFACTION_WEIGHTS = {
  priceSatisfaction: 0.30,   // Are prices fair?
  productQuality: 0.25,      // Are products available and good?
  serviceQuality: 0.20,      // Are employees helpful?
  stockAvailability: 0.15,   // Is stock sufficient?
  atmosphere: 0.10,          // Reputation/cleanliness bonus
} as const;

// ---- Customer Segments ----
export const CUSTOMER_SEGMENTS = {
  BUDGET: {
    id: 'BUDGET',
    name: 'Budget',
    icon: '💰',
    priceSensitivity: 1.5,      // Very price sensitive
    qualitySensitivity: 0.6,    // Less quality sensitive
    serviceSensitivity: 0.5,    // Less service sensitive
    reputationSensitivity: 0.4, // Reputation matters less
    baseShare: 0.40,            // 40% of customers
  },
  REGULAR: {
    id: 'REGULAR',
    name: 'Regular',
    icon: '👤',
    priceSensitivity: 1.0,
    qualitySensitivity: 1.0,
    serviceSensitivity: 0.8,
    reputationSensitivity: 0.7,
    baseShare: 0.30,
  },
  PREMIUM: {
    id: 'PREMIUM',
    name: 'Premium',
    icon: '✨',
    priceSensitivity: 0.5,      // Less price sensitive
    qualitySensitivity: 1.5,    // Very quality conscious
    serviceSensitivity: 1.4,    // Demand high service
    reputationSensitivity: 1.2,
    baseShare: 0.20,
  },
  TOURIST: {
    id: 'TOURIST',
    name: 'Tourist',
    icon: '🎒',
    priceSensitivity: 1.2,
    qualitySensitivity: 0.8,
    serviceSensitivity: 1.1,
    reputationSensitivity: 1.5, // Follow reputation heavily
    baseShare: 0.10,
  },
} as const;

export type CustomerSegmentId = keyof typeof CUSTOMER_SEGMENTS;

// ---- Loyalty Tiers ----
// IMPORTANT: minPoints must be within [0, LOYALTY_CONFIG.maxScore]
// Rescaled (Phase 3 verification): all tiers reachable within maxScore=100
// Bronze: immediate | Silver: ~13 positive days | Gold: ~30 days | Platinum: ~45 days
export const LOYALTY_TIERS = {
  BRONZE:   { minPoints: 0,   multiplier: 1.0,  name: 'Bronze',   icon: '🥉' },
  SILVER:   { minPoints: 25,  multiplier: 1.10, name: 'Silver',   icon: '🥈' },
  GOLD:     { minPoints: 60,  multiplier: 1.25, name: 'Gold',     icon: '🥇' },
  PLATINUM: { minPoints: 90,  multiplier: 1.5,  name: 'Platinum', icon: '💎' },
} as const;

export type LoyaltyTierId = keyof typeof LOYALTY_TIERS;

// ---- Loyalty Config ----
export const LOYALTY_CONFIG = {
  /** Points earned per ৳100 spent */
  pointsPerTakaSpent: 0.1,
  /** Loyalty bonus to repeat visit probability (0.3 = 30% more likely) */
  loyaltyVisitBonus: 0.3,
  /** Max repeat customer rate cap */
  repeatRateCap: 0.86,
  /** Loyalty score decay per day if no visit (prevents stale loyalty) */
  dailyDecay: 0.5,
  /** Loyalty score gain per positive experience */
  dailyGain: 3.0,
  /** Loyalty score loss per negative experience */
  dailyLoss: 4.0,
  /** Maximum loyalty score */
  maxScore: 100,
};

// ---- NPS Config ----
export const NPS_CONFIG = {
  /** Ratings 9-10 are promoters */
  promoterThreshold: 9,
  /** Ratings 7-8 are passives */
  passiveThreshold: 7,
  /** Minimum reviews before NPS is calculated */
  minReviews: 5,
};

// ---- Review Generation Config ----
export const REVIEW_CONFIG = {
  /** Probability of generating a review per tick */
  probabilityPerTick: 0.3,
  /** Max reviews generated per business per tick */
  maxPerTick: 2,
  /** Keep only last N reviews (older are pruned) */
  keepLast: 50,
  /** Review templates by sentiment */
  templates: {
    POSITIVE: [
      'Great prices and friendly service!',
      'Always well-stocked. My go-to shop.',
      'Excellent quality and fair prices.',
      'Love shopping here! Highly recommend.',
      'Staff is very helpful and attentive.',
      'Clean and well-organized store.',
      'Best place in town for this!',
      'Consistently good experience.',
      'Good value for money.',
      'Will definitely come back!',
    ],
    NEUTRAL: [
      'Decent place, nothing special.',
      'Average experience overall.',
      'Prices are okay, selection could be better.',
      'It gets the job done.',
      'Some mediocre, some good products.',
      'Could use better service.',
      'Fair prices but limited stock sometimes.',
    ],
    NEGATIVE: [
      'Way too expensive for what you get.',
      'Poor selection and high prices.',
      'Staff seems uninterested in helping.',
      'Out of stock on essential items.',
      'Would not recommend.',
      'Slow service and unfriendly staff.',
      'Better options available nearby.',
      'Overpriced and underwhelming quality.',
      'Dirty and poorly maintained.',
      'Terrible experience, never coming back.',
    ],
  },
  // Category-specific templates
  CATEGORY_TEMPLATES: {
    STOCKOUT: 'Many items were out of stock. Very frustrating.',
    SERVICE: 'The staff could be much more attentive.',
    QUALITY: 'Product quality has declined recently.',
    PRICE: 'Prices are higher than competitors nearby.',
    CLEANLINESS: 'The shop could be cleaner.',
    WAIT_TIME: 'Wait times were too long.',
  },
};
