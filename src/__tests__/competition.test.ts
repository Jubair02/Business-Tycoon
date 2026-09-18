// ============================================
// Bangladesh Business Tycoon - Competitive Pressure Tests
// ============================================
//
// These guard the mechanic that makes rivalry mean anything: before it, two
// shops of the same trade on the same street sold to entirely separate pools of
// customers, so undercutting a rival won nothing and being undercut cost
// nothing.

import { describe, it, expect } from 'vitest';
import {
  calculateCompetitionPressure,
  calculateShopAttractiveness,
  calculatePriceIndex,
  COMPETITION_CONFIG,
} from '@/lib/game/economy/competition';
import type { RivalShopSnapshot } from '@/lib/game/economy/types';

const shop = (over: Partial<RivalShopSnapshot> = {}): RivalShopSnapshot => ({
  businessId: 'self',
  priceIndex: 1,
  reputation: 50,
  level: 1,
  ...over,
});

describe('calculateShopAttractiveness', () => {
  it('scores an average shop at the going rate as 1.0', () => {
    expect(calculateShopAttractiveness(shop())).toBeCloseTo(1, 5);
  });

  it('scores a cheaper shop higher', () => {
    expect(calculateShopAttractiveness(shop({ priceIndex: 0.85 })))
      .toBeGreaterThan(calculateShopAttractiveness(shop()));
  });

  it('scores a better-regarded shop higher', () => {
    expect(calculateShopAttractiveness(shop({ reputation: 90 })))
      .toBeGreaterThan(calculateShopAttractiveness(shop({ reputation: 40 })));
  });

  it('never returns zero or negative, even for absurd inputs', () => {
    expect(calculateShopAttractiveness(shop({ priceIndex: 0, reputation: 0 }))).toBeGreaterThan(0);
    expect(calculateShopAttractiveness(shop({ priceIndex: 999, reputation: -50 }))).toBeGreaterThan(0);
  });
});

