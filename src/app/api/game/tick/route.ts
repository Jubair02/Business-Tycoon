import { NextRequest, NextResponse } from 'next/server';
import { AppError, handleApiError } from '@/lib/errors';
import { authorizeTickRequest } from '@/lib/game/tick-auth';
import { runScheduledTick, getTickIntervalMs, schedulerEnabled } from '@/lib/game/scheduler';

/**
 * Advance the game clock.
 *
 * This is a service entrypoint, not a player action: one tick moves the day
 * for every player and every AI competitor. The server's own scheduler calls
 * `gameTick()` in process and never comes through here — this route exists so
 * an external cron can drive the world instead (set `GAME_TICK_SCHEDULER=off`
 * and `CRON_SECRET`, then post here on your own schedule).
 *
 * It previously required only a player session, which let any signed-in player
 * fast-forward the shared economy by looping the request.
 */
async function advanceTheWorld(request: NextRequest) {
  try {
    const auth = authorizeTickRequest(request.headers);
    if (!auth.authorized) {
      throw new AppError('UNAUTHORIZED', auth.reason);
    }

    const result = await runScheduledTick();

    if (result === 'locked') {
      // Another tick is already in flight. The day still advances, so this is
      // reported rather than treated as a failure.
      return NextResponse.json({ success: true, ticked: false, reason: 'locked' }, { status: 200 });
    }

    if (result === 'failed') {
      throw new AppError('INTERNAL_ERROR', 'Tick failed. See server logs.');
    }

    return NextResponse.json({ success: true, ticked: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toResponse(), { status: error.statusCode });
    }
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  return advanceTheWorld(request);
}

/**
 * Two jobs, decided by whether the caller proves it is the cron.
 *
 * **Authorized** — advance the world. Vercel Cron issues a plain `GET` with the
 * secret in an `Authorization` header, and there is no way to ask it for a
 * `POST`. This route used to answer such a request with a status payload and a
 * cheerful 200, which is the worst possible shape for the failure: the cron
 * dashboard stays green while the game's clock never moves at all.
 *
 * **Unauthorized** — report whether the in-process clock is running here and
 * how fast, which is how you confirm a deployment is actually advancing the
 * world. Reading it changes nothing, so it stays open.
 *
 * A mutating GET is poor HTTP manners. It is also what hosted cron schedulers
 * send, and a frozen world is a worse outcome than an unfashionable verb.
 */
export async function GET(request: NextRequest) {
  if (authorizeTickRequest(request.headers).authorized) {
    return advanceTheWorld(request);
  }

  return NextResponse.json({
    schedulerEnabled: schedulerEnabled(),
    tickIntervalMs: getTickIntervalMs(),
  });
}
