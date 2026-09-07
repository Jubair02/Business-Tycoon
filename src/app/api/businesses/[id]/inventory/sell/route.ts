import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlayerId, notFound, forbidden, validationError, handleApiError, sellInventorySchema } from '@/lib/errors';

const LIQUIDATION_RATE = 0.7; // 70% of purchase price

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const playerId = await requirePlayerId();

    const { id } = await params;
    const body = sellInventorySchema.parse(await request.json());
    const { inventoryId, quantity } = body;

    // Verify business ownership
    const business = await db.business.findUnique({
      where: { id },
    });

    if (!business) {
      throw notFound('Business');
    }

    if (business.playerId !== playerId) {
      throw forbidden();
    }

    // Verify inventory belongs to this business
    const inventory = await db.inventory.findUnique({
      where: { id: inventoryId },
    });

    if (!inventory) {
      throw notFound('Inventory');
    }

    if (inventory.businessId !== id) {
      throw validationError('Inventory does not belong to this business');
    }

    const result = await db.$transaction(async (tx) => {
      // Re-read inventory inside transaction to prevent race conditions
      const currentInventory = await tx.inventory.findUnique({
        where: { id: inventoryId },
      });

      if (!currentInventory) {
        throw notFound('Inventory');
      }

      if (currentInventory.quantity < quantity) {
        throw validationError(`Not enough stock. Have ${currentInventory.quantity}, trying to sell ${quantity}`);
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
    return handleApiError(error);
  }
}
