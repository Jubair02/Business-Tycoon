import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { CITIES, BUSINESS_TYPES } from '@/lib/game-data';

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

    if (typeof type !== 'string' || typeof city !== 'string' || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Business type, city, and name must be strings' },
        { status: 400 }
      );
    }

    if (!type || !city || !name) {
      return NextResponse.json(
        { error: 'Business type, city, and name are required' },
        { status: 400 }
      );
    }

    if (name.length > 50) {
      return NextResponse.json(
        { error: 'Business name must be 50 characters or less' },
        { status: 400 }
      );
    }

    const cityDef = CITIES.find((c) => c.id === city);
    if (!cityDef) {
      return NextResponse.json(
        { error: `Invalid city: ${city}` },
        { status: 400 }
      );
    }

    const businessType = BUSINESS_TYPES.find((b) => b.id === type);
    if (!businessType) {
      return NextResponse.json(
        { error: `Invalid business type: ${type}` },
        { status: 400 }
      );
    }

    const business = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: playerId } });
      if (!player) {
        throw new Error('Player not found');
      }

      if (player.cash < businessType.investment) {
        throw new Error(`Insufficient cash. Need ৳${businessType.investment.toLocaleString()}, have ৳${player.cash.toLocaleString()}`);
      }

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
    if (error instanceof Error) {
      if (error.message === 'Player not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.startsWith('Insufficient cash')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    console.error('Create business error:', error);
    return NextResponse.json(
      { error: 'Failed to create business' },
      { status: 500 }
    );
  }
}
