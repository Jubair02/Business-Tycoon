// ============================================
// Bangladesh Business Tycoon - Customer Experience Formulas
// Phase 3: Satisfaction, Loyalty, NPS, Segment Demands, Reviews
//
// Design Principles:
// 1. Satisfaction is multi-factor — price, quality, service, stock, atmosphere
// 2. Loyalty compounds over time — positive experiences build, negative erode
// 3. NPS follows industry standard — promoters minus detractors
// 4. Segments have different sensitivities — budget vs premium vs tourist
// 5. Reviews are generated probabilistically based on satisfaction
// ============================================

import {
  SATISFACTION_WEIGHTS,
  CUSTOMER_SEGMENTS,
  LOYALTY_TIERS,
  LOYALTY_CONFIG,
  NPS_CONFIG,
  REVIEW_CONFIG,
} from './cx-config';
import type {
  CustomerSegmentId,
  LoyaltyTierId,
  ReviewSentiment,
  ReviewCategory,
  SatisfactionInput,
  SatisfactionResult,
  LoyaltyInput,
  LoyaltyResult,
  NPSResult,
  SegmentDemandResult,
  CustomerReviewInput,
} from './types';

// ============================================
// 1. PRICE COMPETITIVENESS
// ============================================

/**
 * Calculate average price competitiveness for a business across all products.
 *
 * For each product, the ratio = sellPrice / marketReferencePrice.
 * Competitiveness = clamp(1 - (ratio - 1) / 2, 0, 1)
 *   - ratio 1.0 (at market) → competitiveness 1.0
 *   - ratio 1.5 (50% above) → competitiveness 0.75
 *   - ratio 2.0 (2x market) → competitiveness 0.5
 *   - ratio 3.0 (3x market) → competitiveness 0.0
 *
 * @param inventories - Business inventory items with sellPrice
 * @param productDefs - Product definitions with basePrice and suggestedMarkup
 * @param marketPriceMap - Market price multipliers by product name
 * @returns Average competitiveness 0-1
 */
export function calculatePriceCompetitiveness(
  inventories: { productName: string; sellPrice: number }[],
  productDefs: { name: string; basePrice: number; suggestedMarkup: number }[],
  marketPriceMap: Record<string, { priceMultiplier: number }>,
): number {
  if (inventories.length === 0) return 0.5;

  let totalCompetitiveness = 0;
  let count = 0;

  for (const inv of inventories) {
    const prodDef = productDefs.find(p => p.name === inv.productName);
    if (!prodDef) continue;

    const marketRef = prodDef.basePrice * (1 + prodDef.suggestedMarkup);
    const mp = marketPriceMap[inv.productName];
    const effectiveMarketRef = marketRef * (mp?.priceMultiplier || 1);

    if (effectiveMarketRef > 0) {
      const ratio = inv.sellPrice / effectiveMarketRef;
      // 1.0 = at market, 0.0 = 3x market
      const competitiveness = Math.max(0, Math.min(1, 1 - (ratio - 1) / 2));
      totalCompetitiveness += competitiveness;
    }
    count++;
  }

  return count > 0 ? totalCompetitiveness / count : 0.5;
}

// ============================================
// 2. SATISFACTION CALCULATION
// ============================================

/**
 * Calculate overall customer satisfaction score (0-100).
 *
 * Formula:
 *   rawScore = Σ(weight_i × factor_i × 100) for each factor
 *   smoothed = lerp(currentSatisfaction, rawScore, 0.3)
 *   overall = clamp(smoothed, 0, 100)
 *
 * Smoothing prevents wild swings day-to-day.
 */
