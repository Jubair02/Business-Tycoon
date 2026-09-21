// ============================================
// Bangladesh Business Tycoon - Spoilage
// ============================================
//
// Fresh goods go off. Packaged ones do not.
//
// ---- Why this is the keystone of the supply system ----
//
// Every incentive added so far pushes one way: bulk discounts reward big
// orders, importers reward bigger ones, godowns let you hold them, and credit
// lets you buy them without the cash. With nothing pushing back, the answer to
// every question would be "order the maximum from the importer on thirty days".
//
// Spoilage is the counterweight, and it is different for every trade:
//
//   Clothing, phones   never spoil  — stockpile freely, which is exactly why
//                                    clothing is the Eid trade
//   Rice, oil, biscuits never spoil  — bulk buying is pure upside
//   Eggs               7 days        — a week's cover is sensible
//   Milk, tea, dal     3 days
//   Singara, biryani   2 days
//   Fish, roti         1 day         — a restaurant cannot stockpile at all
//
// So the same warehouse that wins a clothing shop its year loses a restaurant
// its stock, and "buy early when prices are low" is sound advice for rice and
// ruinous for fish. That is the decision the feature exists to create.
//
// Pure: no Prisma, no clock, no randomness.

export const SPOILAGE_CONFIG = {
  /**
   * Loss per game day while stock is still inside its shelf life, expressed
   * against that shelf life.
   *
   * Divided by shelf life so short-lived goods lose faster even when fresh:
   * fish is visibly worse by the end of its one day, eggs barely change over
   * their seven. A flat rate would have made a day-old fish and a day-old egg
   * equally saleable.
   */
  freshLossPerDay: 0.1,

  /** Loss per game day once stock is past its shelf life. Steep, on purpose. */
  staleLossPerDay: 0.35,

  /** Nothing loses more than this in one day, however old. */
  maxLossPerDay: 0.6,

  /**
   * Below this many units, what is left is written off rather than left as a
   * fractional shelf nobody will ever clear.
   */
  writeOffBelow: 1,
} as const;

export interface PerishableDef {
  name: string;
  /** 0 means it does not perish. */
  shelfLifeDays: number;
}

export function isPerishable(def: { shelfLifeDays?: number } | undefined | null): boolean {
  return Boolean(def && Number.isFinite(def.shelfLifeDays) && (def.shelfLifeDays ?? 0) > 0);
}

/**
 * The share of a shelf lost in one day, given how old the stock is.
 *
 * Returns 0 for anything that does not perish, so a warehouse of shirts is
 * never touched by any of this.
 */
export function dailySpoilageRate(ageDays: number, shelfLifeDays: number): number {
  if (!Number.isFinite(shelfLifeDays) || shelfLifeDays <= 0) return 0;
  if (!Number.isFinite(ageDays) || ageDays < 0) return 0;

  const rate = ageDays < shelfLifeDays
    ? SPOILAGE_CONFIG.freshLossPerDay / shelfLifeDays
    : SPOILAGE_CONFIG.staleLossPerDay;

  return Math.min(SPOILAGE_CONFIG.maxLossPerDay, rate);
}

export interface SpoilageLine {
  productName: string;
  /** Units thrown away. */
  spoiled: number;
  /** What is left. */
  remaining: number;
  /** Cost of what was thrown away, at its own cost basis. */
  lossValue: number;
  /** Age after the day passes. */
  newAgeDays: number;
  /** True once the stock is past its shelf life and going fast. */
  pastShelfLife: boolean;
}

export interface SpoilageInput {
  productName: string;
  quantity: number;
  purchasePrice: number;
  averageAgeDays: number;
  shelfLifeDays: number;
}

/**
 * Age a shelf by one game day and work out what is lost.
 *
 * Pure. The caller writes the result and records the loss — see
 * `supply-service.ts`.
 */
