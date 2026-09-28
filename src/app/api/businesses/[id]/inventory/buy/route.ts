import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getProductsForBusiness } from '@/lib/game-data';
import { capacityReport } from '@/lib/game/storage/capacity';
import { addStockToShelf } from '@/lib/game/supply/supply-service';
import type { GodownTier } from '@/lib/game/storage/storage-config';
import { requirePlayerId, notFound, forbidden, insufficientFunds, validationError, internalError, handleApiError, buyInventorySchema } from '@/lib/errors';
import { trackServer, trackServerOnce } from '@/lib/analytics/identity';
import { EVENTS } from '@/lib/analytics/events';

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


    const result = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: playerId } });
      if (!player) {
        throw notFound('Player');
      }

      // ---- Room on the premises ----
      //
      // This route never checked capacity at all: any quantity could be bought
      // into any shop. Now that shelf space is a real constraint and godowns
      // are the way around it, the ceiling has to be enforced here or renting
      // storage means nothing.
      const [inventories, godowns, pending, season] = await Promise.all([
        tx.inventory.findMany({ where: { businessId: id }, select: { productName: true, quantity: true } }),
        tx.godown.findMany({
          where: { businessId: id, status: 'ACTIVE' },
          select: { id: true, tier: true, capacityBonus: true, expiresOnDay: true },
        }),
        tx.preOrder.findMany({ where: { businessId: id, status: 'PENDING' }, select: { quantity: true } }),
        tx.season.findFirst({ where: { status: 'ACTIVE' }, select: { gameDay: true } }),
      ]);

      const capacity = capacityReport({
        productDefs: (getProductsForBusiness(business.type) ?? []).map(p => ({ name: p.name, maxStock: p.maxStock })),
        inventories,
        godowns: godowns.map(g => ({
          id: g.id,
          tier: g.tier as GodownTier,
          capacityBonus: g.capacityBonus,
          expiresOnDay: g.expiresOnDay,
        })),
        incoming: pending.reduce((sum, o) => sum + o.quantity, 0),
        gameDay: season?.gameDay ?? 0,
      });

      if (quantity > capacity.available) {
        throw validationError(
          capacity.available > 0
            ? `Only ${capacity.available} units of space left. Rent a godown to hold more.`
            : 'No storage space left. Rent a godown, or sell some stock first.',
        );
      }

      if (player.cash < totalCost) {
        throw insufficientFunds(totalCost, player.cash);
      }

      await tx.player.update({
        where: { id: playerId },
        data: { cash: { decrement: totalCost } },
      });

      // ---- Merge on the product, not on `productId` ----
      //
      // This route used to do its own merge, keyed on `productId`. That column
      // is '' on every shelf a shop opened with before it was fixed, and on
      // rows the AI writes, and it holds an *order* id on pre-order deliveries.
      // So the lookup missed and a second shelf was created for a product that
      // already had one — which is what shows up in the Inventory tab as the
      // same product listed twice, each half with its own stock and price.
      //
      // `addStockToShelf` is the shared path every other writer already uses:
      // it matches on the product name, blends cost basis and age, and folds
      // any existing duplicates back into one row.
      await addStockToShelf({
        tx,
        businessId: id,
        businessType: business.type,
        productName,
        category,
        quantity,
        unitCost,
        incomingAgeDays: 0,
        productIdFallback: productId,
      });

      const shelf = await tx.inventory.findFirst({
        where: { businessId: id, productName },
      });
      if (!shelf) {
        // addStockToShelf either updated a shelf or created one, so this is
        // unreachable; failing loudly beats returning a success with no row.
        throw internalError('Stock was purchased but the shelf could not be read back.');
      }
      return shelf;
    });

    void trackServerOnce(EVENTS.FIRST_STOCK_BOUGHT, { businessType: business.type, category });
    void trackServer(EVENTS.STOCK_BOUGHT, { businessType: business.type, category, quantity });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
