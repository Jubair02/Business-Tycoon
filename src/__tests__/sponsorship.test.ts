// ============================================
// Bangladesh Business Tycoon - Sponsorship Tests
// ============================================
//
// The two that matter commercially are the determinism of placement selection
// (a shelf that changed brand on every render would make impression counts
// meaningless) and the reach calculation (summing daily distinct accounts would
// overstate reach to a partner, which is the fastest way to lose the second
// campaign).

import { describe, it, expect } from 'vitest';
import {
  isSponsorActive,
  selectPlacement,
  eligiblePlacements,
  hashToUnitInterval,
  buildPartnerReport,
  type PlacementRef,
  type SponsorRef,
  type DailyStat,
} from '@/lib/sponsorship/placements';

const NOW = new Date('2026-09-18T12:00:00Z');

function sponsor(over: Partial<SponsorRef> = {}): SponsorRef {
  return {
    id: 's1',
    name: 'Pran',
    slug: 'pran',
    brandColor: '#f42a41',
    logoUrl: null,
    status: 'ACTIVE',
    startsAt: null,
    endsAt: null,
    ...over,
  };
}

function placement(over: Partial<PlacementRef> = {}): PlacementRef {
  return {
    id: 'p1',
    sponsorId: 's1',
    kind: 'PRODUCT',
    label: 'Pran Cold Drinks',
    targetRef: 'Cold Drinks',
    weight: 1,
    ...over,
  };
}

describe('isSponsorActive', () => {
  it('runs an active campaign with no dates', () => {
    expect(isSponsorActive(sponsor(), NOW)).toBe(true);
  });

  it('does not run a draft', () => {
    expect(isSponsorActive(sponsor({ status: 'DRAFT' }), NOW)).toBe(false);
  });

  it('does not run before it starts or after it ends', () => {
    expect(isSponsorActive(sponsor({ startsAt: '2026-10-01T00:00:00Z' }), NOW)).toBe(false);
    expect(isSponsorActive(sponsor({ endsAt: '2026-09-01T00:00:00Z' }), NOW)).toBe(false);
  });

  it('treats a missing bound as open-ended rather than never', () => {
    expect(isSponsorActive(sponsor({ startsAt: '2026-09-01T00:00:00Z', endsAt: null }), NOW)).toBe(true);
    expect(isSponsorActive(sponsor({ startsAt: null, endsAt: '2026-10-01T00:00:00Z' }), NOW)).toBe(true);
  });

  it('ignores an unparseable date rather than refusing the campaign', () => {
    expect(isSponsorActive(sponsor({ startsAt: 'not a date' }), NOW)).toBe(true);
  });
});

describe('eligiblePlacements', () => {
  it('matches a placement to its target', () => {
    const all = [placement(), placement({ id: 'p2', targetRef: 'Biscuits' })];
    expect(eligiblePlacements(all, 'PRODUCT', 'Cold Drinks').map(p => p.id)).toEqual(['p1']);
  });

  it('treats a placement with no target as a wildcard', () => {
    const all = [placement({ id: 'wild', targetRef: null })];
    expect(eligiblePlacements(all, 'PRODUCT', 'Anything')).toHaveLength(1);
  });

  it('never crosses placement kinds', () => {
    const all = [placement({ kind: 'BILLBOARD', targetRef: null })];
    expect(eligiblePlacements(all, 'PRODUCT', 'Cold Drinks')).toHaveLength(0);
  });
});

