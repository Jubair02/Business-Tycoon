// ============================================
// Bangladesh Business Tycoon - Offline Progression Tests
// ============================================

import { describe, it, expect } from 'vitest';
import {
  isWithinOfflineWindow,
  summariseOfflineProgress,
  OFFLINE_CONFIG,
} from '@/lib/game/offline/offline-progression';
import { OFFLINE_GRACE_GAME_DAYS } from '@/lib/game/offline/offline-config';
import { DEFAULT_TICK_INTERVAL_MS } from '@/lib/game/tick-schedule';

const NOW = new Date('2026-09-18T12:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

/**
 * A point either side of the grace window, derived rather than hardcoded.
 *
 * These used to be written as 7.9 and 8.1 hours. That was true only while the
 * clock ran at a game day a minute, so slowing the clock broke tests that were
 * describing correct behaviour — the assertion, not the code, was pinned to the
 * wrong thing.
 */
const justInside = () => new Date(NOW.getTime() - OFFLINE_CONFIG.graceMs * 0.99);
const justOutside = () => new Date(NOW.getTime() - OFFLINE_CONFIG.graceMs * 1.01);

describe('isWithinOfflineWindow', () => {
  it('counts a player who beat a moment ago as present', () => {
    expect(isWithinOfflineWindow(hoursAgo(0.01), NOW)).toBe(true);
  });

  it('counts a player who has been away less than the grace window as present', () => {
    expect(isWithinOfflineWindow(justInside(), NOW)).toBe(true);
  });

  it('counts a player who has been away longer than the grace window as absent', () => {
    expect(isWithinOfflineWindow(justOutside(), NOW)).toBe(false);
  });

  it('is worth a fixed number of game days, whatever the clock speed', () => {
    // Expressed in game days now, not wall-clock hours: the harm it guards
    // against is unattended *game* days, so tying it to the clock meant it
    // silently changed meaning whenever the tick rate did.
    expect(OFFLINE_CONFIG.graceMs).toBe(OFFLINE_GRACE_GAME_DAYS * DEFAULT_TICK_INTERVAL_MS);
  });

  it('honours an explicit grace window', () => {
    expect(isWithinOfflineWindow(hoursAgo(2), NOW, 60 * 60 * 1000)).toBe(false);
    expect(isWithinOfflineWindow(hoursAgo(0.5), NOW, 60 * 60 * 1000)).toBe(true);
  });

  it('treats a player who has never been seen as absent', () => {
    expect(isWithinOfflineWindow(null, NOW)).toBe(false);
    expect(isWithinOfflineWindow(undefined, NOW)).toBe(false);
  });

  it('treats an unparseable timestamp as absent rather than throwing', () => {
    expect(isWithinOfflineWindow('not a date', NOW)).toBe(false);
  });

  it('treats a clock skew into the future as present', () => {
    expect(isWithinOfflineWindow(new Date(NOW.getTime() + 60_000), NOW)).toBe(true);
  });

  it('accepts an ISO string as well as a Date', () => {
    expect(isWithinOfflineWindow(hoursAgo(1).toISOString(), NOW)).toBe(true);
  });
});

describe('summariseOfflineProgress', () => {
  const metrics = (fromDay: number, count: number, revenue = 1000, profit = 200) =>
    Array.from({ length: count }, (_, i) => ({ gameDay: fromDay + i, revenue, profit }));

  it('adds up what the shops earned while the player was away', () => {
    const summary = summariseOfflineProgress({
      fromGameDay: 10,
      toGameDay: 20,
      businesses: [
        { id: 'a', name: 'Gulshan Tea', type: 'TEA_STALL', dormantSinceDay: null, totalStock: 100, metrics: metrics(11, 10) },
        { id: 'b', name: 'Mirpur Grocery', type: 'GROCERY', dormantSinceDay: null, totalStock: 50, metrics: metrics(11, 10, 5000, 900) },
      ],
    });

    expect(summary.daysAway).toBe(10);
    expect(summary.daysTraded).toBe(10);
    expect(summary.daysDormant).toBe(0);
    expect(summary.profit).toBe(10 * 200 + 10 * 900);
    expect(summary.revenue).toBe(10 * 1000 + 10 * 5000);
    expect(summary.hitCap).toBe(false);
  });

  it('reports the days the shops sat shuttered past the cap', () => {
    const summary = summariseOfflineProgress({
      fromGameDay: 0,
      toGameDay: 500,
      // Traded for the 480 days inside the eight-hour window, then stopped.
      businesses: [
        { id: 'a', name: 'Gulshan Tea', type: 'TEA_STALL', dormantSinceDay: 480, totalStock: 0, metrics: metrics(1, 480) },
      ],
    });

    expect(summary.daysAway).toBe(500);
    expect(summary.daysTraded).toBe(480);
    expect(summary.daysDormant).toBe(20);
    expect(summary.hitCap).toBe(true);
    expect(summary.businesses[0].outOfStock).toBe(true);
  });

  it('ignores metrics from before the player left', () => {
    const summary = summariseOfflineProgress({
      fromGameDay: 100,
      toGameDay: 105,
      businesses: [
        { id: 'a', name: 'Gulshan Tea', type: 'TEA_STALL', dormantSinceDay: null, totalStock: 10, metrics: metrics(90, 20) },
      ],
    });
    // Days 101-105 only: five of the twenty rows.
    expect(summary.businesses[0].daysTraded).toBe(5);
    expect(summary.profit).toBe(5 * 200);
  });

  it('does not let a shop opened mid-absence make the whole stretch look dormant', () => {
    const summary = summariseOfflineProgress({
      fromGameDay: 0,
      toGameDay: 30,
      businesses: [
        { id: 'a', name: 'Old Shop', type: 'TEA_STALL', dormantSinceDay: null, totalStock: 10, metrics: metrics(1, 30) },
        { id: 'b', name: 'New Shop', type: 'GROCERY', dormantSinceDay: null, totalStock: 10, metrics: metrics(26, 5) },
      ],
    });
    expect(summary.daysTraded).toBe(30);
    expect(summary.daysDormant).toBe(0);
    // The new shop still reports its own short history honestly.
    expect(summary.businesses[1].daysTraded).toBe(5);
  });

  it('handles a player with no businesses at all', () => {
    const summary = summariseOfflineProgress({ fromGameDay: 5, toGameDay: 40, businesses: [] });
    expect(summary.daysAway).toBe(35);
    expect(summary.daysTraded).toBe(0);
    expect(summary.profit).toBe(0);
    expect(summary.hitCap).toBe(false);
  });

  it('never reports negative days when the clock has not moved', () => {
    const summary = summariseOfflineProgress({
      fromGameDay: 40,
      toGameDay: 40,
      businesses: [
        { id: 'a', name: 'Gulshan Tea', type: 'TEA_STALL', dormantSinceDay: null, totalStock: 10, metrics: [] },
      ],
    });
    expect(summary.daysAway).toBe(0);
    expect(summary.daysDormant).toBe(0);
  });
});
