// ============================================
// Bangladesh Business Tycoon - Suppliers
// ============================================
//
// Where stock comes from, and on what terms.
//
// ---- The decision this exists to create ----
//
// Buying used to be one button at one price, and a standing order that pressed
// it for you. There was nothing to decide. A shopkeeper here decides four
// things every week, and now so does the player:
//
//   **who**    — the local wholesaler is dearer but delivers tomorrow; the
//                importer is far cheaper but wants a week and a big order
//   **how much** — bigger orders earn real discounts, and tie up real cash
//   **when**   — market prices move every third tick, so buying into a dip is
//                worth more than any discount on offer
//   **on what terms** — cash today, or goods now and payment in thirty days at
//                a surcharge. Taking stock on credit before Eid and settling
//                after selling it is how the trade actually runs here.
//
// Pure: no Prisma, no clock.

export type SupplierId = 'LOCAL' | 'DISTRIBUTOR' | 'IMPORTER' | 'EMERGENCY';

export type PaymentTerm = 'NET_0' | 'NET_7' | 'NET_15' | 'NET_30';

export interface PaymentTermSpec {
  id: PaymentTerm;
  en: string;
  bn: string;
  /** Game days until the bill falls due. */
  days: number;
  /** Share added to the goods value for waiting. */
  surcharge: number;
}

export const PAYMENT_TERMS: Record<PaymentTerm, PaymentTermSpec> = {
  NET_0: { id: 'NET_0', en: 'Cash on order', bn: 'নগদ', days: 0, surcharge: 0 },
  NET_7: { id: 'NET_7', en: 'Pay in 7 days', bn: '৭ দিনে', days: 7, surcharge: 0.02 },
  NET_15: { id: 'NET_15', en: 'Pay in 15 days', bn: '১৫ দিনে', days: 15, surcharge: 0.04 },
  NET_30: { id: 'NET_30', en: 'Pay in 30 days', bn: '৩০ দিনে', days: 30, surcharge: 0.07 },
};

export const PAYMENT_TERM_IDS: readonly PaymentTerm[] = ['NET_0', 'NET_7', 'NET_15', 'NET_30'];

export interface BulkTier {
  minQuantity: number;
  discount: number;
}

export interface SupplierSpec {
  id: SupplierId;
  en: string;
  bn: string;
  icon: string;
  /** One line on the trade-off, for the screen. */
  note: string;
  noteBn: string;
  /** Multiplier on today's market price. Below 1 is cheaper than the counter. */
  priceFactor: number;
  /** Game days from order to delivery. */
  leadDays: number;
  /** Smallest order this supplier will take, in units. */
  minQuantity: number;
  /** Longest credit this supplier will extend. */
  maxTerm: PaymentTerm;
  bulkTiers: readonly BulkTier[];
  /**
   * Hidden from the order screen. Used only by the emergency top-up that keeps
   * a shop trading when nobody is minding it.
   */
  selectable: boolean;
}

