import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, validationError, leaderboardTypeSchema, getOptionalPlayerId } from '@/lib/errors';
import { publicPlayerRef } from '@/lib/auth/session';
import { getActiveSeason } from '@/lib/game/seasons/seasons';
type LeaderboardType = 'networth' | 'profit' | 'revenue' | 'marketshare';

/**
 * GET /api/leaderboard
 *
 * Phase 2: Updated to include AI personality indicators
 * and revenue/market share tabs.
 *
 * Query params:
 *   type: networth | profit | revenue | marketshare
 *   city: optional city filter
 */
export async function GET(request: NextRequest) {
  try {
    // The viewer is resolved from the signed session so rows can be marked
    // "you" without ever publishing a real player id (which is the credential).
    const viewerId = await getOptionalPlayerId();
    const { searchParams } = new URL(request.url);
    const rawType = searchParams.get('type') || 'networth';
    const type = (leaderboardTypeSchema.parse(rawType) === 'marketshare' ? 'marketshare' : rawType) as LeaderboardType;
    const city = searchParams.get('city') || undefined;

    // Every board is scoped to the season being played. One endless board meant
    // whoever started first stayed on top forever and a late joiner had nothing
    // to play for — and it is why `take: 50` then sorting in memory was wrong
    // as soon as there were more than fifty accounts. A season's cohort is
    // bounded by design.
    const season = await getActiveSeason();
    if (!season) return NextResponse.json([]);
    const seasonFilter = { seasonId: season.id };

    if (type === 'marketshare') {
      // Market share leaderboard: total revenue across all businesses
      const players = await db.player.findMany({
        where: seasonFilter,
        take: 50,
        include: {
          _count: { select: { businesses: true } },
          businesses: {
            select: {
              city: true,
              type: true,
              dailyRevenue: true,
              totalRevenue: true,
              totalProfit: true,
              reputation: true,
            },
          },
        },
      });

      const filtered = city
        ? players.filter(p => p.businesses.some(b => b.city === city))
        : players;

      // Sort by total revenue
      filtered.sort((a, b) => {
        const aRev = a.businesses.reduce((sum, b) => sum + b.totalRevenue, 0);
        const bRev = b.businesses.reduce((sum, b) => sum + b.totalRevenue, 0);
        return bRev - aRev;
      });

      const formatted = filtered.slice(0, 20).map(p => ({
        playerId: publicPlayerRef(p.id),
        isYou: p.id === viewerId,
        name: p.name,
        netWorth: p.netWorth,
        totalProfit: p.businesses.reduce((sum, b) => sum + b.totalProfit, 0),
        totalRevenue: p.businesses.reduce((sum, b) => sum + b.totalRevenue, 0),
        businessCount: p._count.businesses,
        maxReputation: p.businesses.length > 0
          ? Math.max(...p.businesses.map(b => b.reputation))
          : 0,
        isAI: p.isAI,
        personality: p.personality,
      }));

      return NextResponse.json(formatted);
    }

    if (type === 'revenue') {
      const players = await db.player.findMany({
        where: seasonFilter,
        take: 50,
        include: {
          _count: { select: { businesses: true } },
          businesses: {
            select: {
              city: true,
              dailyRevenue: true,
              totalRevenue: true,
              totalProfit: true,
              reputation: true,
            },
          },
        },
      });

      const filtered = city
        ? players.filter(p => p.businesses.some(b => b.city === city))
        : players;

      filtered.sort((a, b) => {
        const aRev = a.businesses.reduce((sum, b) => sum + b.totalRevenue, 0);
        const bRev = b.businesses.reduce((sum, b) => sum + b.totalRevenue, 0);
        return bRev - aRev;
      });

      const formatted = filtered.slice(0, 20).map(p => ({
        playerId: publicPlayerRef(p.id),
        isYou: p.id === viewerId,
        name: p.name,
        netWorth: p.netWorth,
        totalProfit: p.businesses.reduce((sum, b) => sum + b.totalProfit, 0),
        totalRevenue: p.businesses.reduce((sum, b) => sum + b.totalRevenue, 0),
        businessCount: p._count.businesses,
        maxReputation: p.businesses.length > 0
          ? Math.max(...p.businesses.map(b => b.reputation))
          : 0,
        isAI: p.isAI,
        personality: p.personality,
      }));

      return NextResponse.json(formatted);
    }

    // Use DB-level ordering for networth and businesses
    if (type === 'networth') {
      const players = await db.player.findMany({
        where: seasonFilter,
        take: 50,
        orderBy: { netWorth: 'desc' },
        include: {
          _count: {
            select: { businesses: true },
          },
          businesses: {
            select: {
              city: true,
              reputation: true,
              totalProfit: true,
              totalRevenue: true,
            },
          },
        },
      });

      const filtered = city
        ? players.filter((p) => p.businesses.some((b) => b.city === city))
        : players;

      const formatted = filtered.slice(0, 20).map((p) => ({
        playerId: publicPlayerRef(p.id),
        isYou: p.id === viewerId,
        name: p.name,
        netWorth: p.netWorth,
        totalProfit: p.businesses.reduce((sum, biz) => sum + biz.totalProfit, 0),
        totalRevenue: p.businesses.reduce((sum, biz) => sum + biz.totalRevenue, 0),
        businessCount: p._count.businesses,
        maxReputation: p.businesses.length > 0
          ? Math.max(...p.businesses.map((biz) => biz.reputation))
          : 0,
        isAI: p.isAI,
        personality: p.personality,
      }));

      return NextResponse.json(formatted);
    }

    // For profit and reputation, still need in-memory sorting
    const allPlayers = await db.player.findMany({
      where: seasonFilter,
      take: 50,
      include: {
        _count: {
          select: { businesses: true },
        },
        businesses: {
          select: {
            city: true,
            reputation: true,
            totalProfit: true,
            totalRevenue: true,
          },
        },
      },
    });

    let players = city
      ? allPlayers.filter((p) => p.businesses.some((b) => b.city === city))
      : allPlayers;

    switch (type) {
      case 'profit': {
        players.sort((a, b) => {
          const aTotal = a.businesses.reduce((sum, biz) => sum + biz.totalProfit, 0);
          const bTotal = b.businesses.reduce((sum, biz) => sum + biz.totalProfit, 0);
          return bTotal - aTotal;
        });
        break;
      }
      default: {
        // reputation
        players.sort((a, b) => {
          const aMaxRep = a.businesses.length > 0
            ? Math.max(...a.businesses.map((biz) => biz.reputation))
            : 0;
          const bMaxRep = b.businesses.length > 0
            ? Math.max(...b.businesses.map((biz) => biz.reputation))
            : 0;
          return bMaxRep - aMaxRep;
        });
        break;
      }
    }

    const formatted = players.slice(0, 20).map((p) => ({
      playerId: publicPlayerRef(p.id),
      isYou: p.id === viewerId,
      name: p.name,
      netWorth: p.netWorth,
      totalProfit: p.businesses.reduce((sum, biz) => sum + biz.totalProfit, 0),
      totalRevenue: p.businesses.reduce((sum, biz) => sum + biz.totalRevenue, 0),
      businessCount: p._count.businesses,
      maxReputation: p.businesses.length > 0
        ? Math.max(...p.businesses.map((biz) => biz.reputation))
        : 0,
      isAI: p.isAI,
      personality: p.personality,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    return handleApiError(error);
  }
}
