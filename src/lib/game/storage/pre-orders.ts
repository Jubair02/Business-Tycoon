// ============================================
// Bangladesh Business Tycoon - Bulk pre-orders
// ============================================
//
// Buying stock now for delivery on a day you choose.
//
// ---- Why a player would ----
//
//   1. **Capacity.** With a godown you can hold several times your shelf space,
//      which is the only way to be ready for an Eid that multiplies clothing
//      demand by 2.8 for ten days.
//   2. **Price.** The unit cost is locked when the order is placed, and market
//      prices move every third tick. Ordering ahead of a rush is a hedge.
//   3. **Bulk.** Larger orders earn a discount.
//   4. **It arrives without you.** A game day is four real hours; nobody is
//      going to be at the counter on the morning of the rush.
//
// Pure: validation, pricing and the delivery plan. Nothing here touches the
// database or the clock — see `storage-service.ts` for that.

import { STORAGE_CONFIG } from './storage-config';
import { fitsInCapacity, type CapacityReport } from './capacity';
import {
  quoteFromSupplier,
  type PaymentTerm,
  type SupplierId,
} from '../supply/suppliers';

export type PreOrderStatus = 'PENDING' | 'DELIVERED' | 'PARTIAL' | 'CANCELLED';

export interface PreOrderQuote {
  productName: string;
  category: string;
  quantity: number;
  /** Before the discount. */
  listUnitCost: number;
  /** What will actually be charged per unit. */
  unitCost: number;
  discount: number;
  totalCost: number;
  /** What the same stock would cost bought at the counter today. */
  spotCost: number;
  /** Positive when ordering ahead is cheaper. */
  saving: number;
  deliveryDay: number;
  leadDays: number;
}

export type PreOrderRejection =
  | 'UNKNOWN_PRODUCT'
  | 'QUANTITY_TOO_SMALL'
  | 'QUANTITY_NOT_FINITE'
  | 'LEAD_TOO_SHORT'
  | 'LEAD_TOO_LONG'
  | 'NO_CAPACITY'
  | 'INSUFFICIENT_FUNDS'
  | 'TOO_MANY_OPEN_ORDERS';

export interface PreOrderValidation {
  ok: boolean;
  reason?: PreOrderRejection;
  /** Human-readable, for the API to pass through. */
  message?: string;
  quote?: PreOrderQuote;
  /** How much would fit, when capacity is the blocker. */
  acceptable?: number;
}

export interface PreOrderRequest {
  productName: string;
  category: string;
  quantity: number;
  /** Season game day the goods should arrive on. */
  deliveryDay: number;
}

export interface PreOrderContext {
  currentGameDay: number;
  /** `basePrice x marketMultiplier`, already resolved by the caller. */
  spotUnitCost: number;
  availableCash: number;
  capacity: CapacityReport;
  openOrderCount: number;
  /** Who is filling it. Defaults to the local wholesaler. */
  supplier?: SupplierId;
  /** How it is being paid for. Defaults to cash. */
  term?: PaymentTerm;
}

/**
 * Price an order without judging it.
 *
 * Separate from validation so the UI can show a live quote as the player drags
 * the quantity slider, including for a quantity they cannot yet afford.
 */
export function quotePreOrder(
  request: PreOrderRequest,
  context: PreOrderContext,
): PreOrderQuote {
  // Priced by the supplier system, which owns the one bulk-discount table in
  // the game. There were briefly two — a storage one and a supplier one — which
  // is exactly the sort of thing that ships a screen quoting a figure the
  // server does not charge.
  const supplierQuote = quoteFromSupplier({
    supplier: context.supplier ?? 'LOCAL',
    quantity: request.quantity,
    marketUnitCost: context.spotUnitCost,
    term: context.term ?? 'NET_0',
    orderDay: context.currentGameDay,
  });

  const listUnitCost = Math.max(1, Math.round(context.spotUnitCost));
  const spotCost = listUnitCost * supplierQuote.quantity;

  return {
    productName: request.productName,
    category: request.category,
    quantity: supplierQuote.quantity,
    listUnitCost,
    unitCost: supplierQuote.unitCost,
    discount: supplierQuote.bulkDiscount,
    totalCost: supplierQuote.totalCost,
    spotCost,
    saving: spotCost - supplierQuote.totalCost,
    deliveryDay: request.deliveryDay,
    leadDays: request.deliveryDay - context.currentGameDay,
  };
}

/**
 * Whether an order may be placed.
 *
 * Every rejection names itself, because the screen has to tell the player what
 * to change — "not enough room" and "not enough cash" want different buttons.
 */