export const SUPPLIERS: Record<SupplierId, SupplierSpec> = {
  LOCAL: {
    id: 'LOCAL',
    en: 'Local wholesaler',
    bn: 'স্থানীয় পাইকার',
    icon: '🛒',
    note: 'Market price, here tomorrow. Small orders welcome, cash only.',
    noteBn: 'বাজারদর, কালই পৌঁছে যাবে। অল্প পরিমাণেও চলবে, তবে নগদে।',
    priceFactor: 1.0,
    leadDays: 1,
    minQuantity: 5,
    maxTerm: 'NET_0',
    bulkTiers: [
      { minQuantity: 100, discount: 0.02 },
      { minQuantity: 300, discount: 0.04 },
    ],
    selectable: true,
  },
  DISTRIBUTOR: {
    id: 'DISTRIBUTOR',
    en: 'City distributor',
    bn: 'শহরের ডিস্ট্রিবিউটর',
    icon: '🚚',
    note: 'Six percent under the market, three days out, and will wait a fortnight for payment.',
    noteBn: 'বাজারদরের ছয় শতাংশ কমে, তিন দিনে, আর পনেরো দিন পর্যন্ত বাকিতে।',
    priceFactor: 0.94,
    leadDays: 3,
    minQuantity: 40,
    maxTerm: 'NET_15',
    bulkTiers: [
      { minQuantity: 100, discount: 0.03 },
      { minQuantity: 300, discount: 0.06 },
      { minQuantity: 800, discount: 0.09 },
    ],
    selectable: true,
  },
  IMPORTER: {
    id: 'IMPORTER',
    en: 'Importer',
    bn: 'আমদানিকারক',
    icon: '🚢',
    note: 'The cheapest goods in the country, if you can wait a week and order properly.',
    noteBn: 'দেশের সবচেয়ে সস্তা মাল, যদি এক সপ্তাহ অপেক্ষা করতে পারেন আর বড় অর্ডার দেন।',
    priceFactor: 0.86,
    leadDays: 7,
    minQuantity: 150,
    maxTerm: 'NET_30',
    bulkTiers: [
      { minQuantity: 300, discount: 0.04 },
      { minQuantity: 800, discount: 0.08 },
      { minQuantity: 2000, discount: 0.12 },
    ],
    selectable: true,
  },
  EMERGENCY: {
    id: 'EMERGENCY',
    en: 'Counter purchase',
    bn: 'জরুরি কেনাকাটা',
    icon: '⚡',
    // Deliberately a bad deal. This is what the emergency top-up pays when
    // nobody is minding the shop — enough to keep the doors open, never the
    // sensible way to buy.
    note: 'Whatever the corner shop has, at a quarter over the odds. Instant.',
    noteBn: 'পাশের দোকানে যা আছে, পঁচিশ শতাংশ বেশি দামে। সঙ্গে সঙ্গে।',
    priceFactor: 1.25,
    leadDays: 0,
    minQuantity: 1,
    maxTerm: 'NET_0',
    bulkTiers: [],
    selectable: false,
  },
};

export const SUPPLIER_IDS: readonly SupplierId[] = ['LOCAL', 'DISTRIBUTOR', 'IMPORTER', 'EMERGENCY'];

/** The ones a player may order from. */
export const SELECTABLE_SUPPLIERS: readonly SupplierSpec[] =
  SUPPLIER_IDS.map(id => SUPPLIERS[id]).filter(s => s.selectable);

export function isSupplierId(value: unknown): value is SupplierId {
  return typeof value === 'string' && (SUPPLIER_IDS as readonly string[]).includes(value);
}

export function isPaymentTerm(value: unknown): value is PaymentTerm {
  return typeof value === 'string' && (PAYMENT_TERM_IDS as readonly string[]).includes(value);
}

/** The bulk discount a quantity earns from this supplier. Largest tier wins. */
export function bulkDiscountFrom(supplier: SupplierId, quantity: number): number {
  let discount = 0;
  for (const tier of SUPPLIERS[supplier].bulkTiers) {
    if (quantity >= tier.minQuantity) discount = tier.discount;
  }
  return discount;
}

/** Whether a supplier will extend this term. */
export function offersTerm(supplier: SupplierId, term: PaymentTerm): boolean {
  return PAYMENT_TERMS[term].days <= PAYMENT_TERMS[SUPPLIERS[supplier].maxTerm].days;
}

/** The terms a supplier will extend, shortest first. */
export function termsFor(supplier: SupplierId): PaymentTermSpec[] {
  return PAYMENT_TERM_IDS.filter(term => offersTerm(supplier, term)).map(term => PAYMENT_TERMS[term]);
}

export interface SupplierQuote {
  supplier: SupplierId;
  quantity: number;
  /** Today's market price for one unit, before anything is applied. */
  marketUnitCost: number;
  /** After the supplier's own price factor. */
  supplierUnitCost: number;
  bulkDiscount: number;
  /** After bulk. This is the goods value per unit. */
  unitCost: number;
  goodsValue: number;
  term: PaymentTerm;
  creditSurcharge: number;
  /** Goods plus the cost of credit. */
  totalCost: number;
  /** Positive when this beats buying the same units at the counter today. */
  savingVsCounter: number;
  leadDays: number;
  /** Game day the bill falls due. Equal to the order day for cash. */
  dueOnDay: number;
}

