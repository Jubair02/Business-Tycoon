// ============================================
// Bangladesh Business Tycoon - Storage service
// ============================================
//
// The database half of godowns and pre-orders. Everything that decides *what
// should happen* lives in `capacity.ts` and `pre-orders.ts` and is pure; this
// module reads, writes and charges.
//
// Money moves at placement, never at delivery. A pre-order is paid for when it
// is made, so the day it arrives cannot fail for want of cash — and the space
// it will occupy is reserved from the same moment, so three orders that each
// fit cannot be placed if together they do not.

import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { PRODUCTS, BUSINESS_TYPES } from '@/lib/game-data';
import {
  capacityReport,
  previewGodown,
  type ActiveGodown,
  type CapacityReport,
} from './capacity';
import {
  cancellationQuote,
  planDelivery,
  quotePreOrder,
  validatePreOrder,
  type PreOrderRequest,
  type PreOrderQuote,
} from './pre-orders';
import {
  SUPPLIERS,
  quoteFromSupplier,
  validateSupplierOrder,
  type PaymentTerm,
  type SupplierId,
} from '../supply/suppliers';
import { isCreditBlocked, openCredit, addStockToShelf } from '../supply/supply-service';
import {
  GODOWN_TIERS,
  GODOWN_TIER_IDS,
  STORAGE_CONFIG,
  godownCapacityBonus,
  godownTermCost,
  type GodownTier,
} from './storage-config';

type Tx = Prisma.TransactionClient;

function productDefsFor(businessType: string) {
  return (PRODUCTS[businessType] ?? []).map(p => ({ name: p.name, maxStock: p.maxStock }));
}

function monthlyRentFor(businessType: string): number {
  return BUSINESS_TYPES.find(b => b.id === businessType)?.rent ?? 0;
}

export interface StorageState {
  businessId: string;
  businessType: string;
  gameDay: number;
  capacity: CapacityReport;
  godowns: {
    id: string;
    tier: GodownTier;
    tierEn: string;
    tierBn: string;
    icon: string;
    capacityBonus: number;
    termCost: number;
    rentedOnDay: number;
    expiresOnDay: number;
    daysRemaining: number;
    autoRenew: boolean;
    expiringSoon: boolean;
  }[];
  preOrders: {
    id: string;
    productName: string;
    category: string;
    quantity: number;
    unitCost: number;
    discount: number;
    totalCost: number;
    placedOnDay: number;
    deliveryDay: number;
    daysUntilDelivery: number;
    status: string;
    deliveredQuantity: number;
    refunded: number;
    note: string | null;
  }[];
  /** Orders already settled, newest first — proof that a delivery landed. */
  recentOrders: {
    id: string;
    productName: string;
    quantity: number;
    totalCost: number;
    deliveryDay: number;
    status: string;
    deliveredQuantity: number;
    refunded: number;
    note: string | null;
  }[];
  /** What each tier would cost and add, for the rental screen. */
  godownOffers: {
    tier: GodownTier;
    en: string;
    bn: string;
    icon: string;
    capacityBonus: number;
    terms: { days: number; cost: number }[];
    /** False when the shop already holds the maximum number of godowns. */
    available: boolean;
  }[];
  limits: {
    maxGodowns: number;
    maxOpenPreOrders: number;
    minLeadDays: number;
    maxLeadDays: number;
    minOrderQuantity: number;
    cancellationFee: number;
  };
}

