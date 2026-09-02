import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { getProductsForBusiness } from '@/lib/game-data';

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
    const { productId, productName, category, quantity } = body;

    if (!productId || !productName || !category || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'productId, productName, category, and positive quantity are required' },
        { status: 400 }
      );
    }

    const business = await db.business.findUnique({
      where: { id },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (business.playerId !== playerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const marketPrice = await db.marketPrice.findUnique({
      where: { productName_city: { productName, city: business.city } },
    });

    const products = getProductsForBusiness(business.type);
    const productDef = products.find((p) => p.name === productName);
    if (!productDef) {
      return NextResponse.json(
        { error: `Product ${productName} is not available for ${business.type}` },
        { status: 400 }
      );
    }

    const priceMultiplier = marketPrice?.priceMultiplier ?? 1;
    const unitCost = Math.round(productDef.basePrice * priceMultiplier);
    const totalCost = unitCost * quantity;

    const player = await db.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    if (player.cash < totalCost) {
      return NextResponse.json(
        { error: `Insufficient cash. Need ৳${totalCost.toLocaleString()}, have ৳${player.cash.toLocaleString()}` },
        { status: 400 }
      );
    }

    const suggestedSellPrice = Math.round(unitCost * (1 + productDef.suggestedMarkup));

    const result = await db.$transaction(async (tx) => {
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
    console.error('Buy inventory error:', error);
    return NextResponse.json(
      { error: 'Failed to buy inventory' },
      { status: 500 }
    );
  }
}
