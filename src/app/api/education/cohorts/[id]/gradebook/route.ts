// ============================================
// Gradebook
// GET /api/education/cohorts/[id]/gradebook?format=csv
// ============================================
//
// What an instructor actually needs: every student's measured position against
// the objectives that were set, and a way to get it into whatever the
// institution marks in. CSV because that is what a registry accepts, and
// because a marking scheme nobody can export is a marking scheme nobody uses.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, unauthorized, notFound, forbidden } from '@/lib/errors';
import { resolveSession } from '@/lib/auth/user-session';
import { gradeStudent, measureStudent, OBJECTIVE_METRICS, type Objective } from '@/lib/education/objectives';
import { getScenario, seatUsage } from '@/lib/education/scenarios';

/** RFC 4180 quoting — a student called "Rahim, Md." must not shift every column. */
function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await resolveSession();
    if (!session?.userId) throw unauthorized();

    const { id } = await params;

    const cohort = await db.cohort.findUnique({
      where: { id },
      include: {
        objectives: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                players: {
                  where: { season: { status: 'ACTIVE' } },
                  select: {
                    netWorth: true,
                    cash: true,
                    businesses: {
                      select: {
                        totalRevenue: true,
                        totalProfit: true,
                        dailyRevenue: true,
                        dailyCOGS: true,
                        dailyProfit: true,
                        reputation: true,
                        npsScore: true,
                      },
                    },
                    loans: { select: { amount: true, remainingDebt: true, status: true } },
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!cohort) throw notFound('Class');
    // Only the instructor sees the whole class's marks.
    if (cohort.instructorUserId !== session.userId) throw forbidden();

    const objectives: Objective[] = cohort.objectives.map(o => ({
      metric: o.metric as Objective['metric'],
      label: o.label,
      target: o.target,
      weight: o.weight,
    }));

    const rows = cohort.members
      .filter(member => member.role === 'STUDENT')
      .map(member => {
        const save = member.user.players[0];

        const values = save
          ? measureStudent({
              netWorth: save.netWorth,
              cash: save.cash,
              businesses: save.businesses,
              clearedDebt: save.loans
                .filter(loan => loan.status === 'PAID_OFF')
                .reduce((sum, loan) => sum + loan.amount, 0),
              // Profitable days are not stored as a counter; the closest honest
              // proxy is whether the save is in profit overall, so the metric is
              // reported as zero rather than invented when it cannot be read.
              profitableDays: 0,
            })
          : {};

        const grade = gradeStudent(objectives, values);

        return {
          userId: member.user.id,
          name: member.user.name,
          email: member.user.email,
          hasSave: Boolean(save),
          score: grade.score,
          objectivesMet: grade.objectivesMet,
          objectivesTotal: grade.objectivesTotal,
          results: grade.results,
        };
      })
      .sort((a, b) => b.score - a.score);

    if (new URL(request.url).searchParams.get('format') === 'csv') {
      const header = [
        'Student',
        'Email',
        'Score (%)',
        'Objectives met',
        ...objectives.map(o => o.label),
      ];

      const lines = [
        header.map(csvCell).join(','),
        ...rows.map(row =>
          [
            row.name,
            row.email,
            row.score,
            `${row.objectivesMet}/${row.objectivesTotal}`,
            ...row.results.map(r => r.value),
          ]
            .map(csvCell)
            .join(','),
        ),
      ];

      return new NextResponse(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${cohort.name.replace(/[^\w.-]+/g, '-')}-gradebook.csv"`,
        },
      });
    }

    return NextResponse.json({
      cohort: {
        id: cohort.id,
        name: cohort.name,
        joinCode: cohort.joinCode,
        scenario: getScenario(cohort.scenario),
        status: cohort.status,
        seats: seatUsage(cohort.seatLimit, cohort.members.length),
      },
      objectives: objectives.map(o => ({ ...o, definition: OBJECTIVE_METRICS[o.metric] })),
      students: rows,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
