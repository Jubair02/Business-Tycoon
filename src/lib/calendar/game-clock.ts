// ============================================
// Bangladesh Business Tycoon - The world's date
// ============================================
//
// Which day of the Bangladeshi year it is *inside the game*.
//
// ---- The mapping ----
//
// A season's day 1 is the real Dhaka date the season opened on, and every game
// day after that is the next calendar day. So a season that starts in February
// plays through Ramadan and Eid; one that starts in June plays through the
// monsoon and Durga Puja.
//
// A game day is a real minute, so the world's calendar runs about 1,440 times
// faster than ours and a 90-day season covers a quarter of a year. That is the
// point: seasons come out genuinely different from one another, which is what
// the season names — "Eid Rush", "Winter Market" — already promised before
// there was a calendar to back them.
//
// The alternative, compressing a whole year into 90 days, was rejected: at four
// calendar days per game day a one-day holiday would be skipped over entirely
// about three times in four, and Eid landing or not would be a coin toss.

import { addDays, toCivilDate, type CivilDate } from './civil-date';

/**
 * The in-game date for a season day.
 *
 * `seasonStartedAt` is when the season actually opened. A season that has not
 * started yet has no date of its own, so the real today stands in — better than
 * inventing an epoch and telling the player it is 1970.
 */
export function gameDayToCivilDate(
  seasonStartedAt: Date | null | undefined,
  gameDay: number,
  now: Date = new Date(),
): CivilDate {
  const anchor = seasonStartedAt ? toCivilDate(seasonStartedAt) : toCivilDate(now);
  // Day 1 is the anchor itself, not the day after it.
  const offset = Math.max(0, Math.floor(gameDay) - 1);
  return addDays(anchor, offset);
}

/** How many game days until an in-game date arrives. Negative once it has passed. */
export function gameDaysUntil(
  seasonStartedAt: Date | null | undefined,
  currentGameDay: number,
  target: CivilDate,
  now: Date = new Date(),
): number {
  const today = gameDayToCivilDate(seasonStartedAt, currentGameDay, now);
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${target}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
