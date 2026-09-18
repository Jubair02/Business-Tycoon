// ============================================
// Bangladesh Business Tycoon - Guided First Week
// ============================================
//
// Onboarding stopped at the welcome slides. A player was told how to open a
// shop and then left alone with an economy that has pricing, restocking,
// staffing, reputation, marketing and rivals in it — and with a tutorial slide
// that still told them to press a "Next Day" button that no longer exists,
// because the clock moved to the server.
//
// This is the guided first week the game was missing: a short list of things
// worth doing, in the order they start to matter, each one satisfied by the
// player's actual save rather than by clicking through a slide. It is pure so
// the progression can be tested without a browser.

export type FirstWeekStepId =
  | 'open-shop'
  | 'stock-shelves'
  | 'set-prices'
  | 'first-profit'
  | 'hire-staff'
  | 'automate'
  | 'grow'
  | 'week-one';

export interface FirstWeekStep {
  id: FirstWeekStepId;
  title: string;
  /** One line on why this matters, not how to click it. */
  detail: string;
  /** Where the step is done, for the "Take me there" link. */
  href?: string;
  /** Shown when the step is complete. */
  done: string;
}

/**
 * What the guide needs to know about a save. Everything here is already in the
 * client store — the guide adds no fetching of its own.
 */
export interface FirstWeekSnapshot {
  /** Game days since this player first opened the game. */
  daysPlayed: number;
  businessCount: number;
  /** Businesses holding at least one unit of stock. */
  stockedBusinessCount: number;
  /** Businesses where at least one shelf price differs from the default markup. */
  repricedBusinessCount: number;
  /** Total staff across every business. */
  employeeCount: number;
  /** Businesses running a standing restock order. */
  managedBusinessCount: number;
  /** Cumulative profit across every business. */
  totalProfit: number;
  /** Highest business level owned. */
  highestBusinessLevel: number;
}

export const FIRST_WEEK_STEPS: FirstWeekStep[] = [
  {
    id: 'open-shop',
    title: 'Open your first shop',
    detail: 'A tea stall is the cheapest way in and pays for itself in under a month.',
    href: '/businesses/new',
    done: 'You are in business.',
  },
  {
    id: 'stock-shelves',
    title: 'Stock the shelves',
    detail: 'Empty shelves turn customers away, and a shop with nothing to sell still pays rent.',
    href: '/businesses',
    done: 'Your shelves have something on them.',
  },
  {
    id: 'set-prices',
    title: 'Set your own prices',
    detail: 'Price under the going rate and you win custom from rivals; price over it and you keep more per sale. Both are valid.',
    href: '/businesses',
    done: 'You are pricing deliberately, not by default.',
  },
  {
    id: 'first-profit',
    title: 'Turn your first profit',
    detail: 'A day passes every minute. Revenue minus stock, rent, power and wages is what actually reaches you.',
    done: 'You made money.',
  },
  {
    id: 'hire-staff',
    title: 'Hire someone',
    detail: 'Staff bring in more customers and lift your reputation — and the wage comes out of every day, not just the good ones.',
    href: '/businesses',
    done: 'You have your first employee.',
  },
  {
    id: 'automate',
    title: 'Put a shop on auto-restock',
    detail: 'The shop manager refills your shelves before opening, so a shop keeps trading while you are away.',
    href: '/businesses',
    done: 'A shop is running itself.',
  },
  {
    id: 'grow',
    title: 'Grow: a second shop, or upgrade this one',
    detail: 'Upgrading raises capacity; a second shop spreads your risk across trades and cities.',
    href: '/businesses',
    done: 'Your empire has two moving parts.',
  },
  {
    id: 'week-one',
    title: 'Finish week one in profit',
    detail: 'Seven game days with more coming in than going out. That is the whole game, repeated.',
    done: 'Week one, in the black.',
  },
];

/** Days of play the guided week covers. */
export const FIRST_WEEK_DAYS = 7;

