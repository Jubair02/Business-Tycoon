// ============================================
// Bangladesh Business Tycoon - Season Config
// ============================================
//
// Pure configuration and scoring for seasons. No Prisma, no clock, no Node —
// so the rules that decide what a finished season was worth can be tested
// directly, and read by the client as easily as by the engine.

export type SeasonStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED';

export const SEASON_CONFIG = {
  /**
   * Game days in a season.
   *
   * A game day is a real minute, so 90 days is about a day and a half of
   * wall-clock time at the default tick rate — short enough to run a real
   * season in testing, and the number is a single knob if the live cadence
   * should be slower.
   */
  lengthDays: 90,

  /** Prestige is capped so a long-running account cannot run away with it. */
  maxPrestige: 50,

  /**
   * A season only counts as played — for prestige, badges and the archive — if
   * the account actually turned up for this much of it. It stops someone
   * signing in on the last day to collect a participation badge.
   */
  minDaysForCredit: 3,

  /** Net worth every season starts from, mirrored from `STARTING_CASH`. */
  startingNetWorth: 500_000,
} as const;

/**
 * Season names, cycled by number. Tied to the Bangladeshi calendar rather than
 * to "Season 7", because the game's whole positioning is that it is set
 * somewhere specific.
 */
const SEASON_NAMES = [
  'Monsoon Trade',
  'Winter Market',
  'Boishakh Boom',
  'Eid Rush',
  'Harvest',
  'Delta Expansion',
];

export function seasonName(number: number): string {
  const index = (Math.max(1, number) - 1) % SEASON_NAMES.length;
  return `Season ${number} — ${SEASON_NAMES[index]}`;
}

// ============================================
// Prestige
// ============================================

export interface SeasonResult {
  /** Net worth when the season closed. */
  finalNetWorth: number;
  /** 1 = first place. */
  finalRank: number;
  /** How many accounts were ranked, for scaling rank rewards fairly. */
  totalRanked: number;
  businessCount: number;
  totalProfit: number;
  /** Game days this account was actually present for. */
  daysPlayed: number;
  seasonLengthDays: number;
}

/**
 * Prestige earned for a finished season.
 *
 * Deliberately status-only — it buys cosmetics and leaderboard flair, never
 * cash, cheaper rent or better margins. A returning player and a first-timer
 * start every season on identical terms, which is the entire reason for
 * resetting: a ladder nobody can catch up on is the problem seasons exist to
 * solve, and carrying an economic edge over would rebuild it.
 */
export function calculatePrestige(result: SeasonResult): number {
  if (result.daysPlayed < SEASON_CONFIG.minDaysForCredit) return 0;

  let prestige = 1; // Turning up and playing it out.

  // Placing. Scaled against the size of the field so a top-10 finish in a
  // twelve-player season is not worth the same as one in a thousand-player
  // season.
  const field = Math.max(1, result.totalRanked);
  const percentile = 1 - (result.finalRank - 1) / field;
  if (result.finalRank === 1) prestige += 5;
  else if (percentile >= 0.99) prestige += 4;
  else if (percentile >= 0.9) prestige += 3;
  else if (percentile >= 0.75) prestige += 2;
  else if (percentile >= 0.5) prestige += 1;

  // Building something, rather than sitting on the opening cash.
  if (result.finalNetWorth >= SEASON_CONFIG.startingNetWorth * 20) prestige += 3;
  else if (result.finalNetWorth >= SEASON_CONFIG.startingNetWorth * 5) prestige += 2;
  else if (result.finalNetWorth > SEASON_CONFIG.startingNetWorth) prestige += 1;

  // Playing most of the season rather than the first week of it.
  if (result.daysPlayed >= result.seasonLengthDays * 0.75) prestige += 1;

  return Math.max(0, prestige);
}

/** Prestige tiers, purely for display. */
export function prestigeTier(prestige: number): { tier: number; label: string } {
  const tiers: { min: number; label: string }[] = [
    { min: 40, label: 'Legend of the Delta' },
    { min: 25, label: 'Magnate' },
    { min: 15, label: 'Industrialist' },
    { min: 8, label: 'Merchant' },
    { min: 3, label: 'Trader' },
    { min: 1, label: 'Shopkeeper' },
    { min: 0, label: 'Newcomer' },
  ];
  const index = tiers.findIndex(t => prestige >= t.min);
  return { tier: tiers.length - 1 - index, label: tiers[index].label };
}

// ============================================
// Badges
// ============================================

export interface BadgeDef {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export const BADGES: Record<string, BadgeDef> = {
  CHAMPION: { id: 'CHAMPION', label: 'Champion', description: 'Finished a season in first place.', icon: '👑' },
  TOP_10: { id: 'TOP_10', label: 'Top 10', description: 'Finished a season in the top ten.', icon: '🏅' },
  TOP_HALF: { id: 'TOP_HALF', label: 'Top Half', description: 'Finished a season in the upper half of the table.', icon: '🎖️' },
  CROREPATI: { id: 'CROREPATI', label: 'Crorepati', description: 'Closed a season worth over one crore taka.', icon: '💎' },
  CONGLOMERATE: { id: 'CONGLOMERATE', label: 'Conglomerate', description: 'Closed a season running five or more businesses.', icon: '🏢' },
  FULL_SEASON: { id: 'FULL_SEASON', label: 'Full Season', description: 'Played a season from start to finish.', icon: '📅' },
  FOUNDER: { id: 'FOUNDER', label: 'Founder', description: 'Played in the very first season.', icon: '🇧🇩' },
};

/**
 * The badges a finished season earned.
 *
 * Returned as ids so the archive stays small and the labels can be translated
 * without rewriting history.
 */
export function awardSeasonBadges(
  result: SeasonResult & { seasonNumber: number },
): string[] {
  if (result.daysPlayed < SEASON_CONFIG.minDaysForCredit) return [];

  const badges: string[] = [];
  const field = Math.max(1, result.totalRanked);
  const percentile = 1 - (result.finalRank - 1) / field;

  if (result.finalRank === 1) badges.push(BADGES.CHAMPION.id);
  else if (result.finalRank <= 10) badges.push(BADGES.TOP_10.id);
  else if (percentile >= 0.5) badges.push(BADGES.TOP_HALF.id);

  if (result.finalNetWorth >= 10_000_000) badges.push(BADGES.CROREPATI.id);
  if (result.businessCount >= 5) badges.push(BADGES.CONGLOMERATE.id);
  if (result.daysPlayed >= result.seasonLengthDays * 0.9) badges.push(BADGES.FULL_SEASON.id);
  if (result.seasonNumber === 1) badges.push(BADGES.FOUNDER.id);

  return badges;
}

/** How far through a season we are, 0-1. */
export function seasonProgress(gameDay: number, lengthDays: number): number {
  if (lengthDays <= 0) return 1;
  return Math.max(0, Math.min(1, gameDay / lengthDays));
}

/** Whether this season has run its course. */
export function isSeasonOver(gameDay: number, lengthDays: number): boolean {
  return gameDay >= lengthDays;
}

/** Game days left, floored at zero. */
export function daysRemaining(gameDay: number, lengthDays: number): number {
  return Math.max(0, lengthDays - gameDay);
}
