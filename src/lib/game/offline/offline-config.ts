// ============================================
// Bangladesh Business Tycoon - Offline Progression Config
// ============================================
//
// Pure configuration, free of Prisma and Node imports so it can be read from
// tests, the client and the Edge runtime alike.

export const OFFLINE_CONFIG = {
  /**
   * How long a player's shops keep trading after the player goes away.
   *
   * The world runs on a server clock at roughly a game day per minute, so a
   * player who closes the tab overnight would otherwise come back to hundreds
   * of unattended days — either a fortune earned by an empty chair, or a chain
   * of shops bankrupted by rent while nobody was restocking them. Neither is a
   * game. Eight hours of catch-up is generous enough to cover a night's sleep
   * or a working day, and bounded enough that returning still matters.
   */
  graceMs: 8 * 60 * 60 * 1000,

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
