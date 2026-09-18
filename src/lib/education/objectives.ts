// ============================================
// Bangladesh Business Tycoon - Education: Objectives & Grading
// ============================================
//
// The simulation already teaches the things a first-year business course covers
// — COGS, gross and net margin, working capital, loan amortisation, NPS,
// customer acquisition cost. What it lacked was any way for an instructor to
// *set* something and mark it.
//
// These are the metrics that can be read straight out of a student's save, and
// the grading that turns them into a mark. Pure: no database, so an instructor's
// marking scheme can be tested without seeding a class.

export type ObjectiveMetric =
  | 'NET_WORTH'
  | 'NET_MARGIN'
  | 'GROSS_MARGIN'
  | 'BUSINESS_COUNT'
  | 'REPUTATION'
  | 'NPS'
  | 'WORKING_CAPITAL_RATIO'
  | 'DEBT_CLEARED'
  | 'PROFITABLE_DAYS';

export interface ObjectiveDef {
  metric: ObjectiveMetric;
  label: string;
  /** What the number means, in the language a course would use. */
  teaches: string;
  /** How the value is written: plain number, taka, or a share. */
  format: 'number' | 'taka' | 'percent';
  /** True when a lower value is the better outcome. */
  lowerIsBetter?: boolean;
}

export const OBJECTIVE_METRICS: Record<ObjectiveMetric, ObjectiveDef> = {
  NET_WORTH: {
    metric: 'NET_WORTH',
    label: 'Net worth',
    teaches: 'Balance sheet: assets less liabilities, and what actually builds it.',
    format: 'taka',
  },
  NET_MARGIN: {
    metric: 'NET_MARGIN',
    label: 'Net margin',
    teaches: 'Profit after every cost, not just after cost of goods.',
    format: 'percent',
  },
  GROSS_MARGIN: {
    metric: 'GROSS_MARGIN',
    label: 'Gross margin',
    teaches: 'Revenue less COGS — the difference between markup and profit.',
    format: 'percent',
  },
  BUSINESS_COUNT: {
    metric: 'BUSINESS_COUNT',
    label: 'Businesses operated',
    teaches: 'Diversification, and the cost of expanding faster than cash allows.',
    format: 'number',
  },
  REPUTATION: {
    metric: 'REPUTATION',
    label: 'Best reputation',
    teaches: 'Brand equity as an asset that takes time to build and moments to lose.',
    format: 'number',
  },
  NPS: {
    metric: 'NPS',
    label: 'Net Promoter Score',
    teaches: 'Customer satisfaction measured the way industry measures it.',
    format: 'number',
  },
  WORKING_CAPITAL_RATIO: {
    metric: 'WORKING_CAPITAL_RATIO',
    label: 'Working capital ratio',
    teaches: 'Cash against a day of restocking — why profitable businesses still fail.',
    format: 'number',
  },
  DEBT_CLEARED: {
    metric: 'DEBT_CLEARED',
    label: 'Debt cleared',
    teaches: 'Loan amortisation, and the real cost of flat-rate interest.',
    format: 'taka',
  },
  PROFITABLE_DAYS: {
    metric: 'PROFITABLE_DAYS',
    label: 'Profitable days',
    teaches: 'Consistency over a lucky week.',
    format: 'number',
  },
};

/** One thing a cohort is marked on. */
export interface Objective {
  metric: ObjectiveMetric;
  label: string;
  target: number;
  /** Share of the overall mark. Normalised across the set when grading. */
  weight: number;
}

/** A student's measured values, read from their save. */
export type ObjectiveValues = Partial<Record<ObjectiveMetric, number>>;

export interface ObjectiveResult {
  metric: ObjectiveMetric;
  label: string;
  target: number;
  value: number;
  /** 0-1, capped: exceeding a target is met, not extra credit. */
  attainment: number;
  met: boolean;
  weight: number;
}

