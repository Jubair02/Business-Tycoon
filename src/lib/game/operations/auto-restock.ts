// ============================================
// Bangladesh Business Tycoon - Standing Restock Orders
// ============================================
//
// Stock empties in roughly a game day, and a game day is a minute of real
// time. Without a standing order the core interaction of the game is re-buying
// the same six products every single tick, for every business owned — a chore
// that grows linearly with success and drives early churn. The AI competitors
// have had `performMandatoryRestock` since Phase 2; players had nothing.
//
// This module is the player's version of it. The planning half is pure and
// testable; the executing half is the only part that touches the database.

import { db } from '@/lib/db';
import { PRODUCTS } from '@/lib/game-data';
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
}): RestockPlan {
  const { inventories, productDefs, priceMultipliers, availableCash, settings } = params;

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

      const unitCost = Math.max(1, Math.round(def.basePrice * (priceMultipliers[inv.productName] ?? 1)));
      return { inv, def, stockRatio, quantity, unitCost };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    // Emptiest first.
    .sort((a, b) => a.stockRatio - b.stockRatio);

  const lines: RestockOrderLine[] = [];
  const skipped: RestockPlan['skipped'] = [];
  let spent = 0;

  for (const c of candidates) {
    const remainingBudget = budget - spent;
    const remainingCash = availableCash - spent;
    const affordable = Math.min(remainingBudget, remainingCash);

    // Buy as much of the wanted quantity as the money left will cover, rather
    // than dropping the line entirely — a partly filled shelf still sells.
    const quantity = Math.min(c.quantity, Math.floor(affordable / c.unitCost));
    if (quantity <= 0) {
      skipped.push({
        productName: c.inv.productName,
        reason: remainingCash < remainingBudget ? 'cash' : 'budget',
      });
      continue;
    }

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
  options: { overrideSettings?: RestockSettings; logActivity?: boolean } = {},
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

    const plan = planRestock({
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
      await tx.inventory.update({
        where: { id: line.inventoryId },
        data: {
          quantity: { increment: line.quantity },
          purchasePrice: line.newPurchasePrice,
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
    select: { autoRestock: true },
  });
  if (!business?.autoRestock) return EMPTY_RESULT;

  try {
    return await runRestock(businessId);
  } catch (error) {
    // A failed restock must not take the whole tick down with it; the shop
    // simply opens with the stock it has.
    console.error(`[AutoRestock] Failed for business ${businessId}:`, error);
    return EMPTY_RESULT;
  }
}
