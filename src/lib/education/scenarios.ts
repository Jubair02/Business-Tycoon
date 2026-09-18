// ============================================
// Bangladesh Business Tycoon - Education: Scenarios & Seats
// ============================================
//
// A scenario is the starting position a whole class shares, so that what a
// student did is comparable with what the student next to them did. Without one
// a cohort is thirty people playing thirty different games, and nothing an
// instructor marks means anything across the group.
//
// Scenarios constrain the *opening* position only. They never change the
// economy's rules — the whole teaching value is that the simulation behaves the
// same for everybody, and a scenario that quietly altered margins would teach
// the wrong lesson convincingly.

import type { Objective, ObjectiveMetric } from './objectives';

export interface Scenario {
  id: string;
  name: string;
  /** What this scenario is for, in an instructor's terms. */
  brief: string;
  /** Opening cash, in taka. */
  startingCash: number;
  /** Business types a student may open. Empty means all of them. */
  allowedBusinessTypes: string[];
  /** Cities a student may trade in. Empty means all of them. */
  allowedCities: string[];
  /** Whether borrowing is available in this scenario. */
  loansEnabled: boolean;
  /** Suggested objectives. An instructor can replace them entirely. */
  defaultObjectives: Objective[];
  /** The concepts this scenario is built to put pressure on. */
  teaches: ObjectiveMetric[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'STANDARD',
    name: 'Open brief',
    brief:
      'The game as everyone else plays it. Use when the point is exploration rather than a specific lesson.',
    startingCash: 500_000,
    allowedBusinessTypes: [],
    allowedCities: [],
    loansEnabled: true,
    teaches: ['NET_WORTH', 'NET_MARGIN', 'BUSINESS_COUNT'],
    defaultObjectives: [
      { metric: 'NET_WORTH', label: 'Grow net worth past ৳15 lakh', target: 1_500_000, weight: 2 },
      { metric: 'NET_MARGIN', label: 'Hold a net margin above 15%', target: 0.15, weight: 1 },
      { metric: 'PROFITABLE_DAYS', label: 'Trade profitably for 20 days', target: 20, weight: 1 },
    ],
  },
  {
    id: 'THIN_MARGINS',
    name: 'Thin margins',
    brief:
      'A grocery in one city and nothing else. Forces the difference between markup and net margin: turnover is high, and rent, power and wages eat most of it.',
    startingCash: 400_000,
    allowedBusinessTypes: ['GROCERY'],
    allowedCities: ['DHAKA'],
    loansEnabled: false,
    teaches: ['GROSS_MARGIN', 'NET_MARGIN', 'WORKING_CAPITAL_RATIO'],
    defaultObjectives: [
      { metric: 'GROSS_MARGIN', label: 'Reach a 14% gross margin', target: 0.14, weight: 1 },
      { metric: 'NET_MARGIN', label: 'Reach a 9% net margin', target: 0.09, weight: 2 },
      { metric: 'WORKING_CAPITAL_RATIO', label: 'Keep a day of restocking in cash', target: 1, weight: 2 },
    ],
  },
  {
    id: 'WORKING_CAPITAL',
    name: 'Cash is not profit',
    brief:
      'An electronics shop with barely enough float. The classic lesson: a profitable business that cannot fund tomorrow’s stock does not open tomorrow.',
    startingCash: 1_200_000,
    allowedBusinessTypes: ['MOBILE'],
    allowedCities: [],
    loansEnabled: true,
    teaches: ['WORKING_CAPITAL_RATIO', 'DEBT_CLEARED', 'NET_MARGIN'],
    defaultObjectives: [
      { metric: 'WORKING_CAPITAL_RATIO', label: 'Never drop below a day of stock in cash', target: 1, weight: 3 },
      { metric: 'DEBT_CLEARED', label: 'Clear ৳5 lakh of borrowing', target: 500_000, weight: 2 },
      { metric: 'NET_WORTH', label: 'Finish above where you started', target: 1_200_000, weight: 1 },
    ],
  },
  {
    id: 'CUSTOMER_FIRST',
    name: 'Service, not price',
    brief:
      'A restaurant against live AI rivals. Undercutting is available and mostly a trap: reputation and NPS move demand more durably than a price cut.',
    startingCash: 900_000,
    allowedBusinessTypes: ['RESTAURANT'],
    allowedCities: [],
    loansEnabled: true,
    teaches: ['NPS', 'REPUTATION', 'NET_MARGIN'],
    defaultObjectives: [
      { metric: 'REPUTATION', label: 'Reach a reputation of 80', target: 80, weight: 2 },
      { metric: 'NPS', label: 'Reach an NPS of 40', target: 40, weight: 2 },
      { metric: 'NET_MARGIN', label: 'Do it without losing money', target: 0.1, weight: 1 },
    ],
  },
];

const BY_ID = new Map(SCENARIOS.map(s => [s.id, s]));

export function getScenario(id: string): Scenario {
  return BY_ID.get(id) ?? SCENARIOS[0];
}

// ============================================
// Join codes and seats
// ============================================

/**
 * Characters a code may use.
 *
 * One of each confusable pair, never both: a class of thirty typing a code off
 * a projector will hit every one of these, and each one is a support request.
 * Dropped: O/0, I/1, L/1, S/5, B/8, Z/2, G/6.
 *
 * The letters are kept and the ambiguous digits dropped, which leaves 24
 * characters — a six-character code is still about 1.9 x 10^8 combinations,
 * far more than a join code needs.
 */
const CODE_ALPHABET = 'ACDEFHJKMNPQRTUVWXY34679';
const CODE_LENGTH = 6;

/**
 * Generate a join code.
 *
 * `randomInt` from a caller so this stays pure and testable; the route passes
 * `crypto.randomInt`.
 */
export function generateJoinCode(randomInt: (maxExclusive: number) => number): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** Normalise what a student typed, so case and stray spaces do not matter. */
export function normaliseJoinCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function isValidJoinCode(code: string): boolean {
  const normalised = normaliseJoinCode(code);
  if (normalised.length !== CODE_LENGTH) return false;
  return [...normalised].every(char => CODE_ALPHABET.includes(char));
}

export type JoinRefusal = 'not-found' | 'closed' | 'full' | 'already-member';

export interface JoinDecision {
  allowed: boolean;
  reason?: JoinRefusal;
}

/**
 * Whether a student may take a seat.
 *
 * Seat limits are the licensing model, so this is the enforcement point: a
 * cohort sold thirty seats admits thirty students, and the thirty-first is told
 * why rather than silently failing.
 */
export function canJoinCohort(params: {
  status: string;
  seatLimit: number;
  seatsTaken: number;
  alreadyMember: boolean;
}): JoinDecision {
  if (params.alreadyMember) return { allowed: false, reason: 'already-member' };
  if (params.status !== 'ACTIVE') return { allowed: false, reason: 'closed' };
  if (params.seatsTaken >= params.seatLimit) return { allowed: false, reason: 'full' };
  return { allowed: true };
}

export interface SeatUsage {
  limit: number;
  used: number;
  remaining: number;
  /** 0-1. */
  utilisation: number;
}

export function seatUsage(limit: number, used: number): SeatUsage {
  const safeLimit = Math.max(0, limit);
  const safeUsed = Math.max(0, used);
  return {
    limit: safeLimit,
    used: safeUsed,
    remaining: Math.max(0, safeLimit - safeUsed),
    utilisation: safeLimit > 0 ? Math.min(1, safeUsed / safeLimit) : 0,
  };
}
