import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlayerId, notFound, forbidden, handleApiError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const playerId = await requirePlayerId();

    const { id } = await params;

    const business = await db.business.findUnique({ where: { id } });
    if (!business) {
      throw notFound('Business');
    }

    if (business.playerId !== playerId) {
      throw forbidden();
    }

    const logs = await db.gameLog.findMany({
      where: { businessId: id },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    return NextResponse.json(logs);
  } catch (error) {
    return handleApiError(error);
  }
}
