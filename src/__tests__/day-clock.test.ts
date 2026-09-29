// ============================================
// The authoritative day clock
// ============================================
//
// The world's day used to be a tally of how many times a timer had fired, so
// any gap in that firing lost time permanently — a restart, a deploy, a
// serverless host with no long-lived process, or a cron on a 30-minute
// schedule. These tests pin the replacement: the day is arithmetic on a stored
// timestamp, so it is the same in every tab, on every instance, and after any
// amount of downtime.

import { describe, it, expect } from 'vitest';
import {
  GAME_DAY_MS,
  MAX_CATCH_UP_DAYS,
  daysSinceAnchor,
  derivedGameDay,
  daysOwed,
  initialAnchor,
  isValidAnchor,
  msUntilNextDay,
  nextDayBoundaryMs,
  rebaseAnchor,
  type ClockAnchor,
} from '@/lib/game/day-clock';
import { DEFAULT_TICK_INTERVAL_MS } from '@/lib/game/tick-schedule';
import { effectiveIntervalMs } from '@/lib/game/clock-speed';

const T0 = Date.parse('2027-01-01T00:00:00.000Z');
const anchor: ClockAnchor = { anchorAtMs: T0, anchorDay: 0 };
const min = (n: number) => n * 60 * 1000;

// ============================================
// The number itself
// ============================================

describe('GAME_DAY_MS', () => {
  it('is four real minutes', () => {
    expect(GAME_DAY_MS).toBe(240_000);
    expect(GAME_DAY_MS).toBe(4 * 60 * 1000);
  });

  it('is the single source of truth — the scheduler default is the same number', () => {
    // Two constants that drifted apart would mean the countdown and the
    // simulation disagreed about how long a day is.
    expect(DEFAULT_TICK_INTERVAL_MS).toBe(GAME_DAY_MS);
  });

  it('is not the old four-hour or ten-minute day', () => {
    expect(GAME_DAY_MS).not.toBe(4 * 60 * 60 * 1000);
    expect(GAME_DAY_MS).not.toBe(10 * 60 * 1000);
  });
});

// ============================================
// Deriving the day
// ============================================

describe('derivedGameDay', () => {
  const at = (ms: number) => derivedGameDay({ anchor, nowMs: T0 + ms, dayLengthMs: GAME_DAY_MS });

  it('is the anchor day at the anchor instant', () => {
    expect(at(0)).toBe(0);
  });

  it('holds until the day is complete', () => {
    expect(at(min(1))).toBe(0);
    expect(at(min(3.9))).toBe(0);
    expect(at(GAME_DAY_MS - 1)).toBe(0);
  });

  it('advances exactly on the boundary', () => {
    expect(at(GAME_DAY_MS)).toBe(1);
  });

  it('advances one day per four minutes', () => {
    expect(at(min(4))).toBe(1);
    expect(at(min(8))).toBe(2);
    expect(at(min(20))).toBe(5);
    expect(at(min(60))).toBe(15);
  });

  it('counts a long absence in full', () => {
    // 24 real hours = 360 game days. Nothing needed to be running for this.
    expect(at(24 * 60 * min(1))).toBe(360);
  });

  it('carries the anchor day forward', () => {
    const later: ClockAnchor = { anchorAtMs: T0, anchorDay: 47 };
    expect(derivedGameDay({ anchor: later, nowMs: T0 + min(8), dayLengthMs: GAME_DAY_MS })).toBe(49);
  });

  it('never rewinds when the clock goes backwards', () => {
    // A corrected server clock or a laptop waking with a stale time must not
    // un-happen days that have already been simulated.
    expect(at(-min(60))).toBe(0);
    expect(daysSinceAnchor({ anchor, nowMs: T0 - min(60), dayLengthMs: GAME_DAY_MS })).toBe(0);
  });

  it('falls back to the default day length if given a nonsense one', () => {
    expect(derivedGameDay({ anchor, nowMs: T0 + min(8), dayLengthMs: 0 })).toBe(2);
    expect(derivedGameDay({ anchor, nowMs: T0 + min(8), dayLengthMs: NaN })).toBe(2);
  });
});

// ============================================
// The countdown
// ============================================

