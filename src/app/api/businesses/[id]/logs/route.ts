import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const playerId = cookieStore.get('playerId')?.value;

    if (!playerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const business = await db.business.findUnique({ where: { id } });
    if (!business || business.playerId !== playerId) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const logs = await db.gameLog.findMany({
      where: { businessId: id },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Get logs error:', error);
    return NextResponse.json({ error: 'Failed to get logs' }, { status: 500 });
  }
}
