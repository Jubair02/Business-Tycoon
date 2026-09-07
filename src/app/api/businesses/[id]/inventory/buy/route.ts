import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getProductsForBusiness } from '@/lib/game-data';
import { requirePlayerId, notFound, forbidden, insufficientFunds, validationError, handleApiError, buyInventorySchema } from '@/lib/errors';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const playerId = await requirePlayerId();

    const { id } = await params;
    const body = buyInventorySchema.parse(await request.json());
    const { productId, productName, category, quantity } = body;

    const business = await db.business.findUnique({
      where: { id },
    });

    if (!business) {
      throw notFound('Business');
    }

    if (business.playerId !== playerId) {
      throw forbidden();
    }

    const marketPrice = await db.marketPrice.findUnique({
      where: { productName_city: { productName, city: business.city } },
    });

    const products = getProductsForBusiness(business.type);
    const productDef = products.find((p) => p.name === productName);
    if (!productDef) {
      throw validationError(`Product ${productName} is not available for ${business.type}`);
    }

    const priceMultiplier = marketPrice?.priceMultiplier ?? 1;
    const unitCost = Math.round(productDef.basePrice * priceMultiplier);
    const totalCost = unitCost * quantity;

    const suggestedSellPrice = Math.round(unitCost * (1 + productDef.suggestedMarkup));

    const result = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: playerId } });
      if (!player) {
        throw notFound('Player');
      }

      if (player.cash < totalCost) {
        throw insufficientFunds(totalCost, player.cash);
      }

      await tx.player.update({
        where: { id: playerId },
        data: { cash: { decrement: totalCost } },
      });

      const existingInventory = await tx.inventory.findFirst({
        where: { businessId: id, productId },
      });

      if (existingInventory) {
        const totalOldCost = existingInventory.purchasePrice * existingInventory.quantity;
        const newTotalCost = totalOldCost + totalCost;
        const newQuantity = existingInventory.quantity + quantity;
        const avgPurchasePrice = newTotalCost / newQuantity;

        return tx.inventory.update({
          where: { id: existingInventory.id },
          data: {
            quantity: newQuantity,
            purchasePrice: Math.round(avgPurchasePrice),
          },
        });
      } else {
        return tx.inventory.create({
          data: {
            businessId: id,
            productId,
            productName,
            category,
            quantity,
            purchasePrice: unitCost,
            sellPrice: suggestedSellPrice,
          },
        });
      }
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
