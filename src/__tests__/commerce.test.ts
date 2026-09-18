// ============================================
// Bangladesh Business Tycoon - Commerce Tests
// ============================================
//
// The load-bearing test in this file is `nothing sold touches the simulation`.
// Everything else here is mechanics; that one is the design rule the whole
// seasonal ladder rests on, and it is the one most likely to be eroded by a
// well-meaning change later.

import { describe, it, expect, afterEach } from 'vitest';
import {
  CATALOGUE,
  getCatalogueItem,
  catalogueByKind,
  canPurchase,
  catalogueProblems,
  takaFromMinor,
} from '@/lib/commerce/catalogue';
import {
  PASS_CONFIG,
  PASS_XP,
  xpForTier,
  buildPassTrack,
  tierForXp,
  passProgress,
  canClaimTier,
  claimKeyFor,
  applyDailyXp,
} from '@/lib/commerce/season-pass';
import {
  REWARD_PLACEMENTS,
  getRewardPlacement,
  canGrantReward,
  maxDailyRewardXp,
  rewardProblems,
} from '@/lib/commerce/rewards';
import {
  getPaymentProvider,
  resetPaymentProvider,
  verifyAdReward,
  signAdReward,
  adsEnabled,
} from '@/lib/commerce/providers';

describe('catalogue', () => {
  it('is internally consistent', () => {
    expect(catalogueProblems()).toEqual([]);
  });

  it('nothing sold touches the simulation', () => {
    // The rule seasons depend on: a level playing field every season. If an
    // item ever needs a field to express an economic effect, this is where that
    // change should be argued for rather than slipped in.
    const allowedKinds = ['COSMETIC', 'PASS', 'CONVENIENCE'];
    for (const item of CATALOGUE) {
      expect(allowedKinds, `${item.sku} has an unexpected kind`).toContain(item.kind);
    }

    // No SKU may carry anything resembling an economic grant.
    const economicFields = ['cash', 'taka', 'multiplier', 'bonus', 'boost', 'rate', 'discount', 'offlineHours'];
    for (const item of CATALOGUE) {
      for (const field of Object.keys(item)) {
        expect(
          economicFields.some(bad => field.toLowerCase().includes(bad)),
          `${item.sku} has an economic-looking field: ${field}`,
        ).toBe(false);
      }
    }
  });

  it('prices are whole poisha, never floats', () => {
    for (const item of CATALOGUE) {
      expect(Number.isInteger(item.priceMinor), item.sku).toBe(true);
    }
  });

  it('converts poisha to taka', () => {
    expect(takaFromMinor(29_900)).toBe(299);
    expect(takaFromMinor(0)).toBe(0);
  });

  it('finds an item by sku, and nothing for a made-up one', () => {
    expect(getCatalogueItem('pass.premium')).toBeDefined();
    expect(getCatalogueItem('pass.godmode')).toBeUndefined();
  });

  it('groups by kind', () => {
    expect(catalogueByKind('PASS').length).toBeGreaterThan(0);
    expect(catalogueByKind('COSMETIC').every(i => i.slot)).toBe(true);
  });

  describe('canPurchase', () => {
    it('allows a normal buy', () => {
      expect(canPurchase({ sku: 'signage.neon', ownedSkus: [], prestige: 0 }).allowed).toBe(true);
    });

    it('refuses something already owned, without calling it an error', () => {
      const verdict = canPurchase({ sku: 'signage.neon', ownedSkus: ['signage.neon'], prestige: 0 });
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe('owned');
    });

    it('refuses an unknown sku', () => {
      expect(canPurchase({ sku: 'nope', ownedSkus: [], prestige: 99 }).reason).toBe('unknown');
    });

    it('holds a prestige-gated item back until it is earned', () => {
      expect(canPurchase({ sku: 'frame.jamdani', ownedSkus: [], prestige: 3 }).reason).toBe('prestige');
    });

    it('will not sell an item that is meant to be earned', () => {
      // Jamdani is prestige 15 and priced at zero: reaching the prestige should
      // still not make it purchasable, because it is not for sale at all.
      expect(canPurchase({ sku: 'frame.jamdani', ownedSkus: [], prestige: 50 }).reason).toBe('not-for-sale');
    });
  });
});

