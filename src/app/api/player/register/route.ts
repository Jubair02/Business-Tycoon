import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { STARTING_CASH } from '@/lib/game-data';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 365,
  path: '/',
};

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const existingPlayerId = cookieStore.get('playerId')?.value;

    // If player already has a cookie, return that player
    if (existingPlayerId) {
      const existingPlayer = await db.player.findUnique({
        where: { id: existingPlayerId },
      });
      if (existingPlayer) {
        return NextResponse.json(existingPlayer);
      }
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Player name is required' },
        { status: 400 }
      );
    }

    if (name.trim().length > 50) {
      return NextResponse.json(
        { error: 'Player name must be 50 characters or less' },
        { status: 400 }
      );
    }

    const player = await db.player.create({
      data: {
        name: name.trim(),
        email: `${Date.now()}-${Math.random().toString(36).slice(2)}@game.local`,
        cash: STARTING_CASH,
        netWorth: STARTING_CASH,
      },
    });

    const response = NextResponse.json(player);
    response.cookies.set('playerId', player.id, COOKIE_OPTIONS);
    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Failed to register player' },
      { status: 500 }
    );
  }
}
