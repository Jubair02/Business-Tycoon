import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { nextTickAt } from '@/lib/game/tick-schedule';
import { getTickIntervalMs, schedulerEnabled } from '@/lib/game/scheduler';
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
    const tickIntervalMs = getTickIntervalMs();

    // The day belongs to the active season now. `lastTick` stays world-level:
    // one scheduler drives whichever season is running.
    const season = await getSeasonSummary();

    return NextResponse.json({
      gameDay: season?.gameDay ?? 1,
      tickCount: season?.gameDay ?? 0,
      season,
      lastTick,
      tickIntervalMs,
      // Null when the world has never ticked, or when no clock is running here
      // — the UI shows "waiting" instead of counting down to a time that will
      // not arrive.
      nextTickAt: schedulerEnabled() ? nextTickAt(lastTick, tickIntervalMs) : null,
      schedulerEnabled: schedulerEnabled(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
