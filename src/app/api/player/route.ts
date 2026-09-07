import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlayerId, notFound, handleApiError } from '@/lib/errors';

export async function GET() {
  try {
    const playerId = await requirePlayerId();

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
      throw notFound('Player');
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
    return handleApiError(error);
  }
}
