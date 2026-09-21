// ============================================
// Bangladesh Business Tycoon - Suppliers & spoilage
// ============================================
//
// Every incentive in the supply chain pushes one way — bulk discounts reward
// big orders, the importer rewards bigger ones, godowns let you hold them, and
// credit lets you buy them without the cash. Spoilage is the only thing pushing
// back, so most of what is worth testing here is that it pushes back correctly
// and that it leaves non-perishables completely alone.

import { describe, it, expect } from 'vitest';
import {
  SUPPLIERS,
  SUPPLIER_IDS,
  SELECTABLE_SUPPLIERS,
  PAYMENT_TERMS,
  PAYMENT_TERM_IDS,
  bulkDiscountFrom,
  offersTerm,
  termsFor,
  quoteFromSupplier,
  validateSupplierOrder,
  overdueTotal,
  isSupplierId,
  isPaymentTerm,
  OVERDUE_PENALTY_PER_DAY,
} from '@/lib/game/supply/suppliers';
import {
  SPOILAGE_CONFIG,
  dailySpoilageRate,
  isPerishable,
  spoilOneDay,
  spoilShelves,
  blendAge,
  projectedSurvival,
} from '@/lib/game/supply/spoilage';
import { PRODUCTS } from '@/lib/game-data';

// ============================================
// Suppliers
// ============================================

describe('the supplier ladder', () => {
  it('trades price against time, in that order', () => {
    // The whole decision. If a supplier were both cheapest and fastest there
    // would be nothing to choose.
    const selectable = SELECTABLE_SUPPLIERS;
    for (let i = 1; i < selectable.length; i++) {
      expect(selectable[i].priceFactor).toBeLessThan(selectable[i - 1].priceFactor);
      expect(selectable[i].leadDays).toBeGreaterThan(selectable[i - 1].leadDays);
      expect(selectable[i].minQuantity).toBeGreaterThan(selectable[i - 1].minQuantity);
    }
  });

  it('keeps the emergency counter off the order screen and dearer than anyone', () => {
    // It exists for the automatic top-up to use when nobody is minding the
    // shop. Offering it as a choice would be offering the player a worse deal
    // with no upside.
    expect(SUPPLIERS.EMERGENCY.selectable).toBe(false);
    expect(SELECTABLE_SUPPLIERS.map(s => s.id)).not.toContain('EMERGENCY');

    for (const spec of SELECTABLE_SUPPLIERS) {
      expect(SUPPLIERS.EMERGENCY.priceFactor).toBeGreaterThan(spec.priceFactor);
    }
  });

  it('extends longer credit the further up the chain you go', () => {
    expect(offersTerm('LOCAL', 'NET_0')).toBe(true);
    expect(offersTerm('LOCAL', 'NET_7')).toBe(false);
    expect(offersTerm('DISTRIBUTOR', 'NET_15')).toBe(true);
    expect(offersTerm('DISTRIBUTOR', 'NET_30')).toBe(false);
    expect(offersTerm('IMPORTER', 'NET_30')).toBe(true);
  });

  it('lists the terms a supplier will actually extend', () => {
    expect(termsFor('LOCAL').map(t => t.id)).toEqual(['NET_0']);
    expect(termsFor('IMPORTER').map(t => t.id)).toEqual(PAYMENT_TERM_IDS);
  });

  it('narrows untrusted ids', () => {
    expect(isSupplierId('IMPORTER')).toBe(true);
    expect(isSupplierId('MY_MATE_DAVE')).toBe(false);
    expect(isPaymentTerm('NET_30')).toBe(true);
    expect(isPaymentTerm('NET_90')).toBe(false);
  });

  it('gives every supplier a name in both languages', () => {
    for (const id of SUPPLIER_IDS) {
      const spec = SUPPLIERS[id];
      expect(spec.en).toBeTruthy();
      expect(/[ঀ-৿]/.test(spec.bn), `${id} bn`).toBe(true);
      expect(/[ঀ-৿]/.test(spec.noteBn), `${id} note bn`).toBe(true);
    }
  });
});