describe('calculateCompetitionPressure', () => {
  it('leaves an uncontested shop exactly as it was', () => {
    const result = calculateCompetitionPressure({ self: shop(), rivals: [] });
    expect(result.pressure).toBe(1);
    expect(result.marketShare).toBe(1);
    expect(result.competitorCount).toBe(1);
  });

  it('costs a shop trade when an equal rival opens next door', () => {
    const result = calculateCompetitionPressure({
      self: shop(),
      rivals: [shop({ businessId: 'rival' })],
    });
    expect(result.pressure).toBeLessThan(1);
    expect(result.marketShare).toBeCloseTo(0.5, 5);
    // Two even shops: the pool grows by `crowding`, then splits in half.
    expect(result.pressure).toBeCloseTo((1 + COMPETITION_CONFIG.crowding) / 2, 5);
  });

  it('costs more trade the more rivals arrive', () => {
    const one = calculateCompetitionPressure({ self: shop(), rivals: [shop({ businessId: 'a' })] });
    const three = calculateCompetitionPressure({
      self: shop(),
      rivals: [shop({ businessId: 'a' }), shop({ businessId: 'b' }), shop({ businessId: 'c' })],
    });
    expect(three.pressure).toBeLessThan(one.pressure);
  });

  it('punishes a shop that a rival is undercutting', () => {
    const even = calculateCompetitionPressure({
      self: shop(),
      rivals: [shop({ businessId: 'rival' })],
    });
    const undercut = calculateCompetitionPressure({
      self: shop(),
      rivals: [shop({ businessId: 'rival', priceIndex: 0.85 })],
    });
    expect(undercut.pressure).toBeLessThan(even.pressure);
    expect(undercut.marketShare).toBeLessThan(0.5);
    expect(undercut.reason).toMatch(/Losing share/);
  });

  it('rewards the shop doing the undercutting', () => {
    const result = calculateCompetitionPressure({
      self: shop({ priceIndex: 0.85 }),
      rivals: [shop({ businessId: 'rival' })],
    });
    expect(result.marketShare).toBeGreaterThan(0.5);
    expect(result.reason).toMatch(/Winning share/);
  });

  it('lets reputation defend against a cheaper rival', () => {
    const cheapRivalOnly = calculateCompetitionPressure({
      self: shop({ reputation: 50 }),
      rivals: [shop({ businessId: 'rival', priceIndex: 0.85 })],
    });
    const cheapRivalButWellRegarded = calculateCompetitionPressure({
      self: shop({ reputation: 95 }),
      rivals: [shop({ businessId: 'rival', priceIndex: 0.85 })],
    });
    expect(cheapRivalButWellRegarded.marketShare).toBeGreaterThan(cheapRivalOnly.marketShare);
  });

  it('never takes more than the configured floor of a shop\'s trade', () => {
    const result = calculateCompetitionPressure({
      self: shop({ priceIndex: 3, reputation: 0 }),
      rivals: Array.from({ length: 8 }, (_, i) =>
        shop({ businessId: `r${i}`, priceIndex: 0.7, reputation: 100 }),
      ),
    });
    expect(result.pressure).toBeGreaterThanOrEqual(COMPETITION_CONFIG.minPressure);
  });

  it('never hands a shop more than the configured ceiling', () => {
    const result = calculateCompetitionPressure({
      self: shop({ priceIndex: 0.4, reputation: 100 }),
      rivals: Array.from({ length: 8 }, (_, i) =>
        shop({ businessId: `r${i}`, priceIndex: 2.5, reputation: 5 }),
      ),
    });
    expect(result.pressure).toBeLessThanOrEqual(COMPETITION_CONFIG.maxPressure);
  });

  it('shares always add up across everyone in the market', () => {
    const shops = [
      shop({ businessId: 'a', priceIndex: 0.9, reputation: 60 }),
      shop({ businessId: 'b', priceIndex: 1.1, reputation: 40 }),
      shop({ businessId: 'c', priceIndex: 1.0, reputation: 80 }),
    ];
    const total = shops.reduce((sum, self) => {
      const rivals = shops.filter(s => s.businessId !== self.businessId);
      return sum + calculateCompetitionPressure({ self, rivals }).marketShare;
    }, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});

describe('calculatePriceIndex', () => {
  const defs = [
    { name: 'Tea (Cha)', basePrice: 8, suggestedMarkup: 0.6 },   // retail 12.8
    { name: 'Biscuits', basePrice: 5, suggestedMarkup: 0.5 },    // retail 7.5
  ];

  it('reads 1.0 for a shop charging the going rate', () => {
    const index = calculatePriceIndex(
      [{ productName: 'Tea (Cha)', sellPrice: 12.8 }, { productName: 'Biscuits', sellPrice: 7.5 }],
      defs,
    );
    expect(index).toBeCloseTo(1, 5);
  });

  it('reads below 1.0 for a shop undercutting', () => {
    const index = calculatePriceIndex([{ productName: 'Tea (Cha)', sellPrice: 10 }], defs);
    expect(index).toBeLessThan(1);
  });

  it('follows the market price multiplier', () => {
    const index = calculatePriceIndex(
      [{ productName: 'Tea (Cha)', sellPrice: 12.8 }],
      defs,
      { 'Tea (Cha)': 2 },
    );
    // Same shelf price against a doubled going rate is half the index.
    expect(index).toBeCloseTo(0.5, 5);
  });

  it('reads an empty shop as at-market rather than as very cheap', () => {
    expect(calculatePriceIndex([], defs)).toBe(1);
  });

  it('ignores products the shop has no definition for', () => {
    const index = calculatePriceIndex(
      [{ productName: 'Tea (Cha)', sellPrice: 12.8 }, { productName: 'Mystery', sellPrice: 99999 }],
      defs,
    );
    expect(index).toBeCloseTo(1, 5);
  });
});
