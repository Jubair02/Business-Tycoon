import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

type LeaderboardType = 'networth' | 'profit' | 'reputation' | 'businesses';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'networth') as LeaderboardType;
    const city = searchParams.get('city') || undefined;

    const validTypes: LeaderboardType[] = ['networth', 'profit', 'reputation', 'businesses'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Always fetch with business data for sorting/filtering
    const allPlayers = await db.player.findMany({
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
      case 'networth':
        players.sort((a, b) => b.netWorth - a.netWorth);
        break;
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
      case 'businesses':
        players.sort((a, b) => b._count.businesses - a._count.businesses);
        break;
    }

    return NextResponse.json(players.slice(0, 20));
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return NextResponse.json(
      { error: 'Failed to get leaderboard' },
      { status: 500 }
    );
  }
}
