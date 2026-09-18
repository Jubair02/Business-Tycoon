// ============================================
// Server game clock — the loop itself
// ============================================
//
// The game engine is mocked: these tests are about the scheduling behaviour
// (one tick in flight at a time, survives failures, does not double-start),
// not about the simulation, and they must not touch a database.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const gameTick = vi.fn();
const acquireTickLock = vi.fn();
const releaseTickLock = vi.fn();

vi.mock('@/lib/game-engine', () => ({
  gameTick: (...args: unknown[]) => gameTick(...args),
  acquireTickLock: (...args: unknown[]) => acquireTickLock(...args),
  releaseTickLock: (...args: unknown[]) => releaseTickLock(...args),
}));

import {
  runScheduledTick,
  startTickScheduler,
  stopTickScheduler,
  isTickSchedulerRunning,
  getTickIntervalMs,
} from '@/lib/game/scheduler';

beforeEach(() => {
  vi.clearAllMocks();
  acquireTickLock.mockResolvedValue(true);
  gameTick.mockResolvedValue(undefined);
  releaseTickLock.mockResolvedValue(undefined);
  stopTickScheduler();
  delete process.env.GAME_TICK_SCHEDULER;
  delete process.env.GAME_TICK_INTERVAL_MS;
});

afterEach(() => {
  stopTickScheduler();
  vi.useRealTimers();
});

describe('runScheduledTick', () => {
  it('takes the lock, ticks, and releases', async () => {
    await expect(runScheduledTick()).resolves.toBe('ran');
    expect(acquireTickLock).toHaveBeenCalledOnce();
    expect(gameTick).toHaveBeenCalledOnce();
    expect(releaseTickLock).toHaveBeenCalledOnce();
  });

  it('skips without ticking when another process holds the lock', async () => {
    acquireTickLock.mockResolvedValue(false);

    await expect(runScheduledTick()).resolves.toBe('locked');
    expect(gameTick).not.toHaveBeenCalled();
    // Nothing was acquired, so nothing must be released — releasing here would
    // unlock a tick another process is still running.
    expect(releaseTickLock).not.toHaveBeenCalled();
  });

  it('releases the lock even when the tick throws', async () => {
    gameTick.mockRejectedValue(new Error('boom'));

    await expect(runScheduledTick()).resolves.toBe('failed');
    expect(releaseTickLock).toHaveBeenCalledOnce();
  });

  it('does not throw when releasing the lock fails', async () => {
    releaseTickLock.mockRejectedValue(new Error('db gone'));
    await expect(runScheduledTick()).resolves.toBe('ran');
  });

  it('reports failure when the lock itself cannot be taken', async () => {
    acquireTickLock.mockRejectedValue(new Error('db gone'));
    await expect(runScheduledTick()).resolves.toBe('failed');
  });
});

describe('startTickScheduler', () => {
  it('does nothing when disabled', () => {
    process.env.GAME_TICK_SCHEDULER = 'off';
    startTickScheduler();
    expect(isTickSchedulerRunning()).toBe(false);
  });

  it('starts when enabled', () => {
    vi.useFakeTimers();
    startTickScheduler();
    expect(isTickSchedulerRunning()).toBe(true);
  });

  it('is idempotent — a second call does not add a second timer', async () => {
    vi.useFakeTimers();
    process.env.GAME_TICK_INTERVAL_MS = '10000';

    startTickScheduler();
    startTickScheduler(); // e.g. dev-server hot reload calling register() again
    startTickScheduler();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(gameTick).toHaveBeenCalledTimes(1);
  });

  it('ticks repeatedly on the configured interval', async () => {
    vi.useFakeTimers();
    process.env.GAME_TICK_INTERVAL_MS = '10000';
    startTickScheduler();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(gameTick).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(gameTick).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(gameTick).toHaveBeenCalledTimes(5);
  });

  it('keeps running after a tick fails', async () => {
    vi.useFakeTimers();
    process.env.GAME_TICK_INTERVAL_MS = '10000';
    gameTick.mockRejectedValueOnce(new Error('one bad day'));
    startTickScheduler();

    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(gameTick).toHaveBeenCalledTimes(2);
    expect(isTickSchedulerRunning()).toBe(true);
  });

  it('does not stack ticks when one runs longer than the interval', async () => {
    vi.useFakeTimers();
    process.env.GAME_TICK_INTERVAL_MS = '10000';

    let release!: () => void;
    gameTick.mockImplementationOnce(
      () => new Promise<void>((resolve) => { release = resolve; }),
    );
    startTickScheduler();

    // First tick starts and hangs.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(gameTick).toHaveBeenCalledTimes(1);

    // Three intervals pass while it is still in flight — the chained timeout
    // means no further tick is queued behind it.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(gameTick).toHaveBeenCalledTimes(1);

    release();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(gameTick).toHaveBeenCalledTimes(2);
  });

  it('stops cleanly', async () => {
    vi.useFakeTimers();
    process.env.GAME_TICK_INTERVAL_MS = '10000';
    startTickScheduler();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(gameTick).toHaveBeenCalledTimes(1);

    stopTickScheduler();
    expect(isTickSchedulerRunning()).toBe(false);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(gameTick).toHaveBeenCalledTimes(1);
  });
});

describe('getTickIntervalMs', () => {
  it('reads the environment through the shared resolver', () => {
    process.env.GAME_TICK_INTERVAL_MS = '45000';
    expect(getTickIntervalMs()).toBe(45_000);
  });

  it('defaults when unset', () => {
    expect(getTickIntervalMs()).toBe(60_000);
  });
});
