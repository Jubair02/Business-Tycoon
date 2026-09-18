// ============================================
// Bangladesh Business Tycoon - Tick Schedule Config
// ============================================
//
// Pure configuration helpers for the server-side game clock. Kept free of any
// Node or Prisma imports so they can be unit tested, and so the middleware and
// the Edge runtime can read the same numbers if they ever need to.

/** How often the world advances when nothing overrides it. */
export const DEFAULT_TICK_INTERVAL_MS = 60_000;

/**
 * Floor on the configured interval. A tick walks every business in the game,
 * so letting it be set to "every 200ms" would simply pile ticks onto a lock
 * that is already held.
 */
export const MIN_TICK_INTERVAL_MS = 5_000;

/** Ceiling, mostly to catch a value pasted in seconds instead of milliseconds. */
export const MAX_TICK_INTERVAL_MS = 60 * 60 * 1000;

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
