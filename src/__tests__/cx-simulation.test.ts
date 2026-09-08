// ============================================
// Bangladesh Business Tycoon - Phase 3 CX Simulation Tests
// Long-term simulation for balance verification
// ============================================

import { describe, it, expect } from 'vitest';
import {
  calculateSatisfaction,
  calculateLoyalty,
  calculateNPS,
  calculateSegmentDemands,
  calculateCXDemandModifier,
  calculateServiceQuality,
  calculatePriceCompetitiveness,
  getLoyaltyTier,
} from '@/lib/game/economy/cx-formulas';
import { LOYALTY_CONFIG, LOYALTY_TIERS, REVIEW_CONFIG } from '@/lib/game/economy/cx-config';

// ---- Simulation Business Profile ----
interface SimBusiness {
  satisfactionScore: number;
  loyaltyScore: number;
  repeatCustomerRate: number;
  npsScore: number;
  totalReviews: number;
  avgReviewRating: number;
  dailyCustomers: number;
  dailyRevenue: number;
  dailyProfit: number;
  recentRatings: number[];  // Track individual ratings for NPS calculation
}

// ---- Simulate one tick of CX for a business ----
function simulateCXTick(biz: SimBusiness, factors: {
  priceCompetitiveness: number;
  productQuality: number;
  serviceQuality: number;
  stockAvailability: number;
  reputation: number;
}): SimBusiness {
  const satisfaction = calculateSatisfaction({
    priceCompetitiveness: factors.priceCompetitiveness,
    productQuality: factors.productQuality,
    serviceQuality: factors.serviceQuality,
    stockAvailability: factors.stockAvailability,
    atmosphere: factors.reputation / 100,
    currentSatisfaction: biz.satisfactionScore,
  });

  const wasPositive = satisfaction.overall >= 50 && biz.dailyProfit >= 0;
  const tier = getLoyaltyTier(biz.loyaltyScore);

  const loyalty = calculateLoyalty({
    currentLoyaltyScore: biz.loyaltyScore,
    currentRepeatRate: biz.repeatCustomerRate,
    wasPositiveExperience: wasPositive,
    totalCustomers: biz.dailyCustomers,
    numberOfReviews: biz.totalReviews,
    averageRating: biz.avgReviewRating,
    loyaltyMultiplier: tier.multiplier,
  });

  // Simulate review generation (deterministic for testing)
  const reviewsThisTick = satisfaction.overall >= 65 ? 1 : satisfaction.overall < 40 ? 1 : 0;
  const newTotalReviews = biz.totalReviews + reviewsThisTick;

  // Simulate rating based on satisfaction
  let rating = 3;
  if (satisfaction.overall >= 90) rating = 5;
  else if (satisfaction.overall >= 70) rating = 4;
  else if (satisfaction.overall >= 50) rating = 3;
  else if (satisfaction.overall >= 30) rating = 2;
  else rating = 1;

  // Track individual ratings for NPS
  const newRatings = [...biz.recentRatings];
  if (reviewsThisTick > 0) {
    newRatings.push(rating);
    // Keep only last 50 (mimics REVIEW_CONFIG.keepLast pruning)
    if (newRatings.length > REVIEW_CONFIG.keepLast) {
      newRatings.splice(0, newRatings.length - REVIEW_CONFIG.keepLast);
    }
  }

  const newAvgRating = newRatings.length > 0
    ? newRatings.reduce((s, r) => s + r, 0) / newRatings.length
    : 0;

  // NPS calculation from individual ratings
  const nps = calculateNPS(newRatings.map(r => ({ rating: r })));

  // CX demand modifier
  const cxDemandMod = calculateCXDemandModifier(satisfaction.overall, loyalty.repeatCustomerRate, loyalty.tierMultiplier);

  // Segment demands
  const segments = calculateSegmentDemands({
    priceCompetitiveness: factors.priceCompetitiveness,
    productQuality: factors.productQuality,
    serviceQuality: factors.serviceQuality,
    reputation: factors.reputation,
  });
  const segmentMod = segments.reduce((sum, seg) => sum + seg.demandMultiplier, 0);

  // Effective customers (simplified - just apply modifiers to base)
  const baseCustomers = 50;
  const effectiveCustomers = Math.max(0, Math.floor(baseCustomers * cxDemandMod * segmentMod));

  return {
    satisfactionScore: satisfaction.overall,
    loyaltyScore: loyalty.loyaltyScore,
    repeatCustomerRate: loyalty.repeatCustomerRate,
    npsScore: nps.nps,
    totalReviews: newTotalReviews,
    avgReviewRating: Math.round(newAvgRating * 100) / 100,
    dailyCustomers: effectiveCustomers,
    dailyRevenue: effectiveCustomers * 100, // Simplified
    dailyProfit: effectiveCustomers * 30, // Simplified
    recentRatings: newRatings,
  };
}

