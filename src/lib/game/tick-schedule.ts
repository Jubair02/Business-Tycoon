// ============================================
// Bangladesh Business Tycoon - Tick Schedule Config
// ============================================
//
// Pure configuration helpers for the server-side game clock. Kept free of any
// Node or Prisma imports so they can be unit tested, and so the middleware and
// the Edge runtime can read the same numbers if they ever need to.

import { GAME_DAY_MS } from './day-clock';

/**
 * How often the world advances when nothing overrides it.
 *
 * An alias for {@link GAME_DAY_MS}, which is the one place the number lives —
 * this module resolves the *configured* day length, `day-clock` defines the
 * default. They must never be two numbers.
 *
 * **Four minutes a game day** — a game you sit and watch, not one you check in
 * on. A 90-day season runs in about six hours of wall-clock time, and a whole
 * shop pays itself back inside a couple of hours.
 *
 * This is a deliberate reversal, so the trade is worth writing down. It was
 * four hours a day, chosen so that a season lasted a fortnight and D1/D7/D30
 * retention had a content cycle to measure against. At four minutes:
 *
 *   - a season is ~6 hours, so `returned_next_season` fires several times a day
 *     and stops being a retention signal;
 *   - the offline grace is 12 game days = ~48 minutes of real time, so a player
 *     who steps away for lunch comes back to shuttered shops;
 *   - a hosted cron cannot drive the world above 4x, because Vercel's smallest
 *     schedule is one minute and 8x needs a firing every 30 seconds. The
 *     in-process scheduler has no such limit.
 *
 * Those are consequences of the pace, not bugs in it. `season-coherence.test.ts`
 * pins them so they stay chosen rather than discovered.
 *
 * Override with `GAME_TICK_INTERVAL_MS` per deployment.
 */
export const DEFAULT_TICK_INTERVAL_MS = GAME_DAY_MS;

/**
 * Floor on the configured interval. A tick walks every business in the game,
 * so letting it be set to "every 200ms" would simply pile ticks onto a lock
 * that is already held.
 */
export const MIN_TICK_INTERVAL_MS = 5_000;

/**
 * Ceiling. A game day should never be longer than a real one.
 *
 * Was an hour, which silently clamped anything slower without saying so. The
 * shipped day is four minutes; this exists only so a deployment that wants a
 * slower world can have one without the value being quietly ignored.
 */
export const MAX_TICK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Resolve the tick interval from its environment value.
 * Anything unparseable falls back to the default rather than disabling the
 * clock — a typo in an env var should not silently freeze the game.
 */
export function resolveTickIntervalMs(raw: string | undefined | null): number {
  if (raw === undefined || raw === null || raw.trim() === '') {
    return DEFAULT_TICK_INTERVAL_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TICK_INTERVAL_MS;

  return Math.min(MAX_TICK_INTERVAL_MS, Math.max(MIN_TICK_INTERVAL_MS, Math.round(parsed)));
}

/**
 * Whether this process should run the in-process game clock.
 *
 * Defaults to on: the game is unplayable without a clock, and the tick lock
 * makes it safe for more than one process to have it enabled. Set
 * `GAME_TICK_SCHEDULER=off` when an external cron drives `/api/game/tick`
 * instead, or on a process that should never advance the world.
 */
export function isSchedulerEnabled(raw: string | undefined | null): boolean {
  if (raw === undefined || raw === null || raw.trim() === '') return true;
  const normalised = raw.trim().toLowerCase();
  return !(normalised === 'off' || normalised === 'false' || normalised === '0');
}

/**
 * When the next tick is due, given when the last one ran.
 * Returns `null` if the world has never ticked, so callers can say "any moment
 * now" rather than rendering a countdown from an invented timestamp.
 */
export function nextTickAt(lastTickISO: string | null, intervalMs: number): string | null {
  if (!lastTickISO) return null;
  const last = new Date(lastTickISO).getTime();
  if (!Number.isFinite(last)) return null;
  return new Date(last + intervalMs).toISOString();
}