/** Everything the storage screen needs for one shop. */
export async function getStorageState(businessId: string, gameDay: number): Promise<StorageState | null> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      type: true,
      inventories: { select: { productName: true, quantity: true } },
      godowns: {
        where: { status: 'ACTIVE' },
        select: {
          id: true, tier: true, capacityBonus: true, termCost: true,
          rentedOnDay: true, expiresOnDay: true, autoRenew: true,
        },
      },
      preOrders: {
        where: { status: 'PENDING' },
        orderBy: { deliveryDay: 'asc' },
        select: {
          id: true, productName: true, category: true, quantity: true,
          unitCost: true, discount: true, totalCost: true,
          placedOnDay: true, deliveryDay: true, status: true,
          deliveredQuantity: true, refunded: true, note: true,
        },
      },

    },
  });

  if (!business) return null;

  // Settled orders, in their own query: Prisma allows one selection per
  // relation, and an order that vanished the day it landed left the player
  // nothing confirming it arrived — or that part of it was refunded.
  const settled = await db.preOrder.findMany({
    where: { businessId, status: { not: 'PENDING' } },
    orderBy: { updatedAt: 'desc' },
    take: 6,
    select: {
      id: true, productName: true, quantity: true, totalCost: true,
      deliveryDay: true, status: true, deliveredQuantity: true,
      refunded: true, note: true,
    },
  });

  const productDefs = productDefsFor(business.type);
  const godowns: ActiveGodown[] = business.godowns.map(g => ({
    id: g.id,
    tier: g.tier as GodownTier,
    capacityBonus: g.capacityBonus,
    expiresOnDay: g.expiresOnDay,
  }));

  const incoming = business.preOrders.reduce((sum, o) => sum + o.quantity, 0);
  const capacity = capacityReport({
    productDefs,
    inventories: business.inventories,
    godowns,
    incoming,
    gameDay,
  });

  const monthlyRent = monthlyRentFor(business.type);
  const atGodownLimit = business.godowns.length >= STORAGE_CONFIG.maxGodownsPerBusiness;

  return {
    businessId: business.id,
    businessType: business.type,
    gameDay,
    capacity,
    godowns: business.godowns.map(g => {
      const spec = GODOWN_TIERS[g.tier as GodownTier] ?? GODOWN_TIERS.SMALL;
      const daysRemaining = g.expiresOnDay - gameDay;
      return {
        id: g.id,
        tier: g.tier as GodownTier,
        tierEn: spec.en,
        tierBn: spec.bn,
        icon: spec.icon,
        capacityBonus: g.capacityBonus,
        termCost: g.termCost,
        rentedOnDay: g.rentedOnDay,
        expiresOnDay: g.expiresOnDay,
        daysRemaining,
        autoRenew: g.autoRenew,
        // Worth warning about: stock sitting in a lapsing godown has nowhere
        // to go, and a delivery due after it lapses may be refunded instead.
        expiringSoon: daysRemaining <= 7,
      };
    }),
    preOrders: business.preOrders.map(o => ({
      ...o,
      daysUntilDelivery: o.deliveryDay - gameDay,
    })),
    recentOrders: settled,
    godownOffers: GODOWN_TIER_IDS.map(tier => ({
      tier,
      en: GODOWN_TIERS[tier].en,
      bn: GODOWN_TIERS[tier].bn,
      icon: GODOWN_TIERS[tier].icon,
      capacityBonus: previewGodown(tier, productDefs),
      terms: STORAGE_CONFIG.termOptions.map(days => ({
        days,
        cost: godownTermCost(tier, monthlyRent, days),
      })),
      available: !atGodownLimit,
    })),
    limits: {
      maxGodowns: STORAGE_CONFIG.maxGodownsPerBusiness,
      maxOpenPreOrders: STORAGE_CONFIG.maxOpenPreOrders,
      minLeadDays: STORAGE_CONFIG.minLeadDays,
      maxLeadDays: STORAGE_CONFIG.maxLeadDays,
      minOrderQuantity: STORAGE_CONFIG.minOrderQuantity,
      cancellationFee: STORAGE_CONFIG.cancellationFee,
    },
  };
}

// ============================================
// Godowns
// ============================================

export interface RentResult {
  ok: boolean;
  message?: string;
  godownId?: string;
  cost?: number;
  capacityBonus?: number;
}

