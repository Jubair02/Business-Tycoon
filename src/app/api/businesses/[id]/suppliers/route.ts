// ============================================
// Suppliers for one shop
// GET /api/businesses/[id]/suppliers
// ============================================
//
// Who will sell to this shop, at what price, on what terms, and how long each
// takes. Plus what the player already owes, because the terms on offer depend
// on whether they have paid their last bill.

import { NextResponse, type NextRequest } from 'next/server';
import { requirePlayerId, notFound, forbidden, handleApiError } from '@/lib/errors';
import { db } from '@/lib/db';
import { PRODUCTS } from '@/lib/game-data';
import { getCurrentGameDay } from '@/lib/game/seasons/seasons';
import {
  SELECTABLE_SUPPLIERS,
  quoteFromSupplier,
  termsFor,
  type PaymentTerm,
  type SupplierId,
} from '@/lib/game/supply/suppliers';
import { creditSummary } from '@/lib/game/supply/supply-service';
import { projectedSurvival } from '@/lib/game/supply/spoilage';

/** Days of trading a delivery is assumed to cover, for the spoilage estimate. */
const ASSUMED_SELL_THROUGH_DAYS = 7;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const playerId = await requirePlayerId();
    const { id } = await params;

    const business = await db.business.findUnique({
      where: { id },
      select: { playerId: true, type: true, city: true },
    });
    if (!business) throw notFound('Business');
    if (business.playerId !== playerId) throw forbidden();

    const gameDay = await getCurrentGameDay();
    const defs = PRODUCTS[business.type] ?? [];

    const marketPrices = await db.marketPrice.findMany({
      where: { city: business.city },
      select: { productName: true, priceMultiplier: true },
    });
    const multiplierFor = (name: string) =>
      marketPrices.find(m => m.productName === name)?.priceMultiplier ?? 1;

    const url = new URL(request.url);
    const productName = url.searchParams.get('product') ?? defs[0]?.name ?? '';
    const quantity = Math.max(0, Math.floor(Number(url.searchParams.get('quantity')) || 0));
    const term = (url.searchParams.get('term') ?? 'NET_0') as PaymentTerm;

    const chosen = defs.find(d => d.name === productName);
    const marketUnitCost = chosen ? chosen.basePrice * multiplierFor(chosen.name) : 0;

    return NextResponse.json({
      gameDay,
      credit: await creditSummary(playerId),

      products: defs.map(def => {
        const multiplier = multiplierFor(def.name);
        return {
          name: def.name,
          category: def.category,
          icon: def.icon,
          basePrice: def.basePrice,
          marketUnitCost: Math.round(def.basePrice * multiplier),
          priceMultiplier: multiplier,
          // Market prices move every third tick. This is how a player sees
          // that rice is cheap this week, which is the whole reason to buy
          // early rather than when the shelf runs out.
          cheapToday: multiplier < 0.98,
          dearToday: multiplier > 1.02,
          shelfLifeDays: def.shelfLifeDays,
          perishable: def.shelfLifeDays > 0,
        };
      }),

      suppliers: SELECTABLE_SUPPLIERS.map(spec => {
        const quote = chosen && quantity > 0
          ? quoteFromSupplier({
              supplier: spec.id as SupplierId,
              quantity,
              marketUnitCost,
              term,
              orderDay: gameDay,
            })
          : null;

        // How much would still be sellable after the supplier's lead time plus
        // a week of trading. Shown so "eight hundred fish from the importer"
        // reads as a mistake before the money leaves, not a week later when it
        // arrives and rots.
        const survival = chosen && quantity > 0
          ? projectedSurvival({
              quantity,
              shelfLifeDays: chosen.shelfLifeDays,
              daysHeld: spec.leadDays + ASSUMED_SELL_THROUGH_DAYS,
            })
          : null;

        return {
          id: spec.id,
          en: spec.en,
          bn: spec.bn,
          icon: spec.icon,
          note: spec.note,
          noteBn: spec.noteBn,
          priceFactor: spec.priceFactor,
          leadDays: spec.leadDays,
          minQuantity: spec.minQuantity,
          terms: termsFor(spec.id as SupplierId),
          quote,
          survival,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
