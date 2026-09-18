import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlayerId, notFound, forbidden, validationError, insufficientFunds, handleApiError, repayLoanSchema } from '@/lib/errors';
import { awardExperience, PROGRESSION_CONFIG } from '@/lib/game/progression';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const playerId = await requirePlayerId();

    const { id } = await params;
    const body = repayLoanSchema.parse(await request.json());
    const { amount } = body;

    const loan = await db.loan.findUnique({ where: { id } });
    if (!loan) {
      throw notFound('Loan');
    }

    if (loan.playerId !== playerId) {
      throw forbidden();
    }

    if (loan.status !== 'ACTIVE') {
      throw validationError(`Loan is already ${loan.status.toLowerCase()}`);
    }

    const repayAmount = Math.min(amount, loan.remainingDebt);

    const player = await db.player.findUnique({ where: { id: playerId } });
    if (!player) {
      throw notFound('Player');
    }

    if (player.cash < repayAmount) {
      throw insufficientFunds(repayAmount, player.cash);
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

      // Phase 6: clearing a loan early earns the same milestone XP as
      // letting the daily payments run it down.
      if (isPaidOff) {
        await awardExperience(
          tx,
          playerId,
          PROGRESSION_CONFIG.loanClearedXp,
          'LOAN_CLEARED',
        );
      }

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
    return handleApiError(error);
  }
}
