// ============================================
// Bangladesh Business Tycoon - Clock speed persistence
// ============================================
//
// The one impure piece of the speed dial. Kept apart from `clock-speed.ts` so
// the scheduler test — which mocks the engine and must never touch a database
// — can mock this module and nothing else.
//
// The speed lives in `GameState`, the world-level key-value store, next to
// `lastTick` and the tick lock: it is a property of the world, not of any
// season or player, and it survives deploys.

import { db } from '@/lib/db';
import { DEFAULT_CLOCK_SPEED, parseClockSpeed, type ClockSpeed } from './clock-speed';

export const CLOCK_SPEED_KEY = 'clockSpeed';

/** The world's current speed. 1x when unset or unreadable. */
export async function readClockSpeed(): Promise<ClockSpeed> {
  try {
    const row = await db.gameState.findUnique({ where: { key: CLOCK_SPEED_KEY } });
    return parseClockSpeed(row?.value);
  } catch (error) {
    // A failed read must not stop the clock. The world runs at normal pace
    // until the next read succeeds.
    console.error('[clock] Could not read speed; running at 1x:', error);
    return DEFAULT_CLOCK_SPEED;
  }
}

/** Set the world's speed, for everyone. */
export async function writeClockSpeed(speed: ClockSpeed): Promise<void> {
  await db.gameState.upsert({
    where: { key: CLOCK_SPEED_KEY },
    create: { key: CLOCK_SPEED_KEY, value: String(speed) },
    update: { value: String(speed) },
  });
}

/** When the world last advanced, as the tick recorded it. */
export async function readLastTick(): Promise<string | null> {
  try {
    const row = await db.gameState.findUnique({ where: { key: 'lastTick' } });
    return row?.value ?? null;
  } catch (error) {
    console.error('[clock] Could not read lastTick:', error);
    return null;
  }
}
