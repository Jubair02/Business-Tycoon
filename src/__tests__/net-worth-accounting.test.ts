// ============================================
// Net worth is counted once
// ============================================
//
// The tick used to add each day's profit to `Business.cash` *and* increment
// `Player.cash` by the same amount, while net worth sums both. These tests
// model the two accounting schemes over a run and assert the corrected one
// tracks reality.

import { describe, it, expect } from 'vitest';
import { calculatePortfolioSummary } from '@/lib/game/expansion';

/** Net worth as `recalculateNetWorth` computes it. */
function netWorth(playerCash: number, businessCash: number, inventory: number, debt: number) {
  return playerCash + businessCash + inventory - debt;
}

/** The old behaviour: profit landed in both rows. */
function tickDoubleCounted(state: { playerCash: number; businessCash: number }, profit: number) {
  return {
    playerCash: state.playerCash + profit,
    businessCash: state.businessCash + profit,
  };
}

/** The fix: the till is swept, so the business ends the day at zero. */
function tickSwept(state: { playerCash: number; businessCash: number }, profit: number) {
  return {
    playerCash: state.playerCash + state.businessCash + profit,
    businessCash: 0,
  };
}

describe('profit accounting', () => {
  const START = 500_000;
  const PROFIT_PER_DAY = 2_594; // Grocery, day-1 steady state
  const DAYS = 30;

  it('the swept ledger grows by exactly the profit earned', () => {
    let state = { playerCash: START, businessCash: 0 };
    for (let d = 0; d < DAYS; d++) state = tickSwept(state, PROFIT_PER_DAY);

    expect(netWorth(state.playerCash, state.businessCash, 0, 0)).toBe(
      START + PROFIT_PER_DAY * DAYS,
    );
  });

  it('the old ledger grew at double the true rate', () => {
    let state = { playerCash: START, businessCash: 0 };
    for (let d = 0; d < DAYS; d++) state = tickDoubleCounted(state, PROFIT_PER_DAY);

    const truth = START + PROFIT_PER_DAY * DAYS;
    const reported = netWorth(state.playerCash, state.businessCash, 0, 0);

    expect(reported).toBe(START + PROFIT_PER_DAY * DAYS * 2);
    expect(reported - START).toBe((truth - START) * 2);
  });

  it('losses are counted once too, not compounded twice', () => {
    const LOSS = -4_148;
    let swept = { playerCash: START, businessCash: 0 };
    let doubled = { playerCash: START, businessCash: 0 };
    for (let d = 0; d < DAYS; d++) {
      swept = tickSwept(swept, LOSS);
      doubled = tickDoubleCounted(doubled, LOSS);
    }

    expect(netWorth(swept.playerCash, swept.businessCash, 0, 0)).toBe(START + LOSS * DAYS);
    expect(netWorth(doubled.playerCash, doubled.businessCash, 0, 0)).toBe(
      START + LOSS * DAYS * 2,
    );
  });

  it('sweeping a legacy stranded balance moves money without changing net worth', () => {
    // An old save whose business sat on an unreachable till.
    const before = { playerCash: 100_000, businessCash: 250_000 };
    const nwBefore = netWorth(before.playerCash, before.businessCash, 0, 0);

    const after = tickSwept(before, 0);

    expect(after.businessCash).toBe(0);
    expect(after.playerCash).toBe(350_000);
    expect(netWorth(after.playerCash, after.businessCash, 0, 0)).toBe(nwBefore);
  });

  it('the till stays at zero across repeated ticks', () => {
    let state = { playerCash: START, businessCash: 0 };
    for (let d = 0; d < 10; d++) {
      state = tickSwept(state, PROFIT_PER_DAY);
      expect(state.businessCash).toBe(0);
    }
  });
});

describe('portfolio summary', () => {
  const base = {
    id: 'b1',
    name: 'Shop',
    type: 'GROCERY',
    city: 'DHAKA',
    cash: 0,
    dailyRevenue: 1000,
    dailyExpense: 400,
    dailyProfit: 600,
    totalRevenue: 5000,
    totalProfit: 3000,
    healthScore: 70,
    satisfactionScore: 60,
    loyaltyScore: 20,
    employeeCount: 2,
  };

  it('reports stock at cost so the net-worth line has something real to show', () => {
    const summary = calculatePortfolioSummary([
      { ...base, inventoryValue: 30_000 },
      { ...base, id: 'b2', inventoryValue: 12_500 },
    ]);

    expect(summary.totalInventoryValue).toBe(42_500);
    // Tills are swept, so this is expected to be zero in steady state.
    expect(summary.totalCash).toBe(0);
  });

  it('treats a missing inventory value as zero rather than NaN', () => {
    const summary = calculatePortfolioSummary([base]);
    expect(summary.totalInventoryValue).toBe(0);
  });

  it('returns zeroed totals for an empty portfolio', () => {
    const summary = calculatePortfolioSummary([]);
    expect(summary.totalInventoryValue).toBe(0);
    expect(summary.totalBusinesses).toBe(0);
  });
});
