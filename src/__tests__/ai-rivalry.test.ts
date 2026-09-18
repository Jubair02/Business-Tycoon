// ============================================
// Bangladesh Business Tycoon - AI Rivalry Tests
// ============================================
//
// The AI ran a full strategy layer against a world that contained no player.
// These cover the inputs that changed that: undercutting a rival's price,
// opening in a market the player is earning in, and poaching their staff.

import { describe, it, expect } from 'vitest';
import {
  calculateUndercutPrice,
  rankMarketsToAttack,
  pickPoachTarget,
  rivalryDrive,
  findRivalsInMarket,
  marketKey,
  RIVALRY_CONFIG,
  EMPTY_RIVAL_INTEL,
  type RivalShop,
  type RivalIntel,
} from '@/lib/game/ai/ai-rivalry';
import type { AIPersonality } from '@/lib/game/ai/types';

function rival(over: Partial<RivalShop> = {}): RivalShop {
  return {
    businessId: 'biz-1',
    businessName: 'Gulshan Tea Corner',
    playerId: 'player-1',
    playerName: 'Jubair',
    city: 'DHAKA',
    type: 'TEA_STALL',
    level: 1,
    reputation: 60,
    dailyProfit: 2000,
    dailyRevenue: 7000,
    priceIndex: 1,
    employees: [],
    ...over,
  };
}

function intelFrom(shops: RivalShop[]): RivalIntel {
  const byMarket: Record<string, RivalShop[]> = {};
  for (const s of shops) (byMarket[marketKey(s.city, s.type)] ||= []).push(s);
  return { byMarket, all: shops };
}

const ALL: AIPersonality[] = ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE', 'TRADER', 'EXPANSIONIST'];

describe('rivalryDrive', () => {
  it('is bounded to 0-1 for every personality', () => {
    for (const p of ALL) {
      const drive = rivalryDrive(p);
      expect(drive).toBeGreaterThanOrEqual(0);
      expect(drive).toBeLessThanOrEqual(1);
    }
  });

  it('makes the aggressive and trading personalities the combative ones', () => {
    expect(rivalryDrive('AGGRESSIVE')).toBeGreaterThan(rivalryDrive('CONSERVATIVE'));
    expect(rivalryDrive('TRADER')).toBeGreaterThan(rivalryDrive('CONSERVATIVE'));
  });
});

describe('findRivalsInMarket', () => {
  it('finds human shops in the same city and trade', () => {
    const intel = intelFrom([rival(), rival({ businessId: 'b2', city: 'SYLHET' })]);
    expect(findRivalsInMarket(intel, 'DHAKA', 'TEA_STALL')).toHaveLength(1);
    expect(findRivalsInMarket(intel, 'SYLHET', 'TEA_STALL')).toHaveLength(1);
  });

  it('does not match a different trade in the same city', () => {
    const intel = intelFrom([rival()]);
    expect(findRivalsInMarket(intel, 'DHAKA', 'GROCERY')).toHaveLength(0);
  });

  it('returns nothing when there are no human shops at all', () => {
    expect(findRivalsInMarket(EMPTY_RIVAL_INTEL, 'DHAKA', 'TEA_STALL')).toHaveLength(0);
  });
});

