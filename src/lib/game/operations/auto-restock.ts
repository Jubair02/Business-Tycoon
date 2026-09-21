// ============================================
// Bangladesh Business Tycoon - Emergency top-up
// ============================================
//
// This used to be a standing restock order that bought properly on the player's
// behalf: their chosen threshold, their chosen target, at market price. It
// worked, and that was the problem — buying was the most interesting decision
// in a trading game and a toggle was making it.
//
// It is now a **safety net, not a strategy**. When a shelf falls below
// `EMERGENCY.threshold` the shop buys from the corner counter at
// `SUPPLIERS.EMERGENCY.priceFactor` — a quarter over the odds, no bulk
// discount, no credit — and only tops up to `EMERGENCY.target`, which is enough
// to keep the doors open and not enough to trade well on.
//
// That keeps the game playable for someone who checks in twice a day (a game
// day is four real hours, and shelves empty in about one) while making the
// supplier screen the place where buying is actually decided. A player who
// never opens it will survive and will quietly earn much less than one who does.
//
// The planning half is pure and testable; the executing half is the only part
// that touches the database.

import { db } from '@/lib/db';
import { PRODUCTS } from '@/lib/game-data';
import { capacityReport } from '../storage/capacity';
import { blendAge } from '../supply/spoilage';
import type { GodownTier } from '../storage/storage-config';
import type { ProductDef } from '@/lib/game-data';

/** Shelf state of one product line, as the planner needs to see it. */
export interface RestockInventoryLine {
  id: string;
  productName: string;
  quantity: number;
  purchasePrice: number;
}

export interface RestockSettings {
  /** Top a product up once it falls below this share of its shelf space. */
  threshold: number;
  /** Refill it to this share of its shelf space. */
  target: number;
  /** Ceiling on what this run may cost, or null for uncapped. */
  budget: number | null;
}

export interface RestockOrderLine {
  inventoryId: string;
  productName: string;
  /** Units to buy. */
  quantity: number;
  /** Wholesale price per unit at today's market multiplier. */
  unitCost: number;
  lineCost: number;
  /** Weighted-average cost basis after this purchase settles. */
  newPurchasePrice: number;
  /** Shelf level before the top-up, as a share of capacity. */
  stockRatioBefore: number;
}

export interface RestockPlan {
  lines: RestockOrderLine[];
  totalCost: number;
  /** Lines that were wanted but left unbought, and why. */
  skipped: { productName: string; reason: 'budget' | 'cash' }[];
}

export const RESTOCK_DEFAULTS: RestockSettings = {
  threshold: 0.4,
  target: 0.9,
  budget: null,
};

/**
 * What the automatic top-up does, whatever the player has configured.
 *
 * Deliberately worse than buying properly. It waits until a shelf is nearly
 * bare, refills it barely past a quarter, and pays the counter premium for the
 * privilege — so it rescues an unattended shop without ever being the sensible
 * way to stock one.
 */
export const EMERGENCY_RESTOCK: RestockSettings & { priceFactor: number } = {
  threshold: 0.15,
  target: 0.35,
  budget: null,
  priceFactor: 1.25,
};

/** Bounds the UI and the API both enforce, so a save cannot hold a nonsense order. */
export const RESTOCK_LIMITS = {
  minThreshold: 0.05,
  maxThreshold: 0.9,
  minTarget: 0.1,
  maxTarget: 1.0,
  minBudget: 0,
} as const;

/**
 * Decide what to buy, given the shelves, today's prices and the money available.
 *
 * Emptiest shelves are filled first. Ordering by urgency rather than by, say,
 * margin means a short-of-cash shop spreads what it has across the products
 * closest to selling out, and — more importantly — means the player can predict
 * what the order will do without modelling the economy in their head.
 *
 * Pure: no database, no clock, no randomness.
 */
