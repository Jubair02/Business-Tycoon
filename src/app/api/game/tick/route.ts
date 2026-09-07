import { NextResponse } from 'next/server';
import { gameTick, acquireTickLock, releaseTickLock } from '@/lib/game-engine';
import { AppError, handleApiError, tickLocked } from '@/lib/errors';

export async function POST() {
  let lockAcquired = false;

  try {
    // Attempt to acquire the tick lock atomically.
    // This prevents concurrent ticks from corrupting game state.
    lockAcquired = await acquireTickLock();

    if (!lockAcquired) {
      throw tickLocked();
    }

    // Run the full game simulation
    await gameTick();

    return NextResponse.json({ success: true });
  } catch (error) {
    // If it's our AppError (e.g., tickLocked), use the structured handler
    if (error instanceof AppError) {
      return NextResponse.json(error.toResponse(), { status: error.statusCode });
    }

    // Log unexpected errors with full detail
    console.error('[API /game/tick] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to execute game tick' } },
      { status: 500 }
    );
  } finally {
    // ALWAYS release the lock, even on failure
    if (lockAcquired) {
      await releaseTickLock();
    }
  }
}
