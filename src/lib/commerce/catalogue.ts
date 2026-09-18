// ============================================
// Bangladesh Business Tycoon - Store Catalogue
// ============================================
//
// The price list lives in code, like `BUSINESS_TYPES` does. A catalogue in the
// database is a catalogue nobody reviews in a pull request, and pricing is
// exactly the kind of thing that should be reviewable.
//
// ---- The rule everything here obeys ----
//
// Nothing sold in this game affects the simulation. Not a taka of starting
// cash, not a point of reputation, not a percent of margin. Seasons exist so
// that everyone starts level; selling an economic edge would rebuild the very
// advantage the reset is there to remove, and would make the leaderboard —
// which is the whole retention loop — meaningless.
//
// That leaves two honest things to sell: how your shops *look*, and how much of
// your own time the game asks for. Both are below. Neither changes a number the
// economy reads.

export type SkuKind = 'COSMETIC' | 'PASS' | 'CONVENIENCE';

export type CosmeticSlot = 'SIGNAGE' | 'FRAME' | 'CITY_SKIN' | 'TITLE';

export interface CatalogueItem {
  sku: string;
  kind: SkuKind;
  name: string;
  description: string;
  /** Price in poisha. 100 poisha = ৳1. Integers only — never a float. */
  priceMinor: number;
  currency: 'BDT';
  /** Cosmetics only: where the item shows up. */
  slot?: CosmeticSlot;
  /** Prestige needed before it can even be bought, for status-gated items. */
  requiresPrestige?: number;
  /** True when it belongs to one season rather than the account. */
  seasonal?: boolean;
  icon: string;
}

/** ৳ from poisha, for display. */
export function takaFromMinor(priceMinor: number): number {
  return priceMinor / 100;
}

export const CATALOGUE: CatalogueItem[] = [
  // ---- Season pass ----
  {
    sku: 'pass.premium',
    kind: 'PASS',
    name: 'Season Pass',
    description:
      'Unlocks the premium reward track for this season — signage, frames and titles. Rewards are cosmetic; the free track always runs alongside it.',
    priceMinor: 29_900, // ৳299
    currency: 'BDT',
    seasonal: true,
    icon: '🎫',
  },

  // ---- Shop signage ----
  {
    sku: 'signage.neon',
    kind: 'COSMETIC',
    slot: 'SIGNAGE',
    name: 'Neon Signboard',
    description: 'A glowing shopfront sign. Visible on your shop card and to anyone viewing your rank.',
    priceMinor: 9_900,
    currency: 'BDT',
    icon: '💡',
  },
  {
    sku: 'signage.handpainted',
    kind: 'COSMETIC',
    slot: 'SIGNAGE',
    name: 'Hand-painted Board',
    description: 'A rickshaw-art shopfront, painted the old way.',
    priceMinor: 9_900,
    currency: 'BDT',
    icon: '🎨',
  },

  // ---- Profile frames ----
  {
    sku: 'frame.gold',
    kind: 'COSMETIC',
    slot: 'FRAME',
    name: 'Gold Frame',
    description: 'A gold border around your name on the leaderboard.',
    priceMinor: 14_900,
    currency: 'BDT',
    icon: '🖼️',
  },
  {
    sku: 'frame.jamdani',
    kind: 'COSMETIC',
    slot: 'FRAME',
    name: 'Jamdani Frame',
    description: 'A woven Jamdani border. Earned, not sold — it needs standing across several seasons.',
    priceMinor: 0,
    currency: 'BDT',
    requiresPrestige: 15,
    icon: '🧵',
  },

  // ---- City skins ----
  {
    sku: 'skin.oldDhaka',
    kind: 'COSMETIC',
    slot: 'CITY_SKIN',
    name: 'Old Dhaka',
    description: 'Puran Dhaka colouring for your dashboard and city cards.',
    priceMinor: 19_900,
    currency: 'BDT',
    icon: '🕌',
  },

  // ---- Titles ----
  {
    sku: 'title.chaiwala',
    kind: 'COSMETIC',
    slot: 'TITLE',
    name: 'Title: Chaiwala',
    description: 'Worn next to your name. Nothing says tea stall like it.',
    priceMinor: 4_900,
    currency: 'BDT',
    icon: '☕',
  },

  // ---- Convenience ----
  //
  // Convenience items buy back clicks, not outcomes.
  //
  // The line is sharper than it first looks, and one early draft of this list
  // crossed it: an "extended offline window" that let shops trade 16 hours
  // unattended instead of 8 would have meant more simulated days per real day,
  // which is more money, which is a better rank. That is pay-to-win however it
  // is worded, on a leaderboard that is the whole retention loop. It was cut.
  //
  // What is left changes only how long a thing takes the player, never what the
  // simulation produces: a bulk screen for orders you could place one by one, a
  // saved pricing strategy you could type out, an export of numbers already on
  // screen.
  {
    sku: 'convenience.managerSlots',
    kind: 'CONVENIENCE',
    name: 'Extra Manager Slots',
    description:
      'Run standing restock orders on every shop at once from one screen. Saves clicks; changes no numbers.',
    priceMinor: 14_900,
    currency: 'BDT',
    icon: '🗂️',
  },
  {
    sku: 'convenience.pricingPresets',
    kind: 'CONVENIENCE',
    name: 'Pricing Presets',
    description:
      'Save a pricing strategy and apply it to any shop in one tap. The same prices you could set by hand, set faster.',
    priceMinor: 9_900,
    currency: 'BDT',
    icon: '🏷️',
  },
  {
    sku: 'convenience.ledgerExport',
    kind: 'CONVENIENCE',
    name: 'Ledger Export',
    description:
      'Download your books as a spreadsheet — daily revenue, COGS, expenses and margin per shop.',
    priceMinor: 9_900,
    currency: 'BDT',
    icon: '📄',
  },
];

