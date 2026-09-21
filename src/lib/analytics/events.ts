// ============================================
// Bangladesh Business Tycoon - Event Taxonomy
// ============================================
//
// A closed set. Every event the product can record is named here, and `track()`
// only accepts these names — because the failure mode of analytics is not too
// few events, it is a thousand free-text names nobody can group six months
// later.
//
// ---- What is deliberately NOT here ----
//
// Simulation internals. A game day is one real minute; recording anything per
// business per tick would write millions of rows a week to answer questions
// that `BusinessMetric` already answers. This taxonomy is *player actions and
// milestones* only.

/** Every event name the product may record. */
export const EVENTS = {
  // ---- Acquisition and onboarding ----
  /** First page view from a browser we have not seen before. Anonymous. */
  VISITED: 'visited',
  SIGNED_UP: 'signed_up',
  SIGNED_IN: 'signed_in',

  // ---- The onboarding funnel, in order ----
  FIRST_BUSINESS_OPENED: 'first_business_opened',
  FIRST_STOCK_BOUGHT: 'first_stock_bought',
  FIRST_PRICE_SET: 'first_price_set',
  FIRST_PROFIT: 'first_profit',
  FIRST_WEEK_COMPLETED: 'first_week_completed',

  // ---- Engagement ----
  SESSION_STARTED: 'session_started',
  SCREEN_VIEWED: 'screen_viewed',
  BUSINESS_OPENED: 'business_opened',
  STOCK_BOUGHT: 'stock_bought',
  RESTOCK_ORDER_SET: 'restock_order_set',
  EMPLOYEE_HIRED: 'employee_hired',
  BUSINESS_UPGRADED: 'business_upgraded',
  CAMPAIGN_LAUNCHED: 'campaign_launched',
  LOAN_TAKEN: 'loan_taken',
  RETURNED_FROM_AWAY: 'returned_from_away',

  // ---- Monetisation ----
  STORE_VIEWED: 'store_viewed',
  PURCHASE_STARTED: 'purchase_started',
  PURCHASE_COMPLETED: 'purchase_completed',
  PASS_TIER_CLAIMED: 'pass_tier_claimed',
  AD_REWARD_GRANTED: 'ad_reward_granted',

  // ---- Seasons: the core retention hypothesis ----
  SEASON_JOINED: 'season_joined',
  SEASON_COMPLETED: 'season_completed',
  /** The number the whole seasonal design rests on. */
  RETURNED_NEXT_SEASON: 'returned_next_season',

  // ---- Education ----
  COHORT_CREATED: 'cohort_created',
  COHORT_JOINED: 'cohort_joined',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/** Every valid name, for validating an untrusted client payload. */
export const EVENT_NAMES: readonly EventName[] = Object.values(EVENTS);

export function isEventName(value: unknown): value is EventName {
  return typeof value === 'string' && (EVENT_NAMES as readonly string[]).includes(value);
}

/**
 * Events a browser is allowed to report.
 *
 * Everything else must come from the server, because a client claiming
 * "purchase_completed" or "first_profit" is worth exactly nothing. The
 * client-reportable set is limited to things only the browser can observe.
 */
export const CLIENT_REPORTABLE: readonly EventName[] = [
  EVENTS.VISITED,
  EVENTS.SESSION_STARTED,
  EVENTS.SCREEN_VIEWED,
  EVENTS.STORE_VIEWED,
];

export function isClientReportable(name: EventName): boolean {
  return CLIENT_REPORTABLE.includes(name);
}

/**
 * The onboarding funnel, in the order a player passes through it.
 *
 * "Where players stop" is the drop-off between consecutive steps here.
 */
export const ONBOARDING_FUNNEL: readonly EventName[] = [
  EVENTS.VISITED,
  EVENTS.SIGNED_UP,
  EVENTS.FIRST_BUSINESS_OPENED,
  EVENTS.FIRST_STOCK_BOUGHT,
  EVENTS.FIRST_PRICE_SET,
  EVENTS.FIRST_PROFIT,
  EVENTS.FIRST_WEEK_COMPLETED,
];

/** The purchase funnel. */
export const PURCHASE_FUNNEL: readonly EventName[] = [
  EVENTS.STORE_VIEWED,
  EVENTS.PURCHASE_STARTED,
  EVENTS.PURCHASE_COMPLETED,
];

/** Human-readable labels for a report. */
export const EVENT_LABELS: Record<EventName, string> = {
  visited: 'Visited',
  signed_up: 'Signed up',
  signed_in: 'Signed in',
  first_business_opened: 'Opened first shop',
  first_stock_bought: 'Bought first stock',
  first_price_set: 'Set a price',
  first_profit: 'Turned a profit',
  first_week_completed: 'Finished the first week',
  session_started: 'Session started',
  screen_viewed: 'Screen viewed',
  business_opened: 'Opened a shop',
  stock_bought: 'Bought stock',
  restock_order_set: 'Set a standing restock order',
  employee_hired: 'Hired staff',
  business_upgraded: 'Upgraded a shop',
  campaign_launched: 'Launched a campaign',
  loan_taken: 'Took a loan',
  returned_from_away: 'Returned after being away',
  store_viewed: 'Viewed the store',
  purchase_started: 'Started a purchase',
  purchase_completed: 'Completed a purchase',
  pass_tier_claimed: 'Claimed a pass tier',
  ad_reward_granted: 'Watched a rewarded video',
  season_joined: 'Joined a season',
  season_completed: 'Finished a season',
  returned_next_season: 'Came back for the next season',
  cohort_created: 'Created a class',
  cohort_joined: 'Joined a class',
};
