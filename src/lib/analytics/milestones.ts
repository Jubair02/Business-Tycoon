// ============================================
// Bangladesh Business Tycoon - Tick Milestones
// ============================================
//
// The last two steps of the onboarding funnel — `first_profit` and
// `first_week_completed` — cannot be recorded from a route handler, because no
// request happens when they occur. They are consequences of the simulation, so
// they are detected here and called once per tick.
//
// This runs in the scheduler, not in a request, so there is no session and no
// cookie: the account id comes from the player row and `track()` is called
// directly rather than through `trackServer()`.

import { db } from '@/lib/db';
import { EVENTS } from './events';
import { trackOnce } from './track';
import { ANALYTICS_CONFIG } from './config';

/** How many game days count as "the first week". */
export const FIRST_WEEK_DAYS = 7;

/**
 * Record the milestones a day's trading just produced.
 *
 * Both events are `trackOnce`, so this is safe to call every tick: the second
 * profitable day for a player writes nothing. That check is a query per
 * candidate, which is why the candidate list is narrowed to human owners who
 * actually traded rather than every player in the season.
 *
 * Never throws. A tick must not fail because analytics did.
 */
export async function recordTickMilestones(gameDay: number, seasonId: string): Promise<void> {
  if (!ANALYTICS_CONFIG.enabled) return;

  try {
    // ---- first_profit ----
    //
    // A profitable *day*, from the metric the tick just wrote. Not net worth:
    // a player who started with ৳500,000 and has lost money every day still has
    // a large balance, and counting that as "turned a profit" would put the
    // whole cohort past a step none of them reached.
    const profitable = await db.businessMetric.findMany({
      where: {
        gameDay,
        profit: { gt: 0 },
        business: { player: { isAI: false, userId: { not: null }, seasonId } },
      },
      select: { business: { select: { player: { select: { userId: true } } } } },
    });

    const profitableUserIds = new Set(
      profitable.map(m => m.business.player.userId).filter((id): id is string => Boolean(id)),
    );

    for (const userId of profitableUserIds) {
      await trackOnce(EVENTS.FIRST_PROFIT, { userId, seasonId }, { gameDay });
    }

    // ---- first_week_completed ----
    //
    // Seven days this player's shops actually *traded*, not seven days of the
    // season and not seven days on the wall clock. A player who joins on day 60
    // still has a first week, and one who was away for three of them has not
    // finished theirs yet — which is the honest reading, because the funnel step
    // means "saw a week of the game", not "held an account for a week".
    const traders = await db.player.findMany({
      where: { isAI: false, seasonId, userId: { not: null } },
      select: {
        userId: true,
        businesses: { select: { metrics: { select: { gameDay: true }, take: 400 } } },
      },
    });

    for (const player of traders) {
      if (!player.userId) continue;

      const daysTraded = new Set<number>();
      for (const business of player.businesses) {
        for (const metric of business.metrics) daysTraded.add(metric.gameDay);
      }
      if (daysTraded.size < FIRST_WEEK_DAYS) continue;

      await trackOnce(EVENTS.FIRST_WEEK_COMPLETED, { userId: player.userId, seasonId }, { gameDay });
    }
  } catch (error) {
    console.error('[analytics] Tick milestones failed:', error);
  }
}
