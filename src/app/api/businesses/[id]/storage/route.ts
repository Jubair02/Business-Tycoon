// ============================================
// Storage for one shop
// GET /api/businesses/[id]/storage
// ============================================
//
// Capacity, rentals, orders on the way, and what the rental market is asking.
// Also serves a live quote when `product` and `quantity` are supplied, so the
// order form can price itself as the player drags the slider without placing
// anything.

import { NextResponse, type NextRequest } from 'next/server';
import { requirePlayerId, notFound, forbidden, handleApiError } from '@/lib/errors';
import { db } from '@/lib/db';
import { getCurrentGameDay } from '@/lib/game/seasons/seasons';
import { getStorageState, quoteOrder } from '@/lib/game/storage/storage-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const playerId = await requirePlayerId();
    const { id } = await params;

    const business = await db.business.findUnique({
      where: { id },
      select: { playerId: true },
    });
    if (!business) throw notFound('Business');
    if (business.playerId !== playerId) throw forbidden();

    const gameDay = await getCurrentGameDay();
    const state = await getStorageState(id, gameDay);
    if (!state) throw notFound('Business');

    // Optional live quote for the order form.
    const url = new URL(request.url);
    const productName = url.searchParams.get('product');
    const quantity = Number(url.searchParams.get('quantity'));
    const deliveryDay = Number(url.searchParams.get('deliveryDay'));

    const quote = productName && Number.isFinite(quantity) && Number.isFinite(deliveryDay)
      ? await quoteOrder({
          businessId: id,
          gameDay,
          request: {
            productName,
            category: url.searchParams.get('category') ?? '',
            quantity: Math.max(0, Math.floor(quantity)),
            deliveryDay: Math.floor(deliveryDay),
          },
        })
      : null;

    return NextResponse.json({ ...state, quote });
  } catch (error) {
    return handleApiError(error);
  }
}
