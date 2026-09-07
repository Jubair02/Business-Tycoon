import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlayerId, notFound, forbidden, validationError, handleApiError, updatePriceSchema } from '@/lib/errors';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invId: string }> }
) {
  try {
    const playerId = await requirePlayerId();

    const { id, invId } = await params;
    const body = updatePriceSchema.parse(await request.json());
    const { sellPrice } = body;

    // Validate business ownership
    const business = await db.business.findUnique({
      where: { id },
    });

    if (!business) {
      throw notFound('Business');
    }

    if (business.playerId !== playerId) {
      throw forbidden();
    }

    // Validate inventory belongs to this business
    const inventory = await db.inventory.findUnique({
      where: { id: invId },
    });

    if (!inventory) {
      throw notFound('Inventory');
    }

    if (inventory.businessId !== id) {
      throw validationError('Inventory does not belong to this business');
    }

    const updated = await db.inventory.update({
      where: { id: invId },
      data: { sellPrice },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
