import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { calculateMarketShare } from '@/lib/game/ai/ai-engine';
import { BUSINESS_TYPES, CITIES } from '@/lib/game-data';

/**
 * GET /api/market/competition
 *
 * Returns competition data for a specific city + business type market,
 * or all markets if no filter specified.
 *
 * Query params:
 *   city: city ID (e.g., "DHAKA")
 *   type: business type ID (e.g., "GROCERY")
 *   all: if "true", return competition data for all city+type combinations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const type = searchParams.get('type');
    const getAll = searchParams.get('all') === 'true';

    if (getAll) {
      // Return competition data for all city+type combinations
      const results = [];
      for (const c of CITIES) {
        for (const bt of BUSINESS_TYPES) {
          const data = await calculateMarketShare(c.id, bt.id);
          if (data.shares.length > 0) {
            // Find player's share
            const playerShares = data.shares.filter(s => !s.isAI);
            const playerShare = playerShares.length > 0
              ? playerShares.reduce((sum, s) => sum + s.share, 0)
              : 0;

            // Find player's rank
            const sorted = [...data.shares].sort((a, b) => b.share - a.share);
            const playerRank = sorted.findIndex(s => !s.isAI) + 1;

            results.push({
              city: c.id,
              cityName: c.name,
              businessType: bt.id,
              businessTypeName: bt.name,
              totalDemand: Math.round(data.totalDemand),
              totalBusinesses: data.shares.length,
              aiBusinesses: data.shares.filter(s => s.isAI).length,
              playerBusinesses: playerShares.length,
              playerMarketShare: Math.round(playerShare * 100),
              playerRank: playerRank || data.shares.length,
              averageRevenue: Math.round(
                data.shares.reduce((sum, s) => sum + s.revenue, 0) / data.shares.length
              ),
              topCompetitor: sorted[0] ? {
                name: sorted[0].playerName,
                share: Math.round(sorted[0].share * 100),
                isAI: sorted[0].isAI,
              } : null,
              shares: data.shares.map(s => ({
                businessName: s.businessName,
                playerName: s.playerName,
                isAI: s.isAI,
                share: Math.round(s.share * 100),
                revenue: Math.round(s.revenue),
              })),
            });
          }
        }
      }
      return NextResponse.json(results);
    }

    // Single market competition
    if (!city || !type) {
      return NextResponse.json(
        { error: 'Provide city and type query params, or all=true' },
        { status: 400 }
      );
    }

    const data = await calculateMarketShare(city, type);
    const sorted = [...data.shares].sort((a, b) => b.share - a.share);
    const playerRank = sorted.findIndex(s => !s.isAI) + 1;

    // Average price across all businesses in this market
    const businesses = await db.business.findMany({
      where: { city, type },
      include: { inventories: true },
    });
    const allPrices = businesses.flatMap(b => b.inventories.map(i => i.sellPrice));
    const avgPrice = allPrices.length > 0
      ? Math.round(allPrices.reduce((s, p) => s + p, 0) / allPrices.length)
      : 0;

    const result = {
      city,
      businessType: type,
      totalDemand: Math.round(data.totalDemand),
      totalBusinesses: data.shares.length,
      aiBusinesses: data.shares.filter(s => s.isAI).length,
      playerBusinesses: data.shares.filter(s => !s.isAI).length,
      playerMarketShare: Math.round(
        (data.shares.filter(s => !s.isAI).reduce((sum, s) => sum + s.share, 0)) * 100
      ),
      playerRank: playerRank || data.shares.length,
      averagePrice: avgPrice,
      shares: sorted.map((s, i) => ({
        rank: i + 1,
        businessName: s.businessName,
        playerName: s.playerName,
        isAI: s.isAI,
        share: Math.round(s.share * 100),
        revenue: Math.round(s.revenue),
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
