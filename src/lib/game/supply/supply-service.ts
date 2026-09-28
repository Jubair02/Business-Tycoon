// ============================================
// Bangladesh Business Tycoon - Supply service
// ============================================
//
// The database half of spoilage and supplier credit. What *should* happen lives
// in `spoilage.ts` and `suppliers.ts` and is pure; this reads, writes and pays.

import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { PRODUCTS } from '@/lib/game-data';
import { blendAge, spoilOneDay } from './spoilage';
import { PAYMENT_TERMS, overdueTotal, type PaymentTerm, type SupplierId } from './suppliers';

type Tx = Prisma.TransactionClient;

// ============================================
// Spoilage
// ============================================

export interface SpoilageResult {
  spoiled: number;
  loss: number;
  lines: { productName: string; spoiled: number; lossValue: number }[];
}

const NO_SPOILAGE: SpoilageResult = { spoiled: 0, loss: 0, lines: [] };

/**
 * Age one shop's shelves by a game day and throw away what has gone off.
 *
 * Runs in the tick **after** deliveries and before trading, so stock that
 * arrived this morning is fresh for today's customers and yesterday's fish is
 * gone before anyone is sold it.
 *
 * Never throws: a shop whose spoilage fails must not take the world's tick
 * down with it.
 */
export async function applySpoilage(businessId: string): Promise<SpoilageResult> {
  try {
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: {
        id: true, type: true, playerId: true,
        inventories: {
          select: { id: true, productName: true, quantity: true, purchasePrice: true, averageAgeDays: true },
        },
      },
    });
    if (!business) return NO_SPOILAGE;

    const defs = PRODUCTS[business.type] ?? [];
    const lines: SpoilageResult['lines'] = [];
    let spoiled = 0;
    let loss = 0;

    for (const inventory of business.inventories) {
      const def = defs.find(d => d.name === inventory.productName);
      const result = spoilOneDay({
        productName: inventory.productName,
        quantity: inventory.quantity,
        purchasePrice: inventory.purchasePrice,
        averageAgeDays: inventory.averageAgeDays,
        shelfLifeDays: def?.shelfLifeDays ?? 0,
      });

      // Nothing lost and nothing perishable: skip the write entirely rather
      // than touch every shelf in the game once a minute.
      if (result.spoiled === 0 && (def?.shelfLifeDays ?? 0) === 0) continue;

      await db.inventory.update({
        where: { id: inventory.id },
        data: { quantity: result.remaining, averageAgeDays: result.newAgeDays },
      });

      if (result.spoiled > 0) {
        spoiled += result.spoiled;
        loss += result.lossValue;
        lines.push({
          productName: inventory.productName,
          spoiled: result.spoiled,
          lossValue: result.lossValue,
        });
      }
    }

    if (spoiled > 0) {
      await db.gameLog.create({
        data: {
          playerId: business.playerId,
          businessId: business.id,
          type: 'SPOILAGE',
          message: `Threw away ${spoiled} units that had gone off — ৳${loss.toLocaleString()} lost. ${
            lines.map(l => `${l.spoiled} × ${l.productName}`).join(', ')
          }`,
          amount: -loss,
        },
      });
    }

    return { spoiled, loss, lines };
  } catch (error) {
    console.error(`[supply] Spoilage failed for ${businessId}:`, error);
    return NO_SPOILAGE;
  }
}

/**
 * Fold arriving stock into a shelf, blending both the cost basis and the age.
 *
 * Every route that adds stock goes through here, so a delivery, a counter
 * purchase and an emergency top-up all age a shelf the same way. Before this,
 * each did its own weighted average of price and none of them touched age.
 */
/**
 * Fold any repeated shelves in a shop back into one row per product.
 *
 * A shop can be holding more than one row for the same product because
 * `POST /inventory/buy` used to merge on `productId` — a column that is '' on
 * older shelves and on rows the AI writes, and an order id on pre-order
 * deliveries. Each miss minted a duplicate, which the Inventory tab lists twice
 * and the tick treats as two shelves drawing demand separately.
 *
 * The buy path repairs the product being bought on its own (see
 * `addStockToShelf`). This exists for the paths that top up everything at once,
 * so one "Restock all" puts a whole shop right instead of needing a purchase
 * per product.
 *
 * Returns the number of rows removed. Safe to call on a healthy shop, where it
 * does nothing.
 */
