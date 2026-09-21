import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlayerId, notFound, validationError, conflict, handleApiError, takeLoanSchema } from '@/lib/errors';
import { trackServer } from '@/lib/analytics/identity';
import { EVENTS } from '@/lib/analytics/events';

const INTEREST_RATE = 0.05;
const MAX_ACTIVE_LOANS = 3;

export async function POST(request: NextRequest) {
  try {
    const playerId = await requirePlayerId();

    const body = takeLoanSchema.parse(await request.json());
    const { amount, days } = body;

    // Get player to check level and active loans
    const player = await db.player.findUnique({ where: { id: playerId } });
    if (!player) {
      throw notFound('Player');
    }

    const maxLoan = player.level * 200000;
    if (amount > maxLoan) {
      throw validationError(`Maximum loan for your level (${player.level}) is ৳${maxLoan.toLocaleString()}`);
    }

    // Calculate loan terms
    const totalInterest = amount * INTEREST_RATE;
    const totalRepayment = amount + totalInterest;
    const dailyPayment = totalRepayment / days;

    const loan = await db.$transaction(async (tx) => {
      // Check active loans count inside transaction to prevent race conditions
      const activeLoans = await tx.loan.count({
        where: { playerId, status: 'ACTIVE' },
      });
      if (activeLoans >= MAX_ACTIVE_LOANS) {
        throw conflict(`Maximum ${MAX_ACTIVE_LOANS} active loans allowed`);
      }

      // Create loan
      const newLoan = await tx.loan.create({
        data: {
          playerId,
          amount,
          interestRate: INTEREST_RATE,
          remainingDebt: totalRepayment,
          dailyPayment,
          daysRemaining: days,
          totalInterest,
          status: 'ACTIVE',
        },
      });

      // Add loan amount to player cash (netWorth unchanged: cash+amount offset by equal debt)
      await tx.player.update({
        where: { id: playerId },
        data: {
          cash: { increment: amount },
        },
      });

      // Log
      await tx.gameLog.create({
        data: {
          playerId,
          type: 'LOAN',
          message: `Took loan of ৳${amount.toLocaleString()} for ${days} days. Interest: ৳${Math.round(totalInterest).toLocaleString()}. Daily payment: ৳${Math.round(dailyPayment).toLocaleString()}`,
          amount,
        },
      });

      return newLoan;
    });

    void trackServer(EVENTS.LOAN_TAKEN, { amount, days });

    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    const playerId = await requirePlayerId();

    const loans = await db.loan.findMany({
      where: { playerId },
      orderBy: { takenAt: 'desc' },
    });

    return NextResponse.json(loans);
  } catch (error) {
    return handleApiError(error);
  }
}
