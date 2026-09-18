// ============================================
// Bangladesh Business Tycoon - Season Rules Tests
// ============================================
//
// The game was one endless shared world: a single clock, a single leaderboard
// that whoever started first would top forever. Seasons replace that with a
// fixed-length world and a level start each time. What a finished season is
// *worth* is the part that has to be right, because it is the only thing that
// crosses the reset.

import { describe, it, expect } from 'vitest';
import {
  SEASON_CONFIG,
  seasonName,
  calculatePrestige,
  prestigeTier,
  awardSeasonBadges,
  seasonProgress,
  isSeasonOver,
  daysRemaining,
  BADGES,
  type SeasonResult,
} from '@/lib/game/seasons/season-config';

const BASE: SeasonResult = {
  finalNetWorth: SEASON_CONFIG.startingNetWorth,
  finalRank: 50,
  totalRanked: 100,
  businessCount: 1,
  totalProfit: 0,
  daysPlayed: 45,
  seasonLengthDays: 90,
};

describe('seasonName', () => {
  it('numbers and names every season', () => {
    expect(seasonName(1)).toBe('Season 1 — Monsoon Trade');
    expect(seasonName(2)).toBe('Season 2 — Winter Market');
  });

  it('cycles the names rather than running out', () => {
    expect(seasonName(7)).toBe('Season 7 — Monsoon Trade');
    expect(seasonName(100)).toContain('Season 100');
  });

  it('does not produce a season zero', () => {
    expect(seasonName(0)).toContain('Monsoon Trade');
  });
});

describe('calculatePrestige', () => {
  it('gives nothing to an account that barely turned up', () => {
    expect(calculatePrestige({ ...BASE, daysPlayed: SEASON_CONFIG.minDaysForCredit - 1 })).toBe(0);
  });

  it('gives something to an account that played it out', () => {
    expect(calculatePrestige(BASE)).toBeGreaterThan(0);
  });

  it('rewards winning the season most', () => {
    const champion = calculatePrestige({ ...BASE, finalRank: 1 });
    const midTable = calculatePrestige({ ...BASE, finalRank: 50 });
    const bottom = calculatePrestige({ ...BASE, finalRank: 100 });
    expect(champion).toBeGreaterThan(midTable);
    expect(midTable).toBeGreaterThan(bottom);
  });

  it('scales placing against the size of the field', () => {
    // Tenth of twelve is mid-table; tenth of a thousand is exceptional.
    const smallField = calculatePrestige({ ...BASE, finalRank: 10, totalRanked: 12 });
    const largeField = calculatePrestige({ ...BASE, finalRank: 10, totalRanked: 1000 });
    expect(largeField).toBeGreaterThan(smallField);
  });

  it('rewards building something over sitting on the opening cash', () => {
    const built = calculatePrestige({ ...BASE, finalNetWorth: SEASON_CONFIG.startingNetWorth * 25 });
    const idle = calculatePrestige({ ...BASE, finalNetWorth: SEASON_CONFIG.startingNetWorth });
    expect(built).toBeGreaterThan(idle);
  });

  it('rewards playing most of the season', () => {
    const throughout = calculatePrestige({ ...BASE, daysPlayed: 85 });
    const briefly = calculatePrestige({ ...BASE, daysPlayed: 10 });
    expect(throughout).toBeGreaterThan(briefly);
  });

  it('never returns a negative amount', () => {
    expect(calculatePrestige({ ...BASE, finalRank: 9999, totalRanked: 10000, finalNetWorth: 0 }))
      .toBeGreaterThanOrEqual(0);
  });

  it('stays small enough per season that the cap is a real ceiling', () => {
    const best = calculatePrestige({
      finalNetWorth: 500_000_000,
      finalRank: 1,
      totalRanked: 10_000,
      businessCount: 10,
      totalProfit: 100_000_000,
      daysPlayed: 90,
      seasonLengthDays: 90,
    });
    expect(best).toBeLessThan(SEASON_CONFIG.maxPrestige);
  });

  it('survives a one-player season', () => {
    expect(() => calculatePrestige({ ...BASE, finalRank: 1, totalRanked: 1 })).not.toThrow();
    expect(calculatePrestige({ ...BASE, finalRank: 1, totalRanked: 1 })).toBeGreaterThan(0);
  });
});

