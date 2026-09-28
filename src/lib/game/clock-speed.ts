// ============================================
// Bangladesh Business Tycoon - World clock speed
// ============================================
//
// How fast the shared world runs: 1x, 2x, 4x or 8x the base tick interval.
//
// ---- One world, one speed ----
//
// This is a *world* dial, not a player one. One tick advances the day for every
// player and every AI competitor, so there is no such thing as one player's
// clock running faster than another's — the game removed a "Next Day" button
// for exactly that reason, and this does not bring it back. Whoever holds the
// operator secret sets the pace for everyone.
//
// ---- How the two clocks share it ----
//
// The in-process scheduler and a hosted cron both ask the same question of the
// same function: *has enough real time passed since the world last advanced?*
//
//   effective interval = base interval / speed
//   tick is due        = now - lastTick >= effective interval
//
// The scheduler re-reads the speed after every tick, so a change takes effect
// on the next cycle. A cron fires at the *fastest* cadence the dial allows —
// every 30 minutes for a 4-hour day at 8x — and at slower speeds most of those
// firings are correct no-ops. Either way the world moves at the chosen pace and
// nothing needs redeploying to change it.
//
// Pure: no Prisma, no clock of its own.

export const CLOCK_SPEEDS = [1, 2, 4, 8] as const;
export type ClockSpeed = (typeof CLOCK_SPEEDS)[number];

export const DEFAULT_CLOCK_SPEED: ClockSpeed = 1;

export function isClockSpeed(value: unknown): value is ClockSpeed {
  return typeof value === 'number' && (CLOCK_SPEEDS as readonly number[]).includes(value);
}

/**
 * Narrow an untrusted value — a stored string, a request body — to a speed.
 *
 * Anything unrecognised is 1x rather than an error: a corrupt row in
 * `GameState` should leave the world running at normal pace, not frozen.
 */
export function parseClockSpeed(raw: unknown): ClockSpeed {
  const value = typeof raw === 'string' ? Number(raw) : raw;
  return isClockSpeed(value) ? value : DEFAULT_CLOCK_SPEED;
}

/** How long a game day takes at this speed. */
export function effectiveIntervalMs(baseIntervalMs: number, speed: ClockSpeed): number {
  return Math.max(1, Math.round(baseIntervalMs / speed));
}

/**
 * Whether the world is owed a tick.
 *
 * A world that has never ticked is always due — otherwise a fresh deployment
 * would wait a full interval before its first day, with nothing to count down
 * from.
 */
export function isTickDue(params: {
  lastTickISO: string | null;
  now: Date;
  baseIntervalMs: number;
  speed: ClockSpeed;
}): boolean {
  if (!params.lastTickISO) return true;

  const last = new Date(params.lastTickISO).getTime();
  if (!Number.isFinite(last)) return true;

  // A small tolerance, because a cron that fires "every 30 minutes" lands a
  // few seconds either side of the mark. Without it a firing 2s early would
  // be skipped and the world would wait a whole extra interval.
  const tolerance = Math.min(60_000, effectiveIntervalMs(params.baseIntervalMs, params.speed) * 0.05);

  return params.now.getTime() - last >= effectiveIntervalMs(params.baseIntervalMs, params.speed) - tolerance;
}

/**
 * When the next day arrives, at the current speed.
 *
 * `null` only when the world has never ticked. Deliberately not conditional on
 * which process drives the clock: a hosted cron advances the world just as the
 * in-process loop does, and telling players "clock paused" while it does so
 * was a real bug on Vercel.
 */
export function nextTickAtSpeed(params: {
  lastTickISO: string | null;
  baseIntervalMs: number;
  speed: ClockSpeed;
}): string | null {
  if (!params.lastTickISO) return null;
  const last = new Date(params.lastTickISO).getTime();
  if (!Number.isFinite(last)) return null;
  return new Date(last + effectiveIntervalMs(params.baseIntervalMs, params.speed)).toISOString();
}

/**
 * Whether the world should be considered running.
 *
 * Running means *something* will advance it: the in-process scheduler here, or
 * an external cron that has ticked it recently enough to be trusted. A world
 * whose last tick is more than two effective intervals old has stalled — the
 * cron has stopped reaching it — and the UI should say so rather than count
 * down to a day that is not coming.
 */
export function clockIsRunning(params: {
  schedulerEnabledHere: boolean;
  lastTickISO: string | null;
  now: Date;
  baseIntervalMs: number;
  speed: ClockSpeed;
}): boolean {
  if (params.schedulerEnabledHere) return true;
  if (!params.lastTickISO) return false;

  const last = new Date(params.lastTickISO).getTime();
  if (!Number.isFinite(last)) return false;

  const staleAfter = effectiveIntervalMs(params.baseIntervalMs, params.speed) * 2;
  return params.now.getTime() - last < staleAfter;
}

/**
 * The cron cadence that keeps up with the fastest speed.
 *
 * Exported so the deploy docs and the test that pins `vercel.json` derive the
 * schedule from the same numbers as the code, rather than from a comment.
 */
export function fastestIntervalMs(baseIntervalMs: number): number {
  return effectiveIntervalMs(baseIntervalMs, CLOCK_SPEEDS[CLOCK_SPEEDS.length - 1]);
}
