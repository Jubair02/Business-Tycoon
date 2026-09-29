// ============================================
// Bangladesh Business Tycoon - Server Game Clock
// ============================================
//
// The world used to advance only when a browser told it to: `GameShell` POSTed
// `/api/game/tick` on a timer, so the shared game day moved at whatever pace
// the most active client chose, and any signed-in player could fast-forward the
// economy for everyone by looping the request.
//
// The clock now lives on the server. This module owns it; `instrumentation.ts`
// starts it when the server boots.

import { gameTick, acquireTickLock, releaseTickLock } from '@/lib/game-engine';
import { resolveTickIntervalMs, isSchedulerEnabled } from './tick-schedule';
import { effectiveIntervalMs } from './clock-speed';
import { readClockSpeed } from './clock-speed-store';
import { daysOwed, msUntilNextDay } from './day-clock';
import { ensureAnchor } from './day-clock-store';
import { getCurrentGameDay } from './seasons/seasons';

/**
 * Module-level so a second `register()` — which Next's dev server does on
 * hot reload — does not leave a second timer running alongside the first.
 */
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

/** The base interval: how long a game day takes at 1x. */
export function getTickIntervalMs(): number {
  return resolveTickIntervalMs(process.env.GAME_TICK_INTERVAL_MS);
}

/**
 * How long a game day takes *right now*, at the world's current speed.
 *
 * Read fresh each time rather than cached, because the speed is a world
 * setting an operator can change at any moment, and the loop below re-arms
 * itself from this after every tick so the change takes effect on the next
 * cycle without a restart.
 */
export async function getEffectiveTickIntervalMs(): Promise<number> {
  return effectiveIntervalMs(getTickIntervalMs(), await readClockSpeed());
}

/** Smallest gap between two wake-ups, so a boundary at 0ms cannot spin. */
const MIN_WAKE_MS = 1_000;

/**
 * How long to sleep before looking at the clock again.
 *
 * The *next day boundary*, not a blind interval. Arming for a full day from
 * whenever the last run happened to finish made the simulation drift later and
 * later behind the clock; aiming at the boundary keeps the two together, and
 * re-reading it each cycle is what lets a speed change take effect without a
 * restart.
 */
export async function msUntilNextWake(now: Date = new Date()): Promise<number> {
  try {
    const [speed, processedDay] = await Promise.all([readClockSpeed(), getCurrentGameDay()]);
    const anchor = await ensureAnchor(processedDay, now);
    const dayLengthMs = effectiveIntervalMs(getTickIntervalMs(), speed);
    const nowMs = now.getTime();

    // A backlog means come straight back. Sleeping to the next boundary while
    // days are still owed caps the loop at one day per boundary — exactly the
    // rate the clock produces them — so a gap that opened during downtime could
    // never close. Observed as a backlog that sat at two or three days
    // indefinitely instead of draining.
    const backlog = daysOwed({ anchor, processedDay, nowMs, dayLengthMs });
    if (backlog > 0) return MIN_WAKE_MS;

    return Math.max(MIN_WAKE_MS, msUntilNextDay({ anchor, nowMs, dayLengthMs }));
  } catch (error) {
    // A database blip must not stop the clock. Fall back to the configured day
    // length and try again on the next cycle.
    console.error('[scheduler] Could not read the clock; retrying next cycle:', error);
    return getTickIntervalMs();
  }
}

export function schedulerEnabled(): boolean {
  return isSchedulerEnabled(process.env.GAME_TICK_SCHEDULER);
}

/**
 * How many days have passed that the simulation has not run yet.
 *
 * The clock's day comes from the anchor; the simulation's day is
 * `Season.gameDay`. The gap between them is the backlog, capped per run so one
 * call cannot try to simulate a month and time out making no progress at all.
 *
 * Returns 0 when the anchor cannot be read — a world that does not know when it
 * started must not guess, because guessing means either replaying history or
 * skipping it.
 */
