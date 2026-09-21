// ============================================
// Settle a supplier bill
// POST /api/player/credit/[creditId]
// ============================================
//
// Paying early clears it at face value; paying late clears it at face value
// plus whatever the late fees have added since it fell due.

import { NextResponse, type NextRequest } from 'next/server';
import { requirePlayerId, validationError, handleApiError } from '@/lib/errors';
import { getCurrentGameDay } from '@/lib/game/seasons/seasons';
import { paySupplierCredit } from '@/lib/game/supply/supply-service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ creditId: string }> },
) {
  try {
    const playerId = await requirePlayerId();
    const { creditId } = await params;

    const result = await paySupplierCredit({
      creditId,
      playerId,
      gameDay: await getCurrentGameDay(),
    });

    if (!result.ok) throw validationError(result.message ?? 'Could not settle that bill.');

    return NextResponse.json({ success: true, paid: result.paid });
  } catch (error) {
    return handleApiError(error);
  }
}
