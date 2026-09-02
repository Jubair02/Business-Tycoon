import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get('playerId')?.value;

    if (!playerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id, invId } = await params;
    const body = await request.json();
    const { sellPrice } = body;

    if (sellPrice === undefined || sellPrice === null || sellPrice < 0) {
      return NextResponse.json(
        { error: 'A valid non-negative sellPrice is required' },
        { status: 400 }
      );
    }

    // Validate business ownership
    const business = await db.business.findUnique({
      where: { id },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (business.playerId !== playerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Validate inventory belongs to this business
    const inventory = await db.inventory.findUnique({
      where: { id: invId },
    });

    if (!inventory) {
      return NextResponse.json({ error: 'Inventory not found' }, { status: 404 });
    }

    if (inventory.businessId !== id) {
      return NextResponse.json({ error: 'Inventory does not belong to this business' }, { status: 400 });
    }

    const updated = await db.inventory.update({
      where: { id: invId },
      data: { sellPrice },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update price error:', error);
    return NextResponse.json(
      { error: 'Failed to update sell price' },
      { status: 500 }
    );
  }
}
