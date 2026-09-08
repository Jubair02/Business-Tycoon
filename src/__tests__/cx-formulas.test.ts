// ============================================
// Bangladesh Business Tycoon - CX Formula Tests
// Phase 3: Tests for Customer Experience formulas
// ============================================

import { describe, it, expect } from 'vitest';
import {
  calculatePriceCompetitiveness,
  calculateSatisfaction,
  calculateServiceQuality,
  getLoyaltyTier,
  calculateLoyalty,
  calculateNPS,
  calculateSegmentDemands,
  generateReviews,
  calculateCXDemandModifier,
  determineSentiment,
  determineCategory,
  generateRating,
} from '@/lib/game/economy/cx-formulas';
import {
  SATISFACTION_WEIGHTS,
  CUSTOMER_SEGMENTS,
  LOYALTY_TIERS,
  LOYALTY_CONFIG,
  NPS_CONFIG,
  REVIEW_CONFIG,
} from '@/lib/game/economy/cx-config';
import type {
  SatisfactionInput,
  SatisfactionResult,
  LoyaltyInput,
  ReviewSentiment,
  ReviewCategory,
} from '@/lib/game/economy/types';

// ============================================
// 1. PRICE COMPETITIVENESS
// ============================================

describe('calculatePriceCompetitiveness', () => {
  const productDefs = [
    { name: 'Tea', basePrice: 5, suggestedMarkup: 0.5 },
    { name: 'Rice', basePrice: 50, suggestedMarkup: 0.3 },
    { name: 'Soap', basePrice: 20, suggestedMarkup: 0.4 },
  ];
  const neutralMarket = {
    Tea: { priceMultiplier: 1.0 },
    Rice: { priceMultiplier: 1.0 },
    Soap: { priceMultiplier: 1.0 },
  };

  it('returns 0.5 for empty inventories', () => {
    expect(calculatePriceCompetitiveness([], productDefs, neutralMarket)).toBe(0.5);
  });

  it('returns ~1.0 when all products are at market price', () => {
    // marketRef = basePrice * (1 + suggestedMarkup)
    // Tea: 5 * 1.5 = 7.5, Rice: 50 * 1.3 = 65, Soap: 20 * 1.4 = 28
    const inventories = [
      { productName: 'Tea', sellPrice: 7.5 },
      { productName: 'Rice', sellPrice: 65 },
      { productName: 'Soap', sellPrice: 28 },
    ];
    const result = calculatePriceCompetitiveness(inventories, productDefs, neutralMarket);
    // ratio = 1.0 for each, competitiveness = 1 - (1-1)/2 = 1.0
    expect(result).toBeCloseTo(1.0, 2);
  });

  it('returns 0.0 when all products are 3x market price', () => {
    const inventories = [
      { productName: 'Tea', sellPrice: 7.5 * 3 },
      { productName: 'Rice', sellPrice: 65 * 3 },
      { productName: 'Soap', sellPrice: 28 * 3 },
    ];
    const result = calculatePriceCompetitiveness(inventories, productDefs, neutralMarket);
    // ratio = 3.0, competitiveness = 1 - (3-1)/2 = 0
    expect(result).toBeCloseTo(0.0, 2);
  });

  it('returns 0.5 when all products are 2x market price', () => {
    const inventories = [
      { productName: 'Tea', sellPrice: 7.5 * 2 },
      { productName: 'Rice', sellPrice: 65 * 2 },
      { productName: 'Soap', sellPrice: 28 * 2 },
    ];
    const result = calculatePriceCompetitiveness(inventories, productDefs, neutralMarket);
    // ratio = 2.0, competitiveness = 1 - (2-1)/2 = 0.5
    expect(result).toBeCloseTo(0.5, 2);
  });

  it('returns ~1.0 when all products are 0.5x market price (below market)', () => {
    const inventories = [
      { productName: 'Tea', sellPrice: 7.5 * 0.5 },
      { productName: 'Rice', sellPrice: 65 * 0.5 },
      { productName: 'Soap', sellPrice: 28 * 0.5 },
    ];
    const result = calculatePriceCompetitiveness(inventories, productDefs, neutralMarket);
    // ratio = 0.5, competitiveness = 1 - (0.5-1)/2 = 1.25 → clamped to 1.0
    expect(result).toBeCloseTo(1.0, 2);
  });

  it('returns 0.75 when all products are 1.5x market price', () => {
    const inventories = [
      { productName: 'Tea', sellPrice: 7.5 * 1.5 },
      { productName: 'Rice', sellPrice: 65 * 1.5 },
      { productName: 'Soap', sellPrice: 28 * 1.5 },
    ];
    const result = calculatePriceCompetitiveness(inventories, productDefs, neutralMarket);
    // ratio = 1.5, competitiveness = 1 - (1.5-1)/2 = 0.75
    expect(result).toBeCloseTo(0.75, 2);
  });

  it('averages mixed pricing correctly', () => {
    const inventories = [
      { productName: 'Tea', sellPrice: 7.5 },      // ratio 1.0 → competitiveness 1.0
      { productName: 'Rice', sellPrice: 65 * 2 },   // ratio 2.0 → competitiveness 0.5
      { productName: 'Soap', sellPrice: 28 * 3 },   // ratio 3.0 → competitiveness 0.0
    ];
    const result = calculatePriceCompetitiveness(inventories, productDefs, neutralMarket);
    // Average: (1.0 + 0.5 + 0.0) / 3 ≈ 0.5
    expect(result).toBeCloseTo(0.5, 2);
  });

  it('applies market price multiplier from marketPriceMap', () => {
    const hotMarket = {
      Tea: { priceMultiplier: 1.5 },  // market price is 1.5x higher
      Rice: { priceMultiplier: 1.0 },
      Soap: { priceMultiplier: 1.0 },
    };
    const inventories = [
      { productName: 'Tea', sellPrice: 7.5 },  // sell at base market, but market is now 1.5x
    ];
    const result = calculatePriceCompetitiveness(inventories, productDefs, hotMarket);
    // effectiveMarketRef = 7.5 * 1.5 = 11.25
    // ratio = 7.5 / 11.25 = 0.667
    // competitiveness = 1 - (0.667 - 1)/2 = 1.167 → clamped to 1.0
    expect(result).toBeCloseTo(1.0, 2);
  });

  it('skips inventories with no matching product definition', () => {
    const inventories = [
      { productName: 'UnknownProduct', sellPrice: 100 },
      { productName: 'Tea', sellPrice: 7.5 },
    ];
    const result = calculatePriceCompetitiveness(inventories, productDefs, neutralMarket);
    // Only Tea counts: competitiveness 1.0
    // count = 2 (both iterated), but only 1 has a productDef, so totalCompetitiveness = 1.0, count = 2
    // Wait - looking at the code: count++ happens regardless of whether prodDef is found
    // Actually the code does `if (!prodDef) continue;` which skips the rest of the loop body including count++
    // So count only increments when prodDef is found AND effectiveMarketRef > 0
    // Let me re-read the code...
    // Actually: count++ is AFTER the if block, so it increments for every inventory item
    // regardless of whether prodDef was found. But totalCompetitiveness only increases
    // when both prodDef is found AND effectiveMarketRef > 0.
    // So: totalCompetitiveness = 1.0, count = 2 → average = 0.5
    // Hmm, wait. Let me re-read carefully...
    // The code is:
    //   for (const inv of inventories) {
    //     const prodDef = productDefs.find(p => p.name === inv.productName);
    //     if (!prodDef) continue;  ← this skips the rest including count++
    //     ...
    //     count++;
    //   }
    // So if !prodDef, continue skips count++. count = 1.
    expect(result).toBeCloseTo(1.0, 2);
  });

  it('returns 0.5 when no inventories match any product definition', () => {
    const inventories = [
      { productName: 'Foo', sellPrice: 100 },
      { productName: 'Bar', sellPrice: 200 },
    ];
    const result = calculatePriceCompetitiveness(inventories, productDefs, neutralMarket);
    // count = 0, returns 0.5
    expect(result).toBe(0.5);
  });
});

