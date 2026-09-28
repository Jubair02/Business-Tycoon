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
//
// ---- The clock was deliberately reversed ----
//
// The game now runs at **four real minutes a game day**, not four hours. That
// is a different product: a session you sit through, not one you check in on.
// The bounds below were rewritten to match, and the guarantees given up are
// named in the tests that used to assert them, because they were real:
//
//   - a season is ~6 hours, so seasonal retention (`returned_next_season`)
//     measures sessions, not weeks;
//   - the offline grace is ~48 minutes, so it covers a coffee break rather than
//     a night's sleep;
//   - a hosted cron tops out at 4x, because a one-minute schedule is the
//     finest Vercel offers and 8x needs a firing every 30 seconds.
//
// None of that is an accident now. Changing the clock again should mean
// changing this file again, on purpose.

import { describe, it, expect } from 'vitest';
import { DEFAULT_TICK_INTERVAL_MS, MAX_TICK_INTERVAL_MS, MIN_TICK_INTERVAL_MS } from '@/lib/game/tick-schedule';
import { SEASON_CONFIG } from '@/lib/game/seasons/season-config';
import { OFFLINE_CONFIG, OFFLINE_GRACE_GAME_DAYS } from '@/lib/game/offline/offline-config';
import { PASS_CONFIG, PASS_XP, xpForTier } from '@/lib/commerce/season-pass';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const MINUTE = 60 * 1000;

/** A game day, in real minutes. */
const gameDayMinutes = DEFAULT_TICK_INTERVAL_MS / MINUTE;
/** A whole season, in real hours. */
const seasonRealHours = (SEASON_CONFIG.lengthDays * DEFAULT_TICK_INTERVAL_MS) / HOUR;

describe('the clock', () => {
  it('runs a season over hours, not a whole evening and not ninety minutes', () => {
    // Was: a season must last 7-45 real days, so seasonal retention had a
    // content cycle to measure. That is given up deliberately — a season is now
    // a long session. It still must not finish before a player can build
    // anything, nor drag past a day.
    expect(seasonRealHours).toBeGreaterThanOrEqual(2);
    expect(seasonRealHours).toBeLessThanOrEqual(24);
  });

  it('leaves a player long enough to act inside a single game day', () => {
    // A day has to be long enough to reprice a shelf, restock and hire before
    // it closes. Under about a minute the player is watching, not playing.
    expect(gameDayMinutes).toBeGreaterThanOrEqual(1);
    expect(gameDayMinutes).toBeLessThanOrEqual(60);
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

  it('covers stepping away from the screen', () => {
    // Was: a night's sleep and a working shift, 16 real hours. At four minutes
    // a game day that would be 240 game days of unattended trading, which is
    // most of a season played by nobody. What it has to cover now is a break —
    // a phone call, a meal — not a night.
    expect(OFFLINE_CONFIG.graceMs).toBeGreaterThanOrEqual(30 * MINUTE);
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

describe('what the cadence costs the analytics', () => {
  it('fits more than one season inside a 30-day window', () => {
    // Still true, and now by a wide margin.
    expect(seasonRealHours / 24).toBeLessThanOrEqual(30);
  });

  it('records that seasonal retention no longer measures weeks', () => {
    // Deliberately asserting the consequence rather than guarding against it.
    // `returned_next_season` fires several times a day at this pace, so it is a
    // session metric now. Anyone reading it as a D7/D30 signal is reading it
    // wrong, and this test is where they find that out.
    expect(seasonRealHours).toBeLessThan(24);
  });
});
