// ============================================
// Bangladesh Business Tycoon - Standing Restock Order Tests
// ============================================

import { describe, it, expect } from 'vitest';
import { planRestock, RESTOCK_DEFAULTS } from '@/lib/game/operations/auto-restock';
import type { ProductDef } from '@/lib/game-data';

const tea: ProductDef = {
  name: 'Tea (Cha)', category: 'TEA_STALL', basePrice: 8, baseDemand: 0.823,
  icon: '🫖', maxStock: 190, suggestedMarkup: 0.6, shelfLifeDays: 3,
};
const biscuits: ProductDef = {
  name: 'Biscuits', category: 'TEA_STALL', basePrice: 5, baseDemand: 0.493,
  icon: '🍪', maxStock: 115, suggestedMarkup: 0.5, shelfLifeDays: 0,
};
const PRODUCT_DEFS = [tea, biscuits];

function line(productName: string, quantity: number, purchasePrice = 8) {
  return { id: `inv-${productName}`, productName, quantity, purchasePrice };
}

const RICH = 10_000_000;

describe('planRestock', () => {
  it('leaves a well-stocked shelf alone', () => {
    const plan = planRestock({
      inventories: [line('Tea (Cha)', 180)], // 95% of 190
      productDefs: PRODUCT_DEFS,
      priceMultipliers: {},
      availableCash: RICH,
      settings: RESTOCK_DEFAULTS,
    });
    expect(plan.lines).toHaveLength(0);
    expect(plan.totalCost).toBe(0);
  });

  it('tops a near-empty shelf up to the target level', () => {
    const plan = planRestock({
      inventories: [line('Tea (Cha)', 10)],
      productDefs: PRODUCT_DEFS,
      priceMultipliers: {},
      availableCash: RICH,
      settings: RESTOCK_DEFAULTS,
    });
    // Target 90% of 190 = 171, so 161 units at 8 taka.
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0].quantity).toBe(161);
    expect(plan.lines[0].unitCost).toBe(8);
    expect(plan.totalCost).toBe(161 * 8);
  });

  it('does not trigger until stock falls below the threshold', () => {
    const justAbove = planRestock({
      inventories: [line('Tea (Cha)', 80)], // 42% — above the 40% trigger
      productDefs: PRODUCT_DEFS,
      priceMultipliers: {},
      availableCash: RICH,
      settings: RESTOCK_DEFAULTS,
    });
    expect(justAbove.lines).toHaveLength(0);

    const justBelow = planRestock({
      inventories: [line('Tea (Cha)', 74)], // 39%
      productDefs: PRODUCT_DEFS,
      priceMultipliers: {},
      availableCash: RICH,
      settings: RESTOCK_DEFAULTS,
    });
    expect(justBelow.lines).toHaveLength(1);
  });

  it('pays today\'s market price, not the base price', () => {
    const plan = planRestock({
      inventories: [line('Tea (Cha)', 0)],
      productDefs: PRODUCT_DEFS,
      priceMultipliers: { 'Tea (Cha)': 1.5 },
      availableCash: RICH,
      settings: RESTOCK_DEFAULTS,
    });
    expect(plan.lines[0].unitCost).toBe(12); // 8 x 1.5
  });

  it('never spends more cash than the owner has', () => {
    const plan = planRestock({
      inventories: [line('Tea (Cha)', 0), line('Biscuits', 0, 5)],
      productDefs: PRODUCT_DEFS,
      priceMultipliers: {},
      availableCash: 500,
      settings: RESTOCK_DEFAULTS,
    });
    expect(plan.totalCost).toBeLessThanOrEqual(500);
    expect(plan.skipped.length).toBeGreaterThan(0);
  });

  it('respects a daily budget even when the owner is rich', () => {
    const plan = planRestock({
      inventories: [line('Tea (Cha)', 0), line('Biscuits', 0, 5)],
      productDefs: PRODUCT_DEFS,
      priceMultipliers: {},
      availableCash: RICH,
      settings: { ...RESTOCK_DEFAULTS, budget: 400 },
    });
    expect(plan.totalCost).toBeLessThanOrEqual(400);
  });

  it('fills the emptiest shelf first when money is short', () => {
    const plan = planRestock({
      // Biscuits are emptier as a share of their shelf (0/115 vs 30/190).
      inventories: [line('Tea (Cha)', 30), line('Biscuits', 0, 5)],
      productDefs: PRODUCT_DEFS,
      priceMultipliers: {},
      availableCash: 300,
      settings: RESTOCK_DEFAULTS,
    });
    expect(plan.lines[0].productName).toBe('Biscuits');
  });

  it('buys a partial line rather than nothing when funds run short', () => {
    const plan = planRestock({
      inventories: [line('Tea (Cha)', 0)],
      productDefs: PRODUCT_DEFS,
      priceMultipliers: {},
      availableCash: 100, // 12 units' worth of a 171-unit order
      settings: RESTOCK_DEFAULTS,
    });
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0].quantity).toBe(12);
    expect(plan.totalCost).toBe(96);
    expect(plan.skipped).toContainEqual({ productName: 'Tea (Cha)', reason: 'cash' });
  });

  it('keeps the cost basis as a weighted average', () => {
    const plan = planRestock({
      // 50 units already held at 4 taka; buying 121 more at 8.
      inventories: [line('Tea (Cha)', 50, 4)],
      productDefs: PRODUCT_DEFS,
      priceMultipliers: {},
      availableCash: RICH,
      settings: RESTOCK_DEFAULTS,
    });
    const { quantity, newPurchasePrice } = plan.lines[0];
    const expected = Math.round((4 * 50 + quantity * 8) / (50 + quantity));
    expect(newPurchasePrice).toBe(expected);
    // Between the old basis and today's price, never outside it.
    expect(newPurchasePrice).toBeGreaterThan(4);
    expect(newPurchasePrice).toBeLessThan(8);
  });

  it('ignores stock the business does not sell', () => {
    const plan = planRestock({
      inventories: [line('Contraband', 0)],
      productDefs: PRODUCT_DEFS,
      priceMultipliers: {},
      availableCash: RICH,
      settings: RESTOCK_DEFAULTS,
    });
    expect(plan.lines).toHaveLength(0);
  });

  it('a manual full restock fills every shelf, not only the near-empty ones', () => {
    const plan = planRestock({
      inventories: [line('Tea (Cha)', 150), line('Biscuits', 100, 5)],
      productDefs: PRODUCT_DEFS,
      priceMultipliers: {},
      availableCash: RICH,
      // What POST /inventory/restock passes: trigger at any level, fill to 100%.
      settings: { threshold: 1, target: 1, budget: null },
    });
    expect(plan.lines).toHaveLength(2);
    expect(plan.lines.find(l => l.productName === 'Tea (Cha)')!.quantity).toBe(40);
    expect(plan.lines.find(l => l.productName === 'Biscuits')!.quantity).toBe(15);
  });

  it('clamps nonsense settings instead of buying nothing', () => {
    const plan = planRestock({
      inventories: [line('Tea (Cha)', 0)],
      productDefs: PRODUCT_DEFS,
      priceMultipliers: {},
      availableCash: RICH,
      settings: { threshold: Number.NaN, target: 99, budget: null },
    });
    expect(plan.lines).toHaveLength(1);
    expect(plan.lines[0].quantity).toBe(190); // target clamped to 100% of shelf
  });

  it('never returns a negative or zero-unit order', () => {
    const plan = planRestock({
      inventories: [line('Tea (Cha)', 200)], // Over its own shelf capacity
      productDefs: PRODUCT_DEFS,
      priceMultipliers: {},
      availableCash: RICH,
      settings: { threshold: 1, target: 1, budget: null },
    });
    expect(plan.lines).toHaveLength(0);
  });
});
