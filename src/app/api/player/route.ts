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

    const player = await db.player.findUnique({
      where: { id: playerId },
      include: {
        _count: {
          select: {
            businesses: true,
          },
        },
        businesses: {
          include: {
            _count: {
              select: { employees: true },
            },
          },
        },
      },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const totalEmployees = player.businesses.reduce(
      (sum, b) => sum + b._count.employees,
      0
    );

    return NextResponse.json({
      ...player,
      businessCount: player._count.businesses,
      totalEmployees,
    });
  } catch (error) {
    console.error('Get player error:', error);
    return NextResponse.json(
      { error: 'Failed to get player data' },
      { status: 500 }
    );
  }
}