export function planRestock(params: {
  inventories: RestockInventoryLine[];
  productDefs: ProductDef[];
  /** Per-product market price multiplier, defaulting to 1 where absent. */
  priceMultipliers: Record<string, number>;
  availableCash: number;
  settings: RestockSettings;
  /**
   * Units of storage free. Defaults to unlimited, which is what it effectively
   * was before godowns existed: the plan only ever targets shelf levels, so it
   * could not exceed base capacity on its own. It can now, if stock is sitting
   * in a godown that has since lapsed and left the shop over its ceiling.
   */
  spaceAvailable?: number;
  /**
   * Multiplier on the market price. 1.0 is the wholesaler; the emergency
   * top-up pays the counter's 1.25.
   */
  priceFactor?: number;
}): RestockPlan {
  const { inventories, productDefs, priceMultipliers, availableCash, settings } = params;
  const spaceAvailable = params.spaceAvailable ?? Number.POSITIVE_INFINITY;
  const priceFactor = params.priceFactor ?? 1;

  const threshold = clamp(settings.threshold, RESTOCK_LIMITS.minThreshold, RESTOCK_LIMITS.maxThreshold);
  const target = clamp(settings.target, RESTOCK_LIMITS.minTarget, RESTOCK_LIMITS.maxTarget);
  const budget = settings.budget === null ? Infinity : Math.max(0, settings.budget);

  const candidates = inventories
    .map(inv => {
      const def = productDefs.find(p => p.name === inv.productName);
      if (!def || def.maxStock <= 0) return null;

      const stockRatio = inv.quantity / def.maxStock;
      if (stockRatio >= threshold) return null;

      const targetQuantity = Math.floor(def.maxStock * target);
      const quantity = targetQuantity - inv.quantity;
      if (quantity <= 0) return null;

      const unitCost = Math.max(1, Math.round(def.basePrice * (priceMultipliers[inv.productName] ?? 1) * priceFactor));
      return { inv, def, stockRatio, quantity, unitCost };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    // Emptiest first.
    .sort((a, b) => a.stockRatio - b.stockRatio);

  const lines: RestockOrderLine[] = [];
  const skipped: RestockPlan['skipped'] = [];
  let spent = 0;

  let spaceLeft = Math.max(0, spaceAvailable);

  for (const c of candidates) {
    const remainingBudget = budget - spent;
    const remainingCash = availableCash - spent;
    const affordable = Math.min(remainingBudget, remainingCash);

    // Buy as much of the wanted quantity as the money left will cover, rather
    // than dropping the line entirely — a partly filled shelf still sells.
    // Bounded by room as well as by money.
    const quantity = Math.min(c.quantity, Math.floor(affordable / c.unitCost), spaceLeft);
    if (quantity <= 0) {
      skipped.push({
        productName: c.inv.productName,
        reason: remainingCash < remainingBudget ? 'cash' : 'budget',
      });
      continue;
    }

    spaceLeft -= quantity;
    const lineCost = quantity * c.unitCost;
    // Cost basis is a weighted average, matching the manual buy route, so COGS
    // and the liquidation value of stock stay honest.
    const newQuantity = c.inv.quantity + quantity;
    const newPurchasePrice = Math.round(
      (c.inv.purchasePrice * c.inv.quantity + lineCost) / newQuantity,
    );

    lines.push({
      inventoryId: c.inv.id,
      productName: c.inv.productName,
      quantity,
      unitCost: c.unitCost,
      lineCost,
      newPurchasePrice,
      stockRatioBefore: c.stockRatio,
    });
    spent += lineCost;

    if (quantity < c.quantity) {
      skipped.push({
        productName: c.inv.productName,
        reason: remainingCash < remainingBudget ? 'cash' : 'budget',
      });
    }
  }

  return { lines, totalCost: spent, skipped };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export interface RestockResult {
  /** True when anything was actually bought. */
  restocked: boolean;
  totalCost: number;
  lines: RestockOrderLine[];
  skipped: RestockPlan['skipped'];
}

const EMPTY_RESULT: RestockResult = { restocked: false, totalCost: 0, lines: [], skipped: [] };

/**
 * Plan and execute a restock for one business, paid for out of the owner's cash.
 *
 * `overrideSettings` is how the manual "Restock all" button reuses this: it
 * passes a one-off order rather than the business's standing settings.
 *
 * Money and stock move in a single transaction, and the player's cash is
 * re-read inside it, so two businesses topping up in the same tick cannot
 * together spend more than their owner has.
 */
export async function runRestock(
  businessId: string,
  options: { overrideSettings?: RestockSettings; logActivity?: boolean; priceFactor?: number } = {},
): Promise<RestockResult> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    include: { inventories: true },
  });
  if (!business) return EMPTY_RESULT;

  // A shop still being fitted out has nothing to sell and no shelves to fill.
  if (business.setupDaysRemaining > 0) return EMPTY_RESULT;

  const settings: RestockSettings = options.overrideSettings ?? {
    threshold: business.autoRestockThreshold,
    target: business.autoRestockTarget,
    budget: business.autoRestockBudget,
  };

  const productDefs = PRODUCTS[business.type] || [];
  if (productDefs.length === 0) return EMPTY_RESULT;

  const marketPrices = await db.marketPrice.findMany({
    where: { city: business.city },
    select: { productName: true, priceMultiplier: true },
  });
  const priceMultipliers: Record<string, number> = {};
  for (const mp of marketPrices) priceMultipliers[mp.productName] = mp.priceMultiplier;

  // Godowns in force today, so a standing order cannot push a shop past its
  // ceiling — reachable when a rental lapses under stock already stored.
  const [godowns, season] = await Promise.all([
    db.godown.findMany({
      where: { businessId, status: 'ACTIVE' },
      select: { id: true, tier: true, capacityBonus: true, expiresOnDay: true },
    }),
    db.season.findFirst({ where: { status: 'ACTIVE' }, select: { gameDay: true } }),
  ]);
  const gameDay = season?.gameDay ?? 0;

  return db.$transaction(async tx => {
    const player = await tx.player.findUnique({
      where: { id: business.playerId },
      select: { id: true, cash: true },
    });
    if (!player) return EMPTY_RESULT;

    // Re-read the shelves inside the transaction: the tick may have sold stock
    // since the read above.
    const inventories = await tx.inventory.findMany({
      where: { businessId },
      select: { id: true, productName: true, quantity: true, purchasePrice: true },
    });

    const space = capacityReport({
      productDefs: productDefs.map(p => ({ name: p.name, maxStock: p.maxStock })),
      inventories,
      godowns: godowns.map(g => ({
        id: g.id,
        tier: g.tier as GodownTier,
        capacityBonus: g.capacityBonus,
        expiresOnDay: g.expiresOnDay,
      })),
      // Pre-orders have their own space reserved at placement; counting it
      // again here would stop a standing order filling shelves it may fill.
      incoming: 0,
      gameDay,
    });

    const plan = planRestock({
      spaceAvailable: space.available,
      priceFactor: options.priceFactor,
      inventories,
      productDefs,
      priceMultipliers,
      availableCash: Math.max(0, player.cash),
      settings,
    });

    if (plan.lines.length === 0) {
      return { restocked: false, totalCost: 0, lines: [], skipped: plan.skipped };
    }

    await tx.player.update({
      where: { id: player.id },
      data: { cash: { decrement: plan.totalCost } },
    });

    for (const line of plan.lines) {
      // Age is blended alongside the cost basis: stock arriving today is fresh
      // and pulls the shelf's average down, which is why a shop that is topped
      // up regularly never spoils and one left to sit does.
      const before = await tx.inventory.findUnique({
        where: { id: line.inventoryId },
        select: { quantity: true, averageAgeDays: true },
      });

      await tx.inventory.update({
        where: { id: line.inventoryId },
        data: {
          quantity: { increment: line.quantity },
          purchasePrice: line.newPurchasePrice,
          averageAgeDays: blendAge({
            existingQuantity: before?.quantity ?? 0,
            existingAgeDays: before?.averageAgeDays ?? 0,
            incomingQuantity: line.quantity,
            incomingAgeDays: 0,
          }),
        },
      });
    }

    if (options.logActivity !== false) {
      const units = plan.lines.reduce((sum, l) => sum + l.quantity, 0);
      await tx.gameLog.create({
        data: {
          playerId: player.id,
          businessId,
          type: 'AUTO_RESTOCK',
          message:
            `${business.name}: restocked ${units} unit${units === 1 ? '' : 's'} across ` +
            `${plan.lines.length} product${plan.lines.length === 1 ? '' : 's'} ` +
            `for ৳${Math.round(plan.totalCost).toLocaleString()}` +
            (plan.skipped.length > 0 ? ` (${plan.skipped.length} line(s) short of funds)` : ''),
          amount: -plan.totalCost,
        },
      });
    }

    return { restocked: true, totalCost: plan.totalCost, lines: plan.lines, skipped: plan.skipped };
  });
}

/**
 * Run the standing order for a business, if it has one switched on.
 * Called at the top of each business's tick, so the shop opens stocked.
 */
export async function runAutoRestockForTick(businessId: string): Promise<RestockResult> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { autoRestock: true, autoRestockBudget: true },
  });
  if (!business?.autoRestock) return EMPTY_RESULT;

  try {
    // The player's threshold and target are deliberately ignored here. This is
    // the emergency top-up, not their buying plan: it waits until a shelf is
    // nearly bare, refills it barely, and pays the counter premium. Their own
    // budget cap is still honoured, because capping what an unattended shop may
    // spend is a safety setting rather than a purchasing decision.
    return await runRestock(businessId, {
      overrideSettings: {
        threshold: EMERGENCY_RESTOCK.threshold,
        target: EMERGENCY_RESTOCK.target,
        budget: business.autoRestockBudget,
      },
      priceFactor: EMERGENCY_RESTOCK.priceFactor,
    });
  } catch (error) {
    // A failed restock must not take the whole tick down with it; the shop
    // simply opens with the stock it has.
    console.error(`[AutoRestock] Failed for business ${businessId}:`, error);
    return EMPTY_RESULT;
  }
}
