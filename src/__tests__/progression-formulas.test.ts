// ============================================
// Phase 6: Player Progression — formula tests
// ============================================

import { describe, it, expect } from 'vitest';
import {
  xpForNextLevel,
  lifetimeXpAt,
  applyExperienceGain,
  calculateProfitableDayXp,
  calculateUpgradeXp,
  crossedFirstProfit,
  isMaxLevel,
} from '@/lib/game/progression/progression-formulas';
import { PROGRESSION_CONFIG } from '@/lib/game/progression/progression-config';
import { EXPANSION_CONFIG } from '@/lib/game/expansion';

describe('xpForNextLevel', () => {
  it('matches the level * 1000 curve the UI renders', () => {
    expect(xpForNextLevel(1)).toBe(1000);
    expect(xpForNextLevel(2)).toBe(2000);
    expect(xpForNextLevel(5)).toBe(5000);
  });

  it('returns 0 at and above the cap so progression stops', () => {
    expect(xpForNextLevel(PROGRESSION_CONFIG.maxLevel)).toBe(0);
    expect(xpForNextLevel(PROGRESSION_CONFIG.maxLevel + 10)).toBe(0);
  });

  it('never returns a negative threshold for junk input', () => {
    expect(xpForNextLevel(0)).toBe(1000);
    expect(xpForNextLevel(-5)).toBe(1000);
  });
});

describe('lifetimeXpAt', () => {
  it('accumulates the triangular sum of the level steps', () => {
    expect(lifetimeXpAt(1)).toBe(0);
    expect(lifetimeXpAt(2)).toBe(1000);
    expect(lifetimeXpAt(3)).toBe(3000);
    expect(lifetimeXpAt(5)).toBe(10000);
  });

  it('adds the in-level progress', () => {
    expect(lifetimeXpAt(3, 500)).toBe(3500);
  });
});

describe('applyExperienceGain', () => {
  it('banks XP without levelling below the threshold', () => {
    const r = applyExperienceGain(1, 0, 400);
    expect(r.level).toBe(1);
    expect(r.experience).toBe(400);
    expect(r.levelsGained).toBe(0);
    expect(r.xpToNext).toBe(600);
  });

  it('levels up and carries the remainder', () => {
    const r = applyExperienceGain(1, 900, 250);
    expect(r.level).toBe(2);
    expect(r.experience).toBe(150);
    expect(r.levelsGained).toBe(1);
  });

  it('levels exactly on the threshold', () => {
    const r = applyExperienceGain(1, 0, 1000);
    expect(r.level).toBe(2);
    expect(r.experience).toBe(0);
    expect(r.levelsGained).toBe(1);
  });

  it('crosses several levels in one award', () => {
    // 1000 (L1->2) + 2000 (L2->3) + 3000 (L3->4) = 6000
    const r = applyExperienceGain(1, 0, 6500);
    expect(r.level).toBe(4);
    expect(r.experience).toBe(500);
    expect(r.levelsGained).toBe(3);
  });

  it('never removes XP for a zero or negative award', () => {
    expect(applyExperienceGain(3, 250, 0).experience).toBe(250);
    expect(applyExperienceGain(3, 250, -9999)).toMatchObject({ level: 3, experience: 250 });
  });

  it('ignores non-finite awards', () => {
    expect(applyExperienceGain(2, 100, NaN)).toMatchObject({ level: 2, experience: 100 });
    expect(applyExperienceGain(2, 100, Infinity)).toMatchObject({ level: 2, experience: 100 });
  });

  it('clamps at the level cap instead of climbing forever', () => {
    const r = applyExperienceGain(PROGRESSION_CONFIG.maxLevel, 0, 10_000_000);
    expect(r.level).toBe(PROGRESSION_CONFIG.maxLevel);
    expect(r.xpToNext).toBe(0);
    expect(r.experience).toBeLessThanOrEqual(
      PROGRESSION_CONFIG.maxLevel * PROGRESSION_CONFIG.xpPerLevelStep,
    );
  });

  it('repairs junk stored state rather than propagating it', () => {
    const r = applyExperienceGain(0, -50, 100);
    expect(r.level).toBe(1);
    expect(r.experience).toBe(100);
  });
});