/** Whether one step is satisfied by the save. */
export function isStepComplete(id: FirstWeekStepId, snapshot: FirstWeekSnapshot): boolean {
  switch (id) {
    case 'open-shop':
      return snapshot.businessCount > 0;
    case 'stock-shelves':
      return snapshot.stockedBusinessCount > 0;
    case 'set-prices':
      return snapshot.repricedBusinessCount > 0;
    case 'first-profit':
      return snapshot.totalProfit > 0;
    case 'hire-staff':
      return snapshot.employeeCount > 0;
    case 'automate':
      return snapshot.managedBusinessCount > 0;
    case 'grow':
      return snapshot.businessCount > 1 || snapshot.highestBusinessLevel > 1;
    case 'week-one':
      // Both halves matter: surviving the week is not the same as earning
      // through it, and a player who has done neither should not be told they
      // have finished.
      return snapshot.daysPlayed >= FIRST_WEEK_DAYS && snapshot.totalProfit > 0;
    default:
      return false;
  }
}

export interface FirstWeekProgress {
  steps: (FirstWeekStep & { complete: boolean; current: boolean })[];
  completedCount: number;
  totalCount: number;
  /** 0-100. */
  percent: number;
  /** The step to nudge towards, or null once everything is done. */
  currentStep: (FirstWeekStep & { complete: boolean; current: boolean }) | null;
  /** True once every step is done, at which point the guide retires itself. */
  finished: boolean;
}

/**
 * Work out where the player is in the guided week.
 *
 * Steps are listed in the order they start to matter, but they are not gated on
 * each other: a player who hires before they reprice has done both, and the
 * guide simply points at the first thing still outstanding. Gating would mean
 * telling someone they have not done a thing they have plainly done.
 */
export function evaluateFirstWeek(snapshot: FirstWeekSnapshot): FirstWeekProgress {
  const steps = FIRST_WEEK_STEPS.map(step => ({
    ...step,
    complete: isStepComplete(step.id, snapshot),
    current: false,
  }));

  const firstOutstanding = steps.find(step => !step.complete);
  if (firstOutstanding) firstOutstanding.current = true;

  const completedCount = steps.filter(step => step.complete).length;

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    percent: Math.round((completedCount / steps.length) * 100),
    currentStep: firstOutstanding ?? null,
    finished: completedCount === steps.length,
  };
}

/**
 * Summarise the client store for `evaluateFirstWeek`.
 *
 * Kept here rather than in the component so the mapping from a business row to
 * "is this shop stocked" has one definition and can be tested.
 */
export function snapshotFromStore(params: {
  businesses: any[];
  gameDay: number;
  /** Game day this player first opened the game, from local storage. */
  firstSeenGameDay: number | null;
}): FirstWeekSnapshot {
  const { businesses, gameDay, firstSeenGameDay } = params;

  const stockUnits = (biz: any) =>
    (biz.inventories ?? []).reduce((sum: number, inv: any) => sum + (inv.quantity || 0), 0);

  return {
    daysPlayed: firstSeenGameDay === null ? 0 : Math.max(0, gameDay - firstSeenGameDay),
    businessCount: businesses.length,
    stockedBusinessCount: businesses.filter(
      biz => stockUnits(biz) > 0 || (biz._count?.inventories ?? 0) > 0,
    ).length,
    repricedBusinessCount: businesses.filter(biz =>
      (biz.inventories ?? []).some((inv: any) => inv.priceEdited === true),
    ).length,
    employeeCount: businesses.reduce(
      (sum, biz) => sum + (biz.employees?.length ?? biz._count?.employees ?? 0),
      0,
    ),
    managedBusinessCount: businesses.filter(biz => biz.autoRestock === true).length,
    totalProfit: businesses.reduce((sum, biz) => sum + (biz.totalProfit || 0), 0),
    highestBusinessLevel: businesses.reduce((max, biz) => Math.max(max, biz.level || 1), 0),
  };
}
