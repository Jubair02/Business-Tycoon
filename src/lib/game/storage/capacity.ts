// ============================================
// Bangladesh Business Tycoon - Capacity
// ============================================
//
// Two different numbers that were previously one, and keeping them apart is the
// whole safety property of this feature:
//
//   **Selling capacity** — the shelves. Fixed per business type, the sum of each
//   product's `maxStock`. This is what the demand model reads, and nothing in
//   this feature may change it. Raising it would *reduce* demand, because it is
//   the denominator of the stock-availability layer in
//   `calculatePotentialCustomers`: a shop with the same stock and a bigger
//   shelf reads as emptier. A player who rented storage and watched their
//   customers leave would be right to be annoyed.
//
//   **Storage capacity** — shelves plus any rented godown. A ceiling on what a
//   shop may *hold*. Nothing else reads it.
//
// So a godown lets you stockpile for Eid. It does not make you more popular.
//
// Pure: no Prisma, no clock.

import { godownCapacityBonus, type GodownTier } from './storage-config';

export interface ProductCapacityDef {
  name: string;
  maxStock: number;
}

export interface HeldStockLine {
  productName: string;
  quantity: number;
}

export interface ActiveGodown {
  id: string;
  tier: GodownTier;
  capacityBonus: number;
  expiresOnDay: number;
}

/** The shelves. What the demand model reads. Never includes rented storage. */
export function sellingCapacity(productDefs: ProductCapacityDef[]): number {
  return productDefs.reduce((sum, p) => sum + Math.max(0, p.maxStock), 0);
}

/**
 * Stock that counts towards the demand model.
 *
 * Each product contributes at most its own shelf space. Without this, goods
 * sitting in a godown would inflate the stock-availability signal — and worse,
 * a shop could hold one product to the ceiling, read as fully stocked, and sell
 * nothing because every other shelf was bare. The manual buy route never
 * checked capacity at all, so that was reachable before godowns existed.
 *
 * For a shop inside its shelf limits this is exactly the old `totalStock`, so
 * ordinary play is unaffected.
 */
export function sellableStock(
  inventories: HeldStockLine[],
  productDefs: ProductCapacityDef[],
): number {
  const shelfByName = new Map(productDefs.map(p => [p.name, Math.max(0, p.maxStock)]));

  return inventories.reduce((sum, line) => {
    const shelf = shelfByName.get(line.productName);
    // A product with no definition cannot be sold, so it cannot count.
    if (shelf === undefined) return sum;
    return sum + Math.min(Math.max(0, line.quantity), shelf);
  }, 0);
}

/** Everything a shop is holding, wherever it sits. */
export function heldStock(inventories: HeldStockLine[]): number {
  return inventories.reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
}

/** Godowns still inside their term on a given day. */
export function activeGodowns(godowns: ActiveGodown[], gameDay: number): ActiveGodown[] {
  return godowns.filter(g => g.expiresOnDay >= gameDay);
}

/** Storage a shop is renting on top of its shelves. */
export function rentedCapacity(godowns: ActiveGodown[], gameDay: number): number {
  return activeGodowns(godowns, gameDay).reduce((sum, g) => sum + Math.max(0, g.capacityBonus), 0);
}

export interface CapacityReport {
  /** Shelves. Drives demand. */
  selling: number;
  /** Rented godown space. */
  rented: number;
  /** Shelves + rented. The ceiling on holdings. */
  storage: number;
  /** Units currently in the shop and its godown. */
  held: number;
  /** Units already bought and on their way. */
  incoming: number;
  /** What may still be bought or ordered. Never negative. */
  available: number;
  /** 0-1, held against storage. */
  utilisation: number;
  /** True when holdings exceed storage — reachable if a godown lapsed. */
  overCapacity: boolean;
}

/**
 * The full picture for one shop.
 *
 * `incoming` is counted against capacity so a player cannot place three orders
 * that each fit and together do not. Pre-orders are paid for at placement, so
 * the space has genuinely been spoken for.
 */
export function capacityReport(params: {
  productDefs: ProductCapacityDef[];
  inventories: HeldStockLine[];
  godowns: ActiveGodown[];
  /** Units on pending pre-orders. */
  incoming: number;
  gameDay: number;
}): CapacityReport {
  const selling = sellingCapacity(params.productDefs);
  const rented = rentedCapacity(params.godowns, params.gameDay);
  const storage = selling + rented;
  const held = heldStock(params.inventories);
  const incoming = Math.max(0, params.incoming);

  return {
    selling,
    rented,
    storage,
    held,
    incoming,
    available: Math.max(0, storage - held - incoming),
    utilisation: storage > 0 ? Math.min(1, held / storage) : 0,
    // A godown can lapse under stock that is already sitting in it. The goods
    // are not destroyed — that would be punishing a player for a rental
    // expiring — but nothing further may be bought until the shop is back
    // inside its limits.
    overCapacity: held > storage,
  };
}

/** Whether a quantity fits, and how much of it would. */
export function fitsInCapacity(report: CapacityReport, quantity: number): {
  fits: boolean;
  acceptable: number;
  shortfall: number;
} {
  const wanted = Math.max(0, Math.floor(quantity));
  const acceptable = Math.min(wanted, report.available);
  return {
    fits: acceptable >= wanted && wanted > 0,
    acceptable,
    shortfall: wanted - acceptable,
  };
}

/** What a tier would add to this shop, for the rental screen. */
export function previewGodown(tier: GodownTier, productDefs: ProductCapacityDef[]): number {
  return godownCapacityBonus(tier, sellingCapacity(productDefs));
}
