import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { PRODUCTS, getBusinessType, getCity, GAME_CONFIG, EMPLOYEE_ROLES } from '@/lib/game-data';

interface PricingAdvice {
  productName: string;
  icon: string;
  purchasePrice: number;
  currentSellPrice: number | null;
  marketPrice: number;
  suggestedPrice: number;
  suggestedMarkup: number;
  maxPrice: number;
  minPrice: number;
  reason: string;
  demandLevel: string;
  weeklyTrend: 'up' | 'down' | 'stable';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get('playerId')?.value;
    if (!playerId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;

    const business = await db.business.findUnique({
      where: { id },
      include: { inventories: true, employees: true },
    });

    if (!business) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (business.playerId !== playerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const bt = getBusinessType(business.type);
    const city = getCity(business.city);
    if (!bt || !city) return NextResponse.json({ error: 'Invalid business data' }, { status: 500 });

    // Get market prices for this city
    const marketPrices = await db.marketPrice.findMany({
      where: { city: business.city },
    });
    const priceMap: Record<string, { priceMultiplier: number; demandMultiplier: number }> = {};
    for (const mp of marketPrices) {
      priceMap[mp.productName] = { priceMultiplier: mp.priceMultiplier, demandMultiplier: mp.demandMultiplier };
    }

    // Employee skill bonus
    const avgSkill = business.employees.length > 0
      ? business.employees.reduce((s, e) => s + (e.skill || 50), 0) / business.employees.length
      : 50;
    const employeeBonus = 1 + business.employees.length * GAME_CONFIG.employeeEfficiencyPerSkill * (avgSkill / 100);

    const products = PRODUCTS[business.type] || [];
    const advice: PricingAdvice[] = [];

    for (const product of products) {
      const existingInv = business.inventories.find(i => i.productName === product.name);
      const mp = priceMap[product.name];
      const currentMarketPrice = Math.round(product.basePrice * (mp?.priceMultiplier || 1));
      const demand = mp?.demandMultiplier || 1;

      // Calculate suggested markup based on demand, competition, and employee skill
      let baseMarkup = product.suggestedMarkup;

      // Adjust for demand
      if (demand > 1.1) baseMarkup += 0.1;      // High demand -> increase markup
      else if (demand < 0.8) baseMarkup -= 0.1;  // Low demand -> decrease markup

      // Adjust for employee quality
      baseMarkup *= (0.9 + employeeBonus * 0.1);

      // Adjust for reputation
      baseMarkup *= (0.8 + (business.reputation / 100) * 0.4);

      // Clamp
      baseMarkup = Math.max(0.05, Math.min(1.5, baseMarkup));

      const suggestedPrice = Math.round(product.basePrice * (1 + baseMarkup) * (mp?.priceMultiplier || 1));
      const maxPrice = Math.round(suggestedPrice * 1.3);  // Too expensive = fewer customers
      const minPrice = Math.round(product.basePrice * 1.05); // At least cover costs

      // Determine demand level
      let demandLevel = 'Medium';
      if (demand >= 1.2) demandLevel = 'High';
      else if (demand < 0.8) demandLevel = 'Low';

      // Determine trend
      const priceVsBase = mp ? mp.priceMultiplier : 1;
      let weeklyTrend: 'up' | 'down' | 'stable' = 'stable';
      if (priceVsBase > 1.05) weeklyTrend = 'up';
      else if (priceVsBase < 0.95) weeklyTrend = 'down';

      // Generate reason
      let reason = '';
      if (demand > 1.15) reason = 'High demand - you can charge more!';
      else if (demand < 0.8) reason = 'Low demand - consider lowering prices';
      else if (!existingInv) reason = 'No stock yet - buy first to start selling';
      else if (existingInv.sellPrice && existingInv.sellPrice > maxPrice)
        reason = 'Your price is too high - customers are leaving!';
      else if (existingInv.sellPrice && existingInv.sellPrice < minPrice)
        reason = 'Selling below cost - you\'re losing money!';
      else reason = 'Pricing looks reasonable for current market';

      advice.push({
        productName: product.name,
        icon: product.icon,
        purchasePrice: Math.round(product.basePrice * (mp?.priceMultiplier || 1)),
        currentSellPrice: existingInv?.sellPrice || null,
        marketPrice: currentMarketPrice,
        suggestedPrice,
        suggestedMarkup: Math.round(baseMarkup * 100),
        maxPrice,
        minPrice,
        reason,
        demandLevel,
        weeklyTrend,
      });
    }

    return NextResponse.json({
      businessName: business.name,
      businessType: bt.name,
      city: city.name,
      reputation: business.reputation,
      employeeCount: business.employees.length,
      avgEmployeeSkill: Math.round(avgSkill),
      advice,
    });
  } catch (error) {
    console.error('Pricing advice error:', error);
    return NextResponse.json({ error: 'Failed to get pricing advice' }, { status: 500 });
  }
}
