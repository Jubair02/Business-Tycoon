import { NextResponse } from 'next/server';
import { seedInitialData, seedAIPlayers } from '@/lib/game-engine';

export async function POST() {
  try {
    await seedInitialData();
    await seedAIPlayers();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Game init error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize game' },
      { status: 500 }
    );
  }
}
