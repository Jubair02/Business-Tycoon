// ============================================
// Bangladesh Business Tycoon - Day clock persistence
// ============================================
//
// Where the authoritative clock anchor lives. Kept apart from `day-clock.ts` so
// the arithmetic stays pure and testable, and so the scheduler test can mock
// this module alone.
//
// The anchor sits in `GameState`, the world-level key-value store, beside the
// speed and the tick lock: it is a property of the world, not of any season or
// player, and it survives deploys, restarts and season rollovers.

import { db } from '@/lib/db';
import {
  GAME_DAY_MS,
  initialAnchor,
  isValidAnchor,
  rebaseAnchor,
  type ClockAnchor,
} from './day-clock';

export const ANCHOR_AT_KEY = 'clockAnchorAt';
export const ANCHOR_DAY_KEY = 'clockAnchorDay';

/** The stored anchor, or null when the world has never been anchored. */
export async function readAnchor(): Promise<ClockAnchor | null> {
  try {
    const rows = await db.gameState.findMany({
      where: { key: { in: [ANCHOR_AT_KEY, ANCHOR_DAY_KEY] } },
      select: { key: true, value: true },
    });

    const at = rows.find(r => r.key === ANCHOR_AT_KEY)?.value;
    const day = rows.find(r => r.key === ANCHOR_DAY_KEY)?.value;
    if (!at || day === undefined) return null;

    const anchor: ClockAnchor = {
      anchorAtMs: new Date(at).getTime(),
      anchorDay: Number(day),
    };
    return isValidAnchor(anchor) ? anchor : null;
  } catch (error) {
    // A failed read must not invent an anchor: writing one would move the
    // world's whole history. Callers treat null as "cannot advance right now".
    console.error('[day-clock] Could not read the anchor:', error);
    return null;
  }
}

/**
 * Write an anchor, replacing whatever is there.
 *
 * Deliberately not exported for general use — moving the anchor moves every
 * day the world will ever compute. Only `ensureAnchor` (which will not
 * overwrite) and `rebaseAnchorForSpeedChange` (which preserves the day
 * reached) may call it.
 */
async function writeAnchor(anchor: ClockAnchor): Promise<void> {
  const at = new Date(anchor.anchorAtMs).toISOString();
  const day = String(Math.max(0, Math.floor(anchor.anchorDay)));

  await db.$transaction([
    db.gameState.upsert({
      where: { key: ANCHOR_AT_KEY },
      create: { key: ANCHOR_AT_KEY, value: at },
      update: { value: at },
    }),
    db.gameState.upsert({
      where: { key: ANCHOR_DAY_KEY },
      create: { key: ANCHOR_DAY_KEY, value: day },
      update: { value: day },
    }),
  ]);
}

/**
 * The world's anchor, creating one only if none exists.
 *
 * **This must never overwrite a stored anchor.** Doing so on every boot would
 * reset the clock on every deploy, which is the exact failure this whole
 * module exists to prevent — so the read comes first and the write is skipped
 * whenever anything usable comes back.
 *
 * `currentDay` is the day the simulation has already reached, used only when
 * seeding a world that has none.
 */
export async function ensureAnchor(currentDay: number, now: Date = new Date()): Promise<ClockAnchor> {
  const existing = await readAnchor();
  if (existing) return existing;

  const seeded = initialAnchor({ currentDay, nowMs: now.getTime() });
  await writeAnchor(seeded);
  console.info(
    `[day-clock] Anchored the world at day ${seeded.anchorDay}, ${new Date(seeded.anchorAtMs).toISOString()}.`,
  );
  return seeded;
}

/**
 * Re-pin the anchor so a speed change applies only from now on.
 *
 * Without this, switching to 8x would mean yesterday suddenly happened eight
 * days ago and the world would owe itself a week of simulation it had already
 * run.
 */
export async function rebaseAnchorForSpeedChange(params: {
  dayLengthMsBefore: number;
  now?: Date;
}): Promise<ClockAnchor | null> {
  const anchor = await readAnchor();
  if (!anchor) return null;

  const now = params.now ?? new Date();
  const rebased = rebaseAnchor({
    anchor,
    nowMs: now.getTime(),
    dayLengthMs: params.dayLengthMsBefore || GAME_DAY_MS,
  });

  await writeAnchor(rebased);
  return rebased;
}

/**
 * Move the anchor to a specific day, keeping the clock running from now.
 *
 * Used by the season rollover, where the world's day counter restarts: without
 * it the new season would inherit the old one's backlog and immediately owe
 * ninety days.
 */
export async function reanchorToDay(day: number, now: Date = new Date()): Promise<ClockAnchor> {
  const anchor = initialAnchor({ currentDay: day, nowMs: now.getTime() });
  await writeAnchor(anchor);
  return anchor;
}