describe('the next day boundary', () => {
  it('is one day length after the anchor, before anything has elapsed', () => {
    expect(nextDayBoundaryMs({ anchor, nowMs: T0, dayLengthMs: GAME_DAY_MS })).toBe(T0 + GAME_DAY_MS);
  });

  it('steps forward with each completed day, not with each call', () => {
    expect(nextDayBoundaryMs({ anchor, nowMs: T0 + min(5), dayLengthMs: GAME_DAY_MS })).toBe(T0 + min(8));
    expect(nextDayBoundaryMs({ anchor, nowMs: T0 + min(9), dayLengthMs: GAME_DAY_MS })).toBe(T0 + min(12));
  });

  it('counts down and never goes negative', () => {
    expect(msUntilNextDay({ anchor, nowMs: T0, dayLengthMs: GAME_DAY_MS })).toBe(GAME_DAY_MS);
    expect(msUntilNextDay({ anchor, nowMs: T0 + min(1), dayLengthMs: GAME_DAY_MS })).toBe(min(3));
    expect(msUntilNextDay({ anchor, nowMs: T0 + min(4), dayLengthMs: GAME_DAY_MS })).toBe(GAME_DAY_MS);
    expect(msUntilNextDay({ anchor, nowMs: T0 - min(99), dayLengthMs: GAME_DAY_MS })).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// The backlog
// ============================================

describe('daysOwed', () => {
  const owed = (elapsedMs: number, processedDay: number) =>
    daysOwed({ anchor, processedDay, nowMs: T0 + elapsedMs, dayLengthMs: GAME_DAY_MS });

  it('is nothing when the simulation is level with the clock', () => {
    expect(owed(0, 0)).toBe(0);
    expect(owed(min(3), 0)).toBe(0);
    expect(owed(min(8), 2)).toBe(0);
  });

  it('is the number of days that passed unsimulated', () => {
    expect(owed(min(4), 0)).toBe(1);
    expect(owed(min(8), 0)).toBe(2);
    expect(owed(min(20), 0)).toBe(5);
  });

  it('matches the brief: 4 minutes ≈ 1 day, 8 ≈ 2, 20 ≈ 5', () => {
    expect(owed(min(4), 0)).toBe(1);
    expect(owed(min(8), 0)).toBe(2);
    expect(owed(min(20), 0)).toBe(5);
  });

  it('is capped so one run cannot try to simulate a month', () => {
    expect(owed(min(4 * 500), 0)).toBe(MAX_CATCH_UP_DAYS);
  });

  it('honours a caller-supplied cap', () => {
    expect(daysOwed({ anchor, processedDay: 0, nowMs: T0 + min(40), dayLengthMs: GAME_DAY_MS, maxPerRun: 3 })).toBe(3);
  });

  it('never returns negative when the simulation is somehow ahead', () => {
    // Replaying days already simulated would double every shop's rent.
    expect(owed(min(4), 9)).toBe(0);
  });

  it('drains to zero as the backlog is worked off', () => {
    let processed = 0;
    const nowMs = T0 + min(20);
    let guard = 0;
    while (guard++ < 50) {
      const n = daysOwed({ anchor, processedDay: processed, nowMs, dayLengthMs: GAME_DAY_MS });
      if (n === 0) break;
      processed += n;
    }
    expect(processed).toBe(5);
    expect(daysOwed({ anchor, processedDay: processed, nowMs, dayLengthMs: GAME_DAY_MS })).toBe(0);
  });
});

// ============================================
// Speed changes
// ============================================

describe('the speed dial', () => {
  it('a faster day makes days arrive proportionally sooner', () => {
    const fast = effectiveIntervalMs(GAME_DAY_MS, 8);
    expect(fast).toBe(30_000);
    expect(derivedGameDay({ anchor, nowMs: T0 + min(4), dayLengthMs: fast })).toBe(8);
  });

  it('rebasing freezes the day reached and restarts the rate from now', () => {
    // Two days in at 1x, then the operator switches to 4x.
    const at = T0 + min(8);
    const rebased = rebaseAnchor({ anchor, nowMs: at, dayLengthMs: GAME_DAY_MS });

    expect(rebased.anchorDay).toBe(2);
    expect(rebased.anchorAtMs).toBe(at);
  });

  it('a speed change does not reach backwards into days already played', () => {
    // Without rebasing, re-deriving at 4x would claim 8 days had passed and the
    // world would owe itself six days it had already simulated.
    const at = T0 + min(8);
    const naive = derivedGameDay({ anchor, nowMs: at, dayLengthMs: effectiveIntervalMs(GAME_DAY_MS, 4) });
    expect(naive).toBe(8);

    const rebased = rebaseAnchor({ anchor, nowMs: at, dayLengthMs: GAME_DAY_MS });
    const honest = derivedGameDay({
      anchor: rebased,
      nowMs: at,
      dayLengthMs: effectiveIntervalMs(GAME_DAY_MS, 4),
    });
    expect(honest).toBe(2);
  });

  it('runs at the new rate afterwards', () => {
    const at = T0 + min(8);
    const rebased = rebaseAnchor({ anchor, nowMs: at, dayLengthMs: GAME_DAY_MS });
    const fast = effectiveIntervalMs(GAME_DAY_MS, 4); // a day a minute

    expect(derivedGameDay({ anchor: rebased, nowMs: at + min(3), dayLengthMs: fast })).toBe(5);
  });
});

// ============================================
// Seeding
// ============================================

describe('initialAnchor', () => {
  it('pins the day already reached to now, so the backlog starts empty', () => {
    // Anchoring at the season's start would declare every day it has already
    // simulated to be owed again, and an upgraded database would replay its
    // entire history.
    const seeded = initialAnchor({ currentDay: 41, nowMs: T0 });
    expect(seeded).toEqual({ anchorDay: 41, anchorAtMs: T0 });
    expect(daysOwed({ anchor: seeded, processedDay: 41, nowMs: T0, dayLengthMs: GAME_DAY_MS })).toBe(0);
  });

  it('gives the next day a full day to arrive', () => {
    const seeded = initialAnchor({ currentDay: 41, nowMs: T0 });
    expect(msUntilNextDay({ anchor: seeded, nowMs: T0, dayLengthMs: GAME_DAY_MS })).toBe(GAME_DAY_MS);
  });

  it('copes with a junk day', () => {
    expect(initialAnchor({ currentDay: NaN, nowMs: T0 }).anchorDay).toBe(0);
    expect(initialAnchor({ currentDay: -5, nowMs: T0 }).anchorDay).toBe(0);
  });
});

describe('isValidAnchor', () => {
  it('accepts a usable anchor', () => {
    expect(isValidAnchor({ anchorAtMs: T0, anchorDay: 0 })).toBe(true);
  });

  it('rejects anything that would corrupt the clock', () => {
    expect(isValidAnchor(null)).toBe(false);
    expect(isValidAnchor(undefined)).toBe(false);
    expect(isValidAnchor({ anchorAtMs: NaN, anchorDay: 0 })).toBe(false);
    expect(isValidAnchor({ anchorAtMs: T0, anchorDay: NaN })).toBe(false);
    expect(isValidAnchor({ anchorAtMs: T0, anchorDay: -1 })).toBe(false);
  });
});

// ============================================
// The properties the brief asks for
// ============================================

describe('persistence and agreement', () => {
  it('two tabs reading the same anchor compute the same day', () => {
    // There is no per-tab state to disagree about: the day is a function of
    // (anchor, now), and both tabs have the same anchor.
    const tabA = derivedGameDay({ anchor, nowMs: T0 + min(37), dayLengthMs: GAME_DAY_MS });
    const tabB = derivedGameDay({ anchor, nowMs: T0 + min(37), dayLengthMs: GAME_DAY_MS });
    expect(tabA).toBe(tabB);
    expect(tabA).toBe(9);
  });

  it('a refresh mid-day does not advance or reset the day', () => {
    const before = derivedGameDay({ anchor, nowMs: T0 + min(2), dayLengthMs: GAME_DAY_MS });
    const afterReload = derivedGameDay({ anchor, nowMs: T0 + min(2.5), dayLengthMs: GAME_DAY_MS });
    expect(before).toBe(0);
    expect(afterReload).toBe(0);
  });

  it('refreshing repeatedly around a boundary never double-counts', () => {
    // The day is read, never incremented, so there is nothing to double.
    const readings = [min(3.9), min(3.99), min(4), min(4.01), min(4.1)].map(ms =>
      derivedGameDay({ anchor, nowMs: T0 + ms, dayLengthMs: GAME_DAY_MS }),
    );
    expect(readings).toEqual([0, 0, 1, 1, 1]);
  });

  it('a server restart resumes where the clock is, not where it stopped', () => {
    // Simulation stopped at day 1; the process was down for 20 minutes.
    const processedDay = 1;
    const backAt = T0 + min(24);
    expect(derivedGameDay({ anchor, nowMs: backAt, dayLengthMs: GAME_DAY_MS })).toBe(6);
    expect(daysOwed({ anchor, processedDay, nowMs: backAt, dayLengthMs: GAME_DAY_MS })).toBe(5);
  });
});