describe('selectPlacement', () => {
  it('returns nothing when nobody has bought the slot', () => {
    expect(selectPlacement([], 'seed')).toBeNull();
  });

  it('is deterministic for a seed', () => {
    // A shelf that picked a different brand on every render would make a
    // partner's impression count depend on how often a player scrolled.
    const options = [placement({ id: 'a' }), placement({ id: 'b' }), placement({ id: 'c' })];
    const first = selectPlacement(options, 'shop-1:Cold Drinks:40');
    for (let i = 0; i < 20; i++) {
      expect(selectPlacement(options, 'shop-1:Cold Drinks:40')!.id).toBe(first!.id);
    }
  });

  it('gives different slots different brands', () => {
    const options = [placement({ id: 'a' }), placement({ id: 'b' })];
    const picks = new Set(
      Array.from({ length: 50 }, (_, i) => selectPlacement(options, `slot-${i}`)!.id),
    );
    expect(picks.size).toBeGreaterThan(1);
  });

  it('splits inventory roughly by weight', () => {
    const options = [placement({ id: 'heavy', weight: 9 }), placement({ id: 'light', weight: 1 })];
    let heavy = 0;
    const runs = 2000;
    for (let i = 0; i < runs; i++) {
      if (selectPlacement(options, `slot-${i}`)!.id === 'heavy') heavy++;
    }
    expect(heavy / runs).toBeGreaterThan(0.8);
    expect(heavy / runs).toBeLessThan(0.98);
  });

  it('ignores a placement with no weight', () => {
    const options = [placement({ id: 'zero', weight: 0 }), placement({ id: 'real', weight: 1 })];
    for (let i = 0; i < 30; i++) {
      expect(selectPlacement(options, `slot-${i}`)!.id).toBe('real');
    }
  });

  it('returns nothing when every placement has no weight', () => {
    expect(selectPlacement([placement({ weight: 0 })], 'seed')).toBeNull();
  });
});

describe('hashToUnitInterval', () => {
  it('stays inside [0, 1)', () => {
    for (const seed of ['', 'a', 'shop-1:Cold Drinks:40', '🇧🇩', 'x'.repeat(500)]) {
      const value = hashToUnitInterval(seed);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('spreads evenly enough to split inventory fairly', () => {
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 10_000; i++) {
      buckets[Math.floor(hashToUnitInterval(`seed-${i}`) * 10)]++;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(700);
      expect(count).toBeLessThan(1300);
    }
  });
});

describe('buildPartnerReport', () => {
  const stats: DailyStat[] = [
    { gameDay: 1, placementId: 'p1', impressions: 100, engagements: 10, uniqueUsers: 40 },
    { gameDay: 2, placementId: 'p1', impressions: 120, engagements: 18, uniqueUsers: 45 },
    { gameDay: 2, placementId: 'p2', impressions: 80, engagements: 4, uniqueUsers: 30 },
  ];

  it('totals impressions and engagements', () => {
    const report = buildPartnerReport(stats);
    expect(report.totalImpressions).toBe(300);
    expect(report.totalEngagements).toBe(32);
    expect(report.daysReported).toBe(2);
  });

  it('does not overstate reach by summing days', () => {
    // The same player on two days is one person. Summing would report 115.
    const report = buildPartnerReport(stats);
    expect(report.peakDailyReach).toBe(45);
  });

  it('does not overstate reach by summing placements within a day', () => {
    // Day 2 has two placements, 45 and 30 distinct accounts — but the same
    // player may have seen both, so the day's reach is at most 45.
    const report = buildPartnerReport(stats);
    const dayTwo = report.byDay.find(d => d.gameDay === 2)!;
    expect(dayTwo.uniqueUsers).toBe(45);
  });

  it('computes an engagement rate', () => {
    expect(buildPartnerReport(stats).engagementRate).toBeCloseTo(32 / 300, 6);
  });

  it('breaks results down by placement, biggest first', () => {
    const report = buildPartnerReport(stats);
    expect(report.byPlacement[0].placementId).toBe('p1');
    expect(report.byPlacement[0].impressions).toBe(220);
  });

  it('returns a zeroed report rather than dividing by zero', () => {
    const report = buildPartnerReport([]);
    expect(report.totalImpressions).toBe(0);
    expect(report.engagementRate).toBe(0);
    expect(report.peakDailyReach).toBe(0);
    expect(report.byDay).toEqual([]);
  });

  it('sorts days chronologically', () => {
    const shuffled: DailyStat[] = [
      { gameDay: 9, placementId: 'p1', impressions: 1, engagements: 0, uniqueUsers: 1 },
      { gameDay: 2, placementId: 'p1', impressions: 1, engagements: 0, uniqueUsers: 1 },
      { gameDay: 5, placementId: 'p1', impressions: 1, engagements: 0, uniqueUsers: 1 },
    ];
    expect(buildPartnerReport(shuffled).byDay.map(d => d.gameDay)).toEqual([2, 5, 9]);
  });
});
