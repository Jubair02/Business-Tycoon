import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

const MIN_LOAN = 50000;
const INTEREST_RATE = 0.05;
const MAX_ACTIVE_LOANS = 3;
const LOAN_DURATION_OPTIONS = [10, 20, 30] as const;

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get('playerId')?.value;

    if (!playerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { amount, days } = body;

    if (!amount || typeof amount !== 'number' || amount < MIN_LOAN) {
      return NextResponse.json(
        { error: `Minimum loan amount is ৳${MIN_LOAN.toLocaleString()}` },
        { status: 400 }
      );
    }

    if (!days || !LOAN_DURATION_OPTIONS.includes(days)) {
      return NextResponse.json(
        { error: `Loan duration must be one of: ${LOAN_DURATION_OPTIONS.join(', ')} days` },
        { status: 400 }
      );
    }

    // Get player to check level and active loans
    const player = await db.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const maxLoan = player.level * 200000;
    if (amount > maxLoan) {
      return NextResponse.json(
        { error: `Maximum loan for your level (${player.level}) is ৳${maxLoan.toLocaleString()}` },
        { status: 400 }
      );
    }

    // Check active loans count
    const activeLoans = await db.loan.count({
      where: { playerId, status: 'ACTIVE' },
    });
    if (activeLoans >= MAX_ACTIVE_LOANS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_ACTIVE_LOANS} active loans allowed` },
        { status: 400 }
      );
    }

    // Calculate loan terms
    const totalInterest = amount * INTEREST_RATE;
    const totalRepayment = amount + totalInterest;
    const dailyPayment = totalRepayment / days;

    const loan = await db.$transaction(async (tx) => {
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

      // Add loan amount to player cash
      await tx.player.update({
        where: { id: playerId },
        data: {
          cash: { increment: amount },
          netWorth: { increment: amount },
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

    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    console.error('Take loan error:', error);
    return NextResponse.json({ error: 'Failed to take loan' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const playerId = cookieStore.get('playerId')?.value;

    if (!playerId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const loans = await db.loan.findMany({
      where: { playerId },
      orderBy: { takenAt: 'desc' },
    });

    return NextResponse.json(loans);
  } catch (error) {
    console.error('Fetch loans error:', error);
    return NextResponse.json({ error: 'Failed to fetch loans' }, { status: 500 });
  }
}
