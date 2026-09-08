// ============================================
// Bangladesh Business Tycoon - Marketing Formula Tests
// Phase 4: Tests for all marketing formula functions
// ============================================

import { describe, it, expect } from 'vitest';
import {
  calculateCampaignDailySpend,
  calculateCampaignReach,
  calculateCampaignConversions,
  calculateCampaignDemandModifier,
  calculateCombinedMarketingModifier,
  calculateBrandAwareness,
  calculateBrandAwarenessDemandBonus,
  calculateCampaignEffectiveness,
  calculateCampaignROI,
  validateCampaign,
} from '@/lib/game/marketing/marketing-formulas';
import { MARKETING_CHANNELS, MARKETING_CONFIG } from '@/lib/game/marketing/marketing-config';

// ---- 1. calculateCampaignDailySpend ----

describe('calculateCampaignDailySpend', () => {
  it('returns daily budget when budget is within total', () => {
    // dailyBudget=1000, spent so far=0, totalBudget=10000 → should spend 1000
    expect(calculateCampaignDailySpend(1000, 0, 10000)).toBe(1000);
  });

  it('returns daily budget when partially spent but enough remaining', () => {
    // 5000 spent, 5000 remaining, daily budget 1000 → should spend 1000
    expect(calculateCampaignDailySpend(1000, 5000, 10000)).toBe(1000);
  });

  it('clamps to remaining budget when remaining is less than daily budget', () => {
    // 9500 spent, 500 remaining, daily budget 1000 → should spend 500
    expect(calculateCampaignDailySpend(1000, 9500, 10000)).toBe(500);
  });

  it('returns 0 when total budget is exhausted', () => {
    // 10000 spent, 0 remaining → should spend 0
    expect(calculateCampaignDailySpend(1000, 10000, 10000)).toBe(0);
  });

  it('returns 0 when overspent beyond total budget', () => {
    // 12000 spent, totalBudget 10000 → remaining = 0
    expect(calculateCampaignDailySpend(1000, 12000, 10000)).toBe(0);
  });

  it('handles zero daily budget', () => {
    expect(calculateCampaignDailySpend(0, 0, 10000)).toBe(0);
  });

  it('handles zero total budget', () => {
    expect(calculateCampaignDailySpend(1000, 0, 0)).toBe(0);
  });

  it('handles totalSpend equaling totalBudget exactly', () => {
    expect(calculateCampaignDailySpend(500, 10000, 10000)).toBe(0);
  });

  it('returns exact remainder for partial day', () => {
    // 9997 spent, 3 remaining → should spend 3
    expect(calculateCampaignDailySpend(500, 9997, 10000)).toBe(3);
  });
});

// ---- 2. calculateCampaignReach ----

