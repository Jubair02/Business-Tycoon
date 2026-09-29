// ============================================
// Server game clock — the catch-up loop
// ============================================
//
// The engine, the clock store and the season are all mocked: these tests are
// about *scheduling* behaviour — how many days get simulated, one run at a
// time, surviving failures, never twice — not about the simulation, and they
// must never touch a database.
//
// The scheduler's job changed with the day clock. It used to advance the day by
// calling `gameTick()` once per firing, which meant a missed firing lost a day
// for good. It now asks the clock how many days have passed unsimulated and
// runs exactly that many.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const gameTick = vi.fn();
const acquireTickLock = vi.fn();
const releaseTickLock = vi.fn();

vi.mock('@/lib/game-engine', () => ({
  gameTick: (...args: unknown[]) => gameTick(...args),
  acquireTickLock: (...args: unknown[]) => acquireTickLock(...args),
  releaseTickLock: (...args: unknown[]) => releaseTickLock(...args),
}));

const readClockSpeed = vi.fn();

vi.mock('@/lib/game/clock-speed-store', () => ({
  readClockSpeed: (...args: unknown[]) => readClockSpeed(...args),
  readLastTick: () => Promise.resolve(null),
  writeClockSpeed: () => Promise.resolve(),
}));

/**
 * The anchor and the processed day are the two halves of "how far behind is
 * the simulation". Both go to the database in production, so both are mocked,
 * and the tests drive the backlog by moving them.
 */
const ensureAnchor = vi.fn();
const getCurrentGameDay = vi.fn();

vi.mock('@/lib/game/day-clock-store', () => ({
  ensureAnchor: (...args: unknown[]) => ensureAnchor(...args),
  readAnchor: () => Promise.resolve(null),
  reanchorToDay: () => Promise.resolve(),
  rebaseAnchorForSpeedChange: () => Promise.resolve(null),
}));

vi.mock('@/lib/game/seasons/seasons', () => ({
  getCurrentGameDay: (...args: unknown[]) => getCurrentGameDay(...args),
}));

import {
  runScheduledTick,
  daysTheWorldOwes,
  startTickScheduler,
  stopTickScheduler,
  isTickSchedulerRunning,
  getTickIntervalMs,
  msUntilNextWake,
} from '@/lib/game/scheduler';
import { GAME_DAY_MS } from '@/lib/game/day-clock';
import { DEFAULT_TICK_INTERVAL_MS } from '@/lib/game/tick-schedule';

const T0 = Date.parse('2027-01-01T00:00:00.000Z');

/** Put the world `daysBehind` days behind the simulation. */
function worldBehindBy(daysBehind: number, processedDay = 0) {
  getCurrentGameDay.mockResolvedValue(processedDay);
  ensureAnchor.mockResolvedValue({
    anchorDay: processedDay,
    anchorAtMs: T0,
  });
  vi.setSystemTime(new Date(T0 + daysBehind * GAME_DAY_MS));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(T0));

  readClockSpeed.mockResolvedValue(1);
  acquireTickLock.mockResolvedValue(true);
  gameTick.mockResolvedValue(undefined);
  releaseTickLock.mockResolvedValue(undefined);
  getCurrentGameDay.mockResolvedValue(0);
  ensureAnchor.mockResolvedValue({ anchorDay: 0, anchorAtMs: T0 });

  stopTickScheduler();
  delete process.env.GAME_TICK_SCHEDULER;
  delete process.env.GAME_TICK_INTERVAL_MS;
});

afterEach(() => {
  stopTickScheduler();
  vi.useRealTimers();
});

// ============================================
// The backlog
// ============================================

describe('daysTheWorldOwes', () => {
  it('is nothing when the simulation is level with the clock', async () => {
    worldBehindBy(0);
    await expect(daysTheWorldOwes()).resolves.toBe(0);
  });

  it('counts the days that passed unsimulated', async () => {
    worldBehindBy(5);
    await expect(daysTheWorldOwes()).resolves.toBe(5);
  });

  it('is capped, so one run cannot try to simulate a month', async () => {
    worldBehindBy(500);
    const owed = await daysTheWorldOwes();
    expect(owed).toBeGreaterThan(0);
    expect(owed).toBeLessThanOrEqual(12);
  });
});

// ============================================
// One run
// ============================================

