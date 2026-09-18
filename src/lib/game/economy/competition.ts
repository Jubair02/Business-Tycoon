// ============================================
// Bangladesh Business Tycoon - Competitive Pressure
// ============================================
//
// Until now "competition" was a screen, not a mechanic: the Competition view
// showed market shares, but nothing in `simulateBusinessTick` ever read a
// rival's price. Two shops on the same street sold to two independent pools of
// customers, so an AI rival undercutting the player cost the player nothing,
// and the player undercutting a rival won nothing.
//
// This module is the missing half. Shops in the same city selling the same
// trade compete for one pool of customers, and each one's share of that pool is
// decided by what it charges and how well it is regarded.

import type { RivalShopSnapshot } from './types';

export const COMPETITION_CONFIG = {
  /**
   * How much the pool grows when another shop opens in the same market.
   *
   * 0 would mean a fixed pool carved ever thinner — the second shop in a
   * market halves everyone's trade, which is far too punishing on a map with
   * eight AI competitors. 1 would mean each shop brings exactly its own
   * customers, i.e. no competition at all. In between, a new shop brings some
   * of its own footfall and takes some of yours, which is how a market street
   * actually behaves.
   */
  crowding: 0.55,

  /**
   * How sharply shoppers chase the cheaper shop. At 1.5 a rival pricing 15%
   * under you is roughly 27% more attractive, all else equal.
   */
  priceElasticity: 1.5,

  /** How much a good name pulls custom away from a cheaper rival. */
  reputationWeight: 0.6,

  /** A shop can never lose more than this share of its trade to rivals... */
  minPressure: 0.35,
  /** ...nor win more than this much by being the best shop in the market. */
  maxPressure: 1.25,
} as const;

/**
 * How attractive one shop is to a shopper choosing between the options.
 *
 * Price and reputation only; stock, staff and marketing are already priced into
 * the customer model elsewhere and would be double-counted here.
 */
export function calculateShopAttractiveness(shop: RivalShopSnapshot): number {
  // priceIndex is sellPrice relative to the typical retail price, so 0.9 means
  // "a tenth under the going rate". Guarded against zero and silly values.
  const priceIndex = Math.max(0.2, Math.min(5, shop.priceIndex || 1));
  const priceFactor = Math.pow(1 / priceIndex, COMPETITION_CONFIG.priceElasticity);

  // Reputation 50 is unremarkable and scores 1.0; 100 scores 1.6, 0 scores 0.4.
  const reputation = Math.max(0, Math.min(100, shop.reputation));
  const reputationFactor =
    1 + ((reputation - 50) / 50) * COMPETITION_CONFIG.reputationWeight;

  return Math.max(0.01, priceFactor * reputationFactor);
}

export interface CompetitionResult {
  /** Multiplier to apply to this shop's potential customers. */
  pressure: number;
  /** This shop's share of the market's custom, 0-1. */
  marketShare: number;
  /** How many shops, including this one, trade in this market. */
  competitorCount: number;
  /** Plain-language reason, for the Competition screen and the daily summary. */
  reason: string;
}

/**
 * Work out what the rivals on the same street do to this shop's footfall.
 *
 * Returns 1.0 — no effect — for a shop with the market to itself, so an
 * uncontested business behaves exactly as it did before this existed.
 */
export function calculateCompetitionPressure(params: {
  self: RivalShopSnapshot;
  rivals: RivalShopSnapshot[];
}): CompetitionResult {
  const { self, rivals } = params;

  if (rivals.length === 0) {
    return {
      pressure: 1,
      marketShare: 1,
      competitorCount: 1,
      reason: 'No competition in this market',
    };
  }

  const selfAttractiveness = calculateShopAttractiveness(self);
  const rivalAttractiveness = rivals.map(calculateShopAttractiveness);
  const totalAttractiveness =
    selfAttractiveness + rivalAttractiveness.reduce((sum, a) => sum + a, 0);

  const marketShare = selfAttractiveness / totalAttractiveness;
  const competitorCount = rivals.length + 1;

  // The pool grows sublinearly with the number of shops, then is divided by
  // attractiveness. A shop holding exactly its even share of a two-shop market
  // keeps 77% of the trade it had alone.
  const poolSize = 1 + (competitorCount - 1) * COMPETITION_CONFIG.crowding;
  const raw = poolSize * marketShare;

  const pressure = Math.max(
    COMPETITION_CONFIG.minPressure,
    Math.min(COMPETITION_CONFIG.maxPressure, raw),
  );

  // A tenth off an even share is already a tenth off the day's takings, so the
  // band for "holding even" is narrow.
  const evenShare = 1 / competitorCount;
  let reason: string;
  if (marketShare > evenShare * 1.1) {
    reason = `Winning share from ${rivals.length} rival${rivals.length === 1 ? '' : 's'}`;
  } else if (marketShare < evenShare * 0.9) {
    reason = `Losing share to ${rivals.length} rival${rivals.length === 1 ? '' : 's'}`;
  } else {
    reason = `Holding even against ${rivals.length} rival${rivals.length === 1 ? '' : 's'}`;
  }

  return { pressure, marketShare, competitorCount, reason };
}

/**
 * Average shelf price relative to the going retail rate for the trade.
 *
 * 1.0 means "at the going rate"; below 1 is undercutting. Returns 1 for a shop
 * with nothing on its shelves, so an empty shop is not mistaken for a cheap one.
 */
export function calculatePriceIndex(
  inventories: { productName: string; sellPrice: number }[],
  productDefs: { name: string; basePrice: number; suggestedMarkup: number }[],
  priceMultipliers: Record<string, number> = {},
): number {
  let total = 0;
  let count = 0;

  for (const inv of inventories) {
    const def = productDefs.find(p => p.name === inv.productName);
    if (!def) continue;

    const reference = def.basePrice * (1 + def.suggestedMarkup) * (priceMultipliers[inv.productName] ?? 1);
    if (reference <= 0) continue;

    total += inv.sellPrice / reference;
    count++;
  }

  return count > 0 ? total / count : 1;
}
