import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { getTickIntervalMs, schedulerEnabled } from '@/lib/game/scheduler';
import { clockIsRunning, effectiveIntervalMs, nextTickAtSpeed } from '@/lib/game/clock-speed';
import { readClockSpeed } from '@/lib/game/clock-speed-store';
import { getSeasonSummary } from '@/lib/game/seasons/seasons';

/**
 * The shared world clock.
 *
 * The client polls this to notice the day has changed — it no longer drives
 * the tick itself — so the response carries enough for a countdown to the next
 * day rather than just the current one.
 */
export async function GET() {
  try {
    const states = await db.gameState.findMany();
    const stateMap: Record<string, string> = {};
    for (const s of states) {
      stateMap[s.key] = s.value;
    }

    const lastTick = stateMap['lastTick'] || null;
    const baseIntervalMs = getTickIntervalMs();
    const speed = await readClockSpeed();
    const tickIntervalMs = effectiveIntervalMs(baseIntervalMs, speed);
    const now = new Date();

    // The day belongs to the active season now. `lastTick` stays world-level:
    // one scheduler drives whichever season is running.
    const season = await getSeasonSummary();

    // Whether *anything* is advancing the world — the in-process loop here, or
    // a hosted cron that has ticked it recently. This used to be
    // `schedulerEnabled()` alone, which on Vercel is always false: every player
    // saw "Clock paused" and no countdown while the cron advanced the world
    // underneath them.
    const clockRunning = clockIsRunning({
      schedulerEnabledHere: schedulerEnabled(),
      lastTickISO: lastTick,
      now,
      baseIntervalMs,
      speed,
    });

    return NextResponse.json({
      gameDay: season?.gameDay ?? 1,
      tickCount: season?.gameDay ?? 0,
      season,
      lastTick,
      /** How long a game day takes right now, at the world's current speed. */
      tickIntervalMs,
      baseTickIntervalMs: baseIntervalMs,
      speed,
      // Null only when the world has never ticked. No longer conditional on
      // which process drives the clock.
      nextTickAt: clockRunning ? nextTickAtSpeed({ lastTickISO: lastTick, baseIntervalMs, speed }) : null,
      clockRunning,
      /** Kept for older clients; `clockRunning` is the honest figure. */
      schedulerEnabled: clockRunning,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
