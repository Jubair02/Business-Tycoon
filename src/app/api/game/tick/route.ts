import { NextResponse } from 'next/server';
import { gameTick } from '@/lib/game-engine';

export async function POST() {
  try {
    await gameTick();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Game tick error:', error);
    return NextResponse.json(
      { error: 'Failed to execute game tick' },
      { status: 500 }
    );
  }
}
