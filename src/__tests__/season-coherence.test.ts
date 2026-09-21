// ============================================
// Bangladesh Business Tycoon - The clock has to agree with itself
// ============================================
//
// Five numbers decide what playing this game feels like, and they live in five
// different files:
//
//   DEFAULT_TICK_INTERVAL_MS   how long a game day takes          tick-schedule
//   SEASON_CONFIG.lengthDays   how many game days a season is     season-config
//   OFFLINE_GRACE_GAME_DAYS    unattended trading allowed         offline-config
//   PASS_CONFIG                XP to finish the season pass       season-pass
//   the E1 payback band        game days to earn a shop back      business-config
//
// Each was set sensibly on its own. Nobody owned the product of them, and the
// product was absurd: at a game day a minute a **season finished in ninety
// minutes**, prestige capped inside a day of real time, the ladder reset before
// lunch, and eight hours away meant 480 game days — five whole seasons — had
// passed without you. D1/D7/D30 retention cannot measure anything against a
// content cycle that short, which made the analytics layer decorative too.
//
// This is the same failure as U2 in INVARIANTS.md, one layer up: every part
// verified in isolation, the composition verified by nobody. So the
// composition is what this file checks. The numbers may be retuned; they may
// not quietly stop making sense together.

import { describe, it, expect } from 'vitest';
import { DEFAULT_TICK_INTERVAL_MS, MAX_TICK_INTERVAL_MS, MIN_TICK_INTERVAL_MS } from '@/lib/game/tick-schedule';
import { SEASON_CONFIG } from '@/lib/game/seasons/season-config';
import { OFFLINE_CONFIG, OFFLINE_GRACE_GAME_DAYS } from '@/lib/game/offline/offline-config';
import { PASS_CONFIG, PASS_XP, xpForTier } from '@/lib/commerce/season-pass';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A game day, in real hours. */
const gameDayHours = DEFAULT_TICK_INTERVAL_MS / HOUR;
/** A whole season, in real days. */
const seasonRealDays = (SEASON_CONFIG.lengthDays * DEFAULT_TICK_INTERVAL_MS) / DAY;

describe('the clock', () => {
  it('runs a season over days, not minutes', () => {
    // The defect. A season that finishes inside one sitting makes prestige,
    // the ladder reset and every retention metric meaningless.
    expect(seasonRealDays).toBeGreaterThanOrEqual(7);
    expect(seasonRealDays).toBeLessThanOrEqual(45);
  });

  it('lets a check-in show visible progress without skipping the week', () => {
    // Too fast and the player cannot keep up with their own shops; too slow and
    // opening the game shows yesterday's screen again.
    const daysPerRealDay = 24 / gameDayHours;
    expect(daysPerRealDay).toBeGreaterThanOrEqual(2);
    expect(daysPerRealDay).toBeLessThanOrEqual(24);
  });

  it('keeps the default inside its own bounds', () => {
    // The ceiling was an hour while the default became four, which would have
    // clamped the shipped game to a quarter of its intended pace in silence.
    expect(DEFAULT_TICK_INTERVAL_MS).toBeGreaterThanOrEqual(MIN_TICK_INTERVAL_MS);
    expect(DEFAULT_TICK_INTERVAL_MS).toBeLessThanOrEqual(MAX_TICK_INTERVAL_MS);
  });

  it('never makes a game day longer than a real one', () => {
    expect(MAX_TICK_INTERVAL_MS).toBeLessThanOrEqual(DAY);
  });
});

describe('the offline grace', () => {
  it('is worth a fixed number of game days, whatever the clock speed', () => {
    // It used to be eight real hours. The harm it guards against is unattended
    // *game* days, so at a game day a minute it was letting 480 of them pass.
    expect(OFFLINE_CONFIG.graceMs).toBe(OFFLINE_GRACE_GAME_DAYS * DEFAULT_TICK_INTERVAL_MS);
  });

  it('covers a night and a working day', () => {
    // A player who sleeps, or who works a shift, must not come back to a
    // shuttered chain.
    expect(OFFLINE_CONFIG.graceMs).toBeGreaterThanOrEqual(16 * HOUR);
  });

  it('is a fraction of a season, not most of one', () => {
    // Otherwise a player could be absent for the season and still place.
    expect(OFFLINE_GRACE_GAME_DAYS).toBeLessThan(SEASON_CONFIG.lengthDays / 4);
  });

  it('beats far more often than the window it protects', () => {
    // A missed heartbeat or two must never strand a player who is right there.
    expect(OFFLINE_CONFIG.heartbeatMs * 4).toBeLessThan(OFFLINE_CONFIG.graceMs);
  });
});

describe('a season is long enough to play', () => {
  it('fits several payback cycles', () => {
    // E1 solves every business type to a 25-45 game day payback. A season has
    // to hold more than one of those or there is no empire to build — only one
    // shop, earned back just as the books close.
    const slowestPayback = 45;
    expect(SEASON_CONFIG.lengthDays / slowestPayback).toBeGreaterThanOrEqual(2);
  });

  it('can be credited without being lived in', () => {
    // `minDaysForCredit` stops someone signing in on the last day to collect a
    // participation badge, but it must not demand the whole season either.
    expect(SEASON_CONFIG.minDaysForCredit).toBeGreaterThan(0);
    expect(SEASON_CONFIG.minDaysForCredit).toBeLessThan(SEASON_CONFIG.lengthDays / 4);
  });
});

describe('the season pass fits the season', () => {
  const fullTrack = xpForTier(PASS_CONFIG.tiers);

  it('cannot be finished in a couple of days', () => {
    // A pass completed in the first week is not a season-long reward track,
    // and it takes the reason to come back with it.
    const fastestDays = fullTrack / PASS_CONFIG.dailyXpCap;
    expect(fastestDays).toBeGreaterThan(SEASON_CONFIG.lengthDays / 10);
  });

  it('is reachable by a player who actually plays', () => {
    // Roughly three shops turning a profit, plus the occasional milestone.
    const activeDailyXp = PASS_XP.profitableDay * 3 + 20;
    expect(fullTrack / activeDailyXp).toBeLessThanOrEqual(SEASON_CONFIG.lengthDays);
  });

  it('is not handed to someone running a single shop passively', () => {
    // If one shop left alone completes the track, the premium lane is buying
    // nothing and the free lane is asking nothing.
    const passiveDailyXp = PASS_XP.profitableDay;
    expect(fullTrack / passiveDailyXp).toBeGreaterThan(SEASON_CONFIG.lengthDays);
  });

  it('cannot be farmed past its daily ceiling', () => {
    expect(PASS_CONFIG.dailyXpCap).toBeLessThan(fullTrack / 5);
  });
});

describe('retention is measurable against this cadence', () => {
  it('fits more than one season inside a 30-day window', () => {
    // `returned_next_season` is the number the whole seasonal design rests on.
    // If a season is longer than the retention window, D30 can never observe a
    // player coming back for the next one.
    expect(seasonRealDays).toBeLessThanOrEqual(30);
  });

  it('does not turn over several seasons inside a week', () => {
    // At the old clock a season ended every ninety minutes, so the metric
    // fired constantly and meant nothing.
    expect(seasonRealDays).toBeGreaterThanOrEqual(7);
  });
});