export function calculateSatisfaction(input: SatisfactionInput): SatisfactionResult {
  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];

  // Calculate each factor score (0-100)
  const priceSatisfaction = input.priceCompetitiveness * 100;
  const productQuality = input.productQuality * 100;
  const serviceQuality = input.serviceQuality * 100;
  const stockAvailability = input.stockAvailability * 100;
  const atmosphere = input.atmosphere * 100;

  // Track positive/negative factors
  if (priceSatisfaction >= 60) positiveFactors.push('Fair prices');
  else if (priceSatisfaction < 40) negativeFactors.push('High prices');

  if (productQuality >= 60) positiveFactors.push('Good product quality');
  else if (productQuality < 40) negativeFactors.push('Poor product quality');

  if (serviceQuality >= 60) positiveFactors.push('Good service');
  else if (serviceQuality < 40) negativeFactors.push('Poor service');

  if (stockAvailability >= 60) positiveFactors.push('Well-stocked');
  else if (stockAvailability < 40) negativeFactors.push('Low stock');

  if (atmosphere >= 60) positiveFactors.push('Good atmosphere');
  else if (atmosphere < 40) negativeFactors.push('Poor atmosphere');

  // Weighted sum
  const rawScore =
    SATISFACTION_WEIGHTS.priceSatisfaction * priceSatisfaction +
    SATISFACTION_WEIGHTS.productQuality * productQuality +
    SATISFACTION_WEIGHTS.serviceQuality * serviceQuality +
    SATISFACTION_WEIGHTS.stockAvailability * stockAvailability +
    SATISFACTION_WEIGHTS.atmosphere * atmosphere;

  // Smooth with previous satisfaction (20% new, 80% old)
  // Smoothing factor 0.2 = ~3-day half-life, gives players more reaction time
  // before satisfaction changes trigger loyalty feedback loops
  const smoothingFactor = 0.2;
  const smoothed = input.currentSatisfaction * (1 - smoothingFactor) + rawScore * smoothingFactor;
  const overall = Math.max(0, Math.min(100, smoothed));

  return {
    overall,
    priceSatisfaction,
    productQuality,
    serviceQuality,
    stockAvailability,
    atmosphere,
    positiveFactors,
    negativeFactors,
  };
}

// ============================================
// 3. LOYALTY TIER LOOKUP
// ============================================

/**
 * Get the loyalty tier for a given loyalty score.
 * Returns the highest tier the score qualifies for.
 */
export function getLoyaltyTier(loyaltyScore: number): { tier: LoyaltyTierId; multiplier: number; name: string; icon: string } {
  if (loyaltyScore >= LOYALTY_TIERS.PLATINUM.minPoints) {
    return { tier: 'PLATINUM', multiplier: LOYALTY_TIERS.PLATINUM.multiplier, name: LOYALTY_TIERS.PLATINUM.name, icon: LOYALTY_TIERS.PLATINUM.icon };
  }
  if (loyaltyScore >= LOYALTY_TIERS.GOLD.minPoints) {
    return { tier: 'GOLD', multiplier: LOYALTY_TIERS.GOLD.multiplier, name: LOYALTY_TIERS.GOLD.name, icon: LOYALTY_TIERS.GOLD.icon };
  }
  if (loyaltyScore >= LOYALTY_TIERS.SILVER.minPoints) {
    return { tier: 'SILVER', multiplier: LOYALTY_TIERS.SILVER.multiplier, name: LOYALTY_TIERS.SILVER.name, icon: LOYALTY_TIERS.SILVER.icon };
  }
  return { tier: 'BRONZE', multiplier: LOYALTY_TIERS.BRONZE.multiplier, name: LOYALTY_TIERS.BRONZE.name, icon: LOYALTY_TIERS.BRONZE.icon };
}

// ============================================
// 4. LOYALTY CALCULATION
// ============================================

/**
 * Calculate updated loyalty score and repeat customer rate.
 *
 * Loyalty score dynamics:
 *   - Positive experience: gain LOYALTY_CONFIG.dailyGain points
 *   - Negative experience: lose LOYALTY_CONFIG.dailyLoss points
 *   - No customers: decay by LOYALTY_CONFIG.dailyDecay
 *   - Score clamped to [0, LOYALTY_CONFIG.maxScore]
 *
 * Repeat customer rate:
 *   - Based on loyalty score and review quality
 *   - Capped at LOYALTY_CONFIG.repeatRateCap
 *   - Loyalty bonus increases repeat probability
 */