describe('runScheduledTick', () => {
  it('does nothing when the world is up to date', async () => {
    worldBehindBy(0);

    await expect(runScheduledTick()).resolves.toBe('up-to-date');
    expect(gameTick).not.toHaveBeenCalled();
    // The lock is still taken and released — that is what makes the check safe.
    expect(releaseTickLock).toHaveBeenCalledOnce();
  });

  it('simulates one day when one is owed', async () => {
    worldBehindBy(1);

    await expect(runScheduledTick()).resolves.toBe('ran');
    expect(gameTick).toHaveBeenCalledTimes(1);
    expect(releaseTickLock).toHaveBeenCalledOnce();
  });

  it('simulates every missed day in one run', async () => {
    // Twenty real minutes away at a four-minute day.
    worldBehindBy(5);

    await expect(runScheduledTick()).resolves.toBe('ran');
    expect(gameTick).toHaveBeenCalledTimes(5);
  });

  it('skips without simulating when another process holds the lock', async () => {
    worldBehindBy(5);
    acquireTickLock.mockResolvedValue(false);

    await expect(runScheduledTick()).resolves.toBe('locked');
    expect(gameTick).not.toHaveBeenCalled();
    // Nothing was acquired, so nothing must be released — releasing here would
    // unlock a run another process is still working through.
    expect(releaseTickLock).not.toHaveBeenCalled();
  });

  it('releases the lock even when a day throws', async () => {
    worldBehindBy(3);
    gameTick.mockRejectedValue(new Error('boom'));

    await expect(runScheduledTick()).resolves.toBe('failed');
    expect(releaseTickLock).toHaveBeenCalledOnce();
  });

  it('does not throw when releasing the lock fails', async () => {
    worldBehindBy(1);
    releaseTickLock.mockRejectedValue(new Error('db gone'));
    await expect(runScheduledTick()).resolves.toBe('ran');
  });

  it('reports failure when the lock itself cannot be taken', async () => {
    acquireTickLock.mockRejectedValue(new Error('db gone'));
    await expect(runScheduledTick()).resolves.toBe('failed');
  });

  it('does not replay days when the simulation is somehow ahead', async () => {
    // Replaying a simulated day would charge every shop its rent twice.
    getCurrentGameDay.mockResolvedValue(9);
    ensureAnchor.mockResolvedValue({ anchorDay: 0, anchorAtMs: T0 });
    vi.setSystemTime(new Date(T0 + GAME_DAY_MS));

    await expect(runScheduledTick()).resolves.toBe('up-to-date');
    expect(gameTick).not.toHaveBeenCalled();
  });
});

// ============================================
// The timer
// ============================================

describe('startTickScheduler', () => {
  it('does nothing when disabled', () => {
    process.env.GAME_TICK_SCHEDULER = 'off';
    startTickScheduler();
    expect(isTickSchedulerRunning()).toBe(false);
  });

  it('starts when enabled', () => {
    startTickScheduler();
    expect(isTickSchedulerRunning()).toBe(true);
  });

  it('is idempotent — a second call does not add a second timer', async () => {
    // One day owed, and the world is level once it is simulated. Three starts
    // must still drain exactly that one day: a second or third timer would
    // each run their own catch-up and simulate it again.
    let processed = 0;
    getCurrentGameDay.mockImplementation(async () => processed);
    ensureAnchor.mockResolvedValue({ anchorDay: 0, anchorAtMs: T0 });
    gameTick.mockImplementation(async () => { processed += 1; });
    vi.setSystemTime(new Date(T0 + GAME_DAY_MS));

    startTickScheduler();
    startTickScheduler(); // e.g. dev-server hot reload calling register() again
    startTickScheduler();

    await vi.advanceTimersByTimeAsync(3_000);

    expect(processed).toBe(1);
    expect(gameTick).toHaveBeenCalledTimes(1);
  });

  it('keeps running after a day fails', async () => {
    worldBehindBy(1);
    gameTick.mockRejectedValueOnce(new Error('one bad day'));

    startTickScheduler();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(isTickSchedulerRunning()).toBe(true);
  });

  it('stops cleanly', async () => {
    worldBehindBy(1);
    startTickScheduler();
    await vi.advanceTimersByTimeAsync(2_000);
    const callsBeforeStop = gameTick.mock.calls.length;

    stopTickScheduler();
    expect(isTickSchedulerRunning()).toBe(false);

    await vi.advanceTimersByTimeAsync(GAME_DAY_MS * 5);
    expect(gameTick).toHaveBeenCalledTimes(callsBeforeStop);
  });

  it('never advances the day by itself — the clock does that', async () => {
    // The timer is a prompt to *check*, not a source of time.
    //
    // The anchor is re-read on every wake and always reports the world level
    // with the simulation, whatever the wall clock says. However many times the
    // loop fires, nothing is simulated — because firing a timer is not what
    // makes a day pass.
    getCurrentGameDay.mockResolvedValue(0);
    ensureAnchor.mockImplementation(async () => ({ anchorDay: 0, anchorAtMs: Date.now() }));

    startTickScheduler();
    await vi.advanceTimersByTimeAsync(GAME_DAY_MS * 10);

    expect(gameTick).not.toHaveBeenCalled();
  });

  it('simulates exactly the days the clock says passed, however often it wakes', async () => {
    // The opposite guarantee: a loop that fires ten times across two game days
    // simulates two days, not ten. The day count comes from the anchor, so
    // extra wake-ups are free no-ops.
    getCurrentGameDay.mockImplementation(async () => processed);
    ensureAnchor.mockResolvedValue({ anchorDay: 0, anchorAtMs: T0 });

    let processed = 0;
    gameTick.mockImplementation(async () => { processed += 1; });

    startTickScheduler();
    await vi.advanceTimersByTimeAsync(GAME_DAY_MS * 2 + 1_000);

    expect(processed).toBe(2);
    expect(gameTick).toHaveBeenCalledTimes(2);
  });
});

