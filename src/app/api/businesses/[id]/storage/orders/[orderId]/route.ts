// ============================================
// Cancel a pre-order
// DELETE /api/businesses/[id]/storage/orders/[orderId]
// ============================================

import { NextResponse, type NextRequest } from 'next/server';
import { requirePlayerId, validationError, handleApiError } from '@/lib/errors';
import { cancelPreOrder } from '@/lib/game/storage/storage-service';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> },
) {
  try {
    const playerId = await requirePlayerId();
    const { orderId } = await params;

    const result = await cancelPreOrder({ orderId, playerId });
    if (!result.ok) throw validationError(result.message ?? 'Could not cancel that order.');

    return NextResponse.json({ success: true, refund: result.refund, fee: result.fee });
  } catch (error) {
    return handleApiError(error);
  }
}
