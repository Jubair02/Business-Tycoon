// ============================================
// Bangladesh Business Tycoon - Guided First Week Tests
// ============================================
//
// Onboarding used to stop at the welcome slides — one of which still told the
// player to press a "Next Day" button that no longer exists. The guided week
// replaces it, and it is ticked off by the player's actual save, so these tests
// are about whether the save is read correctly.

import { describe, it, expect } from 'vitest';
import {
  evaluateFirstWeek,
  isStepComplete,
  snapshotFromStore,
  FIRST_WEEK_STEPS,
  FIRST_WEEK_DAYS,
  type FirstWeekSnapshot,
} from '@/lib/game/onboarding/first-week';

const EMPTY: FirstWeekSnapshot = {
  daysPlayed: 0,
  businessCount: 0,
  stockedBusinessCount: 0,
  repricedBusinessCount: 0,
  employeeCount: 0,
  managedBusinessCount: 0,
  totalProfit: 0,
  highestBusinessLevel: 0,
};

const DONE: FirstWeekSnapshot = {
  daysPlayed: 10,
  businessCount: 2,
  stockedBusinessCount: 2,
  repricedBusinessCount: 1,
  employeeCount: 3,
  managedBusinessCount: 1,
  totalProfit: 50_000,
  highestBusinessLevel: 2,
};

describe('isStepComplete', () => {
  it('starts every step incomplete for a brand-new save', () => {
    for (const step of FIRST_WEEK_STEPS) {
      expect(isStepComplete(step.id, EMPTY), step.id).toBe(false);
    }
  });

  it('marks every step complete for a save that has done everything', () => {
    for (const step of FIRST_WEEK_STEPS) {
      expect(isStepComplete(step.id, DONE), step.id).toBe(true);
    }
  });

  it('counts a shop as opened once one exists', () => {
    expect(isStepComplete('open-shop', { ...EMPTY, businessCount: 1 })).toBe(true);
  });

  it('does not count stock the player has not bought', () => {
    expect(isStepComplete('stock-shelves', { ...EMPTY, businessCount: 1 })).toBe(false);
    expect(isStepComplete('stock-shelves', { ...EMPTY, businessCount: 1, stockedBusinessCount: 1 })).toBe(true);
  });

  it('only counts a price the player set themselves', () => {
    expect(isStepComplete('set-prices', { ...EMPTY, stockedBusinessCount: 3 })).toBe(false);
    expect(isStepComplete('set-prices', { ...EMPTY, repricedBusinessCount: 1 })).toBe(true);
  });

  it('needs profit to be positive, not merely present', () => {
    expect(isStepComplete('first-profit', { ...EMPTY, totalProfit: -5000 })).toBe(false);
    expect(isStepComplete('first-profit', { ...EMPTY, totalProfit: 0 })).toBe(false);
    expect(isStepComplete('first-profit', { ...EMPTY, totalProfit: 1 })).toBe(true);
  });

  it('accepts either route to growth', () => {
    expect(isStepComplete('grow', { ...EMPTY, businessCount: 2 })).toBe(true);
    expect(isStepComplete('grow', { ...EMPTY, businessCount: 1, highestBusinessLevel: 2 })).toBe(true);
    expect(isStepComplete('grow', { ...EMPTY, businessCount: 1, highestBusinessLevel: 1 })).toBe(false);
  });

  it('requires the week to be both survived and profitable', () => {
    const survived = { ...EMPTY, daysPlayed: FIRST_WEEK_DAYS, totalProfit: 0 };
    const profitable = { ...EMPTY, daysPlayed: 2, totalProfit: 10_000 };
    const both = { ...EMPTY, daysPlayed: FIRST_WEEK_DAYS, totalProfit: 10_000 };
    expect(isStepComplete('week-one', survived)).toBe(false);
    expect(isStepComplete('week-one', profitable)).toBe(false);
    expect(isStepComplete('week-one', both)).toBe(true);
  });
});

