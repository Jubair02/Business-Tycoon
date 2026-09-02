import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getProductsForBusiness, getAllProducts, BUSINESS_TYPES } from '@/lib/game-data';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const city = searchParams.get('city');

    if (!city) {
      return NextResponse.json(
        { error: 'city query parameter is required' },
        { status: 400 }
      );
    }

    // Support "all" type or missing type to show all products
    let productDefs;
    if (!type || type === 'all') {
      productDefs = getAllProducts();
    } else {
      productDefs = getProductsForBusiness(type);
    }

    if (productDefs.length === 0) {
      return NextResponse.json(
        { error: `No products found for business type: ${type}` },
        { status: 400 }
      );
    }

    // Get market prices for all products in this city
    const productNames = productDefs.map((p) => p.name);
    const marketPrices = await db.marketPrice.findMany({
      where: { city, productName: { in: productNames } },
    });

    const priceMap = new Map(
      marketPrices.map((mp) => [mp.productName, mp])
    );

    // Get product IDs from the Product table
    const products = await db.product.findMany({
      where: { name: { in: productNames } },
    });

    const productIdMap = new Map(products.map((p) => [p.name, p.id]));

    const result = productDefs.map((def) => {
      const market = priceMap.get(def.name);
      const currentPrice = Math.round(
        def.basePrice * (market?.priceMultiplier ?? 1)
      );
      const currentDemand = def.baseDemand * (market?.demandMultiplier ?? 1);

      return {
        id: productIdMap.get(def.name) || '',
        name: def.name,
        category: def.category,
        basePrice: def.basePrice,
        currentPrice,
        baseDemand: def.baseDemand,
        currentDemand: Math.round(currentDemand * 1000) / 1000,
        icon: def.icon,
        maxStock: def.maxStock,
        suggestedMarkup: def.suggestedMarkup,
        priceMultiplier: market?.priceMultiplier ?? 1,
        demandMultiplier: market?.demandMultiplier ?? 1,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get market products error:', error);
    return NextResponse.json(
      { error: 'Failed to get market products' },
      { status: 500 }
    );
  }
}
