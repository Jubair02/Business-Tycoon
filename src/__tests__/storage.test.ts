// ============================================
// Bangladesh Business Tycoon - Storage & pre-buying
// ============================================
//
// The feature exists because the calendar promised a rush the player had no way
// to prepare for: clothing demand x2.8 for the ten days before Eid, against a
// shelf capacity of 92 units that scales with nothing.
//
// The thing most likely to go wrong is not the arithmetic — it is that rented
// storage quietly becomes a demand bonus. Capacity is the denominator of the
// stock-availability layer, so a bigger number there makes a shop read as
// *emptier*, and a careless fix in the other direction would let a player buy
// customers by renting a shed. Hence the first describe block.

import { describe, it, expect, vi } from 'vitest';
import {
  sellingCapacity,
  sellableStock,
  heldStock,
  rentedCapacity,
  activeGodowns,
  capacityReport,
  fitsInCapacity,
  previewGodown,
  type ActiveGodown,
} from '@/lib/game/storage/capacity';
import {
  quotePreOrder,
  validatePreOrder,
  planDelivery,
  cancellationQuote,
} from '@/lib/game/storage/pre-orders';
import {
  STORAGE_CONFIG,
  GODOWN_TIERS,
  GODOWN_TIER_IDS,
  godownCapacityBonus,
  godownTermCost,
  isGodownTier,
} from '@/lib/game/storage/storage-config';
import { bulkDiscountFrom } from '@/lib/game/supply/suppliers';
import { PRODUCTS, BUSINESS_TYPES } from '@/lib/game-data';
import { calculatePotentialCustomers } from '@/lib/game/economy/formulas';

const CLOTHING = (PRODUCTS.CLOTHING ?? []).map(p => ({ name: p.name, maxStock: p.maxStock }));
const TEA = (PRODUCTS.TEA_STALL ?? []).map(p => ({ name: p.name, maxStock: p.maxStock }));

function godown(bonus: number, expiresOnDay = 100): ActiveGodown {
  return { id: `g-${bonus}-${expiresOnDay}`, tier: 'MEDIUM', capacityBonus: bonus, expiresOnDay };
}

describe('storage never becomes a demand bonus', () => {
  it('leaves selling capacity untouched by any rental', () => {
    // The safety property of the whole feature. `sellingCapacity` is what the
    // demand model reads; godowns must be invisible to it.
    const bare = sellingCapacity(CLOTHING);
    const report = capacityReport({
      productDefs: CLOTHING,
      inventories: [],
      godowns: [godown(500), godown(500)],
      incoming: 0,
      gameDay: 1,
    });

    expect(report.selling).toBe(bare);
    expect(report.storage).toBe(bare + 1000);
  });

  it('does not let godown stock inflate the stock-availability signal', () => {
    // Each product counts at most its own shelf. Without this, 1,000 shirts in
    // a shed would read as a fully stocked shop — and worse, a shop could hold
    // one product to the ceiling, read as full, and sell nothing because every
    // other shelf was bare.
    const oneProduct = CLOTHING[0];
    const hoard = [{ productName: oneProduct.name, quantity: 5_000 }];

    expect(sellableStock(hoard, CLOTHING)).toBe(oneProduct.maxStock);
    expect(heldStock(hoard)).toBe(5_000);
  });

  it('is identical to the old total for a shop inside its shelves', () => {
    // Ordinary play must be unchanged: before godowns, the demand model summed
    // raw quantities. Within shelf limits the two agree exactly.
    const inventories = CLOTHING.map(p => ({ productName: p.name, quantity: Math.floor(p.maxStock * 0.6) }));
    const oldTotal = inventories.reduce((sum, i) => sum + i.quantity, 0);

    expect(sellableStock(inventories, CLOTHING)).toBe(oldTotal);
  });

  it('cannot raise a shop’s customers by renting space', () => {
    // Driven through the real demand function, not a proxy for it. Layer 7 of
    // that function is a random variation, so it is pinned — otherwise this
    // compares two dice rolls and passes or fails for the wrong reason.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const stocked = CLOTHING.map(p => ({ productName: p.name, quantity: p.maxStock }));
    const hoarded = CLOTHING.map(p => ({ productName: p.name, quantity: p.maxStock * 4 }));

    const customersFor = (inventories: { productName: string; quantity: number }[]) =>
      calculatePotentialCustomers({
        baseCustomers: 70,
        cityMultiplier: 1.4,
        level: 1,
        reputation: 50,
        totalStock: sellableStock(inventories, CLOTHING),
        maxStockCapacity: sellingCapacity(CLOTHING),
        employeeCount: 0,
        avgEmployeeSkill: 0,
        eventCustomerEffect: 0,
        businessDemandEffect: 0,
        businessTypeId: 'CLOTHING',
      });

    expect(customersFor(hoarded)).toBe(customersFor(stocked));
    random.mockRestore();
  });

  it('ignores stock for a product the shop does not sell', () => {
    expect(sellableStock([{ productName: 'Smuggled Goods', quantity: 900 }], CLOTHING)).toBe(0);
  });
});