/** Rent storage for a term, paid upfront. */
export async function rentGodown(params: {
  businessId: string;
  playerId: string;
  tier: GodownTier;
  termDays: number;
  gameDay: number;
}): Promise<RentResult> {
  const { businessId, playerId, tier, termDays, gameDay } = params;

  if (!(STORAGE_CONFIG.termOptions as readonly number[]).includes(termDays)) {
    return { ok: false, message: 'That rental term is not offered.' };
  }

  return db.$transaction(async (tx: Tx) => {
    const business = await tx.business.findUnique({
      where: { id: businessId },
      select: { id: true, type: true, playerId: true },
    });
    if (!business || business.playerId !== playerId) {
      return { ok: false, message: 'Business not found.' };
    }

    const existing = await tx.godown.count({ where: { businessId, status: 'ACTIVE' } });
    if (existing >= STORAGE_CONFIG.maxGodownsPerBusiness) {
      return {
        ok: false,
        message: `A shop can hold ${STORAGE_CONFIG.maxGodownsPerBusiness} rentals at once.`,
      };
    }

    const capacityBonus = godownCapacityBonus(tier, productDefsFor(business.type).reduce((s, p) => s + p.maxStock, 0));
    const cost = godownTermCost(tier, monthlyRentFor(business.type), termDays);

    const player = await tx.player.findUnique({ where: { id: playerId }, select: { cash: true } });
    if (!player) return { ok: false, message: 'Player not found.' };
    if (player.cash < cost) {
      return {
        ok: false,
        message: `That rental costs ৳${cost.toLocaleString()} upfront. You have ৳${Math.round(player.cash).toLocaleString()}.`,
      };
    }

    await tx.player.update({ where: { id: playerId }, data: { cash: { decrement: cost } } });

    const godown = await tx.godown.create({
      data: {
        businessId,
        tier,
        capacityBonus,
        termCost: cost,
        rentedOnDay: gameDay,
        expiresOnDay: gameDay + termDays,
      },
      select: { id: true },
    });

    await tx.gameLog.create({
      data: {
        playerId,
        businessId,
        type: 'STORAGE',
        message: `Rented a ${GODOWN_TIERS[tier].en} for ${termDays} days (+${capacityBonus} units) for ৳${cost.toLocaleString()}.`,
        amount: -cost,
      },
    });

    return { ok: true, godownId: godown.id, cost, capacityBonus };
  });
}

/** Turn auto-renew on or off for a rental. */
export async function setGodownAutoRenew(params: {
  godownId: string;
  playerId: string;
  autoRenew: boolean;
}): Promise<{ ok: boolean; message?: string }> {
  const godown = await db.godown.findUnique({
    where: { id: params.godownId },
    select: { id: true, business: { select: { playerId: true } } },
  });

  if (!godown || godown.business.playerId !== params.playerId) {
    return { ok: false, message: 'Rental not found.' };
  }

  await db.godown.update({
    where: { id: params.godownId },
    data: { autoRenew: params.autoRenew },
  });

  return { ok: true };
}

/**
 * Close out rentals whose term has run, renewing the ones set to.
 *
 * Called once per tick. Stock sitting in a lapsed godown is **not** destroyed —
 * the shop simply reads as over capacity and cannot take on more until it is
 * back inside its limits. Confiscating goods a player paid for because a
 * rental lapsed would be a punishment, not a mechanic.
 */
export async function expireGodowns(gameDay: number): Promise<{ expired: number; renewed: number }> {
  const due = await db.godown.findMany({
    where: { status: 'ACTIVE', expiresOnDay: { lte: gameDay } },
    select: {
      id: true, tier: true, termCost: true, autoRenew: true, capacityBonus: true,
      rentedOnDay: true, expiresOnDay: true,
      business: { select: { id: true, playerId: true } },
    },
  });

  let expired = 0;
  let renewed = 0;

  for (const godown of due) {
    const termDays = Math.max(1, godown.expiresOnDay - godown.rentedOnDay);

    try {
      const didRenew = godown.autoRenew
        ? await db.$transaction(async (tx: Tx) => {
            const player = await tx.player.findUnique({
              where: { id: godown.business.playerId },
              select: { cash: true },
            });
            if (!player || player.cash < godown.termCost) return false;

            await tx.player.update({
              where: { id: godown.business.playerId },
              data: { cash: { decrement: godown.termCost } },
            });
            await tx.godown.update({
              where: { id: godown.id },
              data: { rentedOnDay: gameDay, expiresOnDay: gameDay + termDays },
            });
            await tx.gameLog.create({
              data: {
                playerId: godown.business.playerId,
                businessId: godown.business.id,
                type: 'STORAGE',
                message: `Renewed the ${GODOWN_TIERS[godown.tier as GodownTier]?.en ?? 'godown'} for ${termDays} days — ৳${godown.termCost.toLocaleString()}.`,
                amount: -godown.termCost,
              },
            });
            return true;
          })
        : false;

      if (didRenew) {
        renewed++;
        continue;
      }

      await db.godown.update({ where: { id: godown.id }, data: { status: 'EXPIRED' } });
      await db.gameLog.create({
        data: {
          playerId: godown.business.playerId,
          businessId: godown.business.id,
          type: 'STORAGE',
          message: `The ${GODOWN_TIERS[godown.tier as GodownTier]?.en ?? 'godown'} rental has ended. Storage is down ${godown.capacityBonus} units.`,
        },
      });
      expired++;
    } catch (error) {
      console.error(`[storage] Failed to close rental ${godown.id}:`, error);
    }
  }

  return { expired, renewed };
}