// ============================================
// 2. SATISFACTION CALCULATION
// ============================================

describe('calculateSatisfaction', () => {
  it('perfect business (all factors 1.0) with currentSatisfaction=100 → satisfaction > 80', () => {
    const input: SatisfactionInput = {
      priceCompetitiveness: 1.0,
      productQuality: 1.0,
      serviceQuality: 1.0,
      stockAvailability: 1.0,
      atmosphere: 1.0,
      currentSatisfaction: 100,
    };
    const result = calculateSatisfaction(input);
    // rawScore = 0.30*100 + 0.25*100 + 0.20*100 + 0.15*100 + 0.10*100 = 100
    // smoothed = 100 * 0.7 + 100 * 0.3 = 100
    expect(result.overall).toBeCloseTo(100, 1);
    expect(result.overall).toBeGreaterThan(80);
  });

  it('perfect business with currentSatisfaction=0 still yields high satisfaction', () => {
    const input: SatisfactionInput = {
      priceCompetitiveness: 1.0,
      productQuality: 1.0,
      serviceQuality: 1.0,
      stockAvailability: 1.0,
      atmosphere: 1.0,
      currentSatisfaction: 0,
    };
    const result = calculateSatisfaction(input);
    // rawScore = 100, smoothed = 0 * 0.7 + 100 * 0.3 = 30
    expect(result.overall).toBeCloseTo(30, 1);
  });

  it('terrible business (all factors 0.0) → satisfaction < 30', () => {
    const input: SatisfactionInput = {
      priceCompetitiveness: 0.0,
      productQuality: 0.0,
      serviceQuality: 0.0,
      stockAvailability: 0.0,
      atmosphere: 0.0,
      currentSatisfaction: 0,
    };
    const result = calculateSatisfaction(input);
    // rawScore = 0, smoothed = 0
    expect(result.overall).toBeLessThan(30);
    expect(result.overall).toBeCloseTo(0, 1);
  });

  it('terrible business with currentSatisfaction=100 still drops below 80', () => {
    const input: SatisfactionInput = {
      priceCompetitiveness: 0.0,
      productQuality: 0.0,
      serviceQuality: 0.0,
      stockAvailability: 0.0,
      atmosphere: 0.0,
      currentSatisfaction: 100,
    };
    const result = calculateSatisfaction(input);
    // rawScore = 0, smoothed = 100 * 0.7 + 0 * 0.3 = 70
    expect(result.overall).toBeCloseTo(70, 1);
    expect(result.overall).toBeLessThan(80);
  });

  it('mixed factors produce mid-range satisfaction', () => {
    const input: SatisfactionInput = {
      priceCompetitiveness: 0.8,  // 80
      productQuality: 0.6,       // 60
      serviceQuality: 0.5,       // 50
      stockAvailability: 0.7,    // 70
      atmosphere: 0.4,           // 40
      currentSatisfaction: 50,
    };
    const result = calculateSatisfaction(input);
    // rawScore = 0.30*80 + 0.25*60 + 0.20*50 + 0.15*70 + 0.10*40
    //          = 24 + 15 + 10 + 10.5 + 4 = 63.5
    // smoothed = 50 * 0.7 + 63.5 * 0.3 = 35 + 19.05 = 54.05
    expect(result.overall).toBeCloseTo(54.05, 1);
    expect(result.overall).toBeGreaterThan(40);
    expect(result.overall).toBeLessThan(70);
  });

  it('smoothing: current satisfaction blends with new calculation', () => {
    // Same factors but different currentSatisfaction → different results
    const baseFactors = {
      priceCompetitiveness: 0.7,
      productQuality: 0.7,
      serviceQuality: 0.7,
      stockAvailability: 0.7,
      atmosphere: 0.7,
    };
    const lowCurrent = calculateSatisfaction({ ...baseFactors, currentSatisfaction: 0 });
    const highCurrent = calculateSatisfaction({ ...baseFactors, currentSatisfaction: 100 });
    // Higher current satisfaction should produce higher result (smoothing effect)
    expect(highCurrent.overall).toBeGreaterThan(lowCurrent.overall);
  });

  it('tracks positive factors when scores >= 60', () => {
    const input: SatisfactionInput = {
      priceCompetitiveness: 0.7,  // 70 >= 60 → positive
      productQuality: 0.7,       // 70 >= 60 → positive
      serviceQuality: 0.7,       // 70 >= 60 → positive
      stockAvailability: 0.7,    // 70 >= 60 → positive
      atmosphere: 0.7,           // 70 >= 60 → positive
      currentSatisfaction: 50,
    };
    const result = calculateSatisfaction(input);
    expect(result.positiveFactors).toContain('Fair prices');
    expect(result.positiveFactors).toContain('Good product quality');
    expect(result.positiveFactors).toContain('Good service');
    expect(result.positiveFactors).toContain('Well-stocked');
    expect(result.positiveFactors).toContain('Good atmosphere');
    expect(result.negativeFactors).toHaveLength(0);
  });

  it('tracks negative factors when scores < 40', () => {
    const input: SatisfactionInput = {
      priceCompetitiveness: 0.3,  // 30 < 40 → negative
      productQuality: 0.3,       // 30 < 40 → negative
      serviceQuality: 0.3,       // 30 < 40 → negative
      stockAvailability: 0.3,    // 30 < 40 → negative
      atmosphere: 0.3,           // 30 < 40 → negative
      currentSatisfaction: 50,
    };
    const result = calculateSatisfaction(input);
    expect(result.negativeFactors).toContain('High prices');
    expect(result.negativeFactors).toContain('Poor product quality');
    expect(result.negativeFactors).toContain('Poor service');
    expect(result.negativeFactors).toContain('Low stock');
    expect(result.negativeFactors).toContain('Poor atmosphere');
    expect(result.positiveFactors).toHaveLength(0);
  });

  it('factors between 40-59 are neither positive nor negative', () => {
    const input: SatisfactionInput = {
      priceCompetitiveness: 0.5,  // 50 → neither
      productQuality: 0.5,       // 50 → neither
      serviceQuality: 0.5,       // 50 → neither
      stockAvailability: 0.5,    // 50 → neither
      atmosphere: 0.5,           // 50 → neither
      currentSatisfaction: 50,
    };
    const result = calculateSatisfaction(input);
    expect(result.positiveFactors).toHaveLength(0);
    expect(result.negativeFactors).toHaveLength(0);
  });

  it('returns individual factor scores in 0-100 range', () => {
    const input: SatisfactionInput = {
      priceCompetitiveness: 0.75,
      productQuality: 0.60,
      serviceQuality: 0.85,
      stockAvailability: 0.40,
      atmosphere: 0.95,
      currentSatisfaction: 50,
    };
    const result = calculateSatisfaction(input);
    expect(result.priceSatisfaction).toBeCloseTo(75, 5);
    expect(result.productQuality).toBeCloseTo(60, 5);
    expect(result.serviceQuality).toBeCloseTo(85, 5);
    expect(result.stockAvailability).toBeCloseTo(40, 5);
    expect(result.atmosphere).toBeCloseTo(95, 5);
  });

  it('overall satisfaction is clamped to 0-100', () => {
    const input: SatisfactionInput = {
      priceCompetitiveness: 1.0,
      productQuality: 1.0,
      serviceQuality: 1.0,
      stockAvailability: 1.0,
      atmosphere: 1.0,
      currentSatisfaction: 100,
    };
    const result = calculateSatisfaction(input);
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
  });
});

