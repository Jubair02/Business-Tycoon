// ============================================
// Bangladesh Business Tycoon - The authoritative day clock
// ============================================
//
// **One game day is four real minutes.** That is the only place that number
// lives; everything else derives from it.
//
// ---- Why the day is derived, not counted ----
//
// The world used to advance by *counting ticks*: a loop called `gameTick()`,
// which incremented `Season.gameDay` by one. The day was therefore a tally of
// how many times a timer had fired, and any gap in that firing lost time for
// good — a server restart, a deploy, a serverless host with no long-lived
// process, or a cron that only fires every 30 minutes. A world that should
// have been on day 400 sat on day 12, and no amount of waiting caught it up.
//
// The day is now a pure function of wall-clock time:
//
//     day = anchorDay + floor((now - anchorAt) / dayLength)
//
// Nothing needs to have been running for that to be right. A process that has
// been asleep for twenty minutes wakes up knowing five days are owed, and the
// same arithmetic gives the same answer in every tab, on every instance, and
// after every restart.
//
// ---- What the timers are still for ----
//
// Advancing the day and *simulating* it are now different jobs. The clock says
// which day it is; the scheduler's job is to run the simulation for any day the
// clock has reached but the simulation has not. A timer that stops therefore
// delays the catch-up, it does not lose the days.
//
// ---- The anchor, and why it is not just the season start ----
//
// The speed dial (1x-8x) changes how long a day lasts. Deriving from the season
// start alone would mean changing the speed retroactively rewrote history —
// switch to 8x and yesterday suddenly happened eight days ago. So the anchor is
// rebased whenever the speed changes: the day reached so far is frozen into
// `anchorDay`, and the new rate applies only from `anchorAt` onward.
//
// Pure: no Prisma, no Date.now() of its own, no environment. Every input is
// passed in, so the whole clock is testable without a database or a real clock.

/**
 * How long one game day lasts in real milliseconds, at 1x speed.
 *
 * **Four minutes.** The single source of truth for game time — every other
 * duration in the game is expressed in game days and resolved through this.
 */
export const GAME_DAY_MS = 4 * 60 * 1000;

/**
 * Where the clock is pinned.
 *
 * `anchorDay` was the world's day at `anchorAtMs`; time since then is divided
 * by the current day length. Rebasing on a speed change is what keeps the
 * change from reaching backwards into days already played.
 */
export interface ClockAnchor {
  anchorAtMs: number;
  anchorDay: number;
}

/** A sane anchor, or null if the stored one is unusable. */
export function isValidAnchor(anchor: ClockAnchor | null | undefined): anchor is ClockAnchor {
  return Boolean(
    anchor &&
      Number.isFinite(anchor.anchorAtMs) &&
      Number.isFinite(anchor.anchorDay) &&
      anchor.anchorDay >= 0,
  );
}

function safeDayLength(dayLengthMs: number): number {
  return Number.isFinite(dayLengthMs) && dayLengthMs > 0 ? dayLengthMs : GAME_DAY_MS;
}

/**
 * How many whole days have elapsed since the anchor.
 *
 * Never negative. A clock that has gone backwards — a corrected server clock, a
 * laptop waking with a stale time — must not rewind the world, so the floor is
 * the anchor day itself.
 */
export function daysSinceAnchor(params: {
  anchor: ClockAnchor;
  nowMs: number;
  dayLengthMs: number;
}): number {
  const dayLength = safeDayLength(params.dayLengthMs);
  const elapsed = params.nowMs - params.anchor.anchorAtMs;
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
  return Math.floor(elapsed / dayLength);
}

/**
 * The day the world is on *right now*, whether or not anything has simulated it.
 *
 * This is the authoritative answer to "what day is it". It is what every tab,
 * every instance and every restart agrees on, because it is arithmetic on a
 * stored timestamp rather than a count of events that may not have happened.
 */
export function derivedGameDay(params: {
  anchor: ClockAnchor;
  nowMs: number;
  dayLengthMs: number;
}): number {
  return params.anchor.anchorDay + daysSinceAnchor(params);
}

/**
 * When the next day begins, as a timestamp.
 *
 * What the UI counts down to. Derived from the anchor rather than from the last
 * tick, so a late or missed simulation does not drag the countdown with it.
 */
export function nextDayBoundaryMs(params: {
  anchor: ClockAnchor;
  nowMs: number;
  dayLengthMs: number;
}): number {
  const dayLength = safeDayLength(params.dayLengthMs);
  const completed = daysSinceAnchor(params);
  return params.anchor.anchorAtMs + (completed + 1) * dayLength;
}

/** Milliseconds until the next day. Never negative. */
export function msUntilNextDay(params: {
  anchor: ClockAnchor;
  nowMs: number;
  dayLengthMs: number;
}): number {
  return Math.max(0, nextDayBoundaryMs(params) - params.nowMs);
}

/**
 * How many days the simulation still owes the clock.
 *
 * `processedDay` is how far the simulation has actually run — `Season.gameDay`.
 * The difference is the backlog: the days that passed while nothing was
 * running. Capped so one catch-up cannot try to simulate a month in a single
 * request; the remainder is picked up by the next run.
 *
 * Negative differences return 0. A processed day ahead of the clock means the
 * anchor was moved backwards, and replaying days already simulated would double
 * every shop's rent.
 */
export function daysOwed(params: {
  anchor: ClockAnchor;
  processedDay: number;
  nowMs: number;
  dayLengthMs: number;
  maxPerRun?: number;
}): number {
  const target = derivedGameDay(params);
  const behind = target - params.processedDay;
  if (!Number.isFinite(behind) || behind <= 0) return 0;
  const cap = params.maxPerRun ?? MAX_CATCH_UP_DAYS;
  return Math.min(behind, Math.max(1, cap));
}

/**
 * Most days one catch-up run will simulate.
 *
 * A full day walks every business, every AI and every loan, so an unbounded
 * backlog would turn a single request into an hours-long job that times out and
 * makes no progress at all. Twelve days is roughly the offline grace window, and
 * whatever is left is simply taken by the next run a moment later.
 */
export const MAX_CATCH_UP_DAYS = 12;

/**
 * Move the anchor so a rate change applies only from now on.
 *
 * Called when the speed dial moves. The day reached under the old rate is
 * frozen into the new anchor; the partial day in progress is not carried over,
 * which costs at most one day's fraction and keeps the arithmetic honest in
 * both directions.
 */
export function rebaseAnchor(params: {
  anchor: ClockAnchor;
  nowMs: number;
  dayLengthMs: number;
}): ClockAnchor {
  return {
    anchorDay: derivedGameDay(params),
    anchorAtMs: params.nowMs,
  };
}

/**
 * The anchor a world should start from, when none is stored yet.
 *
 * Pinned to *now* at the day already reached, not to when the season opened.
 * Anchoring at the season start would declare every day it has already
 * simulated to be owed again, and an existing database would replay its whole
 * history — every rent charge, every loan payment — the moment it upgraded.
 *
 * So the backlog starts empty and the next day arrives one full day from now.
 */
export function initialAnchor(params: { currentDay: number; nowMs: number }): ClockAnchor {
  return {
    anchorDay: Number.isFinite(params.currentDay) ? Math.max(0, Math.floor(params.currentDay)) : 0,
    anchorAtMs: params.nowMs,
  };
}