describe('capacity', () => {
  it('counts rented space only while the term is live', () => {
    const rentals = [godown(100, 50), godown(200, 10)];
    expect(rentedCapacity(rentals, 5)).toBe(300);
    expect(rentedCapacity(rentals, 20)).toBe(100);
    expect(rentedCapacity(rentals, 60)).toBe(0);
    expect(activeGodowns(rentals, 20)).toHaveLength(1);
  });

  it('reserves space for stock already ordered', () => {
    // Otherwise three orders that each fit could all be placed, and the third
    // would be refunded on delivery for want of room the player thought it had.
    const report = capacityReport({
      productDefs: TEA,
      inventories: [],
      godowns: [],
      incoming: 200,
      gameDay: 1,
    });

    expect(report.incoming).toBe(200);
    expect(report.available).toBe(report.storage - 200);
  });

  it('reports a shop left over capacity by a lapsed rental', () => {
    // The goods are not destroyed — that would punish a player for a rental
    // ending — but nothing further may be bought until they are back inside.
    const report = capacityReport({
      productDefs: TEA,
      inventories: [{ productName: TEA[0].name, quantity: 2_000 }],
      godowns: [godown(500, 3)],
      incoming: 0,
      gameDay: 10,
    });

    expect(report.overCapacity).toBe(true);
    expect(report.available).toBe(0);
    expect(report.utilisation).toBe(1);
  });

  it('never reports negative space', () => {
    const report = capacityReport({
      productDefs: TEA,
      inventories: [{ productName: TEA[0].name, quantity: 99_999 }],
      godowns: [],
      incoming: 5_000,
      gameDay: 1,
    });
    expect(report.available).toBe(0);
  });

  it('says how much of an order would fit', () => {
    const report = capacityReport({ productDefs: TEA, inventories: [], godowns: [], incoming: 0, gameDay: 1 });
    const tooBig = fitsInCapacity(report, report.storage + 50);

    expect(tooBig.fits).toBe(false);
    expect(tooBig.acceptable).toBe(report.storage);
    expect(tooBig.shortfall).toBe(50);
    expect(fitsInCapacity(report, 10).fits).toBe(true);
  });
});

describe('godown pricing', () => {
  it('scales the bonus with the shop, not with a flat number', () => {
    // Base capacity runs from 41 units (mobile) to 1,030 (restaurant). A flat
    // bonus would be transformative for one trade and pointless for another.
    const small = previewGodown('SMALL', CLOTHING);
    const large = previewGodown('LARGE', CLOTHING);

    expect(small).toBe(Math.round(sellingCapacity(CLOTHING) * 0.5));
    expect(large).toBe(Math.round(sellingCapacity(CLOTHING) * 2));
    expect(large).toBeGreaterThan(small);
  });

  it('gives every business type a proportionate deal', () => {
    for (const type of BUSINESS_TYPES) {
      const defs = (PRODUCTS[type.id] ?? []).map(p => ({ name: p.name, maxStock: p.maxStock }));
      if (defs.length === 0) continue;

      const base = sellingCapacity(defs);
      for (const tier of GODOWN_TIER_IDS) {
        const bonus = godownCapacityBonus(tier, base);
        expect(bonus / base).toBeCloseTo(GODOWN_TIERS[tier].capacityFactor, 1);
      }
    }
  });

  it('charges more for a longer term and a bigger shed', () => {
    const rent = 25_000;
    expect(godownTermCost('LARGE', rent, 60)).toBe(godownTermCost('LARGE', rent, 30) * 2);
    expect(godownTermCost('LARGE', rent, 30)).toBeGreaterThan(godownTermCost('SMALL', rent, 30));
  });

  it('never charges nothing', () => {
    expect(godownTermCost('SMALL', 0, 30)).toBeGreaterThan(0);
    expect(godownCapacityBonus('SMALL', 0)).toBeGreaterThan(0);
  });

  it('narrows an untrusted tier', () => {
    expect(isGodownTier('LARGE')).toBe(true);
    expect(isGodownTier('ENORMOUS')).toBe(false);
    expect(isGodownTier(7)).toBe(false);
  });
});

