import { NextRequest, NextResponse } from 'next/server';
import { seedInitialData, seedAIPlayers } from '@/lib/game-engine';
import { handleApiError } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * Seeds reference data (products, market prices, base game state) and the AI
 * competitors. Intentionally unauthenticated: the client calls it on first load,
 * before a player exists. Both seed steps are idempotent and short-circuit once
 * the data is present, so repeat calls are cheap.
 */
export async function POST(request: NextRequest) {
  try {
    enforceRateLimit(request, 'game-init', { limit: 20, windowMs: 60 * 1000 });

    await seedInitialData();
    await seedAIPlayers();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