// ============================================
// Pre-orders
// ============================================

export interface PlaceOrderResult {
  ok: boolean;
  message?: string;
  reason?: string;
  orderId?: string;
  quote?: PreOrderQuote;
  acceptable?: number;
}

async function spotUnitCostFor(businessType: string, city: string, productName: string): Promise<number | null> {
  const def = (PRODUCTS[businessType] ?? []).find(p => p.name === productName);
  if (!def) return null;

  const market = await db.marketPrice.findUnique({
    where: { productName_city: { productName, city } },
    select: { priceMultiplier: true },
  });

  return Math.max(1, Math.round(def.basePrice * (market?.priceMultiplier ?? 1)));
}

/** Price an order without placing it, for the live quote on the screen. */
export async function quoteOrder(params: {
  businessId: string;
  request: PreOrderRequest;
  gameDay: number;
}): Promise<PreOrderQuote | null> {
  const business = await db.business.findUnique({
    where: { id: params.businessId },
    select: { type: true, city: true },
  });
  if (!business) return null;

  const spot = await spotUnitCostFor(business.type, business.city, params.request.productName);
  if (spot === null) return null;

  const state = await getStorageState(params.businessId, params.gameDay);
  if (!state) return null;

  return quotePreOrder(params.request, {
    currentGameDay: params.gameDay,
    spotUnitCost: spot,
    availableCash: Number.MAX_SAFE_INTEGER,
    capacity: state.capacity,
    openOrderCount: state.preOrders.length,
  });
}

/**
 * Place an order with a supplier.
 *
 * Cash orders are charged on the spot, exactly as before. An order on terms
 * takes no money now: it opens a supplier bill that falls due `leadDays +
 * term` days out, which is the whole point — a shopkeeper takes goods before
 * Eid and settles after selling them.
 */