describe('quoting a supplier', () => {
  const base = { quantity: 300, marketUnitCost: 100, orderDay: 10 } as const;

  it('prices the importer well under the counter', () => {
    const importer = quoteFromSupplier({ ...base, supplier: 'IMPORTER', term: 'NET_0' });
    const counter = quoteFromSupplier({ ...base, supplier: 'EMERGENCY', term: 'NET_0' });

    expect(importer.goodsValue).toBeLessThan(counter.goodsValue * 0.7);
    expect(importer.savingVsCounter).toBeGreaterThan(0);
  });

  it('applies bulk on top of the supplier price, not instead of it', () => {
    const quote = quoteFromSupplier({ ...base, supplier: 'DISTRIBUTOR', term: 'NET_0' });
    expect(quote.supplierUnitCost).toBeCloseTo(100 * 0.94, 6);
    expect(quote.bulkDiscount).toBe(0.06);
    expect(quote.unitCost).toBeCloseTo(100 * 0.94 * 0.94, 6);
  });

  it('charges credit on the discounted goods, not the list price', () => {
    // Charging the surcharge on the list price would quietly cancel the bulk
    // discount for anyone buying at scale — which is everyone buying on terms.
    const cash = quoteFromSupplier({ ...base, supplier: 'IMPORTER', term: 'NET_0' });
    const credit = quoteFromSupplier({ ...base, supplier: 'IMPORTER', term: 'NET_30' });

    expect(credit.goodsValue).toBe(cash.goodsValue);
    expect(credit.creditSurcharge).toBe(Math.round(cash.goodsValue * PAYMENT_TERMS.NET_30.surcharge));
    expect(credit.totalCost).toBe(cash.goodsValue + credit.creditSurcharge);
  });

  it('falls back to cash when a supplier will not extend the term asked for', () => {
    const quote = quoteFromSupplier({ ...base, supplier: 'LOCAL', term: 'NET_30' });
    expect(quote.term).toBe('NET_0');
    expect(quote.creditSurcharge).toBe(0);
  });

  it('dates the bill from delivery, not from the order', () => {
    // The importer's week is part of the wait. Billing from the order date
    // would quietly shorten every term it offers.
    const quote = quoteFromSupplier({ ...base, supplier: 'IMPORTER', term: 'NET_30' });
    expect(quote.dueOnDay).toBe(10 + SUPPLIERS.IMPORTER.leadDays + PAYMENT_TERMS.NET_30.days);
  });

  it('does not round the discount away on cheap goods', () => {
    // Tea is ৳8 a unit. Rounding into each unit deletes any discount under 6%.
    const quote = quoteFromSupplier({
      supplier: 'DISTRIBUTOR', quantity: 300, marketUnitCost: 8, term: 'NET_0', orderDay: 1,
    });
    expect(quote.goodsValue).toBeLessThan(8 * 300);
  });

  it('never produces a non-finite figure', () => {
    for (const id of SUPPLIER_IDS) {
      for (const cost of [0, 0.5, 1, 120_000]) {
        const quote = quoteFromSupplier({
          supplier: id, quantity: 100, marketUnitCost: cost, term: 'NET_0', orderDay: 1,
        });
        expect(Number.isFinite(quote.totalCost), `${id} @ ${cost}`).toBe(true);
        expect(quote.totalCost).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('what a supplier will take', () => {
  const ok = { supplier: 'DISTRIBUTOR', quantity: 100, term: 'NET_0', creditBlocked: false } as const;

  it('accepts a sound order', () => {
    expect(validateSupplierOrder(ok).ok).toBe(true);
  });

  it('refuses an order under the supplier minimum', () => {
    const verdict = validateSupplierOrder({ ...ok, quantity: 5 });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('BELOW_MINIMUM');
  });

  it('refuses a term the supplier does not extend', () => {
    const verdict = validateSupplierOrder({ ...ok, term: 'NET_30' });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('TERM_NOT_OFFERED');
  });

  it('refuses credit to someone with an overdue bill', () => {
    // Credit without a consequence for missing a payment is a discount on
    // patience, not credit.
    const verdict = validateSupplierOrder({ ...ok, term: 'NET_15', creditBlocked: true });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('CREDIT_BLOCKED');
  });

  it('still sells for cash to someone with an overdue bill', () => {
    // Being cut off from credit must not mean being cut off from trading.
    expect(validateSupplierOrder({ ...ok, term: 'NET_0', creditBlocked: true }).ok).toBe(true);
  });

  it('refuses the emergency counter as a choice', () => {
    const verdict = validateSupplierOrder({ ...ok, supplier: 'EMERGENCY' });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('NOT_SELECTABLE');
  });
});

describe('late bills', () => {
  it('grows by the daily penalty', () => {
    expect(overdueTotal(10_000, 0)).toBe(10_000);
    expect(overdueTotal(10_000, 5)).toBe(Math.round(10_000 * (1 + OVERDUE_PENALTY_PER_DAY * 5)));
  });

  it('never shrinks a bill', () => {
    for (const late of [-5, 0, 1, 100]) {
      expect(overdueTotal(5_000, late)).toBeGreaterThanOrEqual(5_000);
    }
  });
});

// ============================================
// Spoilage
// ============================================

describe('what perishes', () => {
  it('leaves clothing and phones alone entirely', () => {
    // Which is precisely why clothing is the Eid trade: it is the one that can
    // be stockpiled for a rush ten days out.
    for (const type of ['CLOTHING', 'MOBILE'] as const) {
      for (const def of PRODUCTS[type]) {
        expect(def.shelfLifeDays, def.name).toBe(0);
        expect(isPerishable(def)).toBe(false);
      }
    }
  });

  it('gives a restaurant nothing that keeps', () => {
    for (const def of PRODUCTS.RESTAURANT) {
      expect(def.shelfLifeDays, def.name).toBeGreaterThan(0);
    }
  });

  it('keeps packaged grocery stable and fresh grocery not', () => {
    const byName = new Map(PRODUCTS.GROCERY.map(d => [d.name, d]));
    expect(byName.get('Rice (5kg)')!.shelfLifeDays).toBe(0);
    expect(byName.get('Cooking Oil (1L)')!.shelfLifeDays).toBe(0);
    expect(byName.get('Milk (1L)')!.shelfLifeDays).toBeGreaterThan(0);
    expect(byName.get('Eggs (12pc)')!.shelfLifeDays).toBeGreaterThan(0);
  });

  it('gives every product a shelf life, even if it is zero', () => {
    for (const [type, defs] of Object.entries(PRODUCTS)) {
      for (const def of defs) {
        expect(Number.isFinite(def.shelfLifeDays), `${type}/${def.name}`).toBe(true);
        expect(def.shelfLifeDays).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('the spoilage curve', () => {
  it('is zero for anything that does not perish, at any age', () => {
    for (const age of [0, 1, 50, 5_000]) {
      expect(dailySpoilageRate(age, 0)).toBe(0);
    }
  });

  it('bites harder on short-lived goods even while they are fresh', () => {
    // A day-old fish and a day-old egg must not be equally saleable.
    expect(dailySpoilageRate(0, 1)).toBeGreaterThan(dailySpoilageRate(0, 7));
  });

  it('turns steep past the shelf life', () => {
    expect(dailySpoilageRate(2, 3)).toBeLessThan(dailySpoilageRate(4, 3));
    expect(dailySpoilageRate(4, 3)).toBe(SPOILAGE_CONFIG.staleLossPerDay);
  });

  it('never loses more than the cap in one day', () => {
    for (const age of [0, 1, 10, 1_000]) {
      for (const shelf of [1, 2, 3, 7]) {
        expect(dailySpoilageRate(age, shelf)).toBeLessThanOrEqual(SPOILAGE_CONFIG.maxLossPerDay);
      }
    }
  });

  it('survives nonsense input', () => {
    expect(dailySpoilageRate(Number.NaN, 3)).toBe(0);
    expect(dailySpoilageRate(1, Number.NaN)).toBe(0);
    expect(dailySpoilageRate(-5, 3)).toBe(0);
  });
});

describe('ageing a shelf by a day', () => {
  const fish = { productName: 'Fish Curry', quantity: 100, purchasePrice: 100, shelfLifeDays: 1 };
  const shirt = { productName: 'Shirt', quantity: 100, purchasePrice: 500, shelfLifeDays: 0 };

  it('throws nothing away from a shelf that cannot perish', () => {
    const result = spoilOneDay({ ...shirt, averageAgeDays: 500 });
    expect(result.spoiled).toBe(0);
    expect(result.remaining).toBe(100);
    expect(result.lossValue).toBe(0);
  });

  it('costs the loss at the stock’s own cost basis', () => {
    const result = spoilOneDay({ ...fish, averageAgeDays: 3 });
    expect(result.spoiled).toBeGreaterThan(0);
    expect(result.lossValue).toBe(result.spoiled * 100);
  });

  it('always loses something once stock is past its date', () => {
    // Otherwise a shelf small enough to round to zero keeps one rotting unit
    // on the books indefinitely.
    const result = spoilOneDay({ ...fish, quantity: 2, averageAgeDays: 9 });
    expect(result.spoiled).toBeGreaterThan(0);
  });

  it('never spoils more than is there', () => {
    const result = spoilOneDay({ ...fish, quantity: 1, averageAgeDays: 50 });
    expect(result.spoiled).toBe(1);
    expect(result.remaining).toBe(0);
  });

  it('copes with an empty shelf', () => {
    const result = spoilOneDay({ ...fish, quantity: 0, averageAgeDays: 4 });
    expect(result.spoiled).toBe(0);
    expect(result.remaining).toBe(0);
  });

  it('totals a whole shop', () => {
    const shop = spoilShelves([
      { ...fish, averageAgeDays: 3 },
      { ...shirt, averageAgeDays: 3 },
    ]);
    expect(shop.totalSpoiled).toBeGreaterThan(0);
    expect(shop.totalLoss).toBeGreaterThan(0);
    expect(shop.lines).toHaveLength(2);
  });
});

describe('blending age when stock arrives', () => {
  it('pulls the average down towards the fresh delivery', () => {
    expect(blendAge({
      existingQuantity: 100, existingAgeDays: 4,
      incomingQuantity: 100, incomingAgeDays: 0,
    })).toBe(2);
  });

  it('means a shop topped up daily never ages', () => {
    // The reason regular restocking is the defence against spoilage, rather
    // than an unrelated chore.
    let age = 0;
    for (let day = 0; day < 30; day++) {
      age += 1; // a day passes
      age = blendAge({ existingQuantity: 20, existingAgeDays: age, incomingQuantity: 80 });
    }
    expect(age).toBeLessThan(1.5);
  });

  it('is zero for an empty shelf', () => {
    expect(blendAge({ existingQuantity: 0, existingAgeDays: 9, incomingQuantity: 0 })).toBe(0);
  });
});

describe('projecting what survives', () => {
  it('agrees with what the tick actually does', () => {
    // The screen's estimate and the engine's behaviour run through the same
    // function, so they cannot drift. An earlier version duplicated the curve,
    // left out the minimum-loss rule, and projected two units of fish
    // surviving forever.
    let remaining = 100;
    let age = 0;
    for (let day = 0; day < 5; day++) {
      const step = spoilOneDay({
        productName: 'Fish Curry', quantity: remaining, purchasePrice: 0,
        averageAgeDays: age, shelfLifeDays: 1,
      });
      remaining = step.remaining;
      age = step.newAgeDays;
    }

    expect(projectedSurvival({ quantity: 100, shelfLifeDays: 1, daysHeld: 5 }).surviving)
      .toBe(remaining);
  });

  it('says a week of fish is a mistake and a week of shirts is not', () => {
    const fish = projectedSurvival({ quantity: 800, shelfLifeDays: 1, daysHeld: 7 });
    const shirts = projectedSurvival({ quantity: 800, shelfLifeDays: 0, daysHeld: 7 });

    expect(fish.lossShare).toBeGreaterThan(0.8);
    expect(shirts.lossShare).toBe(0);
    expect(shirts.surviving).toBe(800);
  });

  it('eventually reaches nothing', () => {
    expect(projectedSurvival({ quantity: 1_000, shelfLifeDays: 1, daysHeld: 60 }).surviving).toBe(0);
  });

  it('loses nothing over no time at all', () => {
    expect(projectedSurvival({ quantity: 100, shelfLifeDays: 1, daysHeld: 0 }).surviving).toBe(100);
  });
});

describe('the decision the system exists to create', () => {
  it('makes the importer the right call for rice and the wrong one for fish', () => {
    // Same supplier, same order size, opposite answers — which is the whole
    // point of giving products a shelf life.
    const quantity = 400;
    const lead = SUPPLIERS.IMPORTER.leadDays;

    const rice = projectedSurvival({ quantity, shelfLifeDays: 0, daysHeld: lead + 7 });
    const fish = projectedSurvival({ quantity, shelfLifeDays: 1, daysHeld: lead + 7 });

    expect(rice.surviving).toBe(quantity);
    expect(fish.surviving).toBeLessThan(quantity * 0.1);
  });

  it('leaves the counter the only way to buy fish at short notice', () => {
    // Every supplier that is cheaper than the counter takes at least a day,
    // and a day is a fish's entire shelf life.
    for (const spec of SELECTABLE_SUPPLIERS) {
      expect(spec.leadDays).toBeGreaterThanOrEqual(1);
    }
    expect(SUPPLIERS.EMERGENCY.leadDays).toBe(0);
  });

  it('prices bulk so it is worth planning for', () => {
    const small = quoteFromSupplier({ supplier: 'IMPORTER', quantity: 150, marketUnitCost: 100, term: 'NET_0', orderDay: 1 });
    const large = quoteFromSupplier({ supplier: 'IMPORTER', quantity: 2_000, marketUnitCost: 100, term: 'NET_0', orderDay: 1 });

    expect(large.unitCost).toBeLessThan(small.unitCost);
    expect(bulkDiscountFrom('IMPORTER', 2_000)).toBeGreaterThan(bulkDiscountFrom('IMPORTER', 150));
  });
});
