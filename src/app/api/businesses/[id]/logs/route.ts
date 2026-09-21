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

    // Fifteen is the right number for the panel and the wrong one for anything
    // looking for a particular kind of entry: a tick writes a trading line
    // every day, so a spoilage or delivery note is out of reach within a
    // fortnight. Both are now reachable, bounded.
    const url = new URL(request.url);
    const requested = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(requested)
      ? Math.min(200, Math.max(1, Math.floor(requested)))
      : 15;

    const type = url.searchParams.get('type');

    const logs = await db.gameLog.findMany({
      where: { businessId: id, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json(logs);
  } catch (error) {
    return handleApiError(error);
  }
}
