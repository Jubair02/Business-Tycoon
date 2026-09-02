import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get('playerId')?.value;

    if (!playerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const businesses = await db.business.findMany({
      where: { playerId },
      include: {
        _count: {
          select: {
            inventories: true,
            employees: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(businesses);
  } catch (error) {
    console.error('Get businesses error:', error);
    return NextResponse.json(
      { error: 'Failed to get businesses' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get('playerId')?.value;

    if (!playerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { type, city, name } = body;

    if (!type || !city || !name) {
      return NextResponse.json(
        { error: 'Business type, city, and name are required' },
        { status: 400 }
      );
    }

    const { BUSINESS_TYPES } = await import('@/lib/game-data');
    const businessType = BUSINESS_TYPES.find((b) => b.id === type);

    if (!businessType) {
      return NextResponse.json(
        { error: `Invalid business type: ${type}` },
        { status: 400 }
      );
    }

    const player = await db.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    if (player.cash < businessType.investment) {
      return NextResponse.json(
        { error: `Insufficient cash. Need ৳${businessType.investment.toLocaleString()}, have ৳${player.cash.toLocaleString()}` },
        { status: 400 }
      );
    }

    const business = await db.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: playerId },
        data: { cash: { decrement: businessType.investment } },
      });

      return tx.business.create({
        data: {
          playerId,
          type,
          city,
          name: name.trim(),
          level: 1,
          reputation: 50,
        },
      });
    });

    return NextResponse.json(business, { status: 201 });
  } catch (error) {
    console.error('Create business error:', error);
    return NextResponse.json(
      { error: 'Failed to create business' },
      { status: 500 }
    );
  }
}
