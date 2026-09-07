// ============================================
// Bangladesh Business Tycoon - Economy Formula Tests
// Phase 1: Tests for all core economy formulas
// ============================================

import { describe, it, expect } from 'vitest';
import {
  calculatePotentialCustomers,
  calculatePriceDemandMultiplier,
  calculateProductDemand,
  calculateItemsSold,
  calculateRevenue,
  calculateCostOfGoodsSold,
  calculateBusinessExpenses,
  calculateNetProfit,
  calculateBusinessHealth,
  calculateROI,
  calculateReputationChange,
  roundTaka,
  safeDivide,
  classifyDemandLevel,
} from '@/lib/game/economy/formulas';

// ---- Price Sensitivity Tests ----

describe('calculatePriceDemandMultiplier', () => {
  it('returns baseline demand when price equals market price', () => {
    const result = calculatePriceDemandMultiplier({
      sellPrice: 100,
      marketReferencePrice: 100,
      productPriceSensitivity: 1.0,
      businessPriceSensitivity: 1.0,
    });
    // At market price, demand should be approximately 1.0 (baseline)
    expect(result).toBeCloseTo(1.0, 1);
  });

  it('returns higher demand when price is below market', () => {
    const result = calculatePriceDemandMultiplier({
      sellPrice: 80,
      marketReferencePrice: 100,
      productPriceSensitivity: 1.0,
      businessPriceSensitivity: 1.0,
    });
    expect(result).toBeGreaterThan(1.0);
  });

  it('returns lower demand when price is above market', () => {
    const result = calculatePriceDemandMultiplier({
      sellPrice: 120,
      marketReferencePrice: 100,
      productPriceSensitivity: 1.0,
      businessPriceSensitivity: 1.0,
    });
    expect(result).toBeLessThan(1.0);
  });

  it('returns very low demand at 2x market price', () => {
    const result = calculatePriceDemandMultiplier({
      sellPrice: 200,
      marketReferencePrice: 100,
      productPriceSensitivity: 1.0,
      businessPriceSensitivity: 1.0,
    });
    expect(result).toBeLessThan(0.5);
  });

  it('higher product sensitivity reduces demand more at above-market prices', () => {
    const lowSensitivity = calculatePriceDemandMultiplier({
      sellPrice: 150,
      marketReferencePrice: 100,
      productPriceSensitivity: 0.5,
      businessPriceSensitivity: 1.0,
    });
    const highSensitivity = calculatePriceDemandMultiplier({
      sellPrice: 150,
      marketReferencePrice: 100,
      productPriceSensitivity: 2.0,
      businessPriceSensitivity: 1.0,
    });
    expect(highSensitivity).toBeLessThan(lowSensitivity);
  });

  it('demand never drops to zero even at extreme prices', () => {
    const result = calculatePriceDemandMultiplier({
      sellPrice: 300,
      marketReferencePrice: 100,
      productPriceSensitivity: 1.5,
      businessPriceSensitivity: 1.5,
    });
    expect(result).toBeGreaterThan(0);
  });

  it('handles zero market reference price safely', () => {
    const result = calculatePriceDemandMultiplier({
      sellPrice: 100,
      marketReferencePrice: 0,
      productPriceSensitivity: 1.0,
      businessPriceSensitivity: 1.0,
    });
    expect(result).toBeGreaterThan(0);
    expect(isFinite(result)).toBe(true);
  });
});

// ---- Inventory Constraint Tests ----

describe('calculateItemsSold', () => {
  it('sales equal demand when stock is sufficient', () => {
    expect(calculateItemsSold(25, 100)).toBe(25);
  });

  it('sales are constrained by available stock', () => {
    expect(calculateItemsSold(25, 10)).toBe(10);
  });

  it('inventory never becomes negative', () => {
    const sold = calculateItemsSold(25, 10);
    const remaining = 10 - sold;
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 when stock is 0', () => {
    expect(calculateItemsSold(25, 0)).toBe(0);
  });

  it('returns 0 when demand is 0', () => {
    expect(calculateItemsSold(0, 10)).toBe(0);
  });

  it('handles fractional demand by flooring', () => {
    expect(calculateItemsSold(10.7, 20)).toBe(10);
  });
});

// ---- Revenue Tests ----

describe('calculateRevenue', () => {
  it('calculates revenue correctly', () => {
    expect(calculateRevenue(10, 100)).toBe(1000);
  });

  it('returns 0 when no items sold', () => {
    expect(calculateRevenue(0, 100)).toBe(0);
  });

  it('never returns negative', () => {
    expect(calculateRevenue(-1, 100)).toBe(0);
  });
});

// ---- COGS Tests ----

describe('calculateCostOfGoodsSold', () => {
  it('calculates COGS correctly', () => {
    expect(calculateCostOfGoodsSold(10, 60)).toBe(600);
  });

  it('returns 0 when no items sold', () => {
    expect(calculateCostOfGoodsSold(0, 60)).toBe(0);
  });
});

