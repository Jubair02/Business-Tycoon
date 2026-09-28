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
  nextTickAtSpeed,
} from '@/lib/game/clock-speed';
import { readClockSpeed, readLastTick, writeClockSpeed } from '@/lib/game/clock-speed-store';

const setSpeedSchema = z.object({
  speed: z.number().refine(isClockSpeed, {
    message: `Speed must be one of: ${CLOCK_SPEEDS.join(', ')}`,
  }),
});

async function describeClock() {
  const [speed, lastTick] = await Promise.all([readClockSpeed(), readLastTick()]);
  const baseIntervalMs = getTickIntervalMs();
  const now = new Date();

  return {
    speed,
    speeds: CLOCK_SPEEDS,
    baseIntervalMs,
    effectiveIntervalMs: effectiveIntervalMs(baseIntervalMs, speed),
    lastTick,
    nextTickAt: nextTickAtSpeed({ lastTickISO: lastTick, baseIntervalMs, speed }),
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