// ---- Run N-day simulation ----
function runSimulation(days: number, initialBiz: SimBusiness, factors: {
  priceCompetitiveness: number;
  productQuality: number;
  serviceQuality: number;
  stockAvailability: number;
  reputation: number;
}): SimBusiness[] {
  const results: SimBusiness[] = [initialBiz];
  let current = initialBiz;
  for (let i = 0; i < days; i++) {
    current = simulateCXTick(current, factors);
    results.push(current);
  }
  return results;
}

// ============================================
// 30-DAY SIMULATION
// ============================================

describe('30-Day CX Simulation', () => {
  const defaultBiz: SimBusiness = {
    satisfactionScore: 50, loyaltyScore: 0, repeatCustomerRate: 0,
    npsScore: 0, totalReviews: 0, avgReviewRating: 0,
    dailyCustomers: 50, dailyRevenue: 5000, dailyProfit: 1500,
    recentRatings: [],
  };

  it('well-managed business: satisfaction and loyalty grow over 30 days', () => {
    const results = runSimulation(30, defaultBiz, {
      priceCompetitiveness: 0.9,
      productQuality: 0.85,
      serviceQuality: 0.8,
      stockAvailability: 0.9,
      reputation: 70,
    });

    const final = results[results.length - 1];
    // Satisfaction should increase from 50
    expect(final.satisfactionScore).toBeGreaterThan(55);
    // Loyalty should grow
    expect(final.loyaltyScore).toBeGreaterThan(10);
    // Customers should be reasonable
    expect(final.dailyCustomers).toBeGreaterThan(30);
    expect(final.dailyCustomers).toBeLessThan(200);
  });

  it('poorly-managed business: satisfaction and loyalty decline over 30 days', () => {
    const biz: SimBusiness = { ...defaultBiz, satisfactionScore: 50, dailyProfit: -500 };
    const results = runSimulation(30, biz, {
      priceCompetitiveness: 0.2,
      productQuality: 0.3,
      serviceQuality: 0.2,
      stockAvailability: 0.3,
      reputation: 25,
    });

    const final = results[results.length - 1];
    // Satisfaction should decrease
    expect(final.satisfactionScore).toBeLessThan(45);
    // Loyalty should decline or stay near 0
    expect(final.loyaltyScore).toBeLessThanOrEqual(5);
  });

  it('no runaway demand growth over 30 days', () => {
    const results = runSimulation(30, defaultBiz, {
      priceCompetitiveness: 1.0,
      productQuality: 1.0,
      serviceQuality: 1.0,
      stockAvailability: 1.0,
      reputation: 100,
    });

    const maxCustomers = Math.max(...results.map(r => r.dailyCustomers));
    // Should not exceed 2x base (CX modifier max is 2.0, segments max ~1.0)
    expect(maxCustomers).toBeLessThanOrEqual(150);
  });

  it('no permanent negative death spiral over 30 days', () => {
    // Start with decent business, then 10 days of terrible conditions, then recovery
    let biz: SimBusiness = { ...defaultBiz };

    // Phase 1: Build up (10 days good)
    for (let i = 0; i < 10; i++) {
      biz = simulateCXTick(biz, {
        priceCompetitiveness: 0.8, productQuality: 0.8, serviceQuality: 0.8,
        stockAvailability: 0.8, reputation: 60,
      });
    }
    const afterGood = biz;

    // Phase 2: Crisis (10 days terrible)
    for (let i = 0; i < 10; i++) {
      biz = simulateCXTick(biz, {
        priceCompetitiveness: 0.1, productQuality: 0.1, serviceQuality: 0.1,
        stockAvailability: 0.1, reputation: 20,
      });
    }
    const afterCrisis = biz;

    // Phase 3: Recovery (10 days good again)
    biz.dailyProfit = 1500; // Restore profitability
    for (let i = 0; i < 10; i++) {
      biz = simulateCXTick(biz, {
        priceCompetitiveness: 0.8, productQuality: 0.8, serviceQuality: 0.8,
        stockAvailability: 0.8, reputation: 60,
      });
    }
    const afterRecovery = biz;

    // After crisis, satisfaction should have dropped
    expect(afterCrisis.satisfactionScore).toBeLessThan(afterGood.satisfactionScore);
    // After recovery, satisfaction should be improving (not permanently stuck)
    expect(afterRecovery.satisfactionScore).toBeGreaterThan(afterCrisis.satisfactionScore);
  });

  it('satisfaction stays within [0, 100] over 30 days for all profiles', () => {
    const profiles = [
      { priceCompetitiveness: 0, productQuality: 0, serviceQuality: 0, stockAvailability: 0, reputation: 0 },
      { priceCompetitiveness: 1, productQuality: 1, serviceQuality: 1, stockAvailability: 1, reputation: 100 },
      { priceCompetitiveness: 0.5, productQuality: 0.5, serviceQuality: 0.5, stockAvailability: 0.5, reputation: 50 },
    ];

    for (const factors of profiles) {
      const results = runSimulation(30, defaultBiz, factors);
      for (const r of results) {
        expect(r.satisfactionScore).toBeGreaterThanOrEqual(0);
        expect(r.satisfactionScore).toBeLessThanOrEqual(100);
      }
    }
  });

  it('loyalty score stays within [0, maxScore] over 30 days', () => {
    const results = runSimulation(30, defaultBiz, {
      priceCompetitiveness: 1.0, productQuality: 1.0, serviceQuality: 1.0,
      stockAvailability: 1.0, reputation: 100,
    });
    for (const r of results) {
      expect(r.loyaltyScore).toBeGreaterThanOrEqual(0);
      expect(r.loyaltyScore).toBeLessThanOrEqual(LOYALTY_CONFIG.maxScore);
    }
  });

  it('review count grows but stays bounded by keepLast', () => {
    const results = runSimulation(30, defaultBiz, {
      priceCompetitiveness: 0.8, productQuality: 0.8, serviceQuality: 0.8,
      stockAvailability: 0.8, reputation: 60,
    });
    // After 30 days, reviews should have grown
    const final = results[results.length - 1];
    expect(final.totalReviews).toBeGreaterThan(0);
    // But shouldn't be unreasonably large (max ~1 per tick × 30 days)
    expect(final.totalReviews).toBeLessThanOrEqual(60);
  });
});