// ---- Expense Tests ----

describe('calculateBusinessExpenses', () => {
  it('correctly converts monthly salary to daily', () => {
    const expenses = calculateBusinessExpenses({
      baseRent: 3000,
      level: 1,
      cityRentMultiplier: 1.0,
      totalMonthlySalaries: 30000, // 30k/month
      businessLevel: 1,
      businessTypeId: 'TEA_STALL',
      revenue: 10000,
      grossProfit: 5000,
    });
    // Daily salary = 30000 / 30 = 1000
    expect(expenses.salaries).toBe(1000);
    expect(expenses.salaryDetails.dailySalary).toBeCloseTo(1000, 0);
  });

  it('correctly converts monthly rent to daily', () => {
    const expenses = calculateBusinessExpenses({
      baseRent: 30000, // 30k/month rent
      level: 1,
      cityRentMultiplier: 1.0,
      totalMonthlySalaries: 0,
      businessLevel: 1,
      businessTypeId: 'TEA_STALL',
      revenue: 10000,
      grossProfit: 5000,
    });
    // Daily rent = 30000 / 30 = 1000
    expect(expenses.rent).toBe(1000);
  });

  it('rent scales with level', () => {
    const level1 = calculateBusinessExpenses({
      baseRent: 3000,
      level: 1,
      cityRentMultiplier: 1.0,
      totalMonthlySalaries: 0,
      businessLevel: 1,
      businessTypeId: 'TEA_STALL',
      revenue: 10000,
      grossProfit: 5000,
    });
    const level5 = calculateBusinessExpenses({
      baseRent: 3000,
      level: 5,
      cityRentMultiplier: 1.0,
      totalMonthlySalaries: 0,
      businessLevel: 5,
      businessTypeId: 'TEA_STALL',
      revenue: 10000,
      grossProfit: 5000,
    });
    expect(level5.rent).toBeGreaterThan(level1.rent);
  });

  it('tax is applied on profit with revenue floor', () => {
    const profitable = calculateBusinessExpenses({
      baseRent: 0,
      level: 1,
      cityRentMultiplier: 1.0,
      totalMonthlySalaries: 0,
      businessLevel: 1,
      businessTypeId: 'TEA_STALL',
      revenue: 10000,
      grossProfit: 5000,
    });
    // Tax should be max(5000 * 0.10, 10000 * 0.02) = max(500, 200) = 500
    expect(profitable.taxes).toBeGreaterThanOrEqual(200);

    const loss = calculateBusinessExpenses({
      baseRent: 0,
      level: 1,
      cityRentMultiplier: 1.0,
      totalMonthlySalaries: 0,
      businessLevel: 1,
      businessTypeId: 'TEA_STALL',
      revenue: 10000,
      grossProfit: -1000,
    });
    // Even at a loss, revenue tax floor applies: 10000 * 0.02 = 200
    expect(loss.taxes).toBeGreaterThanOrEqual(200);
  });

  it('total expense is sum of all components', () => {
    const expenses = calculateBusinessExpenses({
      baseRent: 3000,
      level: 1,
      cityRentMultiplier: 1.0,
      totalMonthlySalaries: 30000,
      businessLevel: 1,
      businessTypeId: 'TEA_STALL',
      revenue: 10000,
      grossProfit: 5000,
    });
    expect(expenses.totalExpense).toBe(
      expenses.rent + expenses.salaries + expenses.utilities + expenses.taxes
    );
  });
});

// ---- Net Profit Tests ----

describe('calculateNetProfit', () => {
  it('calculates positive profit correctly', () => {
    // Revenue 10000 - COGS 4000 - Expenses 3000 = 3000
    expect(calculateNetProfit(10000, 4000, 3000)).toBe(3000);
  });

  it('calculates negative profit (loss) correctly', () => {
    // Revenue 5000 - COGS 3000 - Expenses 4000 = -2000
    expect(calculateNetProfit(5000, 3000, 4000)).toBe(-2000);
  });

  it('zero revenue results in loss equal to expenses', () => {
    expect(calculateNetProfit(0, 0, 5000)).toBe(-5000);
  });
});

// ---- Health Score Tests ----

