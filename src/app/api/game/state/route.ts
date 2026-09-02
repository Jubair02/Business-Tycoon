import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const states = await db.gameState.findMany();
    const stateMap: Record<string, string> = {};
    for (const s of states) {
      stateMap[s.key] = s.value;
    }

    return NextResponse.json({
      gameDay: parseInt(stateMap['gameDay'] || '1', 10),
      tickCount: parseInt(stateMap['tickCount'] || '0', 10),
      lastTick: stateMap['lastTick'] || null,
    });
  } catch (error) {
    console.error('Get game state error:', error);
    return NextResponse.json(
      { error: 'Failed to get game state' },
      { status: 500 }
    );
  }
}