describe('bulk discounts', () => {
  it('rewards the largest tier a quantity qualifies for', () => {
    // The tiers belong to the supplier now — "what does volume earn" is a
    // property of who you buy from, not of the warehouse you put it in.
    expect(bulkDiscountFrom('LOCAL', 10)).toBe(0);
    expect(bulkDiscountFrom('LOCAL', 100)).toBe(0.02);
    expect(bulkDiscountFrom('LOCAL', 400)).toBe(0.04);
  });

  it('never exceeds a supplier’s top tier', () => {
    expect(bulkDiscountFrom('LOCAL', Number.MAX_SAFE_INTEGER)).toBe(0.04);
    expect(bulkDiscountFrom('IMPORTER', Number.MAX_SAFE_INTEGER)).toBe(0.12);
    expect(bulkDiscountFrom('EMERGENCY', Number.MAX_SAFE_INTEGER)).toBe(0);
  });
});

// ============================================
// Pre-orders
// ============================================

const baseCapacity = capacityReport({
  productDefs: CLOTHING,
  inventories: [],
  godowns: [godown(400)],
  incoming: 0,
  gameDay: 10,
});

const context = {
  currentGameDay: 10,
  spotUnitCost: 800,
  availableCash: 1_000_000,
  capacity: baseCapacity,
  openOrderCount: 0,
};

const request = {
  productName: CLOTHING[0].name,
  category: 'CLOTHING',
  quantity: 100,
  deliveryDay: 25,
};

describe('quoting an order', () => {
  it('locks a price and applies the bulk discount', () => {
    const quote = quotePreOrder(request, context);

    expect(quote.listUnitCost).toBe(800);
    // Priced by the default supplier, the local wholesaler: 100 units clears
    // its 100-unit tier at 2% but not its 300-unit one.
    expect(quote.discount).toBe(0.02);
    expect(quote.unitCost).toBeCloseTo(784, 6);
    expect(quote.totalCost).toBe(78_400);
    expect(quote.saving).toBe(80_000 - 78_400);
    expect(quote.leadDays).toBe(15);
  });

  it('quotes a quantity the player cannot yet afford', () => {
    // The form shows a live price as the slider moves; refusing to price an
    // unaffordable order would leave the player guessing what to aim for.
    const quote = quotePreOrder({ ...request, quantity: 10_000 }, { ...context, availableCash: 5 });
    expect(quote.totalCost).toBeGreaterThan(0);
  });
});