describe('season pass', () => {
  it('has a tier for every step of the track', () => {
    const track = buildPassTrack();
    expect(track).toHaveLength(PASS_CONFIG.tiers);
    expect(track.map(t => t.tier)).toEqual(Array.from({ length: PASS_CONFIG.tiers }, (_, i) => i + 1));
  });

  it('gives every tier at least one reward across the two tracks', () => {
    for (const tier of buildPassTrack()) {
      expect(Boolean(tier.free || tier.premium), `tier ${tier.tier} is empty`).toBe(true);
    }
  });

  it('only ever grants skus that exist', () => {
    for (const tier of buildPassTrack()) {
      for (const reward of [tier.free, tier.premium]) {
        if (reward?.sku) expect(getCatalogueItem(reward.sku), reward.sku).toBeDefined();
      }
    }
  });

  it('costs more XP for each successive tier', () => {
    const track = buildPassTrack();
    for (let i = 1; i < track.length; i++) {
      expect(track[i].xpRequired).toBeGreaterThan(track[i - 1].xpRequired);
    }
  });

  it('starts at tier zero and reaches the top', () => {
    expect(tierForXp(0)).toBe(0);
    expect(tierForXp(xpForTier(PASS_CONFIG.tiers))).toBe(PASS_CONFIG.tiers);
    expect(tierForXp(999_999)).toBe(PASS_CONFIG.tiers);
  });

  it('is completable inside a season by playing', () => {
    // A pass nobody can finish is a pass nobody buys. At the daily cap the
    // track should take a meaningful part of a season, but not more than it.
    const daysToComplete = xpForTier(PASS_CONFIG.tiers) / PASS_CONFIG.dailyXpCap;
    expect(daysToComplete).toBeGreaterThan(5);
    expect(daysToComplete).toBeLessThan(90);
  });

  describe('passProgress', () => {
    it('reports progress towards the next tier', () => {
      const progress = passProgress(Math.floor(xpForTier(1) / 2));
      expect(progress.tier).toBe(0);
      expect(progress.tierProgress).toBeGreaterThan(0);
      expect(progress.tierProgress).toBeLessThan(1);
      expect(progress.complete).toBe(false);
    });

    it('reports completion at the top', () => {
      const progress = passProgress(xpForTier(PASS_CONFIG.tiers));
      expect(progress.complete).toBe(true);
      expect(progress.tierProgress).toBe(1);
    });

    it('treats negative XP as zero rather than breaking', () => {
      const progress = passProgress(-500);
      expect(progress.xp).toBe(0);
      expect(progress.tier).toBe(0);
    });
  });

  describe('canClaimTier', () => {
    const atTop = xpForTier(PASS_CONFIG.tiers);

    it('allows a reached free tier', () => {
      const verdict = canClaimTier({ tier: 1, track: 'free', xp: atTop, premium: false, claimedTiers: [] });
      expect(verdict.allowed).toBe(true);
    });

    it('refuses a tier not yet reached', () => {
      expect(canClaimTier({ tier: 5, track: 'free', xp: 0, premium: true, claimedTiers: [] }).reason)
        .toBe('not-reached');
    });

    it('refuses the premium track without the pass', () => {
      expect(canClaimTier({ tier: 2, track: 'premium', xp: atTop, premium: false, claimedTiers: [] }).reason)
        .toBe('needs-premium');
    });

    it('refuses a second claim of the same tier', () => {
      const claimed = [claimKeyFor(1, 'free')];
      expect(canClaimTier({ tier: 1, track: 'free', xp: atTop, premium: true, claimedTiers: claimed }).reason)
        .toBe('already-claimed');
    });

    it('keeps the two tracks independent', () => {
      // Claiming the free lane must not consume the premium one.
      const claimed = [claimKeyFor(1, 'free')];
      const premium = canClaimTier({ tier: 1, track: 'premium', xp: atTop, premium: true, claimedTiers: claimed });
      expect(premium.allowed).toBe(true);
    });

    it('refuses a track with no reward at that tier', () => {
      const track = buildPassTrack();
      const emptyFree = track.find(t => t.free === null)!;
      expect(
        canClaimTier({ tier: emptyFree.tier, track: 'free', xp: atTop, premium: true, claimedTiers: [] }).reason,
      ).toBe('no-reward');
    });

    it('refuses a tier that does not exist', () => {
      expect(canClaimTier({ tier: 999, xp: atTop, premium: true, claimedTiers: [] }).reason).toBe('unknown-tier');
    });
  });

  describe('applyDailyXp', () => {
    it('grants what was earned when there is room', () => {
      const { xp, granted } = applyDailyXp({ currentXp: 100, earnedToday: 60, alreadyEarnedToday: 0 });
      expect(granted).toBe(60);
      expect(xp).toBe(160);
    });

    it('caps a day rather than letting it run away', () => {
      const { granted } = applyDailyXp({
        currentXp: 0,
        earnedToday: 10_000,
        alreadyEarnedToday: 0,
      });
      expect(granted).toBe(PASS_CONFIG.dailyXpCap);
    });

    it('grants nothing once the day is used up', () => {
      const { granted } = applyDailyXp({
        currentXp: 500,
        earnedToday: 100,
        alreadyEarnedToday: PASS_CONFIG.dailyXpCap,
      });
      expect(granted).toBe(0);
    });

    it('never subtracts XP', () => {
      const { xp } = applyDailyXp({ currentXp: 500, earnedToday: -100, alreadyEarnedToday: 0 });
      expect(xp).toBe(500);
    });
  });

  it('awards pass XP for things a player actually does', () => {
    for (const value of Object.values(PASS_XP)) {
      expect(value).toBeGreaterThan(0);
    }
  });
});

