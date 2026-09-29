import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requirePlayerId } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { runScheduledTick, daysTheWorldOwes } from '@/lib/game/scheduler';

/**
 * Bring the simulation up to the day the clock is already on.
 *
 * ---- Why a player may call this ----
 *
 * The old `/api/game/tick` had to be locked behind an operator secret, because
 * it advanced the day by one *every time it was called* — so anyone who could
 * call it could fast-forward the shared economy just by looping it.
 *
 * That is no longer possible. The day is derived from a stored timestamp, so
 * this endpoint cannot invent time: it simulates only the days that have
 * genuinely already passed, and calling it twice in a row does nothing the
 * second time. A player hammering it gets a lot of no-ops.
 *
 * That property is what makes the game correct on a host with no long-lived
 * process. A serverless deployment has no in-process scheduler and its cron may
 * only fire once a day; whoever opens the game notices the clock has moved and
 * asks for the backlog to be run. The world advances at wall-clock pace for
 * everyone, driven by whoever happens to be present.
 *
 * Still session-gated and rate-limited: it is expensive, not dangerous.
 */
export async function POST(request: NextRequest) {
  try {
    await requirePlayerId();

    // Generous, because a no-op is cheap and the honest client only calls this
    // on a day boundary. It exists to stop a loop, not to ration normal play.
    enforceRateLimit(request, 'game:catch-up', { limit: 30, windowMs: 60 * 1000 });

    const owedBefore = await daysTheWorldOwes();
    if (owedBefore <= 0) {
      return NextResponse.json({ success: true, ticked: false, daysSimulated: 0, reason: 'up-to-date' });
    }

    const result = await runScheduledTick();

    return NextResponse.json({
      success: result !== 'failed',
      ticked: result === 'ran',
      // What was owed when we looked. Another caller may have taken some of it.
      daysSimulated: result === 'ran' ? owedBefore : 0,
      reason: result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