// ============================================
// 100-DAY SIMULATION
// ============================================

describe('100-Day CX Simulation', () => {
  const defaultBiz: SimBusiness = {
    satisfactionScore: 50, loyaltyScore: 0, repeatCustomerRate: 0,
    npsScore: 0, totalReviews: 0, avgReviewRating: 0,
    dailyCustomers: 50, dailyRevenue: 5000, dailyProfit: 1500,
    recentRatings: [],
  };

  it('well-managed business reaches high loyalty tier over 100 days', () => {
    const results = runSimulation(100, defaultBiz, {
      priceCompetitiveness: 0.9,
      productQuality: 0.85,
      serviceQuality: 0.8,
      stockAvailability: 0.9,
      reputation: 70,
    });

    const final = results[results.length - 1];
    // Should reach at least Silver (25+ points)
    expect(final.loyaltyScore).toBeGreaterThanOrEqual(25);
    // Satisfaction should be high
    expect(final.satisfactionScore).toBeGreaterThan(60);
    // NPS: At ~85 satisfaction, reviews are 4★ (passive), so NPS ≈ 0
    // This is correct behavior - positive NPS requires ≥90 satisfaction
    expect(final.npsScore).toBeGreaterThanOrEqual(-20);
  });

  it('mediocre business maintains moderate loyalty over 100 days', () => {
    const results = runSimulation(100, defaultBiz, {
      priceCompetitiveness: 0.6,
      productQuality: 0.6,
      serviceQuality: 0.6,
      stockAvailability: 0.7,
      reputation: 50,
    });

    const final = results[results.length - 1];
    // Should have some loyalty but not necessarily high
    expect(final.loyaltyScore).toBeGreaterThanOrEqual(0);
    expect(final.loyaltyScore).toBeLessThanOrEqual(LOYALTY_CONFIG.maxScore);
    // Satisfaction should settle around mid-range
    expect(final.satisfactionScore).toBeGreaterThan(30);
    expect(final.satisfactionScore).toBeLessThan(80);
  });

  it('terrible business: loyalty stays near 0 over 100 days', () => {
    const biz: SimBusiness = { ...defaultBiz, dailyProfit: -500 };
    const results = runSimulation(100, biz, {
      priceCompetitiveness: 0.2,
      productQuality: 0.2,
      serviceQuality: 0.2,
      stockAvailability: 0.2,
      reputation: 20,
    });

    const final = results[results.length - 1];
    expect(final.loyaltyScore).toBeLessThanOrEqual(10);
    expect(final.satisfactionScore).toBeLessThan(40);
  });

  it('no runaway demand growth over 100 days', () => {
    const results = runSimulation(100, defaultBiz, {
      priceCompetitiveness: 1.0, productQuality: 1.0, serviceQuality: 1.0,
      stockAvailability: 1.0, reputation: 100,
    });

    const maxCustomers = Math.max(...results.map(r => r.dailyCustomers));
    // CX modifier max 2.0 × segment max ~1.0 × base 50 = 100 max
    expect(maxCustomers).toBeLessThanOrEqual(150);
  });

  it('loyalty does not become permanently maxed', () => {
    // Run 50 days good, 50 days bad
    let biz: SimBusiness = { ...defaultBiz };
    for (let i = 0; i < 50; i++) {
      biz = simulateCXTick(biz, {
        priceCompetitiveness: 0.9, productQuality: 0.9, serviceQuality: 0.9,
        stockAvailability: 0.9, reputation: 80,
      });
    }
    const afterGood = biz;
    biz.dailyProfit = -500;
    for (let i = 0; i < 50; i++) {
      biz = simulateCXTick(biz, {
        priceCompetitiveness: 0.2, productQuality: 0.2, serviceQuality: 0.2,
        stockAvailability: 0.2, reputation: 20,
      });
    }
    // Loyalty should have dropped from peak
    expect(biz.loyaltyScore).toBeLessThan(afterGood.loyaltyScore);
  });

  it('satisfaction is recoverable after prolonged bad period', () => {
    let biz: SimBusiness = { ...defaultBiz };
    // 50 days terrible
    biz.dailyProfit = -500;
    for (let i = 0; i < 50; i++) {
      biz = simulateCXTick(biz, {
        priceCompetitiveness: 0.1, productQuality: 0.1, serviceQuality: 0.1,
        stockAvailability: 0.1, reputation: 10,
      });
    }
    const afterBad = biz;
    // 50 days recovery
    biz.dailyProfit = 1500;
    for (let i = 0; i < 50; i++) {
      biz = simulateCXTick(biz, {
        priceCompetitiveness: 0.9, productQuality: 0.9, serviceQuality: 0.9,
        stockAvailability: 0.9, reputation: 70,
      });
    }
    // Satisfaction should have recovered significantly
    expect(biz.satisfactionScore).toBeGreaterThan(afterBad.satisfactionScore + 20);
  });

  it('NPS converges to stable value over 100 days', () => {
    const results = runSimulation(100, defaultBiz, {
      priceCompetitiveness: 0.8, productQuality: 0.8, serviceQuality: 0.8,
      stockAvailability: 0.8, reputation: 60,
    });

    // Check that NPS in last 10 days is relatively stable
    const last10 = results.slice(-10);
    const npsValues = last10.map(r => r.npsScore);
    const npsRange = Math.max(...npsValues) - Math.min(...npsValues);
    // NPS should not swing wildly (range < 30 in last 10 days)
    expect(npsRange).toBeLessThan(30);
  });

  it('review database does not explode over 100 days', () => {
    const results = runSimulation(100, defaultBiz, {
      priceCompetitiveness: 0.8, productQuality: 0.8, serviceQuality: 0.8,
      stockAvailability: 0.8, reputation: 60,
    });

    const final = results[results.length - 1];
    // Reviews accumulate (pruning happens in game engine, not in this simplified sim)
    // At ~1 review per tick, 100 days ≈ 100 reviews (before engine pruning to keepLast=50)
    expect(final.totalReviews).toBeLessThanOrEqual(105);
    expect(final.totalReviews).toBeGreaterThan(50);
  });
});