describe('calculateBusinessHealth', () => {
  it('profitable business with good stock and reputation has high score', () => {
    const result = calculateBusinessHealth({
      dailyProfit: 10000,
      dailyRevenue: 30000,
      businessCash: 50000,
      totalStock: 200,
      maxStockCapacity: 300,
      reputation: 80,
      businessTypeId: 'TEA_STALL',
    });
    expect(result.score).toBeGreaterThan(60);
    expect(result.status).toMatch(/EXCELLENT|HEALTHY/);
    expect(result.positiveFactors.length).toBeGreaterThan(0);
  });

  it('losing business with low stock and reputation has low score', () => {
    const result = calculateBusinessHealth({
      dailyProfit: -5000,
      dailyRevenue: 3000,
      businessCash: -10000,
      totalStock: 5,
      maxStockCapacity: 300,
      reputation: 15,
      businessTypeId: 'TEA_STALL',
    });
    expect(result.score).toBeLessThan(50);
    expect(result.negativeFactors.length).toBeGreaterThan(0);
  });

  it('score is always between 0 and 100', () => {
    const result = calculateBusinessHealth({
      dailyProfit: -100000,
      dailyRevenue: 0,
      businessCash: -100000,
      totalStock: 0,
      maxStockCapacity: 300,
      reputation: 0,
      businessTypeId: 'TEA_STALL',
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ---- ROI Tests ----

describe('calculateROI', () => {
  it('calculates ROI with positive profit', () => {
    const result = calculateROI({
      investment: 50000,
      cumulativeProfit: 25000,
      averageDailyProfit: 500,
      daysActive: 50,
    });
    expect(result.roiPercentage).toBe(50); // 25000/50000 * 100
    expect(result.estimatedPaybackDays).toBe(100); // 50000/500
  });

  it('handles zero profit (payback not possible)', () => {
    const result = calculateROI({
      investment: 50000,
      cumulativeProfit: 0,
      averageDailyProfit: 0,
      daysActive: 30,
    });
    expect(result.roiPercentage).toBe(0);
    expect(result.estimatedPaybackDays).toBeNull();
  });

  it('handles negative profit (payback not possible)', () => {
    const result = calculateROI({
      investment: 50000,
      cumulativeProfit: -10000,
      averageDailyProfit: -200,
      daysActive: 50,
    });
    expect(result.roiPercentage).toBeLessThan(0);
    expect(result.estimatedPaybackDays).toBeNull();
  });

  it('handles zero investment (no division by zero)', () => {
    const result = calculateROI({
      investment: 0,
      cumulativeProfit: 10000,
      averageDailyProfit: 100,
      daysActive: 100,
    });
    expect(result.roiPercentage).toBe(0); // Falls back to 0
    expect(result.estimatedPaybackDays).toBe(0);
  });
});

// ---- Reputation Change Tests ----

describe('calculateReputationChange', () => {
  it('profitable business gains reputation', () => {
    const change = calculateReputationChange({
      dailyProfit: 5000,
      outOfStockRatio: 0,
      managers: [],
      cleaners: [],
    });
    expect(change).toBeGreaterThan(0);
  });

  it('unprofitable business loses reputation', () => {
    const change = calculateReputationChange({
      dailyProfit: -5000,
      outOfStockRatio: 0,
      managers: [],
      cleaners: [],
    });
    expect(change).toBeLessThan(0);
  });

  it('stockouts reduce reputation', () => {
    const noStockout = calculateReputationChange({
      dailyProfit: 0,
      outOfStockRatio: 0,
      managers: [],
      cleaners: [],
    });
    const withStockout = calculateReputationChange({
      dailyProfit: 0,
      outOfStockRatio: 0.5,
      managers: [],
      cleaners: [],
    });
    expect(withStockout).toBeLessThan(noStockout);
  });

  it('managers and cleaners improve reputation', () => {
    const noStaff = calculateReputationChange({
      dailyProfit: 0,
      outOfStockRatio: 0,
      managers: [],
      cleaners: [],
    });
    const withStaff = calculateReputationChange({
      dailyProfit: 0,
      outOfStockRatio: 0,
      managers: [{ skill: 7 }],
      cleaners: [{ skill: 5 }],
    });
    expect(withStaff).toBeGreaterThan(noStaff);
  });
});

// ---- Utility Tests ----

describe('roundTaka', () => {
  it('rounds to whole number', () => {
    expect(roundTaka(1234.56)).toBe(1235);
    expect(roundTaka(1234.4)).toBe(1234);
  });
});

describe('safeDivide', () => {
  it('divides normally when denominator is non-zero', () => {
    expect(safeDivide(10, 2)).toBe(5);
  });

  it('returns fallback when denominator is zero', () => {
    expect(safeDivide(10, 0)).toBe(0);
    expect(safeDivide(10, 0, -1)).toBe(-1);
  });
});

describe('classifyDemandLevel', () => {
  it('classifies very high demand', () => {
    expect(classifyDemandLevel(1.5)).toBe('VERY_HIGH');
  });

  it('classifies high demand', () => {
    expect(classifyDemandLevel(1.15)).toBe('HIGH');
  });

  it('classifies normal demand', () => {
    expect(classifyDemandLevel(0.9)).toBe('NORMAL');
  });

  it('classifies low demand', () => {
    expect(classifyDemandLevel(0.6)).toBe('LOW');
  });

  it('classifies very low demand', () => {
    expect(classifyDemandLevel(0.3)).toBe('VERY_LOW');
  });
});