describe('prestigeTier', () => {
  it('starts everyone as a newcomer', () => {
    expect(prestigeTier(0).label).toBe('Newcomer');
  });

  it('never goes backwards as prestige rises', () => {
    let previous = -1;
    for (let p = 0; p <= SEASON_CONFIG.maxPrestige; p++) {
      const { tier } = prestigeTier(p);
      expect(tier).toBeGreaterThanOrEqual(previous);
      previous = tier;
    }
  });

  it('tops out at the highest tier', () => {
    expect(prestigeTier(SEASON_CONFIG.maxPrestige).label).toBe('Legend of the Delta');
  });
});

describe('awardSeasonBadges', () => {
  const withSeason = (over: Partial<SeasonResult> = {}, seasonNumber = 2) => ({
    ...BASE, ...over, seasonNumber,
  });

  it('gives nothing to an account that barely turned up', () => {
    expect(awardSeasonBadges(withSeason({ daysPlayed: 1 }))).toEqual([]);
  });

  it('crowns the winner', () => {
    expect(awardSeasonBadges(withSeason({ finalRank: 1 }))).toContain(BADGES.CHAMPION.id);
  });

  it('gives the top ten a badge, but not the champion badge', () => {
    const badges = awardSeasonBadges(withSeason({ finalRank: 4 }));
    expect(badges).toContain(BADGES.TOP_10.id);
    expect(badges).not.toContain(BADGES.CHAMPION.id);
  });

  it('gives exactly one placing badge', () => {
    const placing = [BADGES.CHAMPION.id, BADGES.TOP_10.id, BADGES.TOP_HALF.id];
    for (const rank of [1, 5, 40, 95]) {
      const badges = awardSeasonBadges(withSeason({ finalRank: rank }));
      expect(badges.filter(b => placing.includes(b)).length).toBeLessThanOrEqual(1);
    }
  });

  it('marks a crore closing balance', () => {
    expect(awardSeasonBadges(withSeason({ finalNetWorth: 12_000_000 }))).toContain(BADGES.CROREPATI.id);
    expect(awardSeasonBadges(withSeason({ finalNetWorth: 9_000_000 }))).not.toContain(BADGES.CROREPATI.id);
  });

  it('marks a chain of five shops', () => {
    expect(awardSeasonBadges(withSeason({ businessCount: 5 }))).toContain(BADGES.CONGLOMERATE.id);
    expect(awardSeasonBadges(withSeason({ businessCount: 4 }))).not.toContain(BADGES.CONGLOMERATE.id);
  });

  it('marks playing the whole season', () => {
    expect(awardSeasonBadges(withSeason({ daysPlayed: 88 }))).toContain(BADGES.FULL_SEASON.id);
    expect(awardSeasonBadges(withSeason({ daysPlayed: 40 }))).not.toContain(BADGES.FULL_SEASON.id);
  });

  it('gives the founder badge only for season one', () => {
    expect(awardSeasonBadges(withSeason({}, 1))).toContain(BADGES.FOUNDER.id);
    expect(awardSeasonBadges(withSeason({}, 2))).not.toContain(BADGES.FOUNDER.id);
  });

  it('only ever returns ids that exist', () => {
    const badges = awardSeasonBadges(withSeason({ finalRank: 1, finalNetWorth: 50_000_000, businessCount: 8, daysPlayed: 90 }, 1));
    for (const id of badges) expect(BADGES[id]).toBeDefined();
  });
});

describe('season clock helpers', () => {
  it('reports progress through the season', () => {
    expect(seasonProgress(0, 90)).toBe(0);
    expect(seasonProgress(45, 90)).toBeCloseTo(0.5, 5);
    expect(seasonProgress(90, 90)).toBe(1);
  });

  it('clamps progress rather than running past 100%', () => {
    expect(seasonProgress(200, 90)).toBe(1);
    expect(seasonProgress(-5, 90)).toBe(0);
  });

  it('knows when a season is over', () => {
    expect(isSeasonOver(89, 90)).toBe(false);
    expect(isSeasonOver(90, 90)).toBe(true);
    expect(isSeasonOver(91, 90)).toBe(true);
  });

  it('counts down and stops at zero', () => {
    expect(daysRemaining(80, 90)).toBe(10);
    expect(daysRemaining(90, 90)).toBe(0);
    expect(daysRemaining(120, 90)).toBe(0);
  });

  it('treats a zero-length season as already finished rather than dividing by zero', () => {
    expect(seasonProgress(0, 0)).toBe(1);
    expect(isSeasonOver(0, 0)).toBe(true);
  });
});