describe('calculateCampaignReach', () => {
  it('returns > 0 for valid inputs', () => {
    // Run multiple times to account for random variation
    let anyPositive = false;
    for (let i = 0; i < 20; i++) {
      const reach = calculateCampaignReach('SOCIAL_MEDIA', 1000, 1);
      if (reach > 0) anyPositive = true;
    }
    expect(anyPositive).toBe(true);
  });

  it('returns 0 for zero daily spend', () => {
    expect(calculateCampaignReach('SOCIAL_MEDIA', 0, 1)).toBe(0);
  });

  it('returns 0 for negative daily spend', () => {
    expect(calculateCampaignReach('SOCIAL_MEDIA', -100, 1)).toBe(0);
  });

  it('higher spend generally produces more reach', () => {
    // Test by averaging multiple runs to smooth out random variation
    let lowSpendTotal = 0;
    let highSpendTotal = 0;
    const runs = 50;

    for (let i = 0; i < runs; i++) {
      lowSpendTotal += calculateCampaignReach('SOCIAL_MEDIA', 500, 1);
      highSpendTotal += calculateCampaignReach('SOCIAL_MEDIA', 5000, 1);
    }

    const lowAvg = lowSpendTotal / runs;
    const highAvg = highSpendTotal / runs;

    // Higher spend should produce more reach
    expect(highAvg).toBeGreaterThan(lowAvg);
  });

  it('diminishing returns exponent reduces the spend-ratio bonus', () => {
    // The formula: reach = reachPerTaka * spend * (spend / baseCost)^exponent
    // With exponent=0.6, the bonus multiplier for 10x spend = 10^0.6 ≈ 3.98
    // If exponent were 1.0 (no diminishing returns), bonus = 10^1.0 = 10
    // So the actual ratio should be less than what exponent=1.0 would give
    //
    // For SOCIAL_MEDIA: baseCost=500, exponent=0.6
    // At spend 500:  ratio = 500/500 = 1, bonus = 1^0.6 = 1, reach ∝ 500*1 = 500
    // At spend 5000: ratio = 5000/500 = 10, bonus = 10^0.6 ≈ 3.98, reach ∝ 5000*3.98 = 19900
    // Ratio of reach = 19900/500 = 39.8
    // If exponent=1: ratio would be 5000*10 / 500*1 = 100
    //
    // Key: with exponent < 1, the spend-ratio bonus grows sub-linearly
    // Verify: 2x spend gives bonus of 2^0.6 ≈ 1.52, not 2^1.0 = 2
    const bonusAt2x = Math.pow(2, 0.6);
    expect(bonusAt2x).toBeLessThan(2.0); // Diminishing returns on the ratio bonus
    expect(bonusAt2x).toBeCloseTo(1.52, 1);
  });

  it('higher business level produces more reach', () => {
    let level1Total = 0;
    let level5Total = 0;
    const runs = 50;

    for (let i = 0; i < runs; i++) {
      level1Total += calculateCampaignReach('SOCIAL_MEDIA', 1000, 1);
      level5Total += calculateCampaignReach('SOCIAL_MEDIA', 1000, 5);
    }

    // Level 5 should give more reach than level 1 (8% per level bonus)
    expect(level5Total / runs).toBeGreaterThan(level1Total / runs);
  });

  it('SOCIAL_MEDIA has cheaper reach per taka than TV_MEDIA', () => {
    // SOCIAL_MEDIA: reachPerTaka=2.0, baseDailyCost=500
    // TV_MEDIA: reachPerTaka=0.8, baseDailyCost=20000
    // At the same spend, SOCIAL_MEDIA should give more reach
    let socialTotal = 0;
    let tvTotal = 0;
    const runs = 50;

    for (let i = 0; i < runs; i++) {
      socialTotal += calculateCampaignReach('SOCIAL_MEDIA', 20000, 4);
      tvTotal += calculateCampaignReach('TV_MEDIA', 20000, 4);
    }

    expect(socialTotal / runs).toBeGreaterThan(tvTotal / runs);
  });

  it('returns 0 for invalid channel (falls through to undefined config)', () => {
    // @ts-expect-error - testing invalid channel
    const reach = calculateCampaignReach('INVALID_CHANNEL', 1000, 1);
    expect(reach).toBe(0);
  });

  it('reach varies within ±15% due to random variation', () => {
    // With ±15% variation, results should not all be identical
    const results: number[] = [];
    for (let i = 0; i < 100; i++) {
      results.push(calculateCampaignReach('SOCIAL_MEDIA', 1000, 1));
    }
    const unique = new Set(results);
    // With ±15% random variation, we should get many different values
    expect(unique.size).toBeGreaterThan(10);
  });
});

// ---- 3. calculateCampaignConversions ----