// ============================================
// Waking up
// ============================================

describe('msUntilNextWake', () => {
  it('aims at the next day boundary', async () => {
    getCurrentGameDay.mockResolvedValue(0);
    ensureAnchor.mockResolvedValue({ anchorDay: 0, anchorAtMs: T0 });
    vi.setSystemTime(new Date(T0 + 60_000)); // one minute into the day

    await expect(msUntilNextWake()).resolves.toBe(GAME_DAY_MS - 60_000);
  });

  it('never returns zero, so a boundary cannot spin the loop', async () => {
    getCurrentGameDay.mockResolvedValue(0);
    ensureAnchor.mockResolvedValue({ anchorDay: 0, anchorAtMs: T0 });
    vi.setSystemTime(new Date(T0 + GAME_DAY_MS));

    await expect(msUntilNextWake()).resolves.toBeGreaterThan(0);
  });

  it('shortens with the speed dial', async () => {
    readClockSpeed.mockResolvedValue(4);
    getCurrentGameDay.mockResolvedValue(0);
    ensureAnchor.mockResolvedValue({ anchorDay: 0, anchorAtMs: T0 });
    vi.setSystemTime(new Date(T0));

    await expect(msUntilNextWake()).resolves.toBe(GAME_DAY_MS / 4);
  });

  it('comes straight back while days are still owed', async () => {
    // Sleeping to the next boundary with a backlog outstanding caps the loop at
    // one day per boundary — the same rate the clock produces them — so a gap
    // opened by downtime would never close.
    worldBehindBy(3);
    const wake = await msUntilNextWake();
    expect(wake).toBeLessThanOrEqual(1_000);
  });

  it('sleeps to the boundary once the backlog is clear', async () => {
    worldBehindBy(0);
    vi.setSystemTime(new Date(T0 + 60_000));
    await expect(msUntilNextWake()).resolves.toBe(GAME_DAY_MS - 60_000);
  });

  it('falls back to the configured day length if the clock cannot be read', async () => {
    ensureAnchor.mockRejectedValue(new Error('db gone'));
    await expect(msUntilNextWake()).resolves.toBe(getTickIntervalMs());
  });
});

describe('getTickIntervalMs', () => {
  it('is four minutes by default', () => {
    expect(getTickIntervalMs()).toBe(GAME_DAY_MS);
    expect(getTickIntervalMs()).toBe(DEFAULT_TICK_INTERVAL_MS);
    expect(getTickIntervalMs()).toBe(240_000);
  });

  it('reads an override through the shared resolver', () => {
    process.env.GAME_TICK_INTERVAL_MS = '45000';
    expect(getTickIntervalMs()).toBe(45_000);
  });
});
