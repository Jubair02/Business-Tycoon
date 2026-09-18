// ============================================
// Bangladesh Business Tycoon - XP Awarding
// Phase 6: Player experience & levelling
// ============================================
//
// The one place that writes `Player.level` and `Player.experience`. Everything
// that hands out XP goes through `awardExperience`, so the level curve, the
// cap, and the level-up log entry all live together.

import type { PrismaClient } from '@prisma/client';
import { applyExperienceGain } from './progression-formulas';
import { LEVEL_UP_LOG_TYPE, XP_REASON_LABELS, type XpReason } from './progression-config';

/**
 * The interactive-transaction client Prisma hands to `$transaction(async tx => …)`.
 * Awards always run inside a caller's transaction so XP cannot be granted for a
 * business day (or an upgrade) that then rolls back.
 */
export type PrismaTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export interface AwardResult {
  level: number;
  experience: number;
  levelsGained: number;
  xpAwarded: number;
}

const NO_AWARD: AwardResult = { level: 1, experience: 0, levelsGained: 0, xpAwarded: 0 };

/**
 * Add XP to a player, levelling them up as far as the award carries.
 *
 * Reads the player's current level inside the caller's transaction rather than
 * taking it as an argument: a single tick calls this once per business, and a
 * stale read would silently drop the earlier businesses' XP.
 *
 * Writes a `LEVEL_UP` game log on each level gained so the change surfaces in
 * the activity feed and notification centre instead of the number quietly
 * changing in the top bar.
 */
export async function awardExperience(
  tx: PrismaTx,
  playerId: string,
  xp: number,
  reason: XpReason,
  businessId?: string,
): Promise<AwardResult> {
  if (!Number.isFinite(xp) || xp <= 0) return NO_AWARD;

  const player = await tx.player.findUnique({
    where: { id: playerId },
    select: { level: true, experience: true },
  });
  if (!player) return NO_AWARD;

  const progress = applyExperienceGain(player.level, player.experience, xp);

  // Nothing moved (already at the cap with a full bar) — skip the write.
  if (progress.level === player.level && progress.experience === player.experience) {
    return {
      level: player.level,
      experience: player.experience,
      levelsGained: 0,
      xpAwarded: 0,
    };
  }

  await tx.player.update({
    where: { id: playerId },
    data: { level: progress.level, experience: progress.experience },
  });

  if (progress.levelsGained > 0) {
    await tx.gameLog.create({
      data: {
        playerId,
        businessId: businessId ?? null,
        type: LEVEL_UP_LOG_TYPE,
        message:
          progress.levelsGained === 1
            ? `Level up! You are now Level ${progress.level} (${XP_REASON_LABELS[reason]}).`
            : `Level up! You gained ${progress.levelsGained} levels and are now Level ${progress.level} (${XP_REASON_LABELS[reason]}).`,
        amount: null,
      },
    });
  }

  return {
    level: progress.level,
    experience: progress.experience,
    levelsGained: progress.levelsGained,
    xpAwarded: Math.floor(xp),
  };
}
