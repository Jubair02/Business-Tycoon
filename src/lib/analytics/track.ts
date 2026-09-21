// ============================================
// Bangladesh Business Tycoon - Recording Events
// ============================================
//
// One function, `track()`, used from route handlers. It is deliberately
// impossible to make it fail a request: analytics is never worth losing a
// player's purchase over, so every error is swallowed and logged.
//
// ---- The PII rule ----
//
// No email address, no name, no password, no token, no IP, ever. `userId` is an
// internal identifier that means nothing outside this database. The prop bag is
// filtered against a deny-list below, so a careless call site cannot leak a
// field by accident — this is a game played largely by students in one country,
// and the cost of getting that wrong is not recoverable.

import { db } from '@/lib/db';
import { isEventName, type EventName } from './events';
import { ANALYTICS_CONFIG } from './config';

export interface TrackContext {
  userId?: string | null;
  anonymousId?: string | null;
  seasonId?: string | null;
}

export type EventProps = Record<string, string | number | boolean | null | undefined>;

/**
 * Prop keys that must never be stored, matched case-insensitively as
 * substrings so `userEmail` and `email_address` are both caught.
 */
const FORBIDDEN_PROP_KEYS = [
  'email', 'password', 'passwd', 'token', 'secret', 'cookie', 'session',
  'ip', 'address', 'phone', 'name', 'hash', 'authorization', 'card', 'cvv',
];

/** Strip anything that could carry PII, and bound what is left. */
export function sanitiseProps(props: EventProps | undefined): Record<string, unknown> {
  if (!props) return {};

  const clean: Record<string, unknown> = {};
  let kept = 0;

  for (const [key, value] of Object.entries(props)) {
    if (kept >= ANALYTICS_CONFIG.maxPropsPerEvent) break;
    if (value === undefined || value === null) continue;

    const lower = key.toLowerCase();
    if (FORBIDDEN_PROP_KEYS.some(forbidden => lower.includes(forbidden))) continue;

    if (typeof value === 'string') {
      // Bounded: a prop is a label, not a payload.
      clean[key] = value.slice(0, ANALYTICS_CONFIG.maxPropLength);
    } else if (typeof value === 'number') {
      clean[key] = Number.isFinite(value) ? value : 0;
    } else if (typeof value === 'boolean') {
      clean[key] = value;
    } else {
      continue;
    }
    kept++;
  }

  return clean;
}

/**
 * Record an event.
 *
 * Never throws and never blocks a response on the write failing. Call sites are
 * expected to `void track(...)` — awaiting it would put an analytics insert on
 * the critical path of a player's action for no benefit.
 */
export async function track(
  name: EventName,
  context: TrackContext = {},
  props?: EventProps,
): Promise<void> {
  if (!ANALYTICS_CONFIG.enabled) return;
  if (!isEventName(name)) return;

  // An event belonging to nobody cannot be counted in a funnel or a cohort, so
  // it is dropped rather than stored as noise.
  if (!context.userId && !context.anonymousId) return;

  try {
    await db.analyticsEvent.create({
      data: {
        name,
        userId: context.userId ?? null,
        anonymousId: context.anonymousId ?? null,
        seasonId: context.seasonId ?? null,
        props: JSON.stringify(sanitiseProps(props)),
      },
    });
  } catch (error) {
    console.error(`[analytics] Failed to record ${name}:`, error);
  }
}

/**
 * Record an event only the first time it happens for an account.
 *
 * The onboarding funnel is built from "first" milestones, and a player who
 * opens five shops must count once at `first_business_opened` or the funnel
 * reports more people finishing a step than started it.
 *
 * The existence check makes this more expensive than `track()`, which is why it
 * is a separate function rather than the default.
 */
export async function trackOnce(
  name: EventName,
  context: TrackContext,
  props?: EventProps,
): Promise<void> {
  if (!ANALYTICS_CONFIG.enabled) return;
  if (!context.userId) return;

  try {
    const existing = await db.analyticsEvent.findFirst({
      where: { name, userId: context.userId },
      select: { id: true },
    });
    if (existing) return;

    await track(name, context, props);
  } catch (error) {
    console.error(`[analytics] Failed to record first ${name}:`, error);
  }
}

/**
 * Delete events past the retention window.
 *
 * A game day is a real minute, so even a player-actions-only table grows
 * steadily. Called from the tick on a long interval; safe to call at any time.
 */
export async function pruneOldEvents(now: Date = new Date()): Promise<number> {
  if (!ANALYTICS_CONFIG.enabled) return 0;

  const cutoff = new Date(now.getTime() - ANALYTICS_CONFIG.retainDays * 86_400_000);

  try {
    const { count } = await db.analyticsEvent.deleteMany({
      where: { occurredAt: { lt: cutoff } },
    });
    if (count > 0) console.info(`[analytics] Pruned ${count} events older than ${ANALYTICS_CONFIG.retainDays} days.`);
    return count;
  } catch (error) {
    console.error('[analytics] Prune failed:', error);
    return 0;
  }
}