describe('validating an order', () => {
  it('accepts a sound one', () => {
    const verdict = validatePreOrder(request, context);
    expect(verdict.ok).toBe(true);
    expect(verdict.quote?.totalCost).toBe(78_400);
  });

  it('refuses an order below the supplier minimum', () => {
    const verdict = validatePreOrder({ ...request, quantity: 1 }, context);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('QUANTITY_TOO_SMALL');
  });

  it('refuses same-day delivery', () => {
    // Without a lead time a pre-order is a purchase with extra steps, and the
    // locked price becomes free money.
    const verdict = validatePreOrder({ ...request, deliveryDay: context.currentGameDay }, context);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('LEAD_TOO_SHORT');
  });

  it('refuses a delivery date in the past', () => {
    const verdict = validatePreOrder({ ...request, deliveryDay: 1 }, context);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('LEAD_TOO_SHORT');
  });

  it('refuses a date beyond what a supplier will commit to', () => {
    const verdict = validatePreOrder(
      { ...request, deliveryDay: context.currentGameDay + STORAGE_CONFIG.maxLeadDays + 1 },
      context,
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('LEAD_TOO_LONG');
  });

  it('refuses an order with nowhere to go, and says how much would fit', () => {
    const verdict = validatePreOrder({ ...request, quantity: 10_000 }, context);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('NO_CAPACITY');
    expect(verdict.acceptable).toBe(baseCapacity.available);
    expect(verdict.message).toContain('godown');
  });

  it('refuses an order the player cannot pay for', () => {
    const verdict = validatePreOrder(request, { ...context, availableCash: 100 });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('INSUFFICIENT_FUNDS');
    // The quote still comes back, so the screen can offer a loan for the gap.
    expect(verdict.quote?.totalCost).toBe(78_400);
  });

  it('refuses when too many orders are already open', () => {
    const verdict = validatePreOrder(request, {
      ...context,
      openOrderCount: STORAGE_CONFIG.maxOpenPreOrders,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('TOO_MANY_OPEN_ORDERS');
  });

  it('refuses nonsense rather than storing it', () => {
    for (const bad of [Number.NaN, Infinity]) {
      expect(validatePreOrder({ ...request, quantity: bad }, context).ok).toBe(false);
      expect(validatePreOrder({ ...request, deliveryDay: bad }, context).ok).toBe(false);
    }
  });
});

describe('delivering', () => {
  const due = [
    { id: 'a', productName: 'Shirt', quantity: 100, unitCost: 500, totalCost: 50_000, deliveryDay: 20 },
    { id: 'b', productName: 'Saree', quantity: 100, unitCost: 900, totalCost: 90_000, deliveryDay: 21 },
  ];

  it('delivers everything when there is room', () => {
    const lines = planDelivery({ due, spaceAvailable: 500 });
    expect(lines.every(l => l.status === 'DELIVERED')).toBe(true);
    expect(lines.reduce((s, l) => s + l.delivered, 0)).toBe(200);
    expect(lines.every(l => l.refund === 0)).toBe(true);
  });

  it('honours the earliest order first when room is short', () => {
    // A godown can lapse between ordering and delivery. The player's first
    // commitment is filled first, rather than whichever row the query returned.
    const lines = planDelivery({ due, spaceAvailable: 150 });
    const first = lines.find(l => l.orderId === 'a')!;
    const second = lines.find(l => l.orderId === 'b')!;

    expect(first.delivered).toBe(100);
    expect(first.status).toBe('DELIVERED');
    expect(second.delivered).toBe(50);
    expect(second.status).toBe('PARTIAL');
    expect(second.shortfall).toBe(50);
  });

  it('refunds exactly what could not be housed', () => {
    const lines = planDelivery({ due, spaceAvailable: 150 });
    const second = lines.find(l => l.orderId === 'b')!;
    expect(second.refund).toBe(50 * 900);
    expect(second.note).toContain('godown');
  });

  it('refunds the whole order when there is no room at all', () => {
    const lines = planDelivery({ due, spaceAvailable: 0 });
    expect(lines.every(l => l.status === 'CANCELLED')).toBe(true);
    expect(lines.reduce((s, l) => s + l.refund, 0)).toBe(50_000 + 90_000);
  });

  it('never delivers more than was ordered', () => {
    const lines = planDelivery({ due, spaceAvailable: 10_000 });
    for (const line of lines) {
      const order = due.find(o => o.id === line.orderId)!;
      expect(line.delivered).toBeLessThanOrEqual(order.quantity);
      expect(line.delivered + line.shortfall).toBe(order.quantity);
    }
  });

  it('copes with nothing due', () => {
    expect(planDelivery({ due: [], spaceAvailable: 100 })).toEqual([]);
  });
});

describe('cancelling', () => {
  it('returns the order less a fee', () => {
    const { fee, refund } = cancellationQuote(100_000);
    expect(fee).toBe(10_000);
    expect(refund).toBe(90_000);
    expect(fee + refund).toBe(100_000);
  });

  it('never refunds more than was paid', () => {
    for (const total of [0, 1, 999, 12_345]) {
      const { fee, refund } = cancellationQuote(total);
      expect(refund).toBeLessThanOrEqual(total);
      expect(fee + refund).toBe(Math.round(total));
    }
  });
});

describe('the feature answers the problem it was built for', () => {
  it('lets a clothing shop hold enough for the Eid rush', () => {
    // Eid multiplies clothing demand by 2.8 for ten days. Bare shelves are 92
    // units; a warehouse has to make that a decision rather than a wall.
    const bare = sellingCapacity(CLOTHING);
    const withWarehouse = bare + previewGodown('LARGE', CLOTHING);

    expect(bare).toBeLessThan(100);
    expect(withWarehouse).toBeGreaterThan(bare * 2.8);
  });

  it('prices that preparation as a real commitment', () => {
    // It should need thinking about — and often a loan — rather than being
    // small change against a 500,000 shop.
    const clothing = BUSINESS_TYPES.find(b => b.id === 'CLOTHING')!;
    const rent = godownTermCost('LARGE', clothing.rent, 30);
    const stock = previewGodown('LARGE', CLOTHING) * 850;

    expect(rent).toBeGreaterThan(clothing.investment * 0.02);
    expect(rent + stock).toBeGreaterThan(clothing.investment * 0.25);
  });
});

describe('the bulk discount survives cheap goods', () => {
  it('is not rounded away on a ৳8 product', () => {
    // Found end to end: a tea stall sells at ৳5-15, and rounding the discount
    // into each unit made `8 x 0.94` round back to 8. The cheapest trade in the
    // game — the one that most needs a reason to commit early — was being
    // offered a discount worth nothing.
    const quote = quotePreOrder(
      { productName: 'Tea (Cha)', category: 'TEA_STALL', quantity: 300, deliveryDay: 20 },
      { ...context, spotUnitCost: 8 },
    );

    expect(quote.discount).toBeGreaterThan(0);
    expect(quote.totalCost).toBeLessThan(quote.spotCost);
    expect(quote.saving).toBeGreaterThan(0);
  });

  it('saves the discounted share, whatever the unit price', () => {
    for (const price of [5, 8, 12, 280, 120_000]) {
      const quote = quotePreOrder(
        { productName: 'X', category: 'C', quantity: 400, deliveryDay: 20 },
        { ...context, spotUnitCost: price },
      );
      expect(quote.saving / quote.spotCost).toBeCloseTo(quote.discount, 4);
    }
  });
});