describe('calculateUndercutPrice', () => {
  it('prices below the rival', () => {
    const price = calculateUndercutPrice({
      intendedPrice: 100,
      rivalPrice: 95,
      purchasePrice: 50,
      personality: 'AGGRESSIVE',
    });
    expect(price).not.toBeNull();
    expect(price!).toBeLessThan(95);
  });

  it('undercuts harder the more combative the personality', () => {
    const args = { intendedPrice: 200, rivalPrice: 100, purchasePrice: 20 };
    const aggressive = calculateUndercutPrice({ ...args, personality: 'AGGRESSIVE' })!;
    const conservative = calculateUndercutPrice({ ...args, personality: 'CONSERVATIVE' })!;
    expect(aggressive).toBeLessThan(conservative);
  });

  it('refuses to undercut into a loss', () => {
    const price = calculateUndercutPrice({
      intendedPrice: 100,
      rivalPrice: 52, // undercutting this would land at or under cost
      purchasePrice: 50,
      personality: 'AGGRESSIVE',
    });
    expect(price).toBeNull();
  });

  it('always leaves at least the configured margin over cost', () => {
    for (const p of ALL) {
      const price = calculateUndercutPrice({
        intendedPrice: 1000,
        rivalPrice: 70,
        purchasePrice: 50,
        personality: p,
      });
      if (price !== null) {
        expect(price).toBeGreaterThanOrEqual(50 * (1 + RIVALRY_CONFIG.minMarginOverCost));
      }
    }
  });

  it('leaves its own pricing alone when it was already cheaper', () => {
    const price = calculateUndercutPrice({
      intendedPrice: 60,       // the AI already wanted to sell at 60
      rivalPrice: 100,         // a 15% undercut of which is still above 60
      purchasePrice: 30,
      personality: 'BALANCED',
    });
    expect(price).toBeNull();
  });

  it('ignores a nonsense rival price rather than pricing off it', () => {
    expect(calculateUndercutPrice({ intendedPrice: 100, rivalPrice: 0, purchasePrice: 10, personality: 'TRADER' })).toBeNull();
    expect(calculateUndercutPrice({ intendedPrice: 100, rivalPrice: Infinity, purchasePrice: 10, personality: 'TRADER' })).toBeNull();
  });

  it('never undercuts by more than the configured maximum', () => {
    for (const p of ALL) {
      const price = calculateUndercutPrice({
        intendedPrice: 10_000,
        rivalPrice: 1000,
        purchasePrice: 1,
        personality: p,
      });
      expect(price!).toBeGreaterThanOrEqual(1000 * (1 - RIVALRY_CONFIG.maxUndercut));
    }
  });
});

describe('rankMarketsToAttack', () => {
  it('ranks a market the player is profiting in above one they are not', () => {
    const intel = intelFrom([
      rival({ businessId: 'rich', city: 'DHAKA', type: 'TEA_STALL', dailyProfit: 50_000 }),
      rival({ businessId: 'poor', city: 'KHULNA', type: 'GROCERY', dailyProfit: 100 }),
    ]);
    const ranked = rankMarketsToAttack({ intel, personality: 'AGGRESSIVE', ownedMarkets: [] });
    expect(ranked[0].city).toBe('DHAKA');
  });

  it('ignores a market the player is losing money in', () => {
    const intel = intelFrom([rival({ dailyProfit: -5000 })]);
    const ranked = rankMarketsToAttack({ intel, personality: 'AGGRESSIVE', ownedMarkets: [] });
    expect(ranked).toHaveLength(0);
  });

  it('prefers a market where the player\'s prices are soft', () => {
    const soft = rankMarketsToAttack({
      intel: intelFrom([rival({ priceIndex: 1.3, dailyProfit: 20_000 })]),
      personality: 'AGGRESSIVE',
      ownedMarkets: [],
    });
    const keen = rankMarketsToAttack({
      intel: intelFrom([rival({ priceIndex: 0.85, dailyProfit: 20_000 })]),
      personality: 'AGGRESSIVE',
      ownedMarkets: [],
    });
    expect(soft[0].score).toBeGreaterThan(keen[0].score);
  });

  it('deprioritises a market the AI already trades in', () => {
    const intel = intelFrom([rival({ dailyProfit: 20_000 })]);
    const fresh = rankMarketsToAttack({ intel, personality: 'AGGRESSIVE', ownedMarkets: [] });
    const already = rankMarketsToAttack({
      intel,
      personality: 'AGGRESSIVE',
      ownedMarkets: [marketKey('DHAKA', 'TEA_STALL')],
    });
    expect(fresh[0].score).toBeGreaterThan(already[0]?.score ?? 0);
  });

  it('leaves the cautious personalities expanding on their own logic', () => {
    const intel = intelFrom([rival({ dailyProfit: 20_000 })]);
    const cautious = rankMarketsToAttack({ intel, personality: 'CONSERVATIVE', ownedMarkets: [] });
    const combative = rankMarketsToAttack({ intel, personality: 'AGGRESSIVE', ownedMarkets: [] });
    expect(cautious[0]?.score ?? 0).toBeLessThan(combative[0].score);
  });

  it('has nothing to attack when there is no human in the world', () => {
    const ranked = rankMarketsToAttack({
      intel: EMPTY_RIVAL_INTEL,
      personality: 'AGGRESSIVE',
      ownedMarkets: [],
    });
    expect(ranked).toHaveLength(0);
  });
});

