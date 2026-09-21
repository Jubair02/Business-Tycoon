// ============================================
// Cohorts
// GET  /api/education/cohorts — the cohorts this account teaches or is in
// POST /api/education/cohorts — create one (the caller becomes the instructor)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { handleApiError, unauthorized, validationError } from '@/lib/errors';
import { resolveSession } from '@/lib/auth/user-session';
import { getActiveSeason } from '@/lib/game/seasons/seasons';
import { SCENARIOS, getScenario, generateJoinCode, seatUsage } from '@/lib/education/scenarios';
import { OBJECTIVE_METRICS } from '@/lib/education/objectives';
import { trackServer } from '@/lib/analytics/identity';
import { EVENTS } from '@/lib/analytics/events';

export async function GET() {
  try {
    const session = await resolveSession();
    if (!session?.userId) throw unauthorized();

    const [teaching, enrolled] = await Promise.all([
      db.cohort.findMany({
        where: { instructorUserId: session.userId },
        include: { _count: { select: { members: true } }, objectives: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.cohortMember.findMany({
        where: { userId: session.userId, role: 'STUDENT' },
        include: {
          cohort: { include: { _count: { select: { members: true } }, objectives: true } },
        },
      }),
    ]);

    return NextResponse.json({
      scenarios: SCENARIOS,
      metrics: OBJECTIVE_METRICS,
      teaching: teaching.map(cohort => ({
        id: cohort.id,
        name: cohort.name,
        // Only the instructor ever sees the join code.
        joinCode: cohort.joinCode,
        scenario: cohort.scenario,
        status: cohort.status,
        seats: seatUsage(cohort.seatLimit, cohort._count.members),
        objectives: cohort.objectives,
        createdAt: cohort.createdAt,
      })),
      enrolled: enrolled.map(membership => ({
        id: membership.cohort.id,
        name: membership.cohort.name,
        scenario: membership.cohort.scenario,
        status: membership.cohort.status,
        objectives: membership.cohort.objectives,
        joinedAt: membership.joinedAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  scenario: z.string().max(40).default('STANDARD'),
  seatLimit: z.number().int().min(1).max(500).default(30),
  /** Omit to take the scenario's suggested objectives. */
  objectives: z
    .array(
      z.object({
        metric: z.string().max(40),
        label: z.string().trim().min(1).max(120),
        target: z.number().finite(),
        weight: z.number().finite().min(0).max(10).default(1),
      }),
    )
    .max(12)
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await resolveSession();
    if (!session?.userId) throw unauthorized();

    const body = createSchema.parse(await request.json());
    const scenario = getScenario(body.scenario);
    const season = await getActiveSeason();

    const objectives = (body.objectives ?? scenario.defaultObjectives).map(objective => {
      if (!(objective.metric in OBJECTIVE_METRICS)) {
        throw validationError(`Unknown objective metric: ${objective.metric}`);
      }
      return {
        metric: objective.metric,
        label: objective.label,
        target: objective.target,
        weight: objective.weight,
      };
    });

    // Codes are short and human-typed, so collisions are possible rather than
    // theoretical. Retry a few times before giving up rather than handing the
    // instructor a unique-constraint error.
    type CreatedCohort = Awaited<ReturnType<typeof db.cohort.create>> & {
      objectives: { id: string; metric: string; label: string; target: number; weight: number }[];
      _count: { members: number };
    };
    let cohort: CreatedCohort | null = null;
    for (let attempt = 0; attempt < 5 && !cohort; attempt++) {
      const joinCode = generateJoinCode(max => randomInt(max));
      try {
        cohort = await db.cohort.create({
          data: {
            name: body.name,
            joinCode,
            instructorUserId: session.userId,
            seasonId: season?.id ?? null,
            scenario: scenario.id,
            seatLimit: body.seatLimit,
            status: 'ACTIVE',
            objectives: { create: objectives },
            // The instructor is a member too, so the gradebook and the cohort
            // list have one definition of who is involved.
            members: { create: { userId: session.userId, role: 'INSTRUCTOR' } },
          },
          include: { objectives: true, _count: { select: { members: true } } },
        });
      } catch {
        // Almost certainly the join code; try another.
      }
    }

    if (!cohort) throw validationError('Could not allocate a join code. Try again.');

    void trackServer(EVENTS.COHORT_CREATED, { scenario: cohort.scenario });

    return NextResponse.json({
      success: true,
      cohort: {
        id: cohort.id,
        name: cohort.name,
        joinCode: cohort.joinCode,
        scenario: cohort.scenario,
        status: cohort.status,
        seats: seatUsage(cohort.seatLimit, cohort._count.members),
        objectives: cohort.objectives,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