describe('rewarded video', () => {
  it('is internally consistent', () => {
    expect(rewardProblems(PASS_CONFIG.dailyXpCap)).toEqual([]);
  });

  it('cannot substitute for playing the game', () => {
    // If a day of video filled the daily cap, watching ads would *be* the game.
    expect(maxDailyRewardXp()).toBeLessThan(PASS_CONFIG.dailyXpCap);
  });

  it('pays out only pass progress, never anything economic', () => {
    for (const placement of REWARD_PLACEMENTS) {
      expect(Object.keys(placement).sort()).toEqual(
        ['dailyCap', 'description', 'icon', 'id', 'label', 'passXp'].sort(),
      );
    }
  });

  describe('canGrantReward', () => {
    it('grants a first view', () => {
      const decision = canGrantReward({ placementId: 'pass.boost', viewsToday: 0, adsEnabled: true });
      expect(decision.allowed).toBe(true);
      expect(decision.passXp).toBe(getRewardPlacement('pass.boost')!.passXp);
    });

    it('stops at the daily cap', () => {
      const cap = getRewardPlacement('pass.boost')!.dailyCap;
      expect(canGrantReward({ placementId: 'pass.boost', viewsToday: cap, adsEnabled: true }).reason)
        .toBe('cap-reached');
    });

    it('grants nothing when ads are switched off', () => {
      expect(canGrantReward({ placementId: 'pass.boost', viewsToday: 0, adsEnabled: false }).reason)
        .toBe('ads-disabled');
    });

    it('refuses an unknown placement', () => {
      expect(canGrantReward({ placementId: 'made.up', viewsToday: 0, adsEnabled: true }).reason)
        .toBe('unknown-placement');
    });
  });
});

describe('providers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    resetPaymentProvider();
  });

  it('defaults to the sandbox, which settles without a network call', async () => {
    delete process.env.PAYMENT_PROVIDER;
    resetPaymentProvider();

    const provider = getPaymentProvider();
    expect(provider.id).toBe('sandbox');

    const session = await provider.createCheckout({
      purchaseId: 'p1', sku: 'signage.neon', priceMinor: 9900,
      currency: 'BDT', userId: 'u1', returnUrl: 'https://example.test/settings',
    });
    expect(session.settledImmediately).toBe(true);
    expect(session.redirectUrl).toBeNull();
  });

  it('marks sandbox orders as sandbox, so a real ledger cannot be confused with a fake one', async () => {
    delete process.env.PAYMENT_PROVIDER;
    resetPaymentProvider();
    const session = await getPaymentProvider().createCheckout({
      purchaseId: 'p2', sku: 'signage.neon', priceMinor: 9900,
      currency: 'BDT', userId: 'u1', returnUrl: 'https://example.test',
    });
    expect(session.providerRef).toMatch(/^sandbox_/);
  });

  it('refuses to pretend a real provider works without credentials', async () => {
    process.env.PAYMENT_PROVIDER = 'sslcommerz';
    resetPaymentProvider();
    await expect(
      getPaymentProvider().createCheckout({
        purchaseId: 'p3', sku: 'signage.neon', priceMinor: 9900,
        currency: 'BDT', userId: 'u1', returnUrl: 'https://example.test',
      }),
    ).rejects.toThrow(/not implemented/i);
  });

  describe('rewarded-video signature', () => {
    const secret = 'test-secret-value';
    const params = { userId: 'u1', placement: 'pass.boost', providerRef: 'tx-123' };

    it('accepts a correctly signed callback', () => {
      const signature = signAdReward(params, secret);
      expect(verifyAdReward({ ...params, signature }, secret)).toEqual(params);
    });

    it('rejects a wrong signature', () => {
      expect(verifyAdReward({ ...params, signature: 'deadbeef' }, secret)).toBeNull();
    });

    it('rejects a missing signature', () => {
      expect(verifyAdReward({ ...params, signature: null }, secret)).toBeNull();
    });

    it('rejects everything when no secret is configured', () => {
      const signature = signAdReward(params, secret);
      expect(verifyAdReward({ ...params, signature }, undefined)).toBeNull();
    });

    it('will not let a signature be reused for a different reward', () => {
      // The transaction id is inside the signed message, so a capture from one
      // payout cannot be replayed to claim another.
      const signature = signAdReward(params, secret);
      expect(verifyAdReward({ ...params, providerRef: 'tx-999', signature }, secret)).toBeNull();
      expect(verifyAdReward({ ...params, userId: 'someone-else', signature }, secret)).toBeNull();
      expect(verifyAdReward({ ...params, placement: 'daily.bonus', signature }, secret)).toBeNull();
    });

    it('rejects an empty field rather than signing nothing', () => {
      const signature = signAdReward({ ...params, userId: '' }, secret);
      expect(verifyAdReward({ ...params, userId: '', signature }, secret)).toBeNull();
    });
  });

  it('hides rewarded placements unless a network and a secret are both set', () => {
    process.env.AD_PROVIDER = 'none';
    delete process.env.AD_SSV_SECRET;
    expect(adsEnabled()).toBe(false);

    process.env.AD_PROVIDER = 'admob';
    expect(adsEnabled()).toBe(false); // still no secret

    process.env.AD_SSV_SECRET = 'x';
    expect(adsEnabled()).toBe(true);
  });
});