describe('pickPoachTarget', () => {
  const staffed = (skill: number, salary = 10_000) =>
    rival({ employees: [{ id: `e-${skill}`, role: 'SALESPERSON', name: 'Rahim Khan', salary, skill }] });

  it('picks the best hand in the market', () => {
    const target = pickPoachTarget({
      rivals: [
        rival({ businessId: 'a', employees: [{ id: 'e1', role: 'CASHIER', name: 'A', salary: 8000, skill: 6 }] }),
        rival({ businessId: 'b', employees: [{ id: 'e2', role: 'MANAGER', name: 'B', salary: 20000, skill: 9 }] }),
      ],
      personality: 'AGGRESSIVE',
      aiCash: 5_000_000,
      freeSlots: 2,
    });
    expect(target!.employeeId).toBe('e2');
  });

  it('offers more than the rival was paying', () => {
    const target = pickPoachTarget({
      rivals: [staffed(9, 10_000)],
      personality: 'AGGRESSIVE',
      aiCash: 5_000_000,
      freeSlots: 1,
    });
    expect(target!.offeredSalary).toBeGreaterThan(10_000);
    expect(target!.offeredSalary).toBe(Math.round(10_000 * (1 + RIVALRY_CONFIG.poachPremium)));
  });

  it('will not headhunt a poor hand', () => {
    const target = pickPoachTarget({
      rivals: [staffed(RIVALRY_CONFIG.poachMinSkill - 1)],
      personality: 'AGGRESSIVE',
      aiCash: 5_000_000,
      freeSlots: 1,
    });
    expect(target).toBeNull();
  });

  it('will not poach without a free slot', () => {
    expect(pickPoachTarget({
      rivals: [staffed(9)],
      personality: 'AGGRESSIVE',
      aiCash: 5_000_000,
      freeSlots: 0,
    })).toBeNull();
  });

  it('will not poach a wage it cannot carry', () => {
    expect(pickPoachTarget({
      rivals: [staffed(9, 20_000)],
      personality: 'AGGRESSIVE',
      aiCash: 1000,
      freeSlots: 1,
    })).toBeNull();
  });

  it('is not something the cautious personalities do at all', () => {
    for (const p of ['CONSERVATIVE'] as AIPersonality[]) {
      expect(pickPoachTarget({
        rivals: [staffed(10)],
        personality: p,
        aiCash: 50_000_000,
        freeSlots: 5,
      })).toBeNull();
    }
  });

  it('has nobody to poach in an empty market', () => {
    expect(pickPoachTarget({
      rivals: [],
      personality: 'AGGRESSIVE',
      aiCash: 5_000_000,
      freeSlots: 5,
    })).toBeNull();
  });

  it('reports who is being taken and from where, so the player can be told', () => {
    const target = pickPoachTarget({
      rivals: [staffed(9)],
      personality: 'AGGRESSIVE',
      aiCash: 5_000_000,
      freeSlots: 1,
    })!;
    expect(target.fromPlayerId).toBe('player-1');
    expect(target.fromBusinessName).toBe('Gulshan Tea Corner');
    expect(target.employeeName).toBe('Rahim Khan');
  });
});