export function calculateLoyalty(input: LoyaltyInput): LoyaltyResult {
  let newScore = input.currentLoyaltyScore;

  if (input.totalCustomers > 0) {
    if (input.wasPositiveExperience) {
      newScore += LOYALTY_CONFIG.dailyGain;
    } else {
      newScore -= LOYALTY_CONFIG.dailyLoss;
    }
  } else {
    // No customers — loyalty decays
    newScore -= LOYALTY_CONFIG.dailyDecay;
  }

  // Review bonus: average rating above 3 adds loyalty
  if (input.numberOfReviews > 0) {
    const ratingBonus = (input.averageRating - 3) * 0.5; // ±1 per star away from 3
    newScore += ratingBonus;
  }

  // Clamp
  newScore = Math.max(0, Math.min(LOYALTY_CONFIG.maxScore, newScore));

  // Calculate repeat customer rate
  // Base rate from loyalty score, plus loyalty visit bonus
  const baseRepeatFromScore = newScore / LOYALTY_CONFIG.maxScore; // 0-1
  const repeatRate = Math.min(
    LOYALTY_CONFIG.repeatRateCap,
    input.currentRepeatRate * 0.7 + baseRepeatFromScore * LOYALTY_CONFIG.loyaltyVisitBonus * 0.3
  );

  // Get tier
  const tierInfo = getLoyaltyTier(newScore);

  // Calculate loyalty customer bonus (extra customers from loyalty)
  const loyaltyCustomerBonus = Math.round(repeatRate * input.totalCustomers * (tierInfo.multiplier - 1));

  return {
    loyaltyScore: Math.round(newScore * 10) / 10,
    repeatCustomerRate: Math.round(repeatRate * 1000) / 1000,
    tier: tierInfo.tier,
    tierMultiplier: tierInfo.multiplier,
    loyaltyCustomerBonus,
  };
}

// ============================================
// 5. NPS CALCULATION
// ============================================

/**
 * Calculate Net Promoter Score from review ratings.
 *
 * NPS = %Promoters - %Detractors
 *   - Promoters: ratings 9-10 (mapped from 5-star: 5 = promoter)
 *   - Passives: ratings 7-8 (mapped from 5-star: 4 = passive)
 *   - Detractors: ratings 1-6 (mapped from 5-star: 1-3 = detractor)
 *
 * For 5-star scale:
 *   - 5 stars → Promoter
 *   - 4 stars → Passive
 *   - 1-3 stars → Detractor
 *
 * Returns { nps: 0, promoters: 0, passives: 0, detractors: 0 } if not enough reviews.
 */
export function calculateNPS(reviews: { rating: number }[]): NPSResult {
  if (reviews.length < NPS_CONFIG.minReviews) {
    return { nps: 0, promoters: 0, passives: 0, detractors: 0, totalReviews: reviews.length };
  }

  let promoters = 0;
  let passives = 0;
  let detractors = 0;

  for (const review of reviews) {
    if (review.rating >= 5) {
      promoters++;  // 5-star = promoter (equivalent to 9-10 on 10-point scale)
    } else if (review.rating === 4) {
      passives++;   // 4-star = passive (equivalent to 7-8)
    } else {
      detractors++; // 1-3 stars = detractor (equivalent to 1-6)
    }
  }

  const total = reviews.length;
  const promoterPct = (promoters / total) * 100;
  const passivePct = (passives / total) * 100;
  const detractorPct = (detractors / total) * 100;

  const nps = Math.round(promoterPct - detractorPct);

  return {
    nps,
    promoters: Math.round(promoterPct * 10) / 10,
    passives: Math.round(passivePct * 10) / 10,
    detractors: Math.round(detractorPct * 10) / 10,
    totalReviews: total,
  };
}

// ============================================
// 6. SEGMENT DEMAND CALCULATION
// ============================================

/**
 * Calculate demand multipliers for each customer segment.
 *
 * Each segment has different sensitivities to price, quality, service, and reputation.
 * The demand multiplier represents how attractive the business is to that segment.
 *
 * Formula per segment:
 *   demandMultiplier = baseShare
 *     × (priceCompetitiveness ^ priceSensitivity)
 *     × (quality ^ qualitySensitivity)
 *     × (service ^ serviceSensitivity)
 *     × (reputation ^ reputationSensitivity)
 */