// ============================================
// 3. SERVICE QUALITY
// ============================================

describe('calculateServiceQuality', () => {
  it('returns 0.1 when no employees', () => {
    expect(calculateServiceQuality(0, 0.5, 5)).toBe(0.1);
  });

  it('returns 0.1 when no employees regardless of skill/ideal', () => {
    expect(calculateServiceQuality(0, 1.0, 10)).toBe(0.1);
  });

  it('full staff (5 employees, ideal=5) with high skill → high quality', () => {
    const result = calculateServiceQuality(5, 0.9, 5);
    // coverageRatio = min(1, 5/5) = 1.0
    // quality = 1.0 * (0.3 + 0.7 * 0.9) = 1.0 * 0.93 = 0.93
    expect(result).toBeCloseTo(0.93, 2);
    expect(result).toBeGreaterThan(0.8);
  });

  it('full staff with low skill → moderate quality', () => {
    const result = calculateServiceQuality(5, 0.3, 5);
    // coverageRatio = 1.0
    // quality = 1.0 * (0.3 + 0.7 * 0.3) = 1.0 * 0.51 = 0.51
    expect(result).toBeCloseTo(0.51, 2);
  });

  it('half staff (3 of ideal 6) → reduced coverage', () => {
    const result = calculateServiceQuality(3, 0.8, 6);
    // coverageRatio = min(1, 3/6) = 0.5
    // quality = 0.5 * (0.3 + 0.7 * 0.8) = 0.5 * 0.86 = 0.43
    expect(result).toBeCloseTo(0.43, 2);
  });

  it('overstaffed (10 of ideal 5) → coverage capped at 1.0', () => {
    const result = calculateServiceQuality(10, 0.8, 5);
    // coverageRatio = min(1, 10/5) = 1.0
    // quality = 1.0 * (0.3 + 0.7 * 0.8) = 0.86
    expect(result).toBeCloseTo(0.86, 2);
  });

  it('quality increases with employee skill', () => {
    const lowSkill = calculateServiceQuality(3, 0.2, 5);
    const highSkill = calculateServiceQuality(3, 0.9, 5);
    expect(highSkill).toBeGreaterThan(lowSkill);
  });

  it('quality increases with more employees (up to ideal)', () => {
    const few = calculateServiceQuality(1, 0.7, 5);
    const more = calculateServiceQuality(3, 0.7, 5);
    const full = calculateServiceQuality(5, 0.7, 5);
    expect(more).toBeGreaterThan(few);
    expect(full).toBeGreaterThan(more);
  });

  it('result is always between 0 and 1', () => {
    expect(calculateServiceQuality(0, 0, 1)).toBeGreaterThanOrEqual(0);
    expect(calculateServiceQuality(0, 0, 1)).toBeLessThanOrEqual(1);
    expect(calculateServiceQuality(100, 1.0, 1)).toBeLessThanOrEqual(1);
    expect(calculateServiceQuality(100, 1.0, 1)).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// 4. LOYALTY TIER
// ============================================

describe('getLoyaltyTier', () => {
  it('0 points → BRONZE', () => {
    const result = getLoyaltyTier(0);
    expect(result.tier).toBe('BRONZE');
    expect(result.multiplier).toBe(1.0);
    expect(result.name).toBe('Bronze');
  });

  it('99 points → BRONZE', () => {
    expect(getLoyaltyTier(99).tier).toBe('BRONZE');
  });

  it('100 points → SILVER', () => {
    const result = getLoyaltyTier(100);
    expect(result.tier).toBe('SILVER');
    expect(result.multiplier).toBe(1.10);
    expect(result.name).toBe('Silver');
  });

  it('299 points → SILVER', () => {
    expect(getLoyaltyTier(299).tier).toBe('SILVER');
  });

  it('300 points → GOLD', () => {
    const result = getLoyaltyTier(300);
    expect(result.tier).toBe('GOLD');
    expect(result.multiplier).toBe(1.25);
    expect(result.name).toBe('Gold');
  });

  it('599 points → GOLD', () => {
    expect(getLoyaltyTier(599).tier).toBe('GOLD');
  });

  it('600 points → PLATINUM', () => {
    const result = getLoyaltyTier(600);
    expect(result.tier).toBe('PLATINUM');
    expect(result.multiplier).toBe(1.5);
    expect(result.name).toBe('Platinum');
  });

  it('1000 points → PLATINUM', () => {
    expect(getLoyaltyTier(1000).tier).toBe('PLATINUM');
  });

  it('returns correct icon for each tier', () => {
    expect(getLoyaltyTier(0).icon).toBe('🥉');
    expect(getLoyaltyTier(100).icon).toBe('🥈');
    expect(getLoyaltyTier(300).icon).toBe('🥇');
    expect(getLoyaltyTier(600).icon).toBe('💎');
  });

  it('boundary: exactly at each tier minimum', () => {
    expect(getLoyaltyTier(LOYALTY_TIERS.BRONZE.minPoints).tier).toBe('BRONZE');
    expect(getLoyaltyTier(LOYALTY_TIERS.SILVER.minPoints).tier).toBe('SILVER');
    expect(getLoyaltyTier(LOYALTY_TIERS.GOLD.minPoints).tier).toBe('GOLD');
    expect(getLoyaltyTier(LOYALTY_TIERS.PLATINUM.minPoints).tier).toBe('PLATINUM');
  });
});

// ============================================
// 5. LOYALTY CALCULATION
// ============================================

describe('calculateLoyalty', () => {
  it('positive experience with customers increases loyalty', () => {
    const input: LoyaltyInput = {
      currentLoyaltyScore: 50,
      currentRepeatRate: 0.3,
      wasPositiveExperience: true,
      totalCustomers: 10,
      numberOfReviews: 0,
      averageRating: 3,
      loyaltyMultiplier: 1.0,
    };
    const result = calculateLoyalty(input);
    // newScore = 50 + 2.0 (dailyGain) = 52
    expect(result.loyaltyScore).toBeGreaterThan(50);
  });

  it('negative experience with customers decreases loyalty', () => {
    const input: LoyaltyInput = {
      currentLoyaltyScore: 50,
      currentRepeatRate: 0.3,
      wasPositiveExperience: false,
      totalCustomers: 10,
      numberOfReviews: 0,
      averageRating: 3,
      loyaltyMultiplier: 1.0,
    };
    const result = calculateLoyalty(input);
    // newScore = 50 - 4.0 (dailyLoss) = 46
    expect(result.loyaltyScore).toBeLessThan(50);
  });

  it('no customers causes loyalty decay', () => {
    const input: LoyaltyInput = {
      currentLoyaltyScore: 50,
      currentRepeatRate: 0.3,
      wasPositiveExperience: true,
      totalCustomers: 0,
      numberOfReviews: 0,
      averageRating: 3,
      loyaltyMultiplier: 1.0,
    };
    const result = calculateLoyalty(input);
    // newScore = 50 - 0.5 (dailyDecay) = 49.5
    expect(result.loyaltyScore).toBeLessThan(50);
  });

  it('loyalty score is capped at maxScore (100)', () => {
    const input: LoyaltyInput = {
      currentLoyaltyScore: 99,
      currentRepeatRate: 0.3,
      wasPositiveExperience: true,
      totalCustomers: 10,
      numberOfReviews: 5,
      averageRating: 5,  // rating bonus = (5-3)*0.5 = 1
      loyaltyMultiplier: 1.0,
    };
    const result = calculateLoyalty(input);
    // newScore = 99 + 2.0 + 1.0 = 102 → clamped to 100
    expect(result.loyaltyScore).toBeLessThanOrEqual(100);
  });

  it('loyalty score does not go below 0', () => {
    const input: LoyaltyInput = {
      currentLoyaltyScore: 1,
      currentRepeatRate: 0.3,
      wasPositiveExperience: false,
      totalCustomers: 10,
      numberOfReviews: 5,
      averageRating: 1,  // rating bonus = (?-3)*0.5 = -1
      loyaltyMultiplier: 1.0,
    };
    const result = calculateLoyalty(input);
    // newScore = 1 - 4.0 + (-1) = -4 → clamped to 0
    expect(result.loyaltyScore).toBeGreaterThanOrEqual(0);
  });

  it('high average rating adds loyalty bonus', () => {
    const baseInput: LoyaltyInput = {
      currentLoyaltyScore: 50,
      currentRepeatRate: 0.3,
      wasPositiveExperience: true,
      totalCustomers: 10,
      numberOfReviews: 5,
      averageRating: 3,
      loyaltyMultiplier: 1.0,
    };
    const highRatingInput: LoyaltyInput = {
      ...baseInput,
      averageRating: 5,  // bonus = (5-3)*0.5 = 1
    };
    const lowRatingInput: LoyaltyInput = {
      ...baseInput,
      averageRating: 1,  // bonus = (1-3)*0.5 = -1
    };
    const highResult = calculateLoyalty(highRatingInput);
    const lowResult = calculateLoyalty(lowRatingInput);
    expect(highResult.loyaltyScore).toBeGreaterThan(lowResult.loyaltyScore);
  });

  it('repeat rate is capped at repeatRateCap (0.86)', () => {
    const input: LoyaltyInput = {
      currentLoyaltyScore: 100,
      currentRepeatRate: 0.9,  // above cap
      wasPositiveExperience: true,
      totalCustomers: 10,
      numberOfReviews: 0,
      averageRating: 3,
      loyaltyMultiplier: 1.0,
    };
    const result = calculateLoyalty(input);
    expect(result.repeatCustomerRate).toBeLessThanOrEqual(LOYALTY_CONFIG.repeatRateCap);
  });

  it('repeat rate is non-negative', () => {
    const input: LoyaltyInput = {
      currentLoyaltyScore: 0,
      currentRepeatRate: 0,
      wasPositiveExperience: false,
      totalCustomers: 0,
      numberOfReviews: 0,
      averageRating: 1,
      loyaltyMultiplier: 1.0,
    };
    const result = calculateLoyalty(input);
    expect(result.repeatCustomerRate).toBeGreaterThanOrEqual(0);
  });

  it('tier promotion happens when loyalty crosses threshold', () => {
    // Start just below SILVER threshold
    const before: LoyaltyInput = {
      currentLoyaltyScore: 98,
      currentRepeatRate: 0.3,
      wasPositiveExperience: true,
      totalCustomers: 10,
      numberOfReviews: 0,
      averageRating: 3,
      loyaltyMultiplier: 1.0,
    };
    const result = calculateLoyalty(before);
    // newScore = 98 + 2 = 100 → SILVER
    expect(result.tier).toBe('SILVER');
  });

  it('loyalty customer bonus increases with repeat rate and tier multiplier', () => {
    const bronzeInput: LoyaltyInput = {
      currentLoyaltyScore: 50,
      currentRepeatRate: 0.5,
      wasPositiveExperience: true,
      totalCustomers: 100,
      numberOfReviews: 0,
      averageRating: 3,
      loyaltyMultiplier: 1.0,
    };
    const platinumInput: LoyaltyInput = {
      currentLoyaltyScore: 700,
      currentRepeatRate: 0.5,
      wasPositiveExperience: true,
      totalCustomers: 100,
      numberOfReviews: 0,
      averageRating: 3,
      loyaltyMultiplier: 1.5,
    };
    const bronzeResult = calculateLoyalty(bronzeInput);
    const platinumResult = calculateLoyalty(platinumInput);
    // Higher tier multiplier → higher bonus
    expect(platinumResult.loyaltyCustomerBonus).toBeGreaterThanOrEqual(bronzeResult.loyaltyCustomerBonus);
  });

  it('loyalty score is rounded to 1 decimal', () => {
    const input: LoyaltyInput = {
      currentLoyaltyScore: 50,
      currentRepeatRate: 0.3,
      wasPositiveExperience: true,
      totalCustomers: 10,
      numberOfReviews: 0,
      averageRating: 3,
      loyaltyMultiplier: 1.0,
    };
    const result = calculateLoyalty(input);
    // Should be a clean decimal like 52.0
    expect(result.loyaltyScore * 10).toBe(Math.round(result.loyaltyScore * 10));
  });
});

// ============================================
// 6. NPS CALCULATION
// ============================================

describe('calculateNPS', () => {
  it('returns NPS 0 when fewer than minReviews', () => {
    const reviews = [{ rating: 5 }, { rating: 5 }, { rating: 5 }, { rating: 5 }];
    const result = calculateNPS(reviews);
    expect(result.nps).toBe(0);
    expect(result.promoters).toBe(0);
    expect(result.totalReviews).toBe(4);
  });

  it('all promoters (rating 5) → NPS 100', () => {
    const reviews = Array(10).fill(null).map(() => ({ rating: 5 }));
    const result = calculateNPS(reviews);
    expect(result.nps).toBe(100);
    expect(result.promoters).toBe(100);
    expect(result.detractors).toBe(0);
  });

  it('all detractors (rating 1-3) → NPS -100', () => {
    const reviews = Array(10).fill(null).map(() => ({ rating: 2 }));
    const result = calculateNPS(reviews);
    expect(result.nps).toBe(-100);
    expect(result.detractors).toBe(100);
    expect(result.promoters).toBe(0);
  });

  it('all passives (rating 4) → NPS 0', () => {
    const reviews = Array(10).fill(null).map(() => ({ rating: 4 }));
    const result = calculateNPS(reviews);
    expect(result.nps).toBe(0);
    expect(result.passives).toBe(100);
  });

  it('mixed ratings produce correct NPS', () => {
    // 5 promoters (rating 5), 3 passives (rating 4), 2 detractors (rating 2)
    const reviews = [
      ...Array(5).fill(null).map(() => ({ rating: 5 })),
      ...Array(3).fill(null).map(() => ({ rating: 4 })),
      ...Array(2).fill(null).map(() => ({ rating: 2 })),
    ];
    const result = calculateNPS(reviews);
    // promoterPct = 50, detractorPct = 20, NPS = 30
    expect(result.nps).toBe(30);
    expect(result.promoters).toBe(50);
    expect(result.passives).toBe(30);
    expect(result.detractors).toBe(20);
    expect(result.totalReviews).toBe(10);
  });

  it('rating 3 is a detractor', () => {
    const reviews = Array(5).fill(null).map(() => ({ rating: 3 }));
    const result = calculateNPS(reviews);
    expect(result.nps).toBe(-100);
    expect(result.detractors).toBe(100);
  });

  it('rating 1 is a detractor', () => {
    const reviews = Array(5).fill(null).map(() => ({ rating: 1 }));
    const result = calculateNPS(reviews);
    expect(result.nps).toBe(-100);
  });

  it('exactly minReviews produces a valid NPS', () => {
    const reviews = Array(NPS_CONFIG.minReviews).fill(null).map(() => ({ rating: 5 }));
    const result = calculateNPS(reviews);
    expect(result.nps).toBe(100);
  });

  it('NPS is between -100 and 100', () => {
    const mixedReviews = [
      { rating: 5 }, { rating: 5 }, { rating: 4 },
      { rating: 3 }, { rating: 2 }, { rating: 1 },
    ];
    const result = calculateNPS(mixedReviews);
    expect(result.nps).toBeGreaterThanOrEqual(-100);
    expect(result.nps).toBeLessThanOrEqual(100);
  });
});

// ============================================
// 7. SEGMENT DEMANDS
// ============================================

describe('calculateSegmentDemands', () => {
  it('returns 4 segments', () => {
    const result = calculateSegmentDemands({
      priceCompetitiveness: 0.8,
      productQuality: 0.8,
      serviceQuality: 0.8,
      reputation: 80,
    });
    expect(result).toHaveLength(4);
    expect(result.map(r => r.segment)).toEqual(['BUDGET', 'REGULAR', 'PREMIUM', 'TOURIST']);
  });

  it('each segment has correct base share', () => {
    const result = calculateSegmentDemands({
      priceCompetitiveness: 1.0,
      productQuality: 1.0,
      serviceQuality: 1.0,
      reputation: 100,
    });
    expect(result[0].share).toBe(CUSTOMER_SEGMENTS.BUDGET.baseShare);
    expect(result[1].share).toBe(CUSTOMER_SEGMENTS.REGULAR.baseShare);
    expect(result[2].share).toBe(CUSTOMER_SEGMENTS.PREMIUM.baseShare);
    expect(result[3].share).toBe(CUSTOMER_SEGMENTS.TOURIST.baseShare);
  });

  it('total share sums to ~1.0', () => {
    const result = calculateSegmentDemands({
      priceCompetitiveness: 0.8,
      productQuality: 0.8,
      serviceQuality: 0.8,
      reputation: 80,
    });
    const totalShare = result.reduce((sum, r) => sum + r.share, 0);
    expect(totalShare).toBeCloseTo(1.0, 2);
  });

  it('budget customers react more to price than premium', () => {
    // Low price competitiveness
    const result = calculateSegmentDemands({
      priceCompetitiveness: 0.5,
      productQuality: 0.8,
      serviceQuality: 0.8,
      reputation: 80,
    });
    const budgetPriceFactor = result.find(r => r.segment === 'BUDGET')!.priceFactor;
    const premiumPriceFactor = result.find(r => r.segment === 'PREMIUM')!.priceFactor;
    // Budget has higher price sensitivity (1.5 vs 0.5), so with low price competitiveness,
    // budget's priceFactor should be lower
    expect(budgetPriceFactor).toBeLessThan(premiumPriceFactor);
  });

  it('premium customers react more to quality than budget', () => {
    const result = calculateSegmentDemands({
      priceCompetitiveness: 0.8,
      productQuality: 0.5,
      serviceQuality: 0.8,
      reputation: 80,
    });
    const budgetQualityFactor = result.find(r => r.segment === 'BUDGET')!.qualityFactor;
    const premiumQualityFactor = result.find(r => r.segment === 'PREMIUM')!.qualityFactor;
    // Premium has higher quality sensitivity (1.5 vs 0.6), so with low quality,
    // premium's qualityFactor should be lower
    expect(premiumQualityFactor).toBeLessThan(budgetQualityFactor);
  });

  it('all 1.0 inputs produce demand multiplier equal to base share', () => {
    const result = calculateSegmentDemands({
      priceCompetitiveness: 1.0,
      productQuality: 1.0,
      serviceQuality: 1.0,
      reputation: 100,
    });
    // When all factors are 1.0, 1.0^x = 1.0, so demand = baseShare * 1 * 1 * 1 * 1 = baseShare
    for (const r of result) {
      expect(r.demandMultiplier).toBeCloseTo(r.share, 2);
    }
  });

  it('low reputation hurts tourist segment more than budget', () => {
    const result = calculateSegmentDemands({
      priceCompetitiveness: 0.8,
      productQuality: 0.8,
      serviceQuality: 0.8,
      reputation: 20,  // low reputation
    });
    // Tourist has reputationSensitivity 1.5, Budget has 0.4
    // Low reputation should hurt tourist demand more
    const budgetDemand = result.find(r => r.segment === 'BUDGET')!.demandMultiplier;
    const touristDemand = result.find(r => r.segment === 'TOURIST')!.demandMultiplier;
    // Compare demand relative to their base shares
    const budgetRatio = budgetDemand / CUSTOMER_SEGMENTS.BUDGET.baseShare;
    const touristRatio = touristDemand / CUSTOMER_SEGMENTS.TOURIST.baseShare;
    expect(touristRatio).toBeLessThan(budgetRatio);
  });
});

// ============================================
// 8. REVIEW GENERATION
// ============================================

describe('determineSentiment', () => {
  it('satisfaction >= 65 → POSITIVE', () => {
    expect(determineSentiment(65)).toBe('POSITIVE');
    expect(determineSentiment(80)).toBe('POSITIVE');
    expect(determineSentiment(100)).toBe('POSITIVE');
  });

  it('satisfaction 40-64 → NEUTRAL', () => {
    expect(determineSentiment(40)).toBe('NEUTRAL');
    expect(determineSentiment(50)).toBe('NEUTRAL');
    expect(determineSentiment(64)).toBe('NEUTRAL');
  });

  it('satisfaction < 40 → NEGATIVE', () => {
    expect(determineSentiment(39)).toBe('NEGATIVE');
    expect(determineSentiment(0)).toBe('NEGATIVE');
  });
});

describe('determineCategory', () => {
  it('returns the worst-performing category', () => {
    const result = determineCategory({
      priceSatisfaction: 80,
      serviceQuality: 30,  // worst
      productQuality: 70,
      stockAvailability: 60,
      atmosphere: 50,
    });
    expect(result).toBe('SERVICE');
  });

  it('returns PRICE when price is worst', () => {
    const result = determineCategory({
      priceSatisfaction: 20,
      serviceQuality: 80,
      productQuality: 70,
      stockAvailability: 60,
      atmosphere: 50,
    });
    expect(result).toBe('PRICE');
  });

  it('returns STOCKOUT when stock is worst', () => {
    const result = determineCategory({
      priceSatisfaction: 80,
      serviceQuality: 70,
      productQuality: 60,
      stockAvailability: 10,
      atmosphere: 50,
    });
    expect(result).toBe('STOCKOUT');
  });

  it('returns CLEANLINESS when atmosphere is worst', () => {
    const result = determineCategory({
      priceSatisfaction: 80,
      serviceQuality: 70,
      productQuality: 60,
      stockAvailability: 50,
      atmosphere: 10,
    });
    expect(result).toBe('CLEANLINESS');
  });

  it('returns QUALITY when productQuality is worst', () => {
    const result = determineCategory({
      priceSatisfaction: 80,
      serviceQuality: 70,
      productQuality: 10,
      stockAvailability: 50,
      atmosphere: 60,
    });
    expect(result).toBe('QUALITY');
  });
});

describe('generateRating', () => {
  it('satisfaction 90+ → base rating 5', () => {
    // Run multiple times to check the base is 5 (with ±1 variation: 4-5)
    const ratings = Array(100).fill(null).map(() => generateRating(95));
    for (const r of ratings) {
      expect(r).toBeGreaterThanOrEqual(4);
      expect(r).toBeLessThanOrEqual(5);
    }
  });

  it('satisfaction 70-89 → base rating 4', () => {
    const ratings = Array(100).fill(null).map(() => generateRating(75));
    for (const r of ratings) {
      expect(r).toBeGreaterThanOrEqual(3);
      expect(r).toBeLessThanOrEqual(5);
    }
  });

  it('satisfaction 50-69 → base rating 3', () => {
    const ratings = Array(100).fill(null).map(() => generateRating(60));
    for (const r of ratings) {
      expect(r).toBeGreaterThanOrEqual(2);
      expect(r).toBeLessThanOrEqual(4);
    }
  });

  it('satisfaction 30-49 → base rating 2', () => {
    const ratings = Array(100).fill(null).map(() => generateRating(40));
    for (const r of ratings) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(3);
    }
  });

  it('satisfaction < 30 → base rating 1', () => {
    const ratings = Array(100).fill(null).map(() => generateRating(20));
    for (const r of ratings) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(2);
    }
  });

  it('rating is always between 1 and 5', () => {
    const ratings = Array(200).fill(null).map((_, i) => generateRating(i % 101));
    for (const r of ratings) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(5);
    }
  });
});

describe('generateReviews', () => {
  const highSatisfaction: SatisfactionResult = {
    overall: 85,
    priceSatisfaction: 80,
    productQuality: 90,
    serviceQuality: 85,
    stockAvailability: 80,
    atmosphere: 75,
    positiveFactors: ['Fair prices', 'Good product quality', 'Good service'],
    negativeFactors: [],
  };

  const lowSatisfaction: SatisfactionResult = {
    overall: 25,
    priceSatisfaction: 20,
    productQuality: 30,
    serviceQuality: 15,
    stockAvailability: 25,
    atmosphere: 30,
    positiveFactors: [],
    negativeFactors: ['High prices', 'Poor product quality', 'Poor service'],
  };

  const neutralSatisfaction: SatisfactionResult = {
    overall: 50,
    priceSatisfaction: 50,
    productQuality: 50,
    serviceQuality: 50,
    stockAvailability: 50,
    atmosphere: 50,
    positiveFactors: [],
    negativeFactors: [],
  };

  it('high satisfaction generates positive sentiment reviews', () => {
    // Run multiple times to account for randomness
    let hasPositive = false;
    for (let i = 0; i < 50; i++) {
      const reviews = generateReviews('biz1', 1, highSatisfaction, 5);
      for (const review of reviews) {
        if (review.sentiment === 'POSITIVE') hasPositive = true;
      }
    }
    expect(hasPositive).toBe(true);
  });

  it('low satisfaction generates negative sentiment reviews', () => {
    let hasNegative = false;
    for (let i = 0; i < 50; i++) {
      const reviews = generateReviews('biz1', 1, lowSatisfaction, 5);
      for (const review of reviews) {
        if (review.sentiment === 'NEGATIVE') hasNegative = true;
      }
    }
    expect(hasNegative).toBe(true);
  });

  it('medium satisfaction generates neutral sentiment reviews', () => {
    let hasNeutral = false;
    for (let i = 0; i < 50; i++) {
      const reviews = generateReviews('biz1', 1, neutralSatisfaction, 5);
      for (const review of reviews) {
        if (review.sentiment === 'NEUTRAL') hasNeutral = true;
      }
    }
    expect(hasNeutral).toBe(true);
  });

  it('reviews have valid ratings (1-5)', () => {
    for (let i = 0; i < 20; i++) {
      const reviews = generateReviews('biz1', 1, highSatisfaction, 5);
      for (const review of reviews) {
        expect(review.rating).toBeGreaterThanOrEqual(1);
        expect(review.rating).toBeLessThanOrEqual(5);
      }
    }
  });

  it('reviews have valid sentiments', () => {
    const validSentiments: ReviewSentiment[] = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];
    for (let i = 0; i < 20; i++) {
      const reviews = generateReviews('biz1', 1, highSatisfaction, 5);
      for (const review of reviews) {
        expect(validSentiments).toContain(review.sentiment);
      }
    }
  });

  it('reviews have valid categories', () => {
    const validCategories: ReviewCategory[] = ['PRICE', 'SERVICE', 'QUALITY', 'STOCKOUT', 'CLEANLINESS', 'WAIT_TIME'];
    for (let i = 0; i < 20; i++) {
      const reviews = generateReviews('biz1', 1, highSatisfaction, 5);
      for (const review of reviews) {
        expect(validCategories).toContain(review.category);
      }
    }
  });

  it('reviews have correct businessId and gameDay', () => {
    for (let i = 0; i < 20; i++) {
      const reviews = generateReviews('biz42', 7, highSatisfaction, 5);
      for (const review of reviews) {
        expect(review.businessId).toBe('biz42');
        expect(review.gameDay).toBe(7);
      }
    }
  });

  it('returns empty array when maxReviews is 0', () => {
    const reviews = generateReviews('biz1', 1, highSatisfaction, 0);
    expect(reviews).toHaveLength(0);
  });

  it('never returns more than maxReviews reviews', () => {
    for (let i = 0; i < 20; i++) {
      const reviews = generateReviews('biz1', 1, highSatisfaction, 3);
      expect(reviews.length).toBeLessThanOrEqual(3);
    }
  });
});