export function spoilOneDay(line: SpoilageInput): SpoilageLine {
  const quantity = Math.max(0, Math.floor(line.quantity));
  const newAgeDays = Math.max(0, line.averageAgeDays) + 1;

  if (!isPerishable(line) || quantity <= 0) {
    return {
      productName: line.productName,
      spoiled: 0,
      remaining: quantity,
      lossValue: 0,
      // Age is still tracked on non-perishables so the figure means something
      // if a product's shelf life is ever changed.
      newAgeDays,
      pastShelfLife: false,
    };
  }

  const rate = dailySpoilageRate(line.averageAgeDays, line.shelfLifeDays);
  let spoiled = Math.floor(quantity * rate);

  // A shelf that rounds to zero loss every day would keep one unit of fish
  // forever. Anything perishable and rotting loses at least one unit.
  if (spoiled === 0 && rate > 0 && quantity > 0 && line.averageAgeDays >= line.shelfLifeDays) {
    spoiled = 1;
  }

  spoiled = Math.min(spoiled, quantity);
  let remaining = quantity - spoiled;

  // Clear the dregs rather than leave an unsellable remnant on the books.
  if (remaining > 0 && remaining < SPOILAGE_CONFIG.writeOffBelow) {
    spoiled += remaining;
    remaining = 0;
  }

  return {
    productName: line.productName,
    spoiled,
    remaining,
    lossValue: Math.round(spoiled * Math.max(0, line.purchasePrice)),
    newAgeDays,
    pastShelfLife: newAgeDays > line.shelfLifeDays,
  };
}

/** Age a whole shop by one day. */
export function spoilShelves(lines: SpoilageInput[]): {
  lines: SpoilageLine[];
  totalSpoiled: number;
  totalLoss: number;
} {
  const results = lines.map(spoilOneDay);
  return {
    lines: results,
    totalSpoiled: results.reduce((sum, r) => sum + r.spoiled, 0),
    totalLoss: results.reduce((sum, r) => sum + r.lossValue, 0),
  };
}

/**
 * The average age of a shelf after new stock joins it.
 *
 * Weighted by quantity, exactly as the cost basis already is — so a shop that
 * tops up daily never ages, and one that buys a month of milk carries the
 * average of what it is holding rather than the age of the newest crate.
 */
export function blendAge(params: {
  existingQuantity: number;
  existingAgeDays: number;
  incomingQuantity: number;
  /** Age of the arriving stock. Fresh from a supplier is 0. */
  incomingAgeDays?: number;
}): number {
  const existing = Math.max(0, params.existingQuantity);
  const incoming = Math.max(0, params.incomingQuantity);
  const total = existing + incoming;
  if (total <= 0) return 0;

  const incomingAge = Math.max(0, params.incomingAgeDays ?? 0);
  return (Math.max(0, params.existingAgeDays) * existing + incomingAge * incoming) / total;
}

/**
 * How much of an order is likely to survive to be sold.
 *
 * Shown on the order screen, because "order 800 units of fish from the
 * importer" should be visibly a mistake *before* the money leaves — not a
 * lesson learned a week later when it arrives and rots.
 */
export function projectedSurvival(params: {
  quantity: number;
  shelfLifeDays: number;
  /** Days between ordering and the stock being sold through. */
  daysHeld: number;
}): { surviving: number; lost: number; lossShare: number } {
  const quantity = Math.max(0, Math.floor(params.quantity));
  if (!isPerishable({ shelfLifeDays: params.shelfLifeDays }) || quantity === 0) {
    return { surviving: quantity, lost: 0, lossShare: 0 };
  }

  // Driven through `spoilOneDay` rather than reimplementing the curve, so the
  // estimate on the order screen and what the tick actually does cannot drift
  // apart. An earlier version duplicated the arithmetic and left out the
  // minimum-loss rule, so it projected two units of fish surviving forever.
  let remaining = quantity;
  let age = 0;

  for (let day = 0; day < Math.max(0, Math.floor(params.daysHeld)); day++) {
    const step = spoilOneDay({
      productName: 'projection',
      quantity: remaining,
      purchasePrice: 0,
      averageAgeDays: age,
      shelfLifeDays: params.shelfLifeDays,
    });
    remaining = step.remaining;
    age = step.newAgeDays;
    if (remaining <= 0) break;
  }

  const surviving = Math.max(0, Math.floor(remaining));
  const lost = quantity - surviving;
  return { surviving, lost, lossShare: quantity > 0 ? lost / quantity : 0 };
}