export function calculateSegmentDemands(params: {
  priceCompetitiveness: number;
  productQuality: number;
  serviceQuality: number;
  reputation: number;  // 0-100, normalized to 0-1 internally
}): SegmentDemandResult[] {
  const normalizedReputation = params.reputation / 100;
  const results: SegmentDemandResult[] = [];

  const segmentIds: CustomerSegmentId[] = ['BUDGET', 'REGULAR', 'PREMIUM', 'TOURIST'];

  for (const segId of segmentIds) {
    const seg = CUSTOMER_SEGMENTS[segId];

    // Ensure non-zero bases for exponentiation (avoid 0^x issues)
    const price = Math.max(0.01, params.priceCompetitiveness);
    const quality = Math.max(0.01, params.productQuality);
    const service = Math.max(0.01, params.serviceQuality);
    const reputation = Math.max(0.01, normalizedReputation);

    const priceFactor = Math.pow(price, seg.priceSensitivity);
    const qualityFactor = Math.pow(quality, seg.qualitySensitivity);
    const serviceFactor = Math.pow(service, seg.serviceSensitivity);
    const reputationFactor = Math.pow(reputation, seg.reputationSensitivity);

    const demandMultiplier = seg.baseShare * priceFactor * qualityFactor * serviceFactor * reputationFactor;

    results.push({
      segment: segId,
      share: seg.baseShare,
      demandMultiplier: Math.round(demandMultiplier * 1000) / 1000,
      priceFactor: Math.round(priceFactor * 1000) / 1000,
      qualityFactor: Math.round(qualityFactor * 1000) / 1000,
    });
  }

  return results;
}

// ============================================
// 7. REVIEW GENERATION
// ============================================

/**
 * Determine review sentiment from satisfaction score.
 *   - satisfaction >= 65 → POSITIVE
 *   - satisfaction >= 40 → NEUTRAL
 *   - satisfaction < 40 → NEGATIVE
 */
export function determineSentiment(satisfaction: number): ReviewSentiment {
  if (satisfaction >= 65) return 'POSITIVE';
  if (satisfaction >= 40) return 'NEUTRAL';
  return 'NEGATIVE';
}

/**
 * Determine review category from satisfaction breakdown.
 * Picks the worst-performing category as the review focus.
 * WAIT_TIME is included when service is the worst factor (slow service = long wait).
 */
export function determineCategory(factors: {
  priceSatisfaction: number;
  serviceQuality: number;
  productQuality: number;
  stockAvailability: number;
  atmosphere: number;
}): ReviewCategory {
  // Find the lowest factor
  const entries: [ReviewCategory, number][] = [
    ['PRICE', factors.priceSatisfaction],
    ['SERVICE', factors.serviceQuality],
    ['QUALITY', factors.productQuality],
    ['STOCKOUT', factors.stockAvailability],
    ['CLEANLINESS', factors.atmosphere],
  ];

  // Sort by value ascending (worst first)
  entries.sort((a, b) => a[1] - b[1]);

  // If service is the worst factor and very low, attribute to WAIT_TIME instead
  // This makes WAIT_TIME reviews reachable (previously dead code)
  if (entries[0][0] === 'SERVICE' && entries[0][1] < 30) {
    return 'WAIT_TIME';
  }

  return entries[0][0];
}

/**
 * Generate a star rating from satisfaction score.
 *   - satisfaction 90+ → 5 stars
 *   - satisfaction 70-89 → 4 stars
 *   - satisfaction 50-69 → 3 stars
 *   - satisfaction 30-49 → 2 stars
 *   - satisfaction < 30 → 1 star
 *   - ±1 random variation
 */
export function generateRating(satisfaction: number): number {
  let base: number;
  if (satisfaction >= 90) base = 5;
  else if (satisfaction >= 70) base = 4;
  else if (satisfaction >= 50) base = 3;
  else if (satisfaction >= 30) base = 2;
  else base = 1;

  // Small random variation ±1
  const variation = Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0;
  return Math.max(1, Math.min(5, base + variation));
}

/**
 * Pick a random customer segment, weighted by baseShare.
 */
export function pickRandomSegment(): CustomerSegmentId {
  const roll = Math.random();
  let cumulative = 0;

  const segmentIds: CustomerSegmentId[] = ['BUDGET', 'REGULAR', 'PREMIUM', 'TOURIST'];
  for (const segId of segmentIds) {
    cumulative += CUSTOMER_SEGMENTS[segId].baseShare;
    if (roll <= cumulative) return segId;
  }

  return 'BUDGET'; // Fallback
}

/**
 * Generate a review comment from sentiment and category.
 */