// ============================================
// 9. CX DEMAND MODIFIER
// ============================================

describe('calculateCXDemandModifier', () => {
  it('high satisfaction and loyalty → modifier > 1.0', () => {
    const result = calculateCXDemandModifier(80, 0.6, 1.25);
    // satisfactionModifier = 80/50 = 1.6
    // loyaltyBonus = 1 + 0.6 * (1.25-1) * 0.3 = 1 + 0.6*0.25*0.3 = 1 + 0.045 = 1.045
    // modifier = 1.6 * 1.045 = 1.672
    expect(result).toBeGreaterThan(1.0);
  });

  it('low satisfaction and loyalty → modifier < 1.0', () => {
    const result = calculateCXDemandModifier(20, 0.1, 1.0);
    // satisfactionModifier = 20/50 = 0.4
    // loyaltyBonus = 1 + 0.1 * (1.0-1) * 0.3 = 1
    // modifier = 0.4 * 1 = 0.4
    expect(result).toBeLessThan(1.0);
  });

  it('neutral satisfaction (50) with no loyalty bonus → modifier ~1.0', () => {
    const result = calculateCXDemandModifier(50, 0, 1.0);
    // satisfactionModifier = 50/50 = 1.0
    // loyaltyBonus = 1 + 0 * (1.0-1) * 0.3 = 1.0
    // modifier = 1.0 * 1.0 = 1.0
    expect(result).toBeCloseTo(1.0, 2);
  });

  it('modifier at minimum is 0.2', () => {
    const result = calculateCXDemandModifier(0, 0, 1.0);
    // satisfactionModifier = 0/50 = 0
    // loyaltyBonus = 1
    // modifier = 0 * 1 = 0 → clamped to 0.2
    expect(result).toBe(0.2);
  });

  it('modifier at maximum is 2.0', () => {
    const result = calculateCXDemandModifier(100, 0.86, 1.5);
    // satisfactionModifier = 100/50 = 2.0
    // loyaltyBonus = 1 + 0.86 * (1.5-1) * 0.3 = 1 + 0.86*0.5*0.3 = 1 + 0.129 = 1.129
    // modifier = 2.0 * 1.129 = 2.258 → clamped to 2.0
    expect(result).toBe(2.0);
  });

  it('satisfaction 75 → modifier 1.5 (without loyalty bonus)', () => {
    const result = calculateCXDemandModifier(75, 0, 1.0);
    // satisfactionModifier = 75/50 = 1.5
    // loyaltyBonus = 1
    // modifier = 1.5
    expect(result).toBeCloseTo(1.5, 2);
  });

  it('satisfaction 25 → modifier 0.5 (without loyalty bonus)', () => {
    const result = calculateCXDemandModifier(25, 0, 1.0);
    // satisfactionModifier = 25/50 = 0.5
    expect(result).toBeCloseTo(0.5, 2);
  });

  it('higher loyalty multiplier increases modifier', () => {
    const lowLoyalty = calculateCXDemandModifier(60, 0.5, 1.0);
    const highLoyalty = calculateCXDemandModifier(60, 0.5, 1.5);
    expect(highLoyalty).toBeGreaterThan(lowLoyalty);
  });

  it('higher repeat rate increases modifier (when loyaltyMultiplier > 1)', () => {
    const lowRepeat = calculateCXDemandModifier(60, 0.1, 1.25);
    const highRepeat = calculateCXDemandModifier(60, 0.8, 1.25);
    expect(highRepeat).toBeGreaterThan(lowRepeat);
  });

  it('repeat rate has no effect when loyaltyMultiplier is 1.0', () => {
    const lowRepeat = calculateCXDemandModifier(60, 0.1, 1.0);
    const highRepeat = calculateCXDemandModifier(60, 0.8, 1.0);
    // loyaltyBonus = 1 + rate * (1.0-1) * 0.3 = 1 + rate * 0 = 1
    expect(lowRepeat).toBeCloseTo(highRepeat, 5);
  });
});
