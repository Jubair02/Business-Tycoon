// ============================================
// Bangladesh Business Tycoon - Offline Progression
// ============================================
//
// The game clock lives on the server (`lib/game/scheduler.ts`), so the world
// advances whether or not anyone is watching it. That is what players expect —
// "the world should advance while you're away" — but left unbounded it means a
// player who closes the tab on Friday returns on Monday to four thousand
// unattended game days.
//
// So: shops keep trading for `OFFLINE_CONFIG.graceMs` after their owner goes
// away, and then go dormant until the owner comes back. Dormant shops earn
// nothing and are charged nothing — they are shuttered, not bankrupt. This
// module owns that rule and the "while you were away" report shown on return.

import { db } from '@/lib/db';
import { getCurrentGameDay } from '../seasons/seasons';
import { notifyShopsDormant } from '@/lib/push/notifications';
import { OFFLINE_CONFIG, isWithinOfflineWindow } from './offline-config';

export { OFFLINE_CONFIG, isWithinOfflineWindow };

/** One shop's line in the return report. */
export interface OfflineBusinessSummary {
  id: string;
  name: string;
  type: string;
  daysTraded: number;
  revenue: number;
  profit: number;
  /** Days the shop was shuttered because the owner was past the grace window. */
  daysDormant: number;
  /** True if it ended the stretch with empty shelves. */
  outOfStock: boolean;
}

export interface OfflineSummary {
  /** Game days that passed while the player was away. */
  daysAway: number;
  /** Of those, how many their shops actually traded through. */
  daysTraded: number;
  /** Of those, how many their shops sat shuttered. */
  daysDormant: number;
  revenue: number;
  profit: number;
  businesses: OfflineBusinessSummary[];
  /** True when the absence ran past the grace window. */
  hitCap: boolean;
}

/**
 * Fold per-day business metrics into the report shown on return.
 *
 * Pure, so the shape of the report can be tested without a database.
 */
export function summariseOfflineProgress(params: {
  fromGameDay: number;
  toGameDay: number;
  businesses: {
    id: string;
    name: string;
    type: string;
    dormantSinceDay: number | null;
    totalStock: number;
    metrics: { gameDay: number; revenue: number; profit: number }[];
  }[];
}): OfflineSummary {
  const { fromGameDay, toGameDay, businesses } = params;
  const daysAway = Math.max(0, toGameDay - fromGameDay);

  const lines: OfflineBusinessSummary[] = businesses.map(biz => {
    // Only the days inside the absence count; the metrics table holds more.
    const window = biz.metrics.filter(m => m.gameDay > fromGameDay && m.gameDay <= toGameDay);
    const daysTraded = window.length;
    return {
      id: biz.id,
      name: biz.name,
      type: biz.type,
      daysTraded,
      revenue: Math.round(window.reduce((sum, m) => sum + m.revenue, 0)),
      profit: Math.round(window.reduce((sum, m) => sum + m.profit, 0)),
      daysDormant: Math.max(0, daysAway - daysTraded),
      outOfStock: biz.totalStock <= 0,
    };
  });

  // A shop that traded every day it could sets the headline; shops opened
  // mid-absence should not make the whole stretch look dormant.
  const daysTraded = lines.length > 0 ? Math.max(...lines.map(l => l.daysTraded)) : 0;

  return {
    daysAway,
    daysTraded: Math.min(daysTraded, daysAway),
    daysDormant: Math.max(0, daysAway - daysTraded),
    revenue: lines.reduce((sum, l) => sum + l.revenue, 0),
    profit: lines.reduce((sum, l) => sum + l.profit, 0),
    businesses: lines,
    hitCap: lines.some(l => l.daysDormant > 0),
  };
}

/**
 * Record that a player is present, and report what happened while they weren't.
 *
 * Called by the client heartbeat. Returns `null` for the ordinary case of a
 * player who has been here all along, so the caller can stay quiet.
 */
export async function recordPresence(playerId: string): Promise<OfflineSummary | null> {
  const currentGameDay = await getCurrentGameDay();

  const player = await db.player.findUnique({
    where: { id: playerId },
    select: { id: true, lastSeenGameDay: true },
  });
  if (!player) return null;

  const fromGameDay = player.lastSeenGameDay;
  const daysAway = currentGameDay - fromGameDay;

  // A first-ever visit has no "before" to report on.
  const worthReporting = fromGameDay > 0 && daysAway >= OFFLINE_CONFIG.minAwayDaysToReport;

  let summary: OfflineSummary | null = null;

  if (worthReporting) {
    const businesses = await db.business.findMany({
      where: { playerId },
      select: {
        id: true,
        name: true,
        type: true,
        dormantSinceDay: true,
        inventories: { select: { quantity: true } },
        metrics: {
          where: { gameDay: { gt: fromGameDay, lte: currentGameDay } },
          select: { gameDay: true, revenue: true, profit: true },
        },
      },
    });

    summary = summariseOfflineProgress({
      fromGameDay,
      toGameDay: currentGameDay,
      businesses: businesses.map(b => ({
        id: b.id,
        name: b.name,
        type: b.type,
        dormantSinceDay: b.dormantSinceDay,
        totalStock: b.inventories.reduce((sum, i) => sum + i.quantity, 0),
        metrics: b.metrics,
      })),
    });
  }

  // Waking the shops and stamping presence happen together: a player who is
  // back must not have their shops left shuttered for another tick.
  await db.$transaction([
    db.player.update({
      where: { id: playerId },
      data: { lastSeenAt: new Date(), lastSeenGameDay: currentGameDay },
    }),
    db.business.updateMany({
      where: { playerId, dormantSinceDay: { not: null } },
      data: { dormantSinceDay: null },
    }),
  ]);

  return summary;
}

/**
 * The businesses this tick should simulate.
 *
 * AI competitors always trade. A human's shops trade while the human is inside
 * the grace window, and are shuttered after it. Shops that have just been
 * shuttered get their daily figures zeroed once, so the dashboard shows a
 * closed shop rather than an indefinitely repeated last good day.
 */
export async function resolveTradingBusinesses(currentGameDay: number): Promise<string[]> {
  const now = new Date();

  const businesses = await db.business.findMany({
    select: {
      id: true,
      dormantSinceDay: true,
      player: { select: { isAI: true, lastSeenAt: true, userId: true } },
    },
  });

  const trading: string[] = [];
  const toShutter: string[] = [];
  /** Accounts whose shops are being shuttered right now, and how many. */
  const shutteredPerUser = new Map<string, number>();

  for (const biz of businesses) {
    const present = biz.player.isAI || isWithinOfflineWindow(biz.player.lastSeenAt, now);
    if (present) {
      trading.push(biz.id);
    } else if (biz.dormantSinceDay === null) {
      toShutter.push(biz.id);
      if (biz.player.userId) {
        shutteredPerUser.set(biz.player.userId, (shutteredPerUser.get(biz.player.userId) ?? 0) + 1);
      }
    }
  }

  if (toShutter.length > 0) {
    await db.business.updateMany({
      where: { id: { in: toShutter } },
      data: {
        dormantSinceDay: currentGameDay,
        dailyRevenue: 0,
        dailyExpense: 0,
        dailyProfit: 0,
        dailyCOGS: 0,
        dailyCustomers: 0,
      },
    });

    // Told once, at the moment they shutter — not every tick afterwards.
    for (const [userId, count] of shutteredPerUser) {
      void notifyShopsDormant(userId, count).catch(() => {
        // Never worth failing a tick for.
      });
    }
  }

  return trading;
}