describe('calculateProfitableDayXp', () => {
  it('awards nothing for a break-even or losing day', () => {
    expect(calculateProfitableDayXp(0)).toBe(0);
    expect(calculateProfitableDayXp(-5000)).toBe(0);
  });

  it('awards at least the flat base for any profit', () => {
    expect(calculateProfitableDayXp(1)).toBeGreaterThanOrEqual(
      PROGRESSION_CONFIG.profitableDayBase,
    );
  });

  it('increases with profit but compresses a 48x profit gap into under 3x XP', () => {
    // Day-1 steady-state profits measured from the shipped economy formulas.
    const teaStall = calculateProfitableDayXp(785);
    const mobile = calculateProfitableDayXp(37628);

    expect(mobile).toBeGreaterThan(teaStall);
    expect(mobile / teaStall).toBeLessThan(3);
  });

  it('is monotonic in profit', () => {
    let previous = 0;
    for (const profit of [100, 1000, 5000, 20000, 100000, 1_000_000]) {
      const xp = calculateProfitableDayXp(profit);
      expect(xp).toBeGreaterThanOrEqual(previous);
      previous = xp;
    }
  });

  it('caps the profit bonus so one day cannot buy a level', () => {
    const huge = calculateProfitableDayXp(500_000_000);
    expect(huge).toBeLessThanOrEqual(
      PROGRESSION_CONFIG.profitableDayBase + PROGRESSION_CONFIG.profitBonusCap,
    );
    expect(huge).toBeLessThan(xpForNextLevel(1));
  });

  it('handles non-finite input safely', () => {
    expect(calculateProfitableDayXp(NaN)).toBe(0);
  });
});

describe('calculateUpgradeXp', () => {
  it('scales with the level reached', () => {
    expect(calculateUpgradeXp(2)).toBe(300);
    expect(calculateUpgradeXp(10)).toBe(1500);
  });

  it('floors at level 1 for junk input', () => {
    expect(calculateUpgradeXp(0)).toBe(PROGRESSION_CONFIG.upgradeXpPerLevel);
  });
});

describe('crossedFirstProfit', () => {
  it('fires only on the non-positive to positive transition', () => {
    expect(crossedFirstProfit(0, 500)).toBe(true);
    expect(crossedFirstProfit(-200, 100)).toBe(true);
    expect(crossedFirstProfit(500, 900)).toBe(false);
    expect(crossedFirstProfit(-500, -100)).toBe(false);
  });
});

describe('isMaxLevel', () => {
  it('is false below the cap and true at or above it', () => {
    expect(isMaxLevel(1)).toBe(false);
    expect(isMaxLevel(PROGRESSION_CONFIG.maxLevel - 1)).toBe(false);
    expect(isMaxLevel(PROGRESSION_CONFIG.maxLevel)).toBe(true);
  });
});

// ---- The reason this system exists ----
describe('expansion gating', () => {
  it('reaches the level a second business needs, from profitable days alone', () => {
    // A Tea Stall — the weakest starter — running profitably every day.
    const perDay = calculateProfitableDayXp(785);
    let level = 1;
    let experience = 0;
    let days = 0;

    while (level < EXPANSION_CONFIG.minLevelForSecondBusiness && days < 400) {
      ({ level, experience } = applyExperienceGain(level, experience, perDay));
      days += 1;
    }

    expect(level).toBeGreaterThanOrEqual(EXPANSION_CONFIG.minLevelForSecondBusiness);
    // Should land in a sane window: not instant, not a grind.
    expect(days).toBeGreaterThan(EXPANSION_CONFIG.expansionCooldownDays);
    expect(days).toBeLessThanOrEqual(30);
  });

  it('can reach the level the fifth business needs within a normal run', () => {
    const requiredLevel =
      EXPANSION_CONFIG.minLevelForSecondBusiness +
      3 * EXPANSION_CONFIG.minLevelPerAdditionalBusiness;

    // A mid-sized business, profitable daily, with no other XP sources.
    const perDay = calculateProfitableDayXp(5400);
    let level = 1;
    let experience = 0;
    let days = 0;

    while (level < requiredLevel && days < 1000) {
      ({ level, experience } = applyExperienceGain(level, experience, perDay));
      days += 1;
    }

    expect(level).toBeGreaterThanOrEqual(requiredLevel);
    expect(days).toBeLessThan(200);
  });

  it('the max level clears every expansion gate in the game', () => {
    const highestGate =
      EXPANSION_CONFIG.minLevelForSecondBusiness +
      (EXPANSION_CONFIG.maxBusinessesPerPlayer - 2) *
        EXPANSION_CONFIG.minLevelPerAdditionalBusiness;

    expect(PROGRESSION_CONFIG.maxLevel).toBeGreaterThanOrEqual(highestGate);
  });
});
