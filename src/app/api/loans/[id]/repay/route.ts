import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

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
    const body = await request.json();
    const { amount } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'A positive repayment amount is required' },
        { status: 400 }
      );
    }

    const loan = await db.loan.findUnique({ where: { id } });
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    if (loan.playerId !== playerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (loan.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: `Loan is already ${loan.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    const repayAmount = Math.min(amount, loan.remainingDebt);

    const player = await db.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    if (player.cash < repayAmount) {
      return NextResponse.json(
        { error: `Insufficient cash. Need ৳${Math.round(repayAmount).toLocaleString()}, have ৳${Math.round(player.cash).toLocaleString()}` },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const newRemainingDebt = loan.remainingDebt - repayAmount;
      const isPaidOff = newRemainingDebt <= 0;

      // Proportionally reduce days remaining
      const originalDebt = loan.amount + loan.totalInterest;
      const paidRatio = repayAmount / originalDebt;
      const daysToReduce = Math.min(Math.ceil(paidRatio * loan.daysRemaining), loan.daysRemaining);
      const newDaysRemaining = Math.max(loan.daysRemaining - daysToReduce, 0);

      const updatedLoan = await tx.loan.update({
        where: { id },
        data: {
          remainingDebt: Math.max(newRemainingDebt, 0),
          daysRemaining: newDaysRemaining,
          status: isPaidOff ? 'PAID_OFF' : 'ACTIVE',
        },
      });

      // Deduct from player cash
      await tx.player.update({
        where: { id: playerId },
        data: { cash: { decrement: repayAmount } },
      });

      // Log
      await tx.gameLog.create({
        data: {
          playerId,
          type: isPaidOff ? 'LOAN_PAID' : 'LOAN_REPAY',
          message: isPaidOff
            ? `Fully repaid loan of ৳${loan.amount.toLocaleString()}. Final payment: ৳${Math.round(repayAmount).toLocaleString()}`
            : `Repaid ৳${Math.round(repayAmount).toLocaleString()} on loan. Remaining: ৳${Math.round(newRemainingDebt).toLocaleString()}`,
          amount: -repayAmount,
        },
      });

      return updatedLoan;
    });

    // Recalculate netWorth after repayment
    const updatedPlayer = await db.player.findUnique({ where: { id: playerId } });
    if (updatedPlayer) {
      const bizCash = (await db.business.findMany({ where: { playerId }, select: { cash: true } })).reduce((s, b) => s + b.cash, 0);
      const invValue = (await db.inventory.findMany({ where: { business: { playerId } }, select: { quantity: true, purchasePrice: true } })).reduce((s, i) => s + i.quantity * i.purchasePrice, 0);
      const totalDebt = (await db.loan.findMany({ where: { playerId, status: 'ACTIVE' }, select: { remainingDebt: true } })).reduce((s, l) => s + l.remainingDebt, 0);
      await db.player.update({ where: { id: playerId }, data: { netWorth: updatedPlayer.cash + bizCash + invValue - totalDebt } });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Repay loan error:', error);
    return NextResponse.json({ error: 'Failed to repay loan' }, { status: 500 });
  }
}
