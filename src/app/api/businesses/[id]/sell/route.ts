import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { getBusinessType } from '@/lib/game-data';

// Sell business: recover 40-60% of investment based on reputation
const SELL_BASE_RATE = 0.5;
const SELL_REP_BONUS = 0.001; // +0.1% per reputation point

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get('playerId')?.value;

    if (!playerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch business with all related data
    const business = await db.business.findUnique({
      where: { id },
      include: {
        inventories: true,
        employees: true,
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (business.playerId !== playerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const bt = getBusinessType(business.type);
    const baseInvestment = bt?.investment || 50000;
    const level = business.level || 1;

    // Calculate sell price: base investment * level * sell rate (rep bonus)
    const repBonus = (business.reputation || 0) * SELL_REP_BONUS;
    const sellRate = Math.min(0.8, SELL_BASE_RATE + repBonus);
    const sellPrice = Math.round(baseInvestment * level * sellRate);

    // Calculate inventory liquidation value (70% of purchase price)
    let inventoryValue = 0;
    for (const inv of business.inventories) {
      inventoryValue += Math.round((inv.purchasePrice || 0) * (inv.quantity || 0) * 0.7);
    }

    const totalReceived = sellPrice + inventoryValue;

    // Execute sell in transaction
    const result = await db.$transaction(async (tx) => {
      // Credit player cash
      await tx.player.update({
        where: { id: playerId },
        data: { cash: { increment: totalReceived } },
      });

      // Delete all inventory
      await tx.inventory.deleteMany({ where: { businessId: id } });

      // Delete all employees
      await tx.employee.deleteMany({ where: { businessId: id } });

      // Delete all game logs for this business
      await tx.gameLog.deleteMany({ where: { businessId: id } });

      // Delete the business
      await tx.business.delete({ where: { id } });

      // Create log entry
      await tx.gameLog.create({
        data: {
          playerId,
          type: 'SELL_BUSINESS',
          message: `Sold "${business.name}" for ${formatTakaBDT(totalReceived)}`,
          amount: totalReceived,
        },
      });

      // Return updated player
      return tx.player.findUnique({ where: { id: playerId } });
    });

    return NextResponse.json({
      sold: true,
      sellPrice,
      inventoryValue,
      totalReceived,
      businessName: business.name,
      player: result,
    });
  } catch (error) {
    console.error('Sell business error:', error);
    return NextResponse.json(
      { error: 'Failed to sell business' },
      { status: 500 }
    );
  }
}

function formatTakaBDT(amount: number): string {
  if (amount >= 100000) {
    return `৳${(amount / 100000).toFixed(1)}L`;
  }
  return `৳${amount.toLocaleString()}`;
}