describe('evaluateFirstWeek', () => {
  it('points a new player at opening a shop', () => {
    const progress = evaluateFirstWeek(EMPTY);
    expect(progress.currentStep?.id).toBe('open-shop');
    expect(progress.completedCount).toBe(0);
    expect(progress.percent).toBe(0);
    expect(progress.finished).toBe(false);
  });

  it('retires itself once everything is done', () => {
    const progress = evaluateFirstWeek(DONE);
    expect(progress.finished).toBe(true);
    expect(progress.currentStep).toBeNull();
    expect(progress.percent).toBe(100);
  });

  it('marks exactly one step as current', () => {
    const progress = evaluateFirstWeek({ ...EMPTY, businessCount: 1, stockedBusinessCount: 1 });
    expect(progress.steps.filter(s => s.current)).toHaveLength(1);
    expect(progress.currentStep?.id).toBe('set-prices');
  });

  it('does not un-tick a step done out of order', () => {
    // Hired staff before ever setting a price. Both are true; the guide points
    // at the earliest outstanding one without denying the later one.
    const progress = evaluateFirstWeek({ ...EMPTY, businessCount: 1, employeeCount: 2 });
    expect(progress.steps.find(s => s.id === 'hire-staff')!.complete).toBe(true);
    expect(progress.currentStep?.id).toBe('stock-shelves');
  });

  it('reports progress as a whole percentage of the listed steps', () => {
    const progress = evaluateFirstWeek({ ...EMPTY, businessCount: 1 });
    expect(progress.totalCount).toBe(FIRST_WEEK_STEPS.length);
    expect(progress.percent).toBe(Math.round((1 / FIRST_WEEK_STEPS.length) * 100));
  });
});

describe('snapshotFromStore', () => {
  const business = (over: any = {}) => ({
    id: 'b1',
    level: 1,
    totalProfit: 0,
    inventories: [],
    employees: [],
    ...over,
  });

  it('treats a first visit as day zero rather than as a long absence', () => {
    const snapshot = snapshotFromStore({ businesses: [], gameDay: 400, firstSeenGameDay: null });
    expect(snapshot.daysPlayed).toBe(0);
  });

  it('counts days played from the day the player arrived, not the world clock', () => {
    const snapshot = snapshotFromStore({ businesses: [], gameDay: 412, firstSeenGameDay: 400 });
    expect(snapshot.daysPlayed).toBe(12);
  });

  it('never reports negative days if the clock appears to go backwards', () => {
    const snapshot = snapshotFromStore({ businesses: [], gameDay: 5, firstSeenGameDay: 50 });
    expect(snapshot.daysPlayed).toBe(0);
  });

  it('counts a shop as stocked from either the full list or the count', () => {
    const fromList = snapshotFromStore({
      businesses: [business({ inventories: [{ quantity: 10 }] })],
      gameDay: 1, firstSeenGameDay: 1,
    });
    const fromCount = snapshotFromStore({
      businesses: [business({ inventories: undefined, _count: { inventories: 4 } })],
      gameDay: 1, firstSeenGameDay: 1,
    });
    expect(fromList.stockedBusinessCount).toBe(1);
    expect(fromCount.stockedBusinessCount).toBe(1);
  });

  it('does not count a shop whose shelves are empty', () => {
    const snapshot = snapshotFromStore({
      businesses: [business({ inventories: [{ quantity: 0 }] })],
      gameDay: 1, firstSeenGameDay: 1,
    });
    expect(snapshot.stockedBusinessCount).toBe(0);
  });

  it('counts only prices the player edited', () => {
    const snapshot = snapshotFromStore({
      businesses: [business({ inventories: [{ quantity: 5, priceEdited: false }, { quantity: 5, priceEdited: true }] })],
      gameDay: 1, firstSeenGameDay: 1,
    });
    expect(snapshot.repricedBusinessCount).toBe(1);
  });

  it('adds staff up across every shop', () => {
    const snapshot = snapshotFromStore({
      businesses: [
        business({ employees: [{ id: 'e1' }, { id: 'e2' }] }),
        business({ id: 'b2', employees: undefined, _count: { employees: 3 } }),
      ],
      gameDay: 1, firstSeenGameDay: 1,
    });
    expect(snapshot.employeeCount).toBe(5);
  });

  it('counts shops running a standing restock order', () => {
    const snapshot = snapshotFromStore({
      businesses: [business({ autoRestock: true }), business({ id: 'b2', autoRestock: false })],
      gameDay: 1, firstSeenGameDay: 1,
    });
    expect(snapshot.managedBusinessCount).toBe(1);
  });

  it('survives a store with nothing in it', () => {
    const snapshot = snapshotFromStore({ businesses: [], gameDay: 0, firstSeenGameDay: null });
    expect(snapshot.businessCount).toBe(0);
    expect(snapshot.highestBusinessLevel).toBe(0);
    expect(snapshot.totalProfit).toBe(0);
  });
});
