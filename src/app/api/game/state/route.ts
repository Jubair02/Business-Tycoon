import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { getTickIntervalMs, schedulerEnabled } from '@/lib/game/scheduler';
import { clockIsRunning, effectiveIntervalMs } from '@/lib/game/clock-speed';
import { readClockSpeed } from '@/lib/game/clock-speed-store';
import { getSeasonSummary } from '@/lib/game/seasons/seasons';
import { derivedGameDay, msUntilNextDay, nextDayBoundaryMs } from '@/lib/game/day-clock';
import { ensureAnchor } from '@/lib/game/day-clock-store';

/**
 * The shared world clock.
 *
 * Read-only. The client polls this to notice the day has changed — it does not
 * drive the tick — so the response carries everything a countdown needs.
 *
 * The day here is *derived* from the stored anchor, not read off the season
 * row. That is what makes every tab, every instance and every reload agree:
 * they are all doing the same arithmetic on the same stored timestamp rather
 * than each counting their own ticks.
 */
export async function GET() {
  try {
    const now = new Date();

    const [states, speed, season] = await Promise.all([
      db.gameState.findMany(),
      readClockSpeed(),
      getSeasonSummary(),
    ]);

    const stateMap: Record<string, string> = {};
    for (const s of states) stateMap[s.key] = s.value;

    const lastTick = stateMap['lastTick'] || null;
    const baseIntervalMs = getTickIntervalMs();
    const dayLengthMs = effectiveIntervalMs(baseIntervalMs, speed);

    // The day the simulation has actually run to.
    const processedDay = season?.gameDay ?? 0;
    const anchor = await ensureAnchor(processedDay, now);

    // The day the world is *on*, whether or not anything has simulated it.
    const gameDay = derivedGameDay({ anchor, nowMs: now.getTime(), dayLengthMs });

    const clockRunning = clockIsRunning({
      schedulerEnabledHere: schedulerEnabled(),
      lastTickISO: lastTick,
      now,
      baseIntervalMs,
      speed,
    });

    return NextResponse.json({
      /** Authoritative: derived from the anchor. Same in every tab. */
      gameDay,
      /**
       * How far the simulation has run. Behind `gameDay` only while a catch-up
       * is pending; the client uses the gap to know whether to ask for one.
       */
      processedDay,
      daysBehind: Math.max(0, gameDay - processedDay),
      season,
      lastTick,
      /** How long a game day takes right now, at the world's current speed. */
      tickIntervalMs: dayLengthMs,
      baseTickIntervalMs: baseIntervalMs,
      speed,
      /** When the next day begins — what the countdown counts to. */
      nextTickAt: new Date(nextDayBoundaryMs({ anchor, nowMs: now.getTime(), dayLengthMs })).toISOString(),
      msUntilNextDay: msUntilNextDay({ anchor, nowMs: now.getTime(), dayLengthMs }),
      /** Server time, so a client with a skewed clock can correct for it. */
      serverNow: now.toISOString(),
      clockRunning,
      /** Kept for older clients; `clockRunning` is the honest figure. */
      schedulerEnabled: clockRunning,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
