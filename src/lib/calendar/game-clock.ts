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
// A game day is four real minutes, so the world's calendar runs about 360 times
// faster than ours and a 90-day season covers a quarter of a year. That is the
// point: seasons come out genuinely different from one another, which is what
// the season names — "Eid Rush", "Winter Market" — already promised before
// there was a calendar to back them.
//
// Note the mapping itself does not care about the wall clock: one game day is
// one calendar day whatever `GAME_TICK_INTERVAL_MS` says. Only how fast that
// calendar is experienced changes.
//
// The alternative, compressing a whole year into 90 days, was rejected: at four
// calendar days per game day a one-day holiday would be skipped over entirely
// about three times in four, and Eid landing or not would be a coin toss.

import { addDays, isCivilDate, type CivilDate } from './civil-date';

/**
 * The day the world begins: season 1, day 1.
 *
 * The calendar used to anchor on whenever a season happened to open in real
 * time, which meant the in-game date depended on the wall clock of whoever
 * bootstrapped the database — a fresh deployment and a developer's laptop
 * disagreed about what year it was, and a season re-created after a reset
 * jumped to a different part of the year.
 *
 * A fixed epoch makes the world's history the same everywhere. Overridable via
 * `GAME_EPOCH` so it can be moved without a code change; anything unparseable
 * falls back here rather than leaving the world dateless.
 */
export const DEFAULT_GAME_EPOCH: CivilDate = '2027-01-01';

export function gameEpoch(raw: string | undefined | null = process.env.GAME_EPOCH): CivilDate {
  const trimmed = raw?.trim();
  return trimmed && isCivilDate(trimmed) ? trimmed : DEFAULT_GAME_EPOCH;
}

/**
 * How many days of world history ran before a season's day 1.
 *
 * Seasons follow one another on a single continuous calendar rather than each
 * restarting at the epoch. That is the whole reason the calendar exists: a
 * season opening in February plays through Ramadan and Eid, one opening in June
 * through the monsoon and Durga Puja. Restarting every season at 1 January
 * would make all of them the same season wearing different names.
 */
export function daysBeforeSeason(seasonNumber: number, seasonLengthDays: number): number {
  const number = Math.max(1, Math.floor(seasonNumber || 1));
  const length = Math.max(1, Math.floor(seasonLengthDays || 1));
  return (number - 1) * length;
}

/**
 * The in-game date for a season day.
 *
 * `season` carries the number and length so the date lands on the continuous
 * calendar. Passing nothing treats it as season 1 — which is what an
 * un-bootstrapped world is.
 */
export function gameDayToCivilDate(
  season: { number?: number | null; lengthDays?: number | null } | null | undefined,
  gameDay: number,
  epoch: CivilDate = gameEpoch(),
): CivilDate {
  const offsetInSeason = Math.max(0, Math.floor(gameDay) - 1);
  const before = daysBeforeSeason(season?.number ?? 1, season?.lengthDays ?? 90);
  // Day 1 of season 1 is the epoch itself, not the day after it.
  return addDays(epoch, before + offsetInSeason);
}

/** How many game days until an in-game date arrives. Negative once it has passed. */
export function gameDaysUntil(
  season: { number?: number | null; lengthDays?: number | null } | null | undefined,
  currentGameDay: number,
  target: CivilDate,
  epoch: CivilDate = gameEpoch(),
): number {
  const today = gameDayToCivilDate(season, currentGameDay, epoch);
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${target}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
