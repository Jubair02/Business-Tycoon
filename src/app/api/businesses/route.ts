import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { BUSINESS_TYPES } from '@/lib/game-data';
import { requirePlayerId, notFound, insufficientFunds, handleApiError, createBusinessSchema } from '@/lib/errors';

export async function GET() {
  try {
    const playerId = await requirePlayerId();

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
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const playerId = await requirePlayerId();

    const body = createBusinessSchema.parse(await request.json());
    const { type, city, name } = body;

    const businessType = BUSINESS_TYPES.find((b) => b.id === type);

    const business = await db.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: playerId } });
      if (!player) {
        throw notFound('Player');
      }

      if (player.cash < businessType!.investment) {
        throw insufficientFunds(businessType!.investment, player.cash);
      }

      await tx.player.update({
        where: { id: playerId },
        data: { cash: { decrement: businessType!.investment } },
      });

      return tx.business.create({
        data: {
          playerId,
          type,
          city,
          name,
          level: 1,
          reputation: 50,
        },
      });
    });

    return NextResponse.json(business, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