export function validatePreOrder(
  request: PreOrderRequest,
  context: PreOrderContext,
): PreOrderValidation {
  const quantity = Math.floor(request.quantity);

  if (!Number.isFinite(request.quantity) || !Number.isFinite(request.deliveryDay)) {
    return { ok: false, reason: 'QUANTITY_NOT_FINITE', message: 'That order does not make sense.' };
  }

  if (quantity < STORAGE_CONFIG.minOrderQuantity) {
    return {
      ok: false,
      reason: 'QUANTITY_TOO_SMALL',
      message: `Suppliers take orders of ${STORAGE_CONFIG.minOrderQuantity} units or more.`,
    };
  }

  const leadDays = request.deliveryDay - context.currentGameDay;

  if (leadDays < STORAGE_CONFIG.minLeadDays) {
    return {
      ok: false,
      reason: 'LEAD_TOO_SHORT',
      message: `Deliveries need ${STORAGE_CONFIG.minLeadDays} days' notice. Buy at the counter for stock today.`,
    };
  }

  if (leadDays > STORAGE_CONFIG.maxLeadDays) {
    return {
      ok: false,
      reason: 'LEAD_TOO_LONG',
      message: `Suppliers will not commit more than ${STORAGE_CONFIG.maxLeadDays} days ahead.`,
    };
  }

  if (context.openOrderCount >= STORAGE_CONFIG.maxOpenPreOrders) {
    return {
      ok: false,
      reason: 'TOO_MANY_OPEN_ORDERS',
      message: `You already have ${STORAGE_CONFIG.maxOpenPreOrders} orders on the way.`,
    };
  }

  // Capacity is checked against space already spoken for by other orders, so
  // three orders that each fit cannot be placed if together they do not.
  const fit = fitsInCapacity(context.capacity, quantity);
  if (!fit.fits) {
    return {
      ok: false,
      reason: 'NO_CAPACITY',
      acceptable: fit.acceptable,
      message: fit.acceptable > 0
        ? `Only ${fit.acceptable} units of space left. Rent a godown for more.`
        : 'No storage space left. Rent a godown, or sell some stock first.',
    };
  }

  const quote = quotePreOrder(request, context);

  // Charged in full at placement, so a delivery can never fail for want of
  // cash months later — the money has already left the account.
  if (quote.totalCost > context.availableCash) {
    return {
      ok: false,
      reason: 'INSUFFICIENT_FUNDS',
      quote,
      message: `That order costs ৳${quote.totalCost.toLocaleString()}. Take a loan, or order fewer units.`,
    };
  }

  return { ok: true, quote };
}

/** What cancelling returns, and what it costs. */
export function cancellationQuote(totalCost: number): { fee: number; refund: number } {
  const fee = Math.round(Math.max(0, totalCost) * STORAGE_CONFIG.cancellationFee);
  return { fee, refund: Math.max(0, Math.round(totalCost) - fee) };
}

export interface DeliverablePreOrder {
  id: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  deliveryDay: number;
}

export interface DeliveryLine {
  orderId: string;
  productName: string;
  /** What arrives. Below the ordered quantity when space ran short. */
  delivered: number;
  /** Units that could not be housed. */
  shortfall: number;
  /** Money returned for the units that could not be housed. */
  refund: number;
  unitCost: number;
  status: PreOrderStatus;
  note?: string;
}

/**
 * Work out what arrives, given the room available.
 *
 * Capacity is usually fine — it was checked at placement — but a godown can
 * lapse between ordering and delivery. Rather than destroy goods the player has
 * paid for, or let the shop exceed its ceiling, what fits is delivered and the
 * rest is refunded. Oldest order first, so the player's earliest commitment is
 * honoured first.
 *
 * Pure. The caller writes the result.
 */
export function planDelivery(params: {
  due: DeliverablePreOrder[];
  /** Space free right now, ignoring the orders being delivered. */
  spaceAvailable: number;
}): DeliveryLine[] {
  let remaining = Math.max(0, params.spaceAvailable);

  return [...params.due]
    .sort((a, b) => a.deliveryDay - b.deliveryDay || a.id.localeCompare(b.id))
    .map(order => {
      const delivered = Math.max(0, Math.min(order.quantity, remaining));
      remaining -= delivered;

      const shortfall = order.quantity - delivered;
      const refund = Math.round(shortfall * order.unitCost);

      return {
        orderId: order.id,
        productName: order.productName,
        delivered,
        shortfall,
        refund,
        unitCost: order.unitCost,
        status: shortfall === 0 ? 'DELIVERED' : delivered > 0 ? 'PARTIAL' : 'CANCELLED',
        note: shortfall > 0
          ? `${shortfall} units could not be stored — ৳${refund.toLocaleString()} refunded. Rent a godown to hold more.`
          : undefined,
      };
    });
}