export async function placePreOrder(params: {
  businessId: string;
  playerId: string;
  request: PreOrderRequest & { supplier?: SupplierId; term?: PaymentTerm };
  gameDay: number;
}): Promise<PlaceOrderResult> {
  const { businessId, playerId, request, gameDay } = params;
  const supplier: SupplierId = request.supplier ?? 'LOCAL';
  const term: PaymentTerm = request.term ?? 'NET_0';
  const spec = SUPPLIERS[supplier];

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true, type: true, city: true, playerId: true },
  });
  if (!business || business.playerId !== playerId) {
    return { ok: false, message: 'Business not found.' };
  }

  const spot = await spotUnitCostFor(business.type, business.city, request.productName);
  if (spot === null) {
    return { ok: false, reason: 'UNKNOWN_PRODUCT', message: 'That product is not sold here.' };
  }

  // Who will take the order, on what terms, and whether the player's credit is
  // any good. Checked before the transaction because none of it depends on the
  // shelves.
  const creditBlocked = await isCreditBlocked(playerId);
  const supplierVerdict = validateSupplierOrder({
    supplier,
    quantity: Math.floor(request.quantity),
    term,
    creditBlocked,
  });
  if (!supplierVerdict.ok) {
    return { ok: false, reason: supplierVerdict.reason, message: supplierVerdict.message };
  }

  // A supplier cannot deliver faster than it delivers. The importer's week is
  // the price of its prices.
  if (request.deliveryDay - gameDay < spec.leadDays) {
    return {
      ok: false,
      reason: 'LEAD_TOO_SHORT',
      message: `${spec.en} needs ${spec.leadDays} days. Choose a later date, or a nearer supplier.`,
    };
  }

  return db.$transaction(async (tx: Tx) => {
    // Re-read inside the transaction: two orders placed at once must not both
    // measure against the same free space.
    const [player, fresh] = await Promise.all([
      tx.player.findUnique({ where: { id: playerId }, select: { cash: true } }),
      tx.business.findUnique({
        where: { id: businessId },
        select: {
          type: true,
          inventories: { select: { productName: true, quantity: true } },
          godowns: { where: { status: 'ACTIVE' }, select: { id: true, tier: true, capacityBonus: true, expiresOnDay: true } },
          preOrders: { where: { status: 'PENDING' }, select: { quantity: true } },
        },
      }),
    ]);

    if (!player || !fresh) return { ok: false, message: 'Business not found.' };

    const capacity = capacityReport({
      productDefs: productDefsFor(fresh.type),
      inventories: fresh.inventories,
      godowns: fresh.godowns.map(g => ({
        id: g.id,
        tier: g.tier as GodownTier,
        capacityBonus: g.capacityBonus,
        expiresOnDay: g.expiresOnDay,
      })),
      incoming: fresh.preOrders.reduce((sum, o) => sum + o.quantity, 0),
      gameDay,
    });

    const verdict = validatePreOrder(request, {
      currentGameDay: gameDay,
      spotUnitCost: spot,
      // Goods taken on terms are not paid for today, so cash is not the test
      // for them — the supplier's willingness to lend already was.
      availableCash: term === 'NET_0' ? player.cash : Number.MAX_SAFE_INTEGER,
      capacity,
      openOrderCount: fresh.preOrders.length,
      supplier,
      term,
    });

    if (!verdict.ok || !verdict.quote) {
      return {
        ok: false,
        reason: verdict.reason,
        message: verdict.message,
        acceptable: verdict.acceptable,
      };
    }

    const quote = verdict.quote;
    const supplierQuote = quoteFromSupplier({
      supplier,
      quantity: quote.quantity,
      marketUnitCost: spot,
      term,
      orderDay: gameDay,
    });

    if (term === 'NET_0') {
      await tx.player.update({
        where: { id: playerId },
        data: { cash: { decrement: supplierQuote.totalCost } },
      });
    } else {
      // No cash moves. A bill is opened instead, due after the goods have had
      // time to be sold — which is the only reason a shop can stock for Eid
      // before it has earned Eid's money.
      await openCredit({
        tx,
        playerId,
        businessId,
        supplier,
        term,
        principal: supplierQuote.goodsValue,
        surcharge: supplierQuote.creditSurcharge,
        issuedOnDay: gameDay,
        dueOnDay: supplierQuote.dueOnDay,
      });
    }

    const order = await tx.preOrder.create({
      data: {
        businessId,
        productName: request.productName,
        category: request.category,
        quantity: quote.quantity,
        unitCost: supplierQuote.unitCost,
        discount: supplierQuote.bulkDiscount,
        totalCost: supplierQuote.totalCost,
        placedOnDay: gameDay,
        deliveryDay: request.deliveryDay,
        supplierId: supplier,
        paymentTerm: term,
      },
      select: { id: true },
    });

    await tx.gameLog.create({
      data: {
        playerId,
        businessId,
        type: 'PRE_ORDER',
        message: `Ordered ${quote.quantity} × ${request.productName} from the ${spec.en.toLowerCase()} for day ${request.deliveryDay} — ৳${supplierQuote.totalCost.toLocaleString()}${
          supplierQuote.bulkDiscount > 0 ? ` (${Math.round(supplierQuote.bulkDiscount * 100)}% bulk)` : ''
        }${term === 'NET_0' ? '' : `, payable day ${supplierQuote.dueOnDay}`}.`,
        amount: term === 'NET_0' ? -supplierQuote.totalCost : null,
      },
    });

    return { ok: true, orderId: order.id, quote: { ...quote, totalCost: supplierQuote.totalCost } };
  });
}

/** Cancel an order that has not arrived, refunding it less the fee. */
export async function cancelPreOrder(params: {
  orderId: string;
  playerId: string;
}): Promise<{ ok: boolean; message?: string; refund?: number; fee?: number }> {
  return db.$transaction(async (tx: Tx) => {
    const order = await tx.preOrder.findUnique({
      where: { id: params.orderId },
      select: {
        id: true, status: true, totalCost: true, quantity: true, productName: true,
        business: { select: { id: true, playerId: true } },
      },
    });

    if (!order || order.business.playerId !== params.playerId) {
      return { ok: false, message: 'Order not found.' };
    }
    if (order.status !== 'PENDING') {
      return { ok: false, message: 'That order has already been settled.' };
    }

    const { fee, refund } = cancellationQuote(order.totalCost);

    await tx.player.update({
      where: { id: params.playerId },
      data: { cash: { increment: refund } },
    });
    await tx.preOrder.update({
      where: { id: order.id },
      data: { status: 'CANCELLED', refunded: refund, note: `Cancelled — ৳${fee.toLocaleString()} fee.` },
    });
    await tx.gameLog.create({
      data: {
        playerId: params.playerId,
        businessId: order.business.id,
        type: 'PRE_ORDER',
        message: `Cancelled ${order.quantity} × ${order.productName}. ৳${refund.toLocaleString()} refunded after a ৳${fee.toLocaleString()} fee.`,
        amount: refund,
      },
    });

    return { ok: true, refund, fee };
  });
}