export function generateComment(sentiment: ReviewSentiment, category: ReviewCategory): string {
  // 30% chance of category-specific comment for negative/neutral
  if (sentiment !== 'POSITIVE' && Math.random() < 0.3) {
    const categoryTemplate = REVIEW_CONFIG.CATEGORY_TEMPLATES[category as keyof typeof REVIEW_CONFIG.CATEGORY_TEMPLATES];
    if (categoryTemplate) return categoryTemplate;
  }

  // Pick from sentiment templates
  const templates = REVIEW_CONFIG.templates[sentiment];
  const idx = Math.floor(Math.random() * templates.length);
  return templates[idx];
}

/**
 * Generate customer reviews for a business tick.
 *
 * @param businessId - Business ID
 * @param gameDay - Current game day
 * @param satisfaction - Current satisfaction result
 * @param maxReviews - Max reviews to generate this tick
 * @returns Array of CustomerReviewInput (ready to be persisted)
 */
export function generateReviews(
  businessId: string,
  gameDay: number,
  satisfaction: SatisfactionResult,
  maxReviews: number = REVIEW_CONFIG.maxPerTick,
): CustomerReviewInput[] {
  const reviews: CustomerReviewInput[] = [];

  // Determine how many reviews to generate
  const numReviews = Math.floor(Math.random() * (maxReviews + 1));
  if (numReviews === 0) return reviews;

  for (let i = 0; i < numReviews; i++) {
    // Each review has a probability of being generated
    if (Math.random() > REVIEW_CONFIG.probabilityPerTick) continue;

    const sentiment = determineSentiment(satisfaction.overall);
    const category = determineCategory({
      priceSatisfaction: satisfaction.priceSatisfaction,
      serviceQuality: satisfaction.serviceQuality,
      productQuality: satisfaction.productQuality,
      stockAvailability: satisfaction.stockAvailability,
      atmosphere: satisfaction.atmosphere,
    });
    const rating = generateRating(satisfaction.overall);
    const segment = pickRandomSegment();
    const comment = generateComment(sentiment, category);

    reviews.push({
      businessId,
      gameDay,
      satisfaction: satisfaction.overall,
      sentiment,
      rating,
      category,
      segment,
      comment,
    });
  }

  return reviews;
}

// ============================================
// 8. SERVICE QUALITY CALCULATION
// ============================================

/**
 * Calculate service quality based on employee count and skills.
 *
 * @param employeeCount - Number of employees
 * @param avgEmployeeSkill - Average employee skill (0-1)
 * @param idealEmployeeCount - Ideal number of employees for this business type/level
 * @returns Service quality 0-1
 */
export function calculateServiceQuality(
  employeeCount: number,
  avgEmployeeSkill: number,
  idealEmployeeCount: number,
): number {
  if (employeeCount === 0) return 0.1; // Minimum service with no employees

  // Coverage ratio: how close to ideal staffing
  const coverageRatio = Math.min(1, employeeCount / idealEmployeeCount);

  // Service quality = coverage × skill
  const quality = coverageRatio * (0.3 + 0.7 * avgEmployeeSkill);

  return Math.max(0, Math.min(1, quality));
}

// ============================================
// 9. CX DEMAND MODIFIER
// ============================================

/**
 * Calculate the overall CX demand modifier for a business.
 *
 * This modifies the base customer count based on satisfaction and loyalty.
 * A business with high satisfaction and loyalty attracts more customers.
 *
 * Formula:
 *   modifier = (satisfaction / 50) × (1 + repeatCustomerRate × loyaltyMultiplier)
 *   - satisfaction 50 → base modifier 1.0
 *   - satisfaction 75 → modifier 1.5
 *   - satisfaction 25 → modifier 0.5
 *   - High loyalty adds up to +86% more customers
 */
export function calculateCXDemandModifier(
  satisfactionScore: number,
  repeatCustomerRate: number,
  loyaltyMultiplier: number,
): number {
  const satisfactionModifier = satisfactionScore / 50; // 1.0 at 50, 1.5 at 75, 0.5 at 25
  const loyaltyBonus = 1 + repeatCustomerRate * (loyaltyMultiplier - 1) * LOYALTY_CONFIG.loyaltyVisitBonus;

  return Math.max(0.2, Math.min(2.0, satisfactionModifier * loyaltyBonus));
}
