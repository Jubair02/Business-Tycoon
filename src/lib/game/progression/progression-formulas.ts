// ============================================
// Bangladesh Business Tycoon - Player Progression Formulas
// Phase 6: Player experience & levelling
// ============================================
//
// Pure functions only — no database, no Prisma. Everything here takes plain
// values and returns plain values so the curve can be tuned and tested without
// standing up a game.

import { PROGRESSION_CONFIG } from './progression-config';

export interface LevelProgress {
  /** Level after applying the gain. */
  level: number;
  /** XP *within* the new level (what the UI renders against the threshold). */
  experience: number;
  /** How many levels were crossed by this award. Zero for a normal gain. */
  levelsGained: number;
  /** XP still needed to reach the next level. Zero at max level. */
  xpToNext: number;
}

/**
 * XP required to advance from `level` to `level + 1`.
 * Returns 0 at (or above) the cap, which is what stops progression there.
 */
export function xpForNextLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  if (safeLevel >= PROGRESSION_CONFIG.maxLevel) return 0;
  return safeLevel * PROGRESSION_CONFIG.xpPerLevelStep;
}

/**
 * Cumulative XP a player has earned across their whole run to sit at
 * `level` with `experience` XP banked toward the next one.
 *
 * Not used by the game loop — `Player.experience` deliberately stores only the
 * current level's progress — but it is what analytics and balance work need,
 * and it makes the curve testable as a whole.
 */
export function lifetimeXpAt(level: number, experience = 0): number {
  const safeLevel = Math.max(1, Math.floor(level));
  // Sum of 1000*1 + 1000*2 + ... + 1000*(level-1)
  const stepsCompleted = ((safeLevel - 1) * safeLevel) / 2;
  return stepsCompleted * PROGRESSION_CONFIG.xpPerLevelStep + Math.max(0, experience);
}

/**
 * Apply an XP award, rolling over as many levels as the award covers.
 *
 * A single award can cross more than one level (a late-game upgrade is worth
 * thousands of XP), so this loops rather than levelling once. At the cap, XP is
 * clamped to the threshold so the UI shows a full bar instead of a bar past
 * 100% or a counter that climbs forever.
 *
 * Negative or non-finite gains are ignored: XP is never taken away. A bad day
 * already costs the player money, and clawing back progress would let a player
 * *lose* a business slot they had already unlocked.
 */
export function applyExperienceGain(
  currentLevel: number,
  currentExperience: number,
  gainedXp: number,
): LevelProgress {
  let level = Math.max(1, Math.floor(currentLevel || 1));
  let experience = Math.max(0, Math.floor(currentExperience || 0));
  const gain = Number.isFinite(gainedXp) ? Math.max(0, Math.floor(gainedXp)) : 0;

  const startLevel = level;
  experience += gain;

  // Roll over as many thresholds as the total covers.
  let threshold = xpForNextLevel(level);
  while (threshold > 0 && experience >= threshold) {
    experience -= threshold;
    level += 1;
    threshold = xpForNextLevel(level);
  }

  // At the cap there is no next threshold; park the bar at full.
  if (level >= PROGRESSION_CONFIG.maxLevel) {
    level = PROGRESSION_CONFIG.maxLevel;
    experience = Math.min(
      experience,
      PROGRESSION_CONFIG.maxLevel * PROGRESSION_CONFIG.xpPerLevelStep,
    );
  }

  return {
    level,
    experience,
    levelsGained: level - startLevel,
    xpToNext: Math.max(0, xpForNextLevel(level) - experience),
  };
}

/**
 * XP for a business that finished the day in profit.
 *
 * Flat base plus a logarithmic profit bonus. The log is what keeps the curve
 * honest: day-1 steady-state profit ranges from ~৳785 (Tea Stall) to ~৳37,600
 * (Mobile), a 48x spread that would otherwise translate straight into levelling
 * speed. Logarithmically it compresses to roughly 55 vs 135 XP/day.
 *
 * A break-even or losing day earns nothing.
 */
export function calculateProfitableDayXp(dailyProfit: number): number {
  if (!Number.isFinite(dailyProfit) || dailyProfit <= 0) return 0;

  const bonus = Math.min(
    PROGRESSION_CONFIG.profitBonusCap,
    PROGRESSION_CONFIG.profitBonusScale *
      Math.log10(1 + dailyProfit / PROGRESSION_CONFIG.profitBonusDivisor),
  );

  return Math.round(PROGRESSION_CONFIG.profitableDayBase + bonus);
}

/** XP for upgrading a business to `newLevel`, scaled by the level reached. */
export function calculateUpgradeXp(newLevel: number): number {
  const safeLevel = Math.max(1, Math.floor(newLevel || 1));
  return safeLevel * PROGRESSION_CONFIG.upgradeXpPerLevel;
}

/**
 * Did a business's lifetime profit cross from non-positive to positive?
 * Used for the one-off "first profit" bonus — a state transition, so it can
 * only ever fire once per business without any extra bookkeeping.
 */
export function crossedFirstProfit(
  previousTotalProfit: number,
  newTotalProfit: number,
): boolean {
  return (previousTotalProfit ?? 0) <= 0 && (newTotalProfit ?? 0) > 0;
}

/** True once the player can progress no further. */
export function isMaxLevel(level: number): boolean {
  return Math.floor(level || 1) >= PROGRESSION_CONFIG.maxLevel;
}
