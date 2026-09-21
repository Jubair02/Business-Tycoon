// ============================================
// Bulk pre-orders
// POST /api/businesses/[id]/storage/orders
// ============================================
//
// Charged in full on placement, and the space is reserved from the same moment.
// So a delivery months later cannot fail for want of cash, and three orders
// that each fit cannot be placed if together they do not.

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePlayerId, validationError, handleApiError } from '@/lib/errors';
import { getCurrentGameDay } from '@/lib/game/seasons/seasons';
import { placePreOrder } from '@/lib/game/storage/storage-service';
import { STORAGE_CONFIG } from '@/lib/game/storage/storage-config';
import { SUPPLIER_IDS, PAYMENT_TERM_IDS } from '@/lib/game/supply/suppliers';

const orderSchema = z.object({
  productName: z.string().min(1).max(100),
  category: z.string().min(1).max(60),
  quantity: z.number().int().min(STORAGE_CONFIG.minOrderQuantity).max(100_000),
  /** Season game day the goods should arrive on. */
  deliveryDay: z.number().int().min(0).max(100_000),
  /** Who fills it. Defaults to the local wholesaler. */
  supplier: z.enum(SUPPLIER_IDS as unknown as [string, ...string[]]).optional(),
  /** Cash on order, or goods now and payment later. */
  term: z.enum(PAYMENT_TERM_IDS as unknown as [string, ...string[]]).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const playerId = await requirePlayerId();
    const { id } = await params;
    const body = orderSchema.parse(await request.json());

    const result = await placePreOrder({
      businessId: id,
      playerId,
      gameDay: await getCurrentGameDay(),
      request: body as never,
    });

    if (!result.ok) throw validationError(result.message ?? 'Could not place that order.');

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
