// ============================================
// Bangladesh Business Tycoon - Education Edition Tests
// ============================================
//
// Grading and seat licensing. Both are places where being wrong is expensive in
// a way the rest of the game is not: a mark that is wrong affects somebody's
// course, and a seat limit that leaks is revenue given away.

import { describe, it, expect } from 'vitest';
import {
  OBJECTIVE_METRICS,
  attainmentFor,
  gradeStudent,
  measureStudent,
  type Objective,
} from '@/lib/education/objectives';
import {
  SCENARIOS,
  getScenario,
  generateJoinCode,
  normaliseJoinCode,
  isValidJoinCode,
  canJoinCohort,
  seatUsage,
} from '@/lib/education/scenarios';

const OBJECTIVES: Objective[] = [
  { metric: 'NET_WORTH', label: 'Net worth ৳15 lakh', target: 1_500_000, weight: 2 },
  { metric: 'NET_MARGIN', label: 'Net margin 15%', target: 0.15, weight: 1 },
];

describe('attainmentFor', () => {
  it('is zero at nothing and one at the target', () => {
    expect(attainmentFor(OBJECTIVES[0], 0)).toBe(0);
    expect(attainmentFor(OBJECTIVES[0], 1_500_000)).toBe(1);
  });

  it('is proportional in between', () => {
    expect(attainmentFor(OBJECTIVES[0], 750_000)).toBeCloseTo(0.5, 6);
  });

  it('caps at the target rather than giving extra credit', () => {
    // A runaway metric must not paper over every other objective.
    expect(attainmentFor(OBJECTIVES[0], 15_000_000)).toBe(1);
  });

  it('never goes negative', () => {
    expect(attainmentFor(OBJECTIVES[0], -500_000)).toBe(0);
  });

  it('handles a zero target without dividing by zero', () => {
    const objective: Objective = { metric: 'NET_WORTH', label: 'Break even', target: 0, weight: 1 };
    expect(attainmentFor(objective, 0)).toBe(1);
    expect(attainmentFor(objective, 5)).toBe(0);
  });

  it('scores a broken measurement as zero rather than as full marks', () => {
    // A NaN or an Infinity means the value could not be read, not that the
    // student achieved it. Marking it as met would hand out a grade nobody
    // earned.
    expect(attainmentFor(OBJECTIVES[0], Number.NaN)).toBe(0);
    expect(attainmentFor(OBJECTIVES[0], Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('gradeStudent', () => {
  it('marks a student who met everything at 100', () => {
    const grade = gradeStudent(OBJECTIVES, { NET_WORTH: 2_000_000, NET_MARGIN: 0.2 });
    expect(grade.score).toBe(100);
    expect(grade.objectivesMet).toBe(2);
  });

  it('marks a student who met nothing at 0', () => {
    const grade = gradeStudent(OBJECTIVES, { NET_WORTH: 0, NET_MARGIN: 0 });
    expect(grade.score).toBe(0);
    expect(grade.objectivesMet).toBe(0);
  });

  it('weights objectives as the instructor wrote them', () => {
    // Net worth carries twice the weight, so meeting only it should score ~67.
    const grade = gradeStudent(OBJECTIVES, { NET_WORTH: 1_500_000, NET_MARGIN: 0 });
    expect(grade.score).toBeCloseTo(66.7, 0);
  });

  it('normalises weights rather than marking out of their sum', () => {
    // 2 + 1 should mean the same as 20 + 10, not a mark out of 30.
    const scaled: Objective[] = OBJECTIVES.map(o => ({ ...o, weight: o.weight * 10 }));
    const a = gradeStudent(OBJECTIVES, { NET_WORTH: 1_500_000, NET_MARGIN: 0 });
    const b = gradeStudent(scaled, { NET_WORTH: 1_500_000, NET_MARGIN: 0 });
    expect(a.score).toBeCloseTo(b.score, 6);
  });

  it('treats a metric the student has no value for as zero, not as missing', () => {
    const grade = gradeStudent(OBJECTIVES, { NET_WORTH: 1_500_000 });
    expect(grade.results.find(r => r.metric === 'NET_MARGIN')!.value).toBe(0);
  });

  it('handles a cohort with no objectives set yet', () => {
    const grade = gradeStudent([], { NET_WORTH: 5_000_000 });
    expect(grade.score).toBe(0);
    expect(grade.objectivesTotal).toBe(0);
  });

  it('handles every weight being zero without dividing by zero', () => {
    const zeroed: Objective[] = OBJECTIVES.map(o => ({ ...o, weight: 0 }));
    expect(gradeStudent(zeroed, { NET_WORTH: 1_500_000 }).score).toBe(0);
  });
});

describe('measureStudent', () => {
  const save = {
    netWorth: 2_400_000,
    cash: 300_000,
    clearedDebt: 500_000,
    profitableDays: 21,
    businesses: [
      {
        totalRevenue: 1_000_000, totalProfit: 200_000,
        dailyRevenue: 80_000, dailyCOGS: 60_000, dailyProfit: 12_000,
        reputation: 72, npsScore: 35,
      },
      {
        totalRevenue: 500_000, totalProfit: 50_000,
        dailyRevenue: 20_000, dailyCOGS: 15_000, dailyProfit: 3_000,
        reputation: 64, npsScore: 45,
      },
    ],
  };

  it('reads net margin from cumulative figures, not a single day', () => {
    const values = measureStudent(save);
    expect(values.NET_MARGIN).toBeCloseTo(250_000 / 1_500_000, 6);
  });

  it('reads gross margin as revenue less COGS', () => {
    const values = measureStudent(save);
    expect(values.GROSS_MARGIN).toBeCloseTo((100_000 - 75_000) / 100_000, 6);
  });

  it('reads working capital as cash against a day of restocking', () => {
    // The number that explains why a profitable shop can fail to open tomorrow.
    expect(measureStudent(save).WORKING_CAPITAL_RATIO).toBeCloseTo(300_000 / 75_000, 6);
  });

  it('takes the best reputation and the average NPS', () => {
    const values = measureStudent(save);
    expect(values.REPUTATION).toBe(72);
    expect(values.NPS).toBe(40);
  });

  it('survives a student who has not started', () => {
    const values = measureStudent({
      netWorth: 500_000, cash: 500_000, clearedDebt: 0, profitableDays: 0, businesses: [],
    });
    expect(values.NET_MARGIN).toBe(0);
    expect(values.GROSS_MARGIN).toBe(0);
    expect(values.WORKING_CAPITAL_RATIO).toBe(0);
    expect(values.BUSINESS_COUNT).toBe(0);
  });
});

describe('scenarios', () => {
  it('describes what each one teaches', () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.brief.length).toBeGreaterThan(20);
      expect(scenario.teaches.length).toBeGreaterThan(0);
      expect(scenario.defaultObjectives.length).toBeGreaterThan(0);
    }
  });

  it('only teaches metrics that exist', () => {
    for (const scenario of SCENARIOS) {
      for (const metric of scenario.teaches) expect(OBJECTIVE_METRICS[metric]).toBeDefined();
      for (const objective of scenario.defaultObjectives) {
        expect(OBJECTIVE_METRICS[objective.metric]).toBeDefined();
      }
    }
  });

  it('falls back to the open brief for an unknown id', () => {
    expect(getScenario('made-up').id).toBe('STANDARD');
  });
});

describe('join codes', () => {
  const sequential = () => {
    let i = 0;
    return (max: number) => i++ % max;
  };

  it('generates a code of the expected shape', () => {
    const code = generateJoinCode(sequential());
    expect(code).toHaveLength(6);
    expect(isValidJoinCode(code)).toBe(true);
  });

  it('avoids characters a class will mistype off a projector', () => {
    const confusable = ['0', 'O', '1', 'I', 'L', '5', 'S', '8', 'B'];
    let generated = '';
    const random = sequential();
    for (let i = 0; i < 50; i++) generated += generateJoinCode(random);
    for (const char of confusable) {
      expect(generated.includes(char), `code alphabet contains ${char}`).toBe(false);
    }
  });

  it('forgives case and stray spacing', () => {
    expect(normaliseJoinCode(' a c d-e f g ')).toBe('ACDEFG');
  });

  it('rejects a code of the wrong length or with bad characters', () => {
    expect(isValidJoinCode('ACD')).toBe(false);
    expect(isValidJoinCode('ACDEFGH')).toBe(false);
    expect(isValidJoinCode('ACDEF0')).toBe(false);
  });
});

describe('seat licensing', () => {
  it('admits a student while seats remain', () => {
    expect(canJoinCohort({ status: 'ACTIVE', seatLimit: 30, seatsTaken: 29, alreadyMember: false }).allowed)
      .toBe(true);
  });

  it('refuses the seat past the limit, and says why', () => {
    const verdict = canJoinCohort({ status: 'ACTIVE', seatLimit: 30, seatsTaken: 30, alreadyMember: false });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toBe('full');
  });

  it('refuses a class that is not taking students', () => {
    expect(canJoinCohort({ status: 'ARCHIVED', seatLimit: 30, seatsTaken: 0, alreadyMember: false }).reason)
      .toBe('closed');
  });

  it('does not take a second seat for someone already in', () => {
    expect(canJoinCohort({ status: 'ACTIVE', seatLimit: 30, seatsTaken: 5, alreadyMember: true }).reason)
      .toBe('already-member');
  });

  describe('seatUsage', () => {
    it('reports what is left', () => {
      expect(seatUsage(30, 12)).toEqual({ limit: 30, used: 12, remaining: 18, utilisation: 0.4 });
    });

    it('never reports negative seats or over-full utilisation', () => {
      expect(seatUsage(30, 45).remaining).toBe(0);
      expect(seatUsage(30, 45).utilisation).toBe(1);
      expect(seatUsage(-5, -5).remaining).toBe(0);
    });

    it('handles a cohort with no seats', () => {
      expect(seatUsage(0, 0).utilisation).toBe(0);
    });
  });
});
