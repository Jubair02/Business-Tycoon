import { NextResponse } from 'next/server';
import { seedInitialData, seedAIPlayers } from '@/lib/game-engine';
import { handleApiError } from '@/lib/errors';

export async function POST() {
  try {
    await seedInitialData();
    await seedAIPlayers();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