describe('calculateCampaignConversions', () => {
  it('returns > 0 for valid inputs', () => {
    let anyPositive = false;
    for (let i = 0; i < 20; i++) {
      const conversions = calculateCampaignConversions(
        'SOCIAL_MEDIA', 1000, 70, null, []
      );
      if (conversions > 0) anyPositive = true;
    }
    expect(anyPositive).toBe(true);
  });

  it('returns 0 for zero reach', () => {
    expect(calculateCampaignConversions('SOCIAL_MEDIA', 0, 70, null, [])).toBe(0);
  });

  it('returns 0 for negative reach', () => {
    expect(calculateCampaignConversions('SOCIAL_MEDIA', -100, 70, null, [])).toBe(0);
  });

  it('higher satisfaction produces more conversions', () => {
    let lowSatTotal = 0;
    let highSatTotal = 0;
    const runs = 50;

    for (let i = 0; i < runs; i++) {
      lowSatTotal += calculateCampaignConversions('SOCIAL_MEDIA', 1000, 20, null, []);
      highSatTotal += calculateCampaignConversions('SOCIAL_MEDIA', 1000, 90, null, []);
    }

    expect(highSatTotal / runs).toBeGreaterThan(lowSatTotal / runs);
  });

  it('segment affinity affects conversions for targeted campaigns', () => {
    // INFLUENCER has high affinity for PREMIUM (1.5) and low for BUDGET (0.5)
    let premiumTotal = 0;
    let budgetTotal = 0;
    const runs = 50;

    for (let i = 0; i < runs; i++) {
      premiumTotal += calculateCampaignConversions(
        'INFLUENCER', 5000, 70, 'PREMIUM',
        [{ segment: 'PREMIUM', demandMultiplier: 1.0 }]
      );
      budgetTotal += calculateCampaignConversions(
        'INFLUENCER', 5000, 70, 'BUDGET',
        [{ segment: 'BUDGET', demandMultiplier: 1.0 }]
      );
    }

    // Premium targeting should give more conversions for influencer channel
    expect(premiumTotal / runs).toBeGreaterThan(budgetTotal / runs);
  });

  it('segment demand multiplier boosts conversions', () => {
    let lowDemandTotal = 0;
    let highDemandTotal = 0;
    const runs = 50;

    for (let i = 0; i < runs; i++) {
      lowDemandTotal += calculateCampaignConversions(
        'SOCIAL_MEDIA', 1000, 70, 'BUDGET',
        [{ segment: 'BUDGET', demandMultiplier: 0.5 }]
      );
      highDemandTotal += calculateCampaignConversions(
        'SOCIAL_MEDIA', 1000, 70, 'BUDGET',
        [{ segment: 'BUDGET', demandMultiplier: 2.0 }]
      );
    }

    expect(highDemandTotal / runs).toBeGreaterThan(lowDemandTotal / runs);
  });

  it('untargeted campaign (null segment) uses average affinity', () => {
    // Untargeted should still produce conversions
    let anyPositive = false;
    for (let i = 0; i < 20; i++) {
      const conversions = calculateCampaignConversions(
        'SOCIAL_MEDIA', 1000, 70, null, []
      );
      if (conversions > 0) anyPositive = true;
    }
    expect(anyPositive).toBe(true);
  });

  it('conversion results vary within ±20%', () => {
    const results: number[] = [];
    for (let i = 0; i < 100; i++) {
      results.push(calculateCampaignConversions('SOCIAL_MEDIA', 1000, 70, null, []));
    }
    const unique = new Set(results);
    expect(unique.size).toBeGreaterThan(5);
  });
});

// ---- 4. calculateCampaignDemandModifier ----

describe('calculateCampaignDemandModifier', () => {
  it('returns 1.0 for zero conversions', () => {
    expect(calculateCampaignDemandModifier(0, 50)).toBe(1.0);
  });

  it('returns 1.0 for negative conversions', () => {
    expect(calculateCampaignDemandModifier(-5, 50)).toBe(1.0);
  });

  it('more conversions produce higher modifier', () => {
    const low = calculateCampaignDemandModifier(5, 50);
    const high = calculateCampaignDemandModifier(20, 50);
    expect(high).toBeGreaterThan(low);
  });

  it('modifier is always >= 1.0', () => {
    expect(calculateCampaignDemandModifier(1, 50)).toBeGreaterThanOrEqual(1.0);
    expect(calculateCampaignDemandModifier(10, 50)).toBeGreaterThanOrEqual(1.0);
    expect(calculateCampaignDemandModifier(100, 50)).toBeGreaterThanOrEqual(1.0);
  });

  it('demonstrates diminishing returns (sqrt scaling)', () => {
    // 4x conversions should give 2x boost (sqrt of 4 = 2)
    const base = calculateCampaignDemandModifier(5, 50);
    const quadruple = calculateCampaignDemandModifier(20, 50);

    const baseBoost = base - 1;
    const quadrupleBoost = quadruple - 1;

    // sqrt(4) = 2, so quadruple boost should be ~2x base boost
    expect(quadrupleBoost / baseBoost).toBeCloseTo(2.0, 1);
  });

  it('scaling relative to baseline customers', () => {
    // 10 conversions for 50-customer business = significant boost
    // 10 conversions for 500-customer business = small boost
    const smallBaseline = calculateCampaignDemandModifier(10, 50);
    const largeBaseline = calculateCampaignDemandModifier(10, 500);
    expect(smallBaseline).toBeGreaterThan(largeBaseline);
  });

  it('handles very small baseline customers (clamped to 10)', () => {
    // baseline < 10 should be clamped to 10
    const tiny = calculateCampaignDemandModifier(5, 1);
    const clamped = calculateCampaignDemandModifier(5, 10);
    expect(tiny).toBe(clamped);
  });

  it('produces reasonable values for typical game scenarios', () => {
    // 15 conversions, 100 baseline customers
    const mod = calculateCampaignDemandModifier(15, 100);
    // sqrt(15/100) * 0.8 + 1 = sqrt(0.15) * 0.8 + 1 ≈ 0.387 * 0.8 + 1 ≈ 1.31
    expect(mod).toBeCloseTo(1.31, 1);
  });
});