/**
 * Price an order.
 *
 * Order of operations matters and is deliberate: the supplier's own price
 * factor, then bulk on top of that, then credit on the discounted goods value.
 * Charging credit on the list price would quietly undo the bulk discount for
 * anyone buying on terms — which is most people buying at scale.
 */
export function quoteFromSupplier(params: {
  supplier: SupplierId;
  quantity: number;
  /** `basePrice x marketMultiplier`, resolved by the caller. */
  marketUnitCost: number;
  term: PaymentTerm;
  orderDay: number;
}): SupplierQuote {
  const spec = SUPPLIERS[params.supplier];
  const quantity = Math.max(0, Math.floor(params.quantity));
  const marketUnitCost = Math.max(0.01, params.marketUnitCost);

  const supplierUnitCost = marketUnitCost * spec.priceFactor;
  const bulkDiscount = bulkDiscountFrom(params.supplier, quantity);

  // Kept as a float and rounded once at the total. Rounding into each unit
  // deletes the discount on cheap goods — tea is ৳8, and `round(8 x 0.97)` is 8.
  const unitCost = supplierUnitCost * (1 - bulkDiscount);
  const goodsValue = Math.round(unitCost * quantity);

  const term = offersTerm(params.supplier, params.term) ? params.term : 'NET_0';
  const termSpec = PAYMENT_TERMS[term];
  const creditSurcharge = Math.round(goodsValue * termSpec.surcharge);

  // The counter is what an unplanned purchase costs today, which is the honest
  // thing to measure a planned one against.
  const counterCost = Math.round(marketUnitCost * SUPPLIERS.EMERGENCY.priceFactor) * quantity;

  return {
    supplier: params.supplier,
    quantity,
    marketUnitCost,
    supplierUnitCost,
    bulkDiscount,
    unitCost,
    goodsValue,
    term,
    creditSurcharge,
    totalCost: goodsValue + creditSurcharge,
    savingVsCounter: counterCost - (goodsValue + creditSurcharge),
    leadDays: spec.leadDays,
    dueOnDay: params.orderDay + spec.leadDays + termSpec.days,
  };
}

export type SupplierRejection =
  | 'BELOW_MINIMUM'
  | 'TERM_NOT_OFFERED'
  | 'CREDIT_BLOCKED'
  | 'NOT_SELECTABLE';

export interface SupplierValidation {
  ok: boolean;
  reason?: SupplierRejection;
  message?: string;
}

/** Whether this supplier will take this order. */
export function validateSupplierOrder(params: {
  supplier: SupplierId;
  quantity: number;
  term: PaymentTerm;
  /** True when an account is overdue and no supplier will extend more credit. */
  creditBlocked: boolean;
}): SupplierValidation {
  const spec = SUPPLIERS[params.supplier];

  if (!spec.selectable) {
    return { ok: false, reason: 'NOT_SELECTABLE', message: 'That is not a supplier you can order from.' };
  }

  if (params.quantity < spec.minQuantity) {
    return {
      ok: false,
      reason: 'BELOW_MINIMUM',
      message: `${spec.en} will not take an order under ${spec.minQuantity} units.`,
    };
  }

  if (!offersTerm(params.supplier, params.term)) {
    return {
      ok: false,
      reason: 'TERM_NOT_OFFERED',
      message: `${spec.en} will wait ${PAYMENT_TERMS[spec.maxTerm].days} days at most.`,
    };
  }

  // One overdue bill and the trade stops lending to you. That is the point of
  // credit having teeth.
  if (params.creditBlocked && PAYMENT_TERMS[params.term].days > 0) {
    return {
      ok: false,
      reason: 'CREDIT_BLOCKED',
      message: 'You have an overdue supplier bill. Settle it before buying on terms again.',
    };
  }

  return { ok: true };
}

/** Late fee charged per game day on an overdue bill. */
export const OVERDUE_PENALTY_PER_DAY = 0.01;

/** What an overdue bill has grown to. */
export function overdueTotal(totalDue: number, daysLate: number): number {
  const late = Math.max(0, daysLate);
  return Math.round(totalDue * (1 + OVERDUE_PENALTY_PER_DAY * late));
}
