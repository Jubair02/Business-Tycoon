// ============================================
// The world clock's speed dial
// GET  /api/admin/clock   — current speed and when the next day is due (open)
// POST /api/admin/clock   — set the speed (operator secret)
// ============================================
//
// A *world* dial. One tick advances the day for every player and every AI
// competitor, so this sets the pace for everyone at once. It is gated on
// `CRON_SECRET` — the key that already drives the clock — because whoever may
// advance the world may also decide how fast it runs. There is no admin role
// in the schema yet; when one arrives, this should move behind it.
//
// Reading the dial is open: every player should know the world is at 4x.

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { AppError, handleApiError } from '@/lib/errors';
import { authorizeTickRequest } from '@/lib/game/tick-auth';
import { getTickIntervalMs, schedulerEnabled } from '@/lib/game/scheduler';
import {
  CLOCK_SPEEDS,
  clockIsRunning,
  effectiveIntervalMs,
  isClockSpeed,
} from '@/lib/game/clock-speed';
import { readClockSpeed, readLastTick, writeClockSpeed } from '@/lib/game/clock-speed-store';
import { nextDayBoundaryMs } from '@/lib/game/day-clock';
import { ensureAnchor } from '@/lib/game/day-clock-store';
import { getCurrentGameDay } from '@/lib/game/seasons/seasons';

const setSpeedSchema = z.object({
  speed: z.number().refine(isClockSpeed, {
    message: `Speed must be one of: ${CLOCK_SPEEDS.join(', ')}`,
  }),
});

async function describeClock() {
  const [speed, lastTick, processedDay] = await Promise.all([
    readClockSpeed(),
    readLastTick(),
    getCurrentGameDay(),
  ]);
  const baseIntervalMs = getTickIntervalMs();
  const now = new Date();
  const dayLengthMs = effectiveIntervalMs(baseIntervalMs, speed);

  // From the anchor, not from the last tick. Deriving the countdown from when
  // the simulation last ran would drift behind the clock it is chasing, and the
  // dial would disagree with the countdown every player sees.
  const anchor = await ensureAnchor(processedDay, now);

  return {
    speed,
    speeds: CLOCK_SPEEDS,
    baseIntervalMs,
    effectiveIntervalMs: dayLengthMs,
    lastTick,
    nextTickAt: new Date(nextDayBoundaryMs({ anchor, nowMs: now.getTime(), dayLengthMs })).toISOString(),
    schedulerEnabledHere: schedulerEnabled(),
    running: clockIsRunning({
      schedulerEnabledHere: schedulerEnabled(),
      lastTickISO: lastTick,
      now,
      baseIntervalMs,
      speed,
    }),
  };
}

export async function GET() {
  try {
    return NextResponse.json(await describeClock());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = authorizeTickRequest(request.headers);
    if (!auth.authorized) {
      throw new AppError('UNAUTHORIZED', auth.reason);
    }

    const body = setSpeedSchema.parse(await request.json());
    await writeClockSpeed(body.speed);

    return NextResponse.json({ success: true, ...(await describeClock()) });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toResponse(), { status: error.statusCode });
    }
    return handleApiError(error);
  }
}
