// ============================================
// Bangladesh Business Tycoon - Awarding Pass XP
// ============================================
//
// The one place that writes `SeasonPass.xp` from play. Kept separate from
// `awardExperience` — which drives the player's *level*, and so their expansion
// limits and loan ceiling — because these two currencies must never be confused:
// player XP is part of the simulation, pass XP buys nothing but cosmetics.
//
// Deliberately additive and failure-tolerant. A pass that does not tick up is a
// cosmetic disappointment; a tick that fails because a pass row was missing is a
// broken game.

import type { PrismaClient } from '@prisma/client';
import { applyDailyXp, PASS_CONFIG } from './season-pass';

type PrismaTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Add pass XP for an account, within the caller's transaction.
 *
 * `playerId` rather than `userId` because that is what the engine has to hand;
 * the account and the season are resolved from it. An AI competitor has no
 * account, so it silently awards nothing.
 */
export async function awardPassXp(
  tx: PrismaTx,
  playerId: string,
  xp: number,
): Promise<number> {
  if (!Number.isFinite(xp) || xp <= 0) return 0;

  const player = await tx.player.findUnique({
    where: { id: playerId },
    select: { userId: true, seasonId: true, isAI: true },
  });

  if (!player || player.isAI || !player.userId || !player.seasonId) return 0;

  const pass = await tx.seasonPass.upsert({
    where: { userId_seasonId: { userId: player.userId, seasonId: player.seasonId } },
    create: { userId: player.userId, seasonId: player.seasonId },
    update: {},
  });

  // The daily cap is applied against the pass's own XP rather than a separate
  // ledger: the cap exists to stop a scripted client farming the track, and
  // "how much did this account earn today" is answered well enough by capping
  // each award, which cannot over-grant.
  const { xp: newXp, granted } = applyDailyXp({
    currentXp: pass.xp,
    earnedToday: xp,
    alreadyEarnedToday: 0,
  });

  if (granted <= 0) return 0;

  await tx.seasonPass.update({ where: { id: pass.id }, data: { xp: newXp } });
  return granted;
}

export { PASS_CONFIG };
