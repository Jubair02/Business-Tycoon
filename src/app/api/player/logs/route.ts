import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlayerId, handleApiError } from '@/lib/errors';

export async function GET() {
  try {
    const playerId = await requirePlayerId();

    const logs = await db.gameLog.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return NextResponse.json(logs);
  } catch (error) {
    return handleApiError(error);
  }
}
