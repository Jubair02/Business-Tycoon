import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, validationError, leaderboardTypeSchema } from '@/lib/errors';

type LeaderboardType = 'networth' | 'profit' | 'reputation' | 'businesses';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawType = searchParams.get('type') || 'networth';
    const type = leaderboardTypeSchema.parse(rawType) as LeaderboardType;
    const city = searchParams.get('city') || undefined;

    // Use DB-level ordering and pagination for networth and businesses
    // For profit and reputation, we still need in-memory sorting since they're computed
    if (type === 'networth') {
      const players = await db.player.findMany({
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
            },
          },
        },
      });

      const filtered = city
        ? players.filter((p) => p.businesses.some((b) => b.city === city))
        : players;

      const formatted = filtered.slice(0, 20).map((p) => ({
        playerId: p.id,
        name: p.name,
        netWorth: p.netWorth,
        totalProfit: p.businesses.reduce((sum, biz) => sum + biz.totalProfit, 0),
        businessCount: p._count.businesses,
        maxReputation: p.businesses.length > 0
          ? Math.max(...p.businesses.map((biz) => biz.reputation))
          : 0,
      }));

      return NextResponse.json(formatted);
    }

    if (type === 'businesses') {
      const players = await db.player.findMany({
        take: 50,
        orderBy: { businesses: { _count: 'desc' } },
        include: {
          _count: {
            select: { businesses: true },
          },
          businesses: {
            select: {
              city: true,
              reputation: true,
              totalProfit: true,
            },
          },
        },
      });

      const filtered = city
        ? players.filter((p) => p.businesses.some((b) => b.city === city))
        : players;

      const formatted = filtered.slice(0, 20).map((p) => ({
        playerId: p.id,
        name: p.name,
        netWorth: p.netWorth,
        totalProfit: p.businesses.reduce((sum, biz) => sum + biz.totalProfit, 0),
        businessCount: p._count.businesses,
        maxReputation: p.businesses.length > 0
          ? Math.max(...p.businesses.map((biz) => biz.reputation))
          : 0,
      }));

      return NextResponse.json(formatted);
    }

    // For profit and reputation, still need in-memory sorting (computed aggregates)
    const allPlayers = await db.player.findMany({
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
          },
        },
      },
    });

    // Filter by city if provided
    let players = city
      ? allPlayers.filter((p) =>
          p.businesses.some((b) => b.city === city)
        )
      : allPlayers;

    // Sort by the requested criteria
    switch (type) {
      case 'profit': {
        players.sort((a, b) => {
          const aTotal = a.businesses.reduce((sum, biz) => sum + biz.totalProfit, 0);
          const bTotal = b.businesses.reduce((sum, biz) => sum + biz.totalProfit, 0);
          return bTotal - aTotal;
        });
        break;
      }
      case 'reputation':
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

    const formatted = players.slice(0, 20).map((p) => ({
      playerId: p.id,
      name: p.name,
      netWorth: p.netWorth,
      totalProfit: p.businesses.reduce((sum, biz) => sum + biz.totalProfit, 0),
      businessCount: p._count.businesses,
      maxReputation: p.businesses.length > 0
        ? Math.max(...p.businesses.map((biz) => biz.reputation))
        : 0,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    return handleApiError(error);
  }
}