export async function daysTheWorldOwes(now: Date = new Date()): Promise<number> {
  const [speed, processedDay] = await Promise.all([readClockSpeed(), getCurrentGameDay()]);
  const anchor = await ensureAnchor(processedDay, now);

  return daysOwed({
    anchor,
    processedDay,
    nowMs: now.getTime(),
    dayLengthMs: effectiveIntervalMs(getTickIntervalMs(), speed),
  });
}

/**
 * Simulate however many days the clock says are owed.
 *
 * ---- Why this is a loop and not a tick ----
 *
 * The world's day is derived from a stored timestamp (`day-clock.ts`), so it
 * advances whether or not anything is running. This function's job is to catch
 * the *simulation* up to it: it asks how many days have passed that have not
 * been simulated, and runs `gameTick()` exactly that many times.
 *
 * That is what makes a restart, a deploy, a sleeping laptop or a cron that
 * fires every thirty minutes survivable. Before this, a missed firing meant a
 * lost day — a world that should have been on day 400 sat on day 12.
 *
 * Each `gameTick()` advances `Season.gameDay` by one inside a transaction, and
 * the whole run holds the tick lock, so a day can never be simulated twice: a
 * second caller finds the lock held, and by the time it gets in the backlog is
 * already gone.
 *
 * Losing the lock is normal, not an error — someone else is already doing it.
 */
export async function runScheduledTick(): Promise<'ran' | 'locked' | 'failed' | 'up-to-date'> {
  let acquired = false;
  try {
    acquired = await acquireTickLock();
    if (!acquired) return 'locked';

    const owed = await daysTheWorldOwes();
    if (owed <= 0) return 'up-to-date';

    for (let day = 0; day < owed; day++) {
      await gameTick();
    }

    if (owed > 1) {
      console.info(`[scheduler] Caught the world up by ${owed} days.`);
    }
    return 'ran';
  } catch (error) {
    console.error('[scheduler] Tick failed:', error);
    return 'failed';
  } finally {
    if (acquired) {
      try {
        await releaseTickLock();
      } catch (error) {
        // The stale-lock recovery in acquireTickLock will clear it after two
        // minutes, so a failed release delays the world rather than wedging it.
        console.error('[scheduler] Failed to release tick lock:', error);
      }
    }
  }
}

/**
 * Chained timeouts rather than setInterval.
 *
 * A tick walks every business in the game and can take longer than the
 * interval; setInterval would queue the next one on top of a tick still in
 * flight, and they would spend the difference fighting over the lock. Waiting
 * a full interval *after* each tick completes keeps exactly one in flight.
 */
function scheduleNext(intervalMs: number): void {
  timer = setTimeout(async () => {
    if (!running) return;
    await runScheduledTick();
    // Aim at the next day boundary, re-read each cycle. That is what lets an
    // operator turn the speed dial without restarting the server, and what
    // stops the simulation drifting later than the clock it is chasing.
    if (running) scheduleNext(await msUntilNextWake());
  }, intervalMs);

  // Do not hold the process open on this timer alone.
  timer.unref?.();
}

export function startTickScheduler(): void {
  if (running) return;

  if (!schedulerEnabled()) {
    console.info(
      '[scheduler] Game clock disabled (GAME_TICK_SCHEDULER=off). ' +
        'The world will only advance if an external caller posts to /api/game/tick.',
    );
    return;
  }

  running = true;

  // The first wake is soon rather than a full day away: a process that has just
  // started is the most likely one to have a backlog waiting for it, and making
  // `start` synchronous keeps it a plain call rather than an async one.
  scheduleNext(MIN_WAKE_MS);

  const intervalMs = getTickIntervalMs();
  console.info(
    `[scheduler] Game clock started — one day every ${Math.round(intervalMs / 1000)}s at 1x. ` +
      'Days are derived from the stored anchor, so a restart catches up rather than losing time.',
  );
}

export function stopTickScheduler(): void {
  running = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** Exposed for tests and diagnostics. */
export function isTickSchedulerRunning(): boolean {
  return running;
}
