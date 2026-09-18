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

/**
 * Module-level so a second `register()` — which Next's dev server does on
 * hot reload — does not leave a second timer running alongside the first.
 */
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

export function getTickIntervalMs(): number {
  return resolveTickIntervalMs(process.env.GAME_TICK_INTERVAL_MS);
}

export function schedulerEnabled(): boolean {
  return isSchedulerEnabled(process.env.GAME_TICK_SCHEDULER);
}

/**
 * Run one tick, taking the same lock the HTTP entrypoint takes.
 *
 * Losing the lock is normal, not an error: another process (or an external
 * cron hitting `/api/game/tick`) got there first, and the day has advanced
 * either way.
 */
export async function runScheduledTick(): Promise<'ran' | 'locked' | 'failed'> {
  let acquired = false;
  try {
    acquired = await acquireTickLock();
    if (!acquired) return 'locked';

    await gameTick();
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
    if (running) scheduleNext(intervalMs);
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

  const intervalMs = getTickIntervalMs();
  running = true;
  scheduleNext(intervalMs);
  console.info(`[scheduler] Game clock started — one day every ${Math.round(intervalMs / 1000)}s.`);
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
