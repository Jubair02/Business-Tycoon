import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

const LIQUIDATION_RATE = 0.7; // 70% of purchase price

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get('playerId')?.value;

    if (!playerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { inventoryId, quantity } = body;

    if (!inventoryId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'inventoryId and positive quantity are required' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(quantity)) {
      return NextResponse.json(
        { error: 'Quantity must be an integer' },
        { status: 400 }
      );
    }

    // Verify business ownership
    const business = await db.business.findUnique({
      where: { id },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (business.playerId !== playerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify inventory belongs to this business
    const inventory = await db.inventory.findUnique({
      where: { id: inventoryId },
    });

    if (!inventory) {
      return NextResponse.json({ error: 'Inventory not found' }, { status: 404 });
    }

    if (inventory.businessId !== id) {
      return NextResponse.json({ error: 'Inventory does not belong to this business' }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      // Re-read inventory inside transaction to prevent race conditions
      const currentInventory = await tx.inventory.findUnique({
        where: { id: inventoryId },
      });

      if (!currentInventory) {
        throw new Error('Inventory not found');
      }

      if (currentInventory.quantity < quantity) {
        throw new Error(`Not enough stock. Have ${currentInventory.quantity}, trying to sell ${quantity}`);
      }

      const sellPricePerUnit = Math.round(currentInventory.purchasePrice * LIQUIDATION_RATE);
      const totalReceived = sellPricePerUnit * quantity;

      // Credit player cash
      await tx.player.update({
        where: { id: playerId },
        data: { cash: { increment: totalReceived } },
      });

      // Update or remove inventory
      const newQuantity = currentInventory.quantity - quantity;
      let updatedInventory;

      if (newQuantity === 0) {
        await tx.inventory.delete({ where: { id: inventoryId } });
        updatedInventory = null;
      } else {
        updatedInventory = await tx.inventory.update({
          where: { id: inventoryId },
          data: { quantity: newQuantity },
        });
      }

      // Log the transaction
      await tx.gameLog.create({
        data: {
          playerId,
          businessId: id,
          type: 'SELL',
          message: `Sold ${quantity}x ${currentInventory.productName} at ৳${sellPricePerUnit.toLocaleString()}/unit (70% liquidation). Received ৳${totalReceived.toLocaleString()}.`,
          amount: totalReceived,
        },
      });

      // Fetch updated business data
      const updatedBusiness = await tx.business.findUnique({
        where: { id },
        include: {
          inventories: { orderBy: { createdAt: 'desc' } },
          employees: { orderBy: { hiredAt: 'asc' } },
        },
      });

      return {
        business: updatedBusiness,
        sale: {
          productName: currentInventory.productName,
          quantity,
          sellPricePerUnit,
          totalReceived,
        },
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Inventory not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.startsWith('Not enough stock')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    console.error('Sell inventory error:', error);
    return NextResponse.json(
      { error: 'Failed to sell inventory' },
      { status: 500 }
    );
  }
}
