// ============================================
// Bangladesh Business Tycoon - Analytics Config
// ============================================
//
// Pure configuration, free of Prisma and Node, so the client bundle and the
// tests can read the same numbers.

export const ANALYTICS_CONFIG = {
  /**
   * Off by a single switch.
   *
   * `ANALYTICS_DISABLED=1` stops every write without touching a call site —
   * useful for a load test, or for anyone who would rather not collect this at
   * all while they decide.
   */
  get enabled(): boolean {
    return process.env.ANALYTICS_DISABLED !== '1';
  },

  /** How long raw events are kept before pruning. */
  retainDays: 180,

  /** A prop is a label, not a payload. */
  maxPropsPerEvent: 12,
  maxPropLength: 120,

  /** How long a browser's anonymous id survives. */
  anonymousIdDays: 365,

  /** Silence after which a new session is counted. */
  sessionGapMinutes: 30,

  /** Days of silence after which an actor counts as gone, for drop-off. */
  quietAfterDays: 3,
} as const;

/** Cookie holding the per-browser anonymous id. */
export const ANONYMOUS_ID_COOKIE = 'bd-tycoon-aid';
