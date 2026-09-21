// ============================================
// Bangladesh Business Tycoon - Tick Schedule Config
// ============================================
//
// Pure configuration helpers for the server-side game clock. Kept free of any
// Node or Prisma imports so they can be unit tested, and so the middleware and
// the Edge runtime can read the same numbers if they ever need to.

/**
 * How often the world advances when nothing overrides it.
 *
 * Four hours a game day, which with a 90-day season makes a season **two
 * weeks** — the cadence every other system in the game already assumes. Push
 * notifications, the offline grace window, the "while you were away" report and
 * the PWA install prompt are all built for a game you check in on, not one you
 * sit and watch.
 *
 * It was 60 seconds, which is the right number for developing against and the
 * wrong one to ship: a season completed in **ninety minutes**, prestige capped
 * within a day of real time, the leaderboard reset before lunch, and eight
 * hours away meant 480 game days — more than five whole seasons — passed
 * without you. D1/D7/D30 retention cannot mean anything measured against a
 * content cycle that short.
 *
 * Override with `GAME_TICK_INTERVAL_MS` for local work; 60_000 is still the
 * comfortable number to develop against.
 *
 * Changing this changes more than the clock — see `season-coherence.test.ts`,
 * which checks that the offline grace, the season length and the payback band
 * still make sense together afterwards.
 */
export const DEFAULT_TICK_INTERVAL_MS = 4 * 60 * 60 * 1000;

/**
 * Floor on the configured interval. A tick walks every business in the game,
 * so letting it be set to "every 200ms" would simply pile ticks onto a lock
 * that is already held.
 */
export const MIN_TICK_INTERVAL_MS = 5_000;

/**
 * Ceiling. A game day should never be longer than a real one.
 *
 * Was an hour, which silently clamped anything slower — and the default is now
 * four hours, so that ceiling would have capped the game at a quarter of its
 * intended pace without saying so.
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
