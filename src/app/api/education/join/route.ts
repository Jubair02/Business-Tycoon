// ============================================
// Join a cohort
// POST /api/education/join
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { handleApiError, unauthorized, validationError, notFound, conflict } from '@/lib/errors';
import { resolveSession } from '@/lib/auth/user-session';
import { canJoinCohort, normaliseJoinCode, isValidJoinCode } from '@/lib/education/scenarios';
import { trackServer } from '@/lib/analytics/identity';
import { EVENTS } from '@/lib/analytics/events';

const joinSchema = z.object({
  code: z.string().trim().min(1).max(20),
});

export async function POST(request: NextRequest) {
  try {
    const session = await resolveSession();
    if (!session?.userId) throw unauthorized();

    const { code } = joinSchema.parse(await request.json());
    const joinCode = normaliseJoinCode(code);

    // Checked before touching the database so a typo is answered immediately
    // and a malformed code is never used as a query.
    if (!isValidJoinCode(joinCode)) throw validationError('That is not a valid class code.');

    const result = await db.$transaction(async tx => {
      const cohort = await tx.cohort.findUnique({
        where: { joinCode },
        include: { _count: { select: { members: true } } },
      });
      if (!cohort) throw notFound('Class');

      const existing = await tx.cohortMember.findUnique({
        where: { cohortId_userId: { cohortId: cohort.id, userId: session.userId! } },
      });

      // The seat check happens inside the transaction: two students taking the
      // last seat at the same moment must not both get it.
      const verdict = canJoinCohort({
        status: cohort.status,
        seatLimit: cohort.seatLimit,
        seatsTaken: cohort._count.members,
        alreadyMember: Boolean(existing),
      });

      if (!verdict.allowed) {
        if (verdict.reason === 'already-member') return { cohort, alreadyIn: true };
        if (verdict.reason === 'full') throw conflict('That class is full.');
        if (verdict.reason === 'closed') throw conflict('That class is not taking students.');
        throw validationError('You cannot join that class.');
      }

      await tx.cohortMember.create({
        data: { cohortId: cohort.id, userId: session.userId!, role: 'STUDENT' },
      });

      return { cohort, alreadyIn: false };
    });

    void trackServer(EVENTS.COHORT_JOINED);

    return NextResponse.json({
      success: true,
      alreadyIn: result.alreadyIn,
      cohort: {
        id: result.cohort.id,
        name: result.cohort.name,
        scenario: result.cohort.scenario,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
