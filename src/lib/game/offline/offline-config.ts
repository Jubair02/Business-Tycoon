// ============================================
// Bangladesh Business Tycoon - Offline Progression Config
// ============================================
//
// Pure configuration, free of Prisma and Node imports so it can be read from
// tests, the client and the Edge runtime alike.
//
// The grace window is expressed in *game days* and converted to real time from
// the clock speed, because that is the unit the harm is measured in. See
// `OFFLINE_GRACE_GAME_DAYS`.

import { resolveTickIntervalMs } from '../tick-schedule';

/**
 * How many **game days** a player's shops keep trading unattended.
 *
 * This is the number that actually matters, and it used to be written as eight
 * real hours. The harm it guards against is measured in game days — a chain
 * bankrupted by rent while nobody restocked it, or a fortune earned by an empty
 * chair — so pinning it to the wall clock meant the protection silently changed
 * meaning whenever the tick rate did. At the old 60-second tick, "eight hours"
 * was 480 game days: more than five entire seasons of unattended trading, which
 * is not a grace window, it is the whole game played by nobody.
 *
 * Twelve game days is about a week and a half of a shop's life: long enough
 * that a weekend away costs you nothing, short enough that returning matters.
 */
export const OFFLINE_GRACE_GAME_DAYS = 12;

/** The grace window in real time, for a given clock speed. */
export function graceMsFor(tickIntervalMs: number): number {
  return OFFLINE_GRACE_GAME_DAYS * tickIntervalMs;
}

export const OFFLINE_CONFIG = {
  /**
   * How long a player's shops keep trading after the player goes away.
   *
   * Derived from the clock rather than fixed, so it stays worth the same number
   * of game days whatever the tick interval is set to. At the default four
   * hours a game day that is two real days.
   */
  get graceMs(): number {
    return graceMsFor(resolveTickIntervalMs(process.env.GAME_TICK_INTERVAL_MS));
  },

  /**
   * A return is only worth reporting if enough happened. Below this many game
   * days the player has effectively not been away — a page reload or a short
   * tab switch should not raise a modal.
   */
  minAwayDaysToReport: 5,

  /**
   * How often the client tells the server it is still there. Comfortably under
   * the grace window, so a missed beat or two never strands a live player.
   */
  heartbeatMs: 60_000,
} as const;

/**
 * Whether a player counts as present for simulation purposes.
 *
 * AI competitors are always present: they are the world, not visitors to it.
 */
export function isWithinOfflineWindow(
  lastSeenAt: Date | string | null | undefined,
  now: Date = new Date(),
  graceMs: number = OFFLINE_CONFIG.graceMs,
): boolean {
  if (!lastSeenAt) return false;
  const seen = lastSeenAt instanceof Date ? lastSeenAt.getTime() : new Date(lastSeenAt).getTime();
  if (!Number.isFinite(seen)) return false;
  // A clock skew that puts lastSeenAt in the future should read as present,
  // not as absent for negative time.
  return now.getTime() - seen <= graceMs;
}