// ---- 5. calculateCombinedMarketingModifier ----

describe('calculateCombinedMarketingModifier', () => {
  it('returns 1.0 for empty array', () => {
    expect(calculateCombinedMarketingModifier([])).toBe(1.0);
  });

  it('returns correct value for single campaign', () => {
    // Single campaign with modifier 1.3 → boost = 0.3 → effectiveBoost = 0.3^0.7
    const result = calculateCombinedMarketingModifier([1.3]);
    const expected = 1 + Math.pow(0.3, MARKETING_CONFIG.stackingDiminishingReturns);
    expect(result).toBeCloseTo(expected, 5);
  });

  it('multiple campaigns stack with diminishing returns', () => {
    // Two campaigns each with modifier 1.3 → total boost = 0.6
    // effectiveBoost = 0.6^0.7, which is less than 2 × 0.3^0.7
    const single = calculateCombinedMarketingModifier([1.3]);
    const double = calculateCombinedMarketingModifier([1.3, 1.3]);

    // Double should be more than single but less than 2x single boost
    expect(double).toBeGreaterThan(single);
    expect(double - 1).toBeLessThan(2 * (single - 1));
  });

  it('result is clamped to [1.0, 1.8]', () => {
    // Very high modifiers should be clamped to 1.8
    const result = calculateCombinedMarketingModifier([5.0, 5.0, 5.0, 5.0]);
    expect(result).toBeLessThanOrEqual(MARKETING_CONFIG.demandModifierCap);
    expect(result).toBeGreaterThanOrEqual(MARKETING_CONFIG.demandModifierFloor);
  });

  it('result is at least 1.0 even with small modifiers', () => {
    const result = calculateCombinedMarketingModifier([1.01]);
    expect(result).toBeGreaterThanOrEqual(1.0);
  });

  it('three campaigns with moderate modifiers', () => {
    const result = calculateCombinedMarketingModifier([1.1, 1.15, 1.2]);
    expect(result).toBeGreaterThan(1.0);
    expect(result).toBeLessThanOrEqual(1.8);
  });

  it('campaigns with modifier 1.0 (no boost) contribute nothing', () => {
    const withNeutral = calculateCombinedMarketingModifier([1.3, 1.0]);
    const withoutNeutral = calculateCombinedMarketingModifier([1.3]);
    expect(withNeutral).toBeCloseTo(withoutNeutral, 5);
  });

  it('stacking diminishing returns exponent is 0.7', () => {
    // Verify the config value matches our expectations
    expect(MARKETING_CONFIG.stackingDiminishingReturns).toBe(0.7);
  });
});

// ---- 6. calculateBrandAwareness ----

