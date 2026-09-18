// ============================================
// Starting inventory is charged, not gifted
// ============================================

import { describe, it, expect } from 'vitest';
import {
  buildStartingInventory,
  calculateStartingInventoryCost,
  calculateExpansionCost,
  EXPANSION_CONFIG,
} from '@/lib/game/expansion';
import { BUSINESS_TYPES, PRODUCTS } from '@/lib/game-data';

const LIQUIDATION_RATE = 0.7; // mirrors POST /api/businesses/[id]/inventory/sell

describe('buildStartingInventory', () => {
  it('stocks every product of the business type at the configured ratio', () => {
    for (const bt of BUSINESS_TYPES) {
      const { items } = buildStartingInventory(bt.id);
      const defs = PRODUCTS[bt.id] || [];

      expect(items).toHaveLength(defs.length);
      for (const def of defs) {
        const item = items.find((i) => i.productName === def.name);
        expect(item).toBeDefined();
        expect(item!.quantity).toBe(
          Math.floor(def.maxStock * EXPANSION_CONFIG.startingStockRatio),
        );
        expect(item!.purchasePrice).toBe(def.basePrice);
      }
    }
  });

  it('prices each line at wholesale so COGS and liquidation have a real basis', () => {
    const { items, totalCost } = buildStartingInventory('GROCERY');
    for (const item of items) {
      expect(item.lineCost).toBe(Math.round(item.purchasePrice * item.quantity));
      expect(item.purchasePrice).toBeGreaterThan(0);
    }
    expect(totalCost).toBe(items.reduce((s, i) => s + i.lineCost, 0));
  });

  it('sets a shelf price above cost', () => {
    for (const bt of BUSINESS_TYPES) {
      for (const item of buildStartingInventory(bt.id).items) {
        expect(item.sellPrice).toBeGreaterThan(item.purchasePrice);
      }
    }
  });

  it('returns an empty set for an unknown business type instead of throwing', () => {
    expect(buildStartingInventory('NOT_A_TYPE')).toEqual({ items: [], totalCost: 0 });
    expect(calculateStartingInventoryCost('NOT_A_TYPE')).toBe(0);
  });
});

describe('calculateExpansionCost', () => {
  it('includes the opening stock in the total that gets debited', () => {
    for (const bt of BUSINESS_TYPES) {
      const cost = calculateExpansionCost(bt.investment, 0, 'DHAKA_GULSHAN', bt.id);
      const stock = calculateStartingInventoryCost(bt.id);

      expect(cost.startingInventoryCost).toBe(stock);
      expect(cost.startingInventoryCost).toBeGreaterThan(0);

      // Total must cover the stock on top of the premises costs.
      const premises = Math.round(
        cost.baseCost * cost.locationModifier + cost.setupCost,
      );
      expect(cost.totalCost).toBeGreaterThanOrEqual(premises);
      expect(cost.totalCost - premises).toBeCloseTo(stock, 0);
    }
  });

  it('still scales the premises cost with businesses already owned', () => {
    const first = calculateExpansionCost(300000, 0, '', 'GROCERY');
    const third = calculateExpansionCost(300000, 2, '', 'GROCERY');
    expect(third.totalCost).toBeGreaterThan(first.totalCost);
    // Stock is a flat wholesale cost — it does not inflate with expansion count.
    expect(third.startingInventoryCost).toBe(first.startingInventoryCost);
  });
});

describe('the opening-stock arbitrage is closed', () => {
  it('immediately liquidating the opening stock loses money for every type', () => {
    for (const bt of BUSINESS_TYPES) {
      const paid = calculateStartingInventoryCost(bt.id);
      const recovered = buildStartingInventory(bt.id).items.reduce(
        (sum, item) =>
          sum + Math.round(item.purchasePrice * LIQUIDATION_RATE) * item.quantity,
        0,
      );

      expect(recovered).toBeLessThan(paid);
    }
  });

  it('a buy-then-liquidate round trip nets a loss rather than free cash', () => {
    // The old bug: stock arrived free, so this figure was pure profit.
    const bt = BUSINESS_TYPES.find((b) => b.id === 'MOBILE')!;
    const cost = calculateExpansionCost(bt.investment, 0, '', bt.id);
    const recovered = buildStartingInventory(bt.id).items.reduce(
      (sum, item) =>
        sum + Math.round(item.purchasePrice * LIQUIDATION_RATE) * item.quantity,
      0,
    );

    expect(recovered).toBeLessThan(cost.totalCost);
  });
});

describe('affordability of a first business', () => {
  const STARTING_CASH = 500000;

  it('leaves the cheap starters comfortably affordable on day one', () => {
    for (const id of ['TEA_STALL', 'GROCERY']) {
      const bt = BUSINESS_TYPES.find((b) => b.id === id)!;
      const cost = calculateExpansionCost(bt.investment, 0, '', bt.id);
      const cashAfter = STARTING_CASH - cost.totalCost;
      const minReserve = STARTING_CASH * EXPANSION_CONFIG.minCashReserveRatio;

      expect(cost.totalCost).toBeLessThanOrEqual(STARTING_CASH);
      expect(cashAfter).toBeGreaterThan(minReserve);
    }
  });
});
