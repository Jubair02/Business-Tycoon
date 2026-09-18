// ============================================
// Bangladesh Business Tycoon - Player Progression Config
// Phase 6: Player experience & levelling
// ============================================
//
// Player level was previously a dead field: nothing ever wrote it, so every
// save sat at level 1 forever. That silently disabled the whole expansion
// system, because EXPANSION_CONFIG.minLevelForSecondBusiness requires level 2
// before a second business can be opened.
//
// The curve is fixed by the UI, which predates this module: both the dashboard
// and the profile sheet render `experience / (level * 1000)`. So `experience`
// is progress *within* the current level, not a lifetime total, and the
// threshold grows linearly.

export const PROGRESSION_CONFIG = {
  /**
   * XP needed to advance from `level` to `level + 1`.
   * Linear at 1000/level — matches the `level * 1000` the UI already displays.
   */
  xpPerLevelStep: 1000,

  /**
   * Highest reachable level. Expansion needs level 5 for a fifth business and
   * the bank lends `level * 200,000`, so 25 leaves plenty of headroom above
   * every gate in the game without letting loan capacity run away.
   */
  maxLevel: 25,

  // ---- Profitable day ----
  /** Flat XP for any business that ends the day in profit. */
  profitableDayBase: 40,
  /**
   * Profit-scaled bonus: `profitBonusScale * log10(1 + profit / profitBonusDivisor)`.
   * Logarithmic on purpose — a Mobile shop out-earns a Tea Stall ~48x, and a
   * linear reward would let high-capital players skip the level curve entirely.
   */
  profitBonusScale: 60,
  profitBonusDivisor: 1000,
  /** Ceiling on the profit-scaled portion, so one huge day cannot buy a level. */
  profitBonusCap: 160,

  // ---- One-off milestones ----
  /** Opening a business (the first one, and every expansion after it). */
  newBusinessXp: 250,
  /** First time a business's lifetime profit turns positive. */
  firstProfitXp: 300,
  /** Upgrading a business, scaled by the level reached. */
  upgradeXpPerLevel: 150,
  /** Clearing a loan in full, whether by daily payments or early repayment. */
  loanClearedXp: 200,
} as const;

/** Log type used for level-up entries in the activity feed. */
export const LEVEL_UP_LOG_TYPE = 'LEVEL_UP';

/** Human-readable reasons, used in the level-up log message. */
export type XpReason =
  | 'PROFITABLE_DAY'
  | 'FIRST_PROFIT'
  | 'NEW_BUSINESS'
  | 'BUSINESS_UPGRADE'
  | 'LOAN_CLEARED';

export const XP_REASON_LABELS: Record<XpReason, string> = {
  PROFITABLE_DAY: 'daily profit',
  FIRST_PROFIT: 'first profit',
  NEW_BUSINESS: 'new business',
  BUSINESS_UPGRADE: 'business upgrade',
  LOAN_CLEARED: 'loan cleared',
};
