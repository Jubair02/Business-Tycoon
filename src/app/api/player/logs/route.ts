import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get('playerId')?.value;

    if (!playerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const logs = await db.gameLog.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Get player logs error:', error);
    return NextResponse.json({ error: 'Failed to get logs' }, { status: 500 });
  }
}