export async function collapseDuplicateShelves(tx: Tx, businessId: string): Promise<number> {
  const rows = await tx.inventory.findMany({
    where: { businessId },
    select: {
      id: true,
      productName: true,
      productId: true,
      quantity: true,
      purchasePrice: true,
      averageAgeDays: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const byProduct = new Map<string, typeof rows>();
  for (const row of rows) {
    const group = byProduct.get(row.productName);
    if (group) group.push(row);
    else byProduct.set(row.productName, [row]);
  }

  const strayIds: string[] = [];

  for (const group of byProduct.values()) {
    if (group.length < 2) continue;

    // The oldest row survives: it is the one the player has been pricing, and
    // the one every other screen has been pointing at.
    const [primary, ...strays] = group;

    const totalQuantity = group.reduce((sum, r) => sum + r.quantity, 0);
    const totalCost = group.reduce((sum, r) => sum + r.purchasePrice * r.quantity, 0);
    const ageWeighted = group.reduce((sum, r) => sum + r.averageAgeDays * r.quantity, 0);

    await tx.inventory.update({
      where: { id: primary.id },
      data: {
        quantity: totalQuantity,
        purchasePrice: totalQuantity > 0 ? Math.round(totalCost / totalQuantity) : primary.purchasePrice,
        averageAgeDays: totalQuantity > 0 ? ageWeighted / totalQuantity : primary.averageAgeDays,
        // Salvage a real product id from whichever duplicate had one.
        ...(primary.productId ? {} : { productId: group.find(r => r.productId)?.productId ?? '' }),
      },
    });

    strayIds.push(...strays.map(r => r.id));
  }

  if (strayIds.length > 0) {
    await tx.inventory.deleteMany({ where: { id: { in: strayIds } } });
  }

  return strayIds.length;
}

export async function addStockToShelf(params: {
  tx: Tx;
  businessId: string;
  businessType: string;
  productName: string;
  category: string;
  quantity: number;
  unitCost: number;
  /** Age of the arriving goods. Fresh from a supplier is 0. */
  incomingAgeDays?: number;
  productIdFallback?: string;
}): Promise<void> {
  const { tx, businessId, productName, quantity, unitCost } = params;
  if (quantity <= 0) return;

  // ---- One product, one shelf ----
  //
  // `findMany`, not `findFirst`, because a shop can already be holding more
  // than one row for the same product: `POST /inventory/buy` used to merge on
  // `productId`, a column that older rows carry as '' and that pre-order
  // deliveries carry an order id in. Every mismatch minted a second shelf for a
  // product that already had one, and the tick then treated it as a second
  // shelf — drawing its own demand, holding its own price.
  //
  // Folding the strays in here repairs a shop through ordinary play, which is
  // the only repair path available for saves that already went wrong.
  const shelves = await tx.inventory.findMany({
    where: { businessId, productName },
    select: { id: true, quantity: true, purchasePrice: true, averageAgeDays: true, productId: true },
    orderBy: { createdAt: 'asc' },
  });

  if (shelves.length > 0) {
    const [primary, ...strays] = shelves;

    // Collapse what is already on the shelves into single running totals, so
    // the incoming stock blends against the shop's real position rather than
    // against whichever duplicate happened to be found first.
    const heldQuantity = shelves.reduce((sum, s) => sum + s.quantity, 0);
    const heldCost = shelves.reduce((sum, s) => sum + s.purchasePrice * s.quantity, 0);
    const heldAgeWeighted = shelves.reduce((sum, s) => sum + s.averageAgeDays * s.quantity, 0);

    const newQuantity = heldQuantity + quantity;
    const newCost = (heldCost + unitCost * quantity) / newQuantity;

    await tx.inventory.update({
      where: { id: primary.id },
      data: {
        quantity: newQuantity,
        purchasePrice: Math.round(newCost),
        averageAgeDays: blendAge({
          existingQuantity: heldQuantity,
          existingAgeDays: heldQuantity > 0 ? heldAgeWeighted / heldQuantity : 0,
          incomingQuantity: quantity,
          incomingAgeDays: params.incomingAgeDays,
        }),
        // Backfill a real product id onto rows that were written without one,
        // so anything still keying on it stops missing.
        ...(primary.productId ? {} : { productId: params.productIdFallback ?? '' }),
      },
    });

    if (strays.length > 0) {
      await tx.inventory.deleteMany({ where: { id: { in: strays.map(s => s.id) } } });
    }
    return;
  }

  const def = (PRODUCTS[params.businessType] ?? []).find(d => d.name === productName);
  await tx.inventory.create({
    data: {
      businessId,
      productId: params.productIdFallback ?? '',
      productName,
      category: params.category,
      quantity,
      purchasePrice: Math.round(unitCost),
      sellPrice: Math.round(unitCost * (1 + (def?.suggestedMarkup ?? 0.3))),
      averageAgeDays: Math.max(0, params.incomingAgeDays ?? 0),
    },
  });
}

// ============================================
// Supplier credit
// ============================================

export interface CreditSummary {
  open: number;
  overdue: number;
  /** principal + surcharge + any penalty, across every unsettled bill. */
  totalOutstanding: number;
  blocked: boolean;
  nextDueOnDay: number | null;
}

/** What a player owes their suppliers. */
export async function creditSummary(playerId: string): Promise<CreditSummary> {
  const bills = await db.supplierCredit.findMany({
    where: { playerId, status: { in: ['OPEN', 'OVERDUE'] } },
    select: { totalDue: true, penalty: true, status: true, dueOnDay: true },
    orderBy: { dueOnDay: 'asc' },
  });

  const overdue = bills.filter(b => b.status === 'OVERDUE');

  return {
    open: bills.length - overdue.length,
    overdue: overdue.length,
    totalOutstanding: bills.reduce((sum, b) => sum + b.totalDue + b.penalty, 0),
    // One unpaid bill and the trade stops lending to you. Credit without a
    // consequence for missing a payment is just a discount on patience.
    blocked: overdue.length > 0,
    nextDueOnDay: bills[0]?.dueOnDay ?? null,
  };
}

/** Whether the player may still buy on terms. */
export async function isCreditBlocked(playerId: string): Promise<boolean> {
  const overdue = await db.supplierCredit.count({
    where: { playerId, status: 'OVERDUE' },
  });
  return overdue > 0;
}

/** Record a bill for goods taken on terms. */
export async function openCredit(params: {
  tx: Tx;
  playerId: string;
  businessId: string;
  supplier: SupplierId;
  term: PaymentTerm;
  principal: number;
  surcharge: number;
  issuedOnDay: number;
  dueOnDay: number;
}): Promise<string> {
  const credit = await params.tx.supplierCredit.create({
    data: {
      playerId: params.playerId,
      businessId: params.businessId,
      supplierId: params.supplier,
      term: params.term,
      principal: params.principal,
      surcharge: params.surcharge,
      totalDue: params.principal + params.surcharge,
      issuedOnDay: params.issuedOnDay,
      dueOnDay: params.dueOnDay,
    },
    select: { id: true },
  });
  return credit.id;
}

export interface SettlementResult {
  paid: number;
  amountPaid: number;
  newlyOverdue: number;
  penaltyCharged: number;
}

/**
 * Settle every supplier bill that has fallen due.
 *
 * Called once per world tick. A bill the player can pay is paid; one they
 * cannot goes overdue, starts accruing a late fee, and blocks further credit
 * until it is cleared. Nothing is seized and no shop is closed — the sanction
 * is that the trade stops extending you terms, which is what actually happens.
 */
export async function settleSupplierCredit(gameDay: number): Promise<SettlementResult> {
  const result: SettlementResult = { paid: 0, amountPaid: 0, newlyOverdue: 0, penaltyCharged: 0 };

  const due = await db.supplierCredit.findMany({
    where: { status: { in: ['OPEN', 'OVERDUE'] }, dueOnDay: { lte: gameDay } },
    select: {
      id: true, playerId: true, businessId: true, totalDue: true, penalty: true,
      dueOnDay: true, status: true, supplierId: true,
    },
  });

  for (const bill of due) {
    try {
      await db.$transaction(async (tx: Tx) => {
        const player = await tx.player.findUnique({
          where: { id: bill.playerId },
          select: { cash: true },
        });
        if (!player) return;

        const daysLate = Math.max(0, gameDay - bill.dueOnDay);
        const owed = daysLate > 0 ? overdueTotal(bill.totalDue, daysLate) : Math.round(bill.totalDue);
        const penalty = Math.max(0, owed - Math.round(bill.totalDue));

        if (player.cash >= owed) {
          await tx.player.update({
            where: { id: bill.playerId },
            data: { cash: { decrement: owed } },
          });
          await tx.supplierCredit.update({
            where: { id: bill.id },
            data: { status: 'PAID', paidOnDay: gameDay, penalty },
          });
          await tx.gameLog.create({
            data: {
              playerId: bill.playerId,
              businessId: bill.businessId,
              type: 'SUPPLIER_CREDIT',
              message: `Paid the ${bill.supplierId.toLowerCase()} bill — ৳${owed.toLocaleString()}${
                penalty > 0 ? ` (including ৳${penalty.toLocaleString()} in late fees)` : ''
              }.`,
              amount: -owed,
            },
          });

          result.paid++;
          result.amountPaid += owed;
          result.penaltyCharged += penalty;
          return;
        }

        // Short. The bill stands, grows, and no supplier will extend more.
        await tx.supplierCredit.update({
          where: { id: bill.id },
          data: { status: 'OVERDUE', penalty },
        });

        if (bill.status !== 'OVERDUE') {
          await tx.gameLog.create({
            data: {
              playerId: bill.playerId,
              businessId: bill.businessId,
              type: 'SUPPLIER_CREDIT',
              message: `Could not pay the ${bill.supplierId.toLowerCase()} bill of ৳${owed.toLocaleString()}. Late fees are running, and no supplier will sell you on terms until it is cleared.`,
            },
          });
          result.newlyOverdue++;
        }
      });
    } catch (error) {
      console.error(`[supply] Failed to settle credit ${bill.id}:`, error);
    }
  }

  return result;
}

/** Pay an outstanding bill early, or clear an overdue one. */
export async function paySupplierCredit(params: {
  creditId: string;
  playerId: string;
  gameDay: number;
}): Promise<{ ok: boolean; message?: string; paid?: number }> {
  return db.$transaction(async (tx: Tx) => {
    const bill = await tx.supplierCredit.findUnique({
      where: { id: params.creditId },
      select: {
        id: true, playerId: true, businessId: true, totalDue: true,
        dueOnDay: true, status: true, supplierId: true,
      },
    });

    if (!bill || bill.playerId !== params.playerId) {
      return { ok: false, message: 'Bill not found.' };
    }
    if (bill.status === 'PAID') {
      return { ok: false, message: 'That bill is already settled.' };
    }

    const daysLate = Math.max(0, params.gameDay - bill.dueOnDay);
    const owed = daysLate > 0 ? overdueTotal(bill.totalDue, daysLate) : Math.round(bill.totalDue);

    const player = await tx.player.findUnique({
      where: { id: params.playerId },
      select: { cash: true },
    });
    if (!player || player.cash < owed) {
      return {
        ok: false,
        message: `That bill is ৳${owed.toLocaleString()} and you have ৳${Math.round(player?.cash ?? 0).toLocaleString()}.`,
      };
    }

    await tx.player.update({
      where: { id: params.playerId },
      data: { cash: { decrement: owed } },
    });
    await tx.supplierCredit.update({
      where: { id: bill.id },
      data: { status: 'PAID', paidOnDay: params.gameDay, penalty: Math.max(0, owed - Math.round(bill.totalDue)) },
    });
    await tx.gameLog.create({
      data: {
        playerId: params.playerId,
        businessId: bill.businessId,
        type: 'SUPPLIER_CREDIT',
        message: `Settled the ${bill.supplierId.toLowerCase()} bill — ৳${owed.toLocaleString()}.`,
        amount: -owed,
      },
    });

    return { ok: true, paid: owed };
  });
}

/** Total unsettled supplier debt, for net worth. */
export async function outstandingSupplierDebt(tx: Tx, playerId: string): Promise<number> {
  const bills = await tx.supplierCredit.findMany({
    where: { playerId, status: { in: ['OPEN', 'OVERDUE'] } },
    select: { totalDue: true, penalty: true },
  });
  return bills.reduce((sum, b) => sum + b.totalDue + b.penalty, 0);
}

export { PAYMENT_TERMS };