export interface Grade {
  /** 0-100. */
  score: number;
  results: ObjectiveResult[];
  objectivesMet: number;
  objectivesTotal: number;
}

/**
 * How far a student got towards one objective.
 *
 * Capped at 1 on purpose. A student who triples the target has met it; letting
 * them bank 300% would let one runaway metric paper over every other objective,
 * which is the opposite of what a marking scheme is for.
 */
export function attainmentFor(objective: Objective, value: number): number {
  const def = OBJECTIVE_METRICS[objective.metric];
  if (!def) return 0;
  if (!Number.isFinite(value)) return 0;

  if (objective.target === 0) return value === 0 ? 1 : 0;

  const ratio = def.lowerIsBetter
    ? objective.target / Math.max(value, Number.EPSILON)
    : value / objective.target;

  return Math.max(0, Math.min(1, ratio));
}

/**
 * Grade a student against a cohort's objectives.
 *
 * Weights are normalised rather than assumed to sum to 1, so an instructor who
 * writes 2/1/1 gets what they plainly meant instead of a mark out of 400.
 */
export function gradeStudent(objectives: Objective[], values: ObjectiveValues): Grade {
  if (objectives.length === 0) {
    return { score: 0, results: [], objectivesMet: 0, objectivesTotal: 0 };
  }

  const totalWeight = objectives.reduce((sum, o) => sum + Math.max(0, o.weight), 0);

  const results: ObjectiveResult[] = objectives.map(objective => {
    const value = values[objective.metric] ?? 0;
    const attainment = attainmentFor(objective, value);
    return {
      metric: objective.metric,
      label: objective.label,
      target: objective.target,
      value,
      attainment,
      met: attainment >= 1,
      weight: objective.weight,
    };
  });

  const score =
    totalWeight > 0
      ? results.reduce((sum, r) => sum + r.attainment * Math.max(0, r.weight), 0) / totalWeight
      : 0;

  return {
    score: Math.round(score * 1000) / 10,
    results,
    objectivesMet: results.filter(r => r.met).length,
    objectivesTotal: results.length,
  };
}

/**
 * Read a student's metrics out of their save.
 *
 * Kept here rather than in the API route so the mapping from a save to a mark
 * has one definition and can be tested against a fixture.
 */
export function measureStudent(save: {
  netWorth: number;
  businesses: {
    totalRevenue: number;
    totalProfit: number;
    dailyRevenue: number;
    dailyCOGS: number;
    dailyProfit: number;
    reputation: number;
    npsScore: number;
  }[];
  cash: number;
  clearedDebt: number;
  profitableDays: number;
}): ObjectiveValues {
  const businesses = save.businesses;

  const totalRevenue = businesses.reduce((sum, b) => sum + b.totalRevenue, 0);
  const totalProfit = businesses.reduce((sum, b) => sum + b.totalProfit, 0);
  const dailyRevenue = businesses.reduce((sum, b) => sum + b.dailyRevenue, 0);
  const dailyCogs = businesses.reduce((sum, b) => sum + b.dailyCOGS, 0);

  return {
    NET_WORTH: save.netWorth,
    NET_MARGIN: totalRevenue > 0 ? totalProfit / totalRevenue : 0,
    GROSS_MARGIN: dailyRevenue > 0 ? (dailyRevenue - dailyCogs) / dailyRevenue : 0,
    BUSINESS_COUNT: businesses.length,
    REPUTATION: businesses.length > 0 ? Math.max(...businesses.map(b => b.reputation)) : 0,
    NPS: businesses.length > 0
      ? businesses.reduce((sum, b) => sum + b.npsScore, 0) / businesses.length
      : 0,
    // Cash against a day's restocking: the number that explains why a
    // profitable shop can still fail to open tomorrow.
    WORKING_CAPITAL_RATIO: dailyCogs > 0 ? save.cash / dailyCogs : 0,
    DEBT_CLEARED: save.clearedDebt,
    PROFITABLE_DAYS: save.profitableDays,
  };
}