const BY_SKU = new Map(CATALOGUE.map(item => [item.sku, item]));

export function getCatalogueItem(sku: string): CatalogueItem | undefined {
  return BY_SKU.get(sku);
}

export function catalogueByKind(kind: SkuKind): CatalogueItem[] {
  return CATALOGUE.filter(item => item.kind === kind);
}

/**
 * Whether an account may buy an item right now.
 *
 * Owning it already is the common case and is not an error — the store should
 * show it as owned, not refuse it with a message.
 */
export function canPurchase(params: {
  sku: string;
  ownedSkus: string[];
  prestige: number;
}): { allowed: boolean; reason?: 'unknown' | 'owned' | 'prestige' | 'not-for-sale' } {
  const item = getCatalogueItem(params.sku);
  if (!item) return { allowed: false, reason: 'unknown' };
  if (params.ownedSkus.includes(params.sku)) return { allowed: false, reason: 'owned' };
  if (item.requiresPrestige !== undefined && params.prestige < item.requiresPrestige) {
    return { allowed: false, reason: 'prestige' };
  }
  // A zero price means it is earned rather than sold.
  if (item.priceMinor <= 0) return { allowed: false, reason: 'not-for-sale' };
  return { allowed: true };
}

/**
 * Sanity check on the catalogue itself, asserted by the tests.
 *
 * The important one is the last clause: a SKU that granted an economic effect
 * would need a field to express it, and there is deliberately no such field.
 */
export function catalogueProblems(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const item of CATALOGUE) {
    if (seen.has(item.sku)) problems.push(`Duplicate sku: ${item.sku}`);
    seen.add(item.sku);

    if (!Number.isInteger(item.priceMinor)) problems.push(`${item.sku}: price must be whole poisha`);
    if (item.priceMinor < 0) problems.push(`${item.sku}: negative price`);
    if (item.kind === 'COSMETIC' && !item.slot) problems.push(`${item.sku}: cosmetic with no slot`);
    if (item.requiresPrestige !== undefined && item.requiresPrestige < 0) {
      problems.push(`${item.sku}: negative prestige requirement`);
    }
  }

  return problems;
}
