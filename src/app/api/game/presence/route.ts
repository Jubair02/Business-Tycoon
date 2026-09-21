// ============================================
// Player presence heartbeat
// POST /api/game/presence
// ============================================
//
// The world runs on a server clock, so the game needs to know who is actually
// at the table. This is that signal: the client beats on a timer and whenever
// the tab regains focus, which keeps the player's shops trading. Stop beating
// for longer than the offline grace window and the shops shutter until you come
// back — see `lib/game/offline/offline-progression.ts`.
//
// The first beat after an absence also returns the "while you were away"
// report, so the client does not need a second round trip for it.

import { NextResponse } from 'next/server';
import { requirePlayerId, handleApiError } from '@/lib/errors';
import { recordPresence, OFFLINE_CONFIG } from '@/lib/game/offline/offline-progression';
import { trackServer } from '@/lib/analytics/identity';
import { EVENTS } from '@/lib/analytics/events';

export async function POST() {
  try {
    const playerId = await requirePlayerId();
    const away = await recordPresence(playerId);

    if (away) {
      void trackServer(EVENTS.RETURNED_FROM_AWAY, { daysAway: away.daysAway, daysTraded: away.daysTraded });
    }

    return NextResponse.json({
      success: true,
      /** Null when the player has simply been here all along. */
      away,
      heartbeatMs: OFFLINE_CONFIG.heartbeatMs,
      graceMs: OFFLINE_CONFIG.graceMs,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