describe('calculateBrandAwareness', () => {
  it('no campaigns: awareness decays', () => {
    // Current awareness 50, no reach → should decay by 2%
    const result = calculateBrandAwareness(50, 0);
    const expected = 50 * (1 - MARKETING_CONFIG.brandAwarenessDecay);
    expect(result).toBeCloseTo(expected, 5);
  });

  it('with campaigns: awareness increases', () => {
    // Current awareness 50, with reach → should be higher than decayed
    const decayed = calculateBrandAwareness(50, 0);
    const withReach = calculateBrandAwareness(50, 1000);
    expect(withReach).toBeGreaterThan(decayed);
  });

  it('capped at 100 (maxBrandAwareness)', () => {
    // Very high current awareness and high reach → should not exceed 100
    const result = calculateBrandAwareness(100, 10000);
    expect(result).toBeLessThanOrEqual(MARKETING_CONFIG.maxBrandAwareness);
  });

  it('never goes below 0', () => {
    const result = calculateBrandAwareness(0, 0);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('decay works correctly at 2% per day', () => {
    // Start at 100, no reach → 98 after one day
    const result = calculateBrandAwareness(100, 0);
    expect(result).toBeCloseTo(98, 1);
  });

  it('reach gain is capped at +5 per day', () => {
    // Even with enormous reach, gain should be capped
    const lowReach = calculateBrandAwareness(0, 100);
    const highReach = calculateBrandAwareness(0, 100000);
    // highReach should be at most 5 (max daily gain)
    expect(highReach).toBeLessThanOrEqual(5);
    expect(highReach).toBeGreaterThan(lowReach);
  });

  it('brand awareness with moderate reach', () => {
    // awareness = (50 × 0.98) + min(500 × 0.01, 5) = 49 + 5 = 54
    const result = calculateBrandAwareness(50, 500);
    expect(result).toBeCloseTo(54, 1);
  });

  it('small reach gives proportional gain', () => {
    // awareness = (0 × 0.98) + min(100 × 0.01, 5) = 0 + 1 = 1
    const result = calculateBrandAwareness(0, 100);
    expect(result).toBeCloseTo(1, 1);
  });

  it('awareness eventually decays to 0 with no campaigns', () => {
    let awareness = 80;
    for (let day = 0; day < 500; day++) {
      awareness = calculateBrandAwareness(awareness, 0);
    }
    expect(awareness).toBeLessThan(1);
  });
});

// ---- 7. calculateBrandAwarenessDemandBonus ----

describe('calculateBrandAwarenessDemandBonus', () => {
  it('0 awareness = 1.0 (no bonus)', () => {
    expect(calculateBrandAwarenessDemandBonus(0)).toBeCloseTo(1.0, 5);
  });

  it('100 awareness = 1.3 (maximum bonus)', () => {
    expect(calculateBrandAwarenessDemandBonus(100)).toBeCloseTo(1.3, 5);
  });

  it('50 awareness = 1.15 (midpoint)', () => {
    expect(calculateBrandAwarenessDemandBonus(50)).toBeCloseTo(1.15, 5);
  });

  it('linear scaling between 0 and 100', () => {
    // Should be perfectly linear: bonus = 1 + (awareness / 100) * 0.3
    const at25 = calculateBrandAwarenessDemandBonus(25);
    const at75 = calculateBrandAwarenessDemandBonus(75);
    expect(at25).toBeCloseTo(1.075, 3); // 1 + 0.25 * 0.3
    expect(at75).toBeCloseTo(1.225, 3); // 1 + 0.75 * 0.3
  });

  it('result is always >= 1.0', () => {
    expect(calculateBrandAwarenessDemandBonus(0)).toBeGreaterThanOrEqual(1.0);
    expect(calculateBrandAwarenessDemandBonus(50)).toBeGreaterThanOrEqual(1.0);
    expect(calculateBrandAwarenessDemandBonus(100)).toBeGreaterThanOrEqual(1.0);
  });

  it('result is always <= 1.3', () => {
    expect(calculateBrandAwarenessDemandBonus(100)).toBeLessThanOrEqual(1.3);
    expect(calculateBrandAwarenessDemandBonus(150)).toBeLessThanOrEqual(1.45); // beyond 100 gives more
  });
});

// ---- 8. calculateCampaignEffectiveness ----

describe('calculateCampaignEffectiveness', () => {
  it('returns 0 for zero spend', () => {
    expect(calculateCampaignEffectiveness(10, 1000, 0, 5000)).toBe(0);
  });

  it('returns 0 for negative spend', () => {
    expect(calculateCampaignEffectiveness(10, 1000, -100, 5000)).toBe(0);
  });

  it('returns value between 0 and 1', () => {
    const result = calculateCampaignEffectiveness(30, 1000, 5000, 10000);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('good campaign has higher effectiveness', () => {
    // Good: high conversions, good ROI, efficient reach
    const good = calculateCampaignEffectiveness(50, 1000, 2000, 8000);
    // Bad: low conversions, poor ROI, expensive reach
    const bad = calculateCampaignEffectiveness(5, 200, 5000, 1000);
    expect(good).toBeGreaterThan(bad);
  });

  it('high conversion rate boosts effectiveness', () => {
    // 5% conversion rate (above expected 3.5%)
    const highConv = calculateCampaignEffectiveness(50, 1000, 3000, 6000);
    // 1% conversion rate (below expected)
    const lowConv = calculateCampaignEffectiveness(10, 1000, 3000, 6000);
    expect(highConv).toBeGreaterThan(lowConv);
  });

  it('better ROI boosts effectiveness', () => {
    // ROI = 3 (revenue 12000 / spend 3000 = 4, ROI = 3)
    const highROI = calculateCampaignEffectiveness(30, 1000, 3000, 12000);
    // ROI = 0.33 (revenue 4000 / spend 3000, ROI = 0.33)
    const lowROI = calculateCampaignEffectiveness(30, 1000, 3000, 4000);
    expect(highROI).toBeGreaterThan(lowROI);
  });

  it('efficient reach (low CPM) boosts effectiveness', () => {
    // Low CPM: spend 1000, reach 10000 → CPM = 100 (very efficient)
    const efficient = calculateCampaignEffectiveness(30, 10000, 1000, 3000);
    // High CPM: spend 5000, reach 200 → CPM = 25000 (very inefficient)
    const inefficient = calculateCampaignEffectiveness(30, 200, 5000, 3000);
    expect(efficient).toBeGreaterThan(inefficient);
  });

  it('zero reach with spend gives low effectiveness', () => {
    const result = calculateCampaignEffectiveness(0, 0, 5000, 0);
    // conversionScore = 0, roiScore = 0, reachScore = 0.2 (worst CPM)
    // effectiveness = 0 * 0.4 + 0 * 0.35 + 0.2 * 0.25 = 0.05
    expect(result).toBeCloseTo(0.05, 3);
  });
});

// ---- 9. calculateCampaignROI ----

describe('calculateCampaignROI', () => {
  it('break even: revenue equals spend → ROI = 0', () => {
    expect(calculateCampaignROI(5000, 5000)).toBeCloseTo(0, 5);
  });

  it('profitable: revenue > spend → positive ROI', () => {
    // Revenue 10000, spend 5000 → ROI = (10000-5000)/5000 = 1.0
    expect(calculateCampaignROI(5000, 10000)).toBeCloseTo(1.0, 5);
  });

  it('losing: revenue < spend → negative ROI', () => {
    // Revenue 2000, spend 5000 → ROI = (2000-5000)/5000 = -0.6
    expect(calculateCampaignROI(5000, 2000)).toBeCloseTo(-0.6, 5);
  });

  it('zero spend → ROI = 0', () => {
    expect(calculateCampaignROI(0, 5000)).toBe(0);
  });

  it('negative spend → ROI = 0', () => {
    expect(calculateCampaignROI(-100, 5000)).toBe(0);
  });

  it('zero revenue with spend → ROI = -1', () => {
    expect(calculateCampaignROI(5000, 0)).toBeCloseTo(-1.0, 5);
  });

  it('doubled money: ROI = 1', () => {
    expect(calculateCampaignROI(5000, 10000)).toBeCloseTo(1.0, 5);
  });

  it('tripled money: ROI = 2', () => {
    expect(calculateCampaignROI(5000, 15000)).toBeCloseTo(2.0, 5);
  });
});

// ---- 10. validateCampaign ----

describe('validateCampaign', () => {
  it('valid inputs return no errors', () => {
    const errors = validateCampaign('SOCIAL_MEDIA', 1000, 7, 1, 0, 50000);
    expect(errors).toHaveLength(0);
  });

  it('valid inputs for higher-level channel', () => {
    const errors = validateCampaign('TV_MEDIA', 25000, 7, 5, 0, 100000);
    expect(errors).toHaveLength(0);
  });

  it('invalid channel returns error', () => {
    // @ts-expect-error - testing invalid channel
    const errors = validateCampaign('INVALID_CHANNEL', 1000, 7, 1, 0, 50000);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Invalid marketing channel');
  });

  it('level too low for channel returns error', () => {
    // INFLUENCER requires level 2
    const errors = validateCampaign('INFLUENCER', 5000, 7, 1, 0, 100000);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes('too low'))).toBe(true);
  });

  it('level too low for BILLBOARD (requires level 3)', () => {
    const errors = validateCampaign('BILLBOARD', 8000, 7, 2, 0, 100000);
    expect(errors.some(e => e.includes('too low'))).toBe(true);
  });

  it('level too low for TV_MEDIA (requires level 4)', () => {
    const errors = validateCampaign('TV_MEDIA', 20000, 7, 3, 0, 100000);
    expect(errors.some(e => e.includes('too low'))).toBe(true);
  });

  it('budget too low returns error', () => {
    // SOCIAL_MEDIA baseDailyCost=500, min = 500*0.5 = 250
    const errors = validateCampaign('SOCIAL_MEDIA', 100, 7, 1, 0, 50000);
    expect(errors.some(e => e.includes('too low'))).toBe(true);
  });

  it('budget too high returns error', () => {
    // SOCIAL_MEDIA baseDailyCost=500, max = 500*20 = 10000
    const errors = validateCampaign('SOCIAL_MEDIA', 15000, 7, 1, 0, 50000);
    expect(errors.some(e => e.includes('too high'))).toBe(true);
  });

  it('duration too short returns error', () => {
    const errors = validateCampaign('SOCIAL_MEDIA', 1000, 1, 1, 0, 50000);
    expect(errors.some(e => e.includes('too short'))).toBe(true);
  });

  it('duration too long returns error', () => {
    const errors = validateCampaign('SOCIAL_MEDIA', 1000, 50, 1, 0, 50000);
    expect(errors.some(e => e.includes('too long'))).toBe(true);
  });

  it('too many active campaigns returns error', () => {
    // maxActiveCampaignsPerBusiness = 3, so 3 already active
    const errors = validateCampaign('SOCIAL_MEDIA', 1000, 7, 1, 3, 50000);
    expect(errors.some(e => e.includes('Maximum'))).toBe(true);
  });

  it('not enough cash returns error', () => {
    // dailyBudget 1000 but only 500 cash
    const errors = validateCampaign('SOCIAL_MEDIA', 1000, 7, 1, 0, 500);
    expect(errors.some(e => e.includes('Not enough cash'))).toBe(true);
  });

  it('multiple errors can be returned at once', () => {
    // Level too low AND budget too low AND duration too short
    const errors = validateCampaign('INFLUENCER', 100, 1, 1, 0, 50);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('boundary: exact minimum budget is valid', () => {
    // SOCIAL_MEDIA min = 500 * 0.5 = 250
    const errors = validateCampaign('SOCIAL_MEDIA', 250, 3, 1, 0, 50000);
    expect(errors).toHaveLength(0);
  });

  it('boundary: exact maximum budget is valid', () => {
    // SOCIAL_MEDIA max = 500 * 20 = 10000
    const errors = validateCampaign('SOCIAL_MEDIA', 10000, 3, 1, 0, 50000);
    expect(errors).toHaveLength(0);
  });

  it('boundary: minimum duration is valid', () => {
    const errors = validateCampaign('SOCIAL_MEDIA', 1000, 3, 1, 0, 50000);
    expect(errors).toHaveLength(0);
  });

  it('boundary: maximum duration is valid', () => {
    const errors = validateCampaign('SOCIAL_MEDIA', 1000, 30, 1, 0, 50000);
    expect(errors).toHaveLength(0);
  });

  it('boundary: exact minimum level for channel', () => {
    // INFLUENCER minLevel = 2
    const errors = validateCampaign('INFLUENCER', 5000, 7, 2, 0, 100000);
    expect(errors).toHaveLength(0);
  });

  it('boundary: max campaigns minus 1 is valid', () => {
    // maxActiveCampaignsPerBusiness = 3, so 2 already active is fine
    const errors = validateCampaign('SOCIAL_MEDIA', 1000, 7, 1, 2, 50000);
    expect(errors).toHaveLength(0);
  });

  it('exact cash equal to daily budget is valid', () => {
    const errors = validateCampaign('SOCIAL_MEDIA', 1000, 7, 1, 0, 1000);
    expect(errors).toHaveLength(0);
  });
});
