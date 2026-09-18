// ============================================
// Bangladesh Business Tycoon - Rewarded Video
// ============================================
//
// Rewarded video is the right monetisation for this market — IAP propensity in
// Bangladesh is low and ad inventory is not — but it runs straight into the
// same rule the store obeys: nothing bought or watched may change what the
// simulation produces.
//
// The usual rewarded-video prize (free currency, a free restock, a speed-up)
// would break that outright. So what a video pays out here is *pass XP*: it
// advances the cosmetic reward track and touches nothing the economy reads. A
// player who watches every video available gets their cosmetics sooner and not
// one taka more than a player who watches none.
//
// That is a smaller carrot than a free restock, and it is the only one that
// leaves the leaderboard meaning anything.

export interface RewardPlacement {
  id: string;
  label: string;
  description: string;
  /** Pass XP granted per completed view. */
  passXp: number;
  /** Most views of this placement that will pay out in a day. */
  dailyCap: number;
  icon: string;
}

export const REWARD_PLACEMENTS: RewardPlacement[] = [
  {
    id: 'pass.boost',
    label: 'Watch for pass progress',
    description: 'A short video for progress on this season’s reward track.',
    passXp: 100,
    dailyCap: 3,
    icon: '🎬',
  },
  {
    id: 'daily.bonus',
    label: 'Daily bonus',
    description: 'One video a day for a larger slice of the track.',
    passXp: 200,
    dailyCap: 1,
    icon: '🎁',
  },
];

const BY_ID = new Map(REWARD_PLACEMENTS.map(placement => [placement.id, placement]));

export function getRewardPlacement(id: string): RewardPlacement | undefined {
  return BY_ID.get(id);
}

/** Total pass XP a player could earn from video in one day. */
export function maxDailyRewardXp(): number {
  return REWARD_PLACEMENTS.reduce((sum, p) => sum + p.passXp * p.dailyCap, 0);
}

export type RewardRefusal = 'unknown-placement' | 'cap-reached' | 'ads-disabled';

export interface RewardDecision {
  allowed: boolean;
  reason?: RewardRefusal;
  passXp?: number;
}

/**
 * Whether a completed view should pay out.
 *
 * Checked server-side against rewards already recorded today — the client
 * saying a video finished is not evidence that one did, which is exactly why
 * the network's signed callback exists.
 */
export function canGrantReward(params: {
  placementId: string;
  viewsToday: number;
  adsEnabled: boolean;
}): RewardDecision {
  if (!params.adsEnabled) return { allowed: false, reason: 'ads-disabled' };

  const placement = getRewardPlacement(params.placementId);
  if (!placement) return { allowed: false, reason: 'unknown-placement' };

  if (params.viewsToday >= placement.dailyCap) return { allowed: false, reason: 'cap-reached' };

  return { allowed: true, passXp: placement.passXp };
}

/**
 * Sanity check, asserted by the tests.
 *
 * The load-bearing one is that the total daily video reward stays under the
 * pass's own daily XP cap: if video alone could fill the cap, playing the game
 * would stop being the way to progress the track.
 */
export function rewardProblems(passDailyXpCap: number): string[] {
  const problems: string[] = [];

  for (const placement of REWARD_PLACEMENTS) {
    if (placement.passXp <= 0) problems.push(`${placement.id}: reward must be positive`);
    if (placement.dailyCap <= 0) problems.push(`${placement.id}: cap must be positive`);
  }

  if (maxDailyRewardXp() >= passDailyXpCap) {
    problems.push(
      `Video alone (${maxDailyRewardXp()} XP) meets or exceeds the pass daily cap ` +
        `(${passDailyXpCap}), which would make watching ads a substitute for playing.`,
    );
  }

  return problems;
}
