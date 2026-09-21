// ============================================
// Supplier bills
// GET /api/player/credit
// ============================================
//
// What the player owes their suppliers, and what each bill costs to settle
// today — which is more than the face value once it is late.

import { NextResponse } from 'next/server';
import { requirePlayerId, handleApiError } from '@/lib/errors';
import { db } from '@/lib/db';
import { getCurrentGameDay } from '@/lib/game/seasons/seasons';
import { creditSummary } from '@/lib/game/supply/supply-service';
import { overdueTotal } from '@/lib/game/supply/suppliers';

export async function GET() {
  try {
    const playerId = await requirePlayerId();
    const gameDay = await getCurrentGameDay();

    const bills = await db.supplierCredit.findMany({
      where: { playerId, status: { in: ['OPEN', 'OVERDUE'] } },
      orderBy: { dueOnDay: 'asc' },
      select: {
        id: true, supplierId: true, term: true, principal: true, surcharge: true,
        totalDue: true, penalty: true, issuedOnDay: true, dueOnDay: true, status: true,
        business: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      gameDay,
      summary: await creditSummary(playerId),
      bills: bills.map(bill => {
        const daysLate = Math.max(0, gameDay - bill.dueOnDay);
        return {
          ...bill,
          daysUntilDue: bill.dueOnDay - gameDay,
          daysLate,
          payableNow: daysLate > 0 ? overdueTotal(bill.totalDue, daysLate) : Math.round(bill.totalDue),
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
