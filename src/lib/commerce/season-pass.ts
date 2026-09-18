// ============================================
// Bangladesh Business Tycoon - Season Pass
// ============================================
//
// A reward track that runs the length of a season. Two lanes: a free one
// everybody is on, and a premium one the pass unlocks. Both lanes hand out
// cosmetics and nothing else, for the reason set out in `catalogue.ts` — a pass
// that sold an economic edge would undo the point of resetting each season.
//
// Pure: pass XP, tier maths and claim validation have no database in them.

export interface PassReward {
  /** Catalogue sku, or null for a purely decorative filler tier. */
  sku: string | null;
  label: string;
  icon: string;
}

export interface PassTier {
  /** 1-based. */
  tier: number;
  /** Pass XP needed to reach it. */
  xpRequired: number;
  free: PassReward | null;
  premium: PassReward | null;
}

export const PASS_CONFIG = {
  tiers: 10,
  /** XP for the first tier; each one after costs a little more. */
  baseTierXp: 400,
  tierXpGrowth: 1.15,
  /** Ceiling on XP earned in one game day, so a bot cannot farm the track. */
  dailyXpCap: 600,
} as const;

/** Pass XP for the things a player does in a day. */
export const PASS_XP = {
  /** Per profitable game day. */
  profitableDay: 60,
  /** Opening a new shop. */
  newBusiness: 200,
  /** Upgrading one. */
  upgrade: 150,
  /** First time a shop's reputation passes 75. */
  reputationMilestone: 120,
  /** Clearing a loan. */
  loanCleared: 180,
} as const;

/** Cumulative XP needed to have reached a tier. */
export function xpForTier(tier: number): number {
  if (tier <= 0) return 0;
  let total = 0;
  for (let i = 0; i < tier; i++) {
    total += Math.round(PASS_CONFIG.baseTierXp * Math.pow(PASS_CONFIG.tierXpGrowth, i));
  }
  return total;
}

/** The whole reward track. */
export function buildPassTrack(): PassTier[] {
  const rewards: { free: PassReward | null; premium: PassReward | null }[] = [
    { free: { sku: null, label: 'Season badge', icon: '🎖️' }, premium: { sku: 'title.chaiwala', label: 'Title: Chaiwala', icon: '☕' } },
    { free: null, premium: { sku: 'signage.handpainted', label: 'Hand-painted Board', icon: '🎨' } },
    { free: { sku: null, label: 'Profile flourish', icon: '✨' }, premium: null },
    { free: null, premium: { sku: 'signage.neon', label: 'Neon Signboard', icon: '💡' } },
    { free: { sku: null, label: 'Season stamp', icon: '📮' }, premium: null },
    { free: null, premium: { sku: 'frame.gold', label: 'Gold Frame', icon: '🖼️' } },
    { free: { sku: null, label: 'Ledger skin', icon: '📒' }, premium: null },
    { free: null, premium: { sku: 'skin.oldDhaka', label: 'Old Dhaka skin', icon: '🕌' } },
    { free: { sku: null, label: 'Season emblem', icon: '🏵️' }, premium: null },
    { free: null, premium: { sku: 'frame.jamdani', label: 'Jamdani Frame', icon: '🧵' } },
  ];

  return Array.from({ length: PASS_CONFIG.tiers }, (_, index) => ({
    tier: index + 1,
    xpRequired: xpForTier(index + 1),
    free: rewards[index]?.free ?? null,
    premium: rewards[index]?.premium ?? null,
  }));
}

/** The highest tier reached with this much XP. */
export function tierForXp(xp: number): number {
  const track = buildPassTrack();
  let reached = 0;
  for (const tier of track) {
    if (xp >= tier.xpRequired) reached = tier.tier;
  }
  return reached;
}

export interface PassProgress {
  xp: number;
  tier: number;
  maxTier: number;
  /** XP into the current tier, and what the next one costs. */
  xpIntoTier: number;
  xpForNextTier: number;
  /** 0-1 towards the next tier. */
  tierProgress: number;
  complete: boolean;
}

export function passProgress(xp: number): PassProgress {
  const safeXp = Math.max(0, Math.floor(xp));
  const tier = tierForXp(safeXp);
  const maxTier = PASS_CONFIG.tiers;

  if (tier >= maxTier) {
    return {
      xp: safeXp,
      tier: maxTier,
      maxTier,
      xpIntoTier: 0,
      xpForNextTier: 0,
      tierProgress: 1,
      complete: true,
    };
  }

  const currentFloor = xpForTier(tier);
  const nextFloor = xpForTier(tier + 1);

  return {
    xp: safeXp,
    tier,
    maxTier,
    xpIntoTier: safeXp - currentFloor,
    xpForNextTier: nextFloor - currentFloor,
    tierProgress: (safeXp - currentFloor) / Math.max(1, nextFloor - currentFloor),
    complete: false,
  };
}

export type ClaimRefusal = 'unknown-tier' | 'not-reached' | 'already-claimed' | 'needs-premium' | 'no-reward';

export interface ClaimResult {
  allowed: boolean;
  reason?: ClaimRefusal;
  /** The sku to grant, if the reward is an owned item rather than a flourish. */
  sku?: string | null;
}

/**
 * Whether a tier's reward can be claimed.
 *
 * Checked server-side on every claim: the client showing a claim button is not
 * evidence of anything.
 */
export function canClaimTier(params: {
  tier: number;
  track?: 'free' | 'premium';
  xp: number;
  premium: boolean;
  claimedTiers: number[];
}): ClaimResult {
  const track = params.track ?? 'free';
  const definition = buildPassTrack().find(t => t.tier === params.tier);
  if (!definition) return { allowed: false, reason: 'unknown-tier' };

  if (tierForXp(params.xp) < params.tier) return { allowed: false, reason: 'not-reached' };
  if (track === 'premium' && !params.premium) return { allowed: false, reason: 'needs-premium' };

  const reward = track === 'premium' ? definition.premium : definition.free;
  if (!reward) return { allowed: false, reason: 'no-reward' };

  // Claimed tiers are stored as `tier` for the free lane and `tier + 1000` for
  // the premium one, so one number carries both lanes without a second column.
  const claimKey = track === 'premium' ? params.tier + 1000 : params.tier;
  if (params.claimedTiers.includes(claimKey)) return { allowed: false, reason: 'already-claimed' };

  return { allowed: true, sku: reward.sku };
}

/** The number recorded once a tier is claimed. See `canClaimTier`. */
export function claimKeyFor(tier: number, track: 'free' | 'premium'): number {
  return track === 'premium' ? tier + 1000 : tier;
}

/**
 * Apply a day's pass XP, respecting the daily cap.
 *
 * The cap is what stops a scripted client from farming the track: the honest
 * ceiling on a day's play is a day's play.
 */
export function applyDailyXp(params: {
  currentXp: number;
  earnedToday: number;
  alreadyEarnedToday: number;
}): { xp: number; granted: number } {
  const room = Math.max(0, PASS_CONFIG.dailyXpCap - Math.max(0, params.alreadyEarnedToday));
  const granted = Math.max(0, Math.min(params.earnedToday, room));
  return { xp: Math.max(0, params.currentXp) + granted, granted };
}
