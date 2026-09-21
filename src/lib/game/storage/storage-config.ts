// ============================================
// Bangladesh Business Tycoon - Storage & pre-buying config
// ============================================
//
// Pure configuration. No Prisma, no clock, no Node — so the client, the tests
// and the engine all read the same numbers.
//
// ---- Why this exists ----
//
// The calendar gives clothing a x2.8 demand spike in the ten days before
// Eid-ul-Fitr. Shelf space is a fixed constant per business type — 92 units for
// a clothing shop — and does not scale with anything. So the game was telling
// the player a rush was coming and giving them no way to prepare for it. They
// could watch it arrive and sell out on the first morning.
//
// A godown is rented space that raises what a shop may **hold**. It never
// raises what a shop can **sell**: the selling figure is what drives the demand
// model, and letting rented storage touch it would turn a logistics decision
// into a backdoor demand bonus. See `capacity.ts`.

export type GodownTier = 'SMALL' | 'MEDIUM' | 'LARGE';

export interface GodownTierSpec {
  id: GodownTier;
  en: string;
  bn: string;
  /**
   * Extra storage as a share of the shop's own shelf capacity.
   *
   * A share rather than a unit count, because base capacity runs from 41 units
   * (mobile) to 1,030 (restaurant) — a flat bonus would be transformative for
   * one trade and pointless for another.
   */
  capacityFactor: number;
  /** Term cost as a share of the shop's monthly rent, per 30 game days. */
  rentFactor: number;
  icon: string;
}

export const GODOWN_TIERS: Record<GodownTier, GodownTierSpec> = {
  SMALL: {
    id: 'SMALL',
    en: 'Lock-up',
    bn: 'ছোট গুদাম',
    capacityFactor: 0.5,
    rentFactor: 0.3,
    icon: '🔒',
  },
  MEDIUM: {
    id: 'MEDIUM',
    en: 'Godown',
    bn: 'গুদাম',
    capacityFactor: 1.0,
    rentFactor: 0.55,
    icon: '🏬',
  },
  LARGE: {
    id: 'LARGE',
    en: 'Warehouse',
    bn: 'বড় গুদাম',
    capacityFactor: 2.0,
    rentFactor: 1.0,
    icon: '🏭',
  },
};

export const GODOWN_TIER_IDS: readonly GodownTier[] = ['SMALL', 'MEDIUM', 'LARGE'];

export function isGodownTier(value: unknown): value is GodownTier {
  return typeof value === 'string' && (GODOWN_TIER_IDS as readonly string[]).includes(value);
}

export const STORAGE_CONFIG = {
  /** Terms a godown may be rented for, in game days. */
  termOptions: [30, 60, 90] as const,

  /** A shop may not hold more than this many godowns at once. */
  maxGodownsPerBusiness: 2,

  // ---- Pre-orders ----

  /**
   * Shortest notice a supplier will take.
   *
   * Without it a "pre-order" is just a purchase with extra steps, and the price
   * lock would be free money — order at today's price, take delivery today.
   */
  minLeadDays: 2,

  /** Furthest ahead an order may be placed. Roughly a season. */
  maxLeadDays: 90,

  /** A shop may not have more than this many orders outstanding. */
  maxOpenPreOrders: 8,

  /** Smallest order worth a supplier's time. */
  minOrderQuantity: 5,

  /**
   * Cancellation fee, as a share of the order.
   *
   * Cancelling is allowed right up to delivery — a plan that stops making sense
   * should be abandonable — but not for free, or the price lock becomes a
   * riskless option on the market.
   */
  cancellationFee: 0.1,

  // Bulk discounts used to live here as a second table alongside the supplier
  // one. They are now the supplier's business entirely — see
  // `supply/suppliers.ts`, where each supplier has its own tiers, because "what
  // discount does volume earn" is a property of who you buy from.
} as const;

/** What a godown of this tier adds to a shop with this shelf capacity. */
export function godownCapacityBonus(tier: GodownTier, baseCapacity: number): number {
  return Math.max(1, Math.round(baseCapacity * GODOWN_TIERS[tier].capacityFactor));
}

/** What a term costs upfront, for a shop paying this monthly rent. */
export function godownTermCost(tier: GodownTier, monthlyRent: number, termDays: number): number {
  const months = Math.max(0, termDays) / 30;
  return Math.max(1, Math.round(GODOWN_TIERS[tier].rentFactor * monthlyRent * months));
}