// ============================================
// Delivery
// ============================================

export interface DeliveryResult {
  delivered: number;
  units: number;
  refunded: number;
}

/**
 * Deliver everything due for one shop.
 *
 * Runs in the tick, **before** the day trades, so stock ordered for the morning
 * of Eid is on the shelves for that day's customers rather than the next one.
 *
 * Never throws: a failed delivery must not take the whole world's tick with it.
 */
export async function deliverDuePreOrders(businessId: string, gameDay: number): Promise<DeliveryResult> {
  const empty: DeliveryResult = { delivered: 0, units: 0, refunded: 0 };

  try {
    const business = await db.business.findUnique({
      where: { id: businessId },
      select: {
        id: true, type: true, playerId: true,
        inventories: { select: { id: true, productName: true, quantity: true, purchasePrice: true, productId: true } },
        godowns: { where: { status: 'ACTIVE' }, select: { id: true, tier: true, capacityBonus: true, expiresOnDay: true } },
        preOrders: {
          where: { status: 'PENDING', deliveryDay: { lte: gameDay } },
          select: { id: true, productName: true, category: true, quantity: true, unitCost: true, totalCost: true, deliveryDay: true },
        },
      },
    });

    if (!business || business.preOrders.length === 0) return empty;

    // Space free before anything arrives. `incoming` is zero here on purpose:
    // the orders being delivered are the incoming, and counting them twice
    // would refund stock there is room for.
    const capacity = capacityReport({
      productDefs: productDefsFor(business.type),
      inventories: business.inventories,
      godowns: business.godowns.map(g => ({
        id: g.id,
        tier: g.tier as GodownTier,
        capacityBonus: g.capacityBonus,
        expiresOnDay: g.expiresOnDay,
      })),
      incoming: 0,
      gameDay,
    });

    const lines = planDelivery({
      due: business.preOrders.map(o => ({
        id: o.id,
        productName: o.productName,
        quantity: o.quantity,
        unitCost: o.unitCost,
        totalCost: o.totalCost,
        deliveryDay: o.deliveryDay,
      })),
      spaceAvailable: capacity.available,
    });

    let units = 0;
    let refunded = 0;
    let delivered = 0;

    for (const line of lines) {
      const order = business.preOrders.find(o => o.id === line.orderId)!;

      await db.$transaction(async (tx: Tx) => {
        if (line.delivered > 0) {
          // Through the shared helper so the cost basis *and* the stock's age
          // are blended the same way here, at the counter, and on an emergency
          // top-up. Fresh goods pull the shelf's average age down, which is
          // what stops a shop that restocks daily ever spoiling.
          await addStockToShelf({
            tx,
            businessId: business.id,
            businessType: business.type,
            productName: line.productName,
            category: order.category,
            quantity: line.delivered,
            unitCost: line.unitCost,
            incomingAgeDays: 0,
            productIdFallback: order.id,
          });
        }

        if (line.refund > 0) {
          await tx.player.update({
            where: { id: business.playerId },
            data: { cash: { increment: line.refund } },
          });
        }

        await tx.preOrder.update({
          where: { id: line.orderId },
          data: {
            status: line.status,
            deliveredQuantity: line.delivered,
            refunded: line.refund,
            note: line.note ?? null,
          },
        });

        await tx.gameLog.create({
          data: {
            playerId: business.playerId,
            businessId: business.id,
            type: 'DELIVERY',
            message: line.delivered > 0
              ? `Delivered ${line.delivered} × ${line.productName}.${line.note ? ` ${line.note}` : ''}`
              : `${line.productName} could not be delivered — no storage space. ৳${line.refund.toLocaleString()} refunded.`,
            amount: line.refund > 0 ? line.refund : null,
          },
        });
      });

      units += line.delivered;
      refunded += line.refund;
      if (line.delivered > 0) delivered++;
    }

    return { delivered, units, refunded };
  } catch (error) {
    console.error(`[storage] Delivery failed for ${businessId}:`, error);
    return empty;
  }
}
