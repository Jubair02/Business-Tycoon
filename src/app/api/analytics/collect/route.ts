// ============================================
// Client event collection
// POST /api/analytics/collect
// ============================================
//
// The only place browser-supplied analytics enters the system, and therefore
// the only place that has to be paranoid:
//
//   - The event name must be in `CLIENT_REPORTABLE`. A client claiming
//     `purchase_completed` or `first_profit` is worth nothing, so those names
//     are rejected outright rather than stored and quietly distrusted later.
//   - `userId` is taken from the session cookie. The body cannot set it.
//   - Props go through the same PII deny-list as every server-side call.
//   - Rate limited, because this endpoint is unauthenticated by design — the
//     first funnel step happens before sign-up.
//
// It answers 204 whatever happens. A browser has nothing useful to do with an
// analytics failure, and a body would only invite someone to probe it.

import { NextResponse, type NextRequest } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { track } from '@/lib/analytics/track';
import { isEventName, isClientReportable, type EventName } from '@/lib/analytics/events';
import { ANALYTICS_CONFIG, ANONYMOUS_ID_COOKIE } from '@/lib/analytics/config';
import {
  resolveAnalyticsContext,
  ANONYMOUS_ID_COOKIE_OPTIONS,
} from '@/lib/analytics/identity';

/** Batched, because a client sends several screen views a minute. */
const MAX_EVENTS_PER_REQUEST = 20;

interface IncomingEvent {
  name?: unknown;
  props?: unknown;
}

function readProps(value: unknown): Record<string, string | number | boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const out: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      out[key] = raw;
    }
    // Anything else — objects, arrays, functions — is dropped here rather than
    // being stringified. `sanitiseProps` bounds what survives.
  }
  return out;
}

export async function POST(request: NextRequest) {
  const noContent = new NextResponse(null, { status: 204 });

  if (!ANALYTICS_CONFIG.enabled) return noContent;

  try {
    // Generous: a normal session sends a handful of events a minute, and
    // rejecting a real player's events is worse than accepting a few junk ones.
    enforceRateLimit(request, 'analytics-collect', { limit: 120, windowMs: 60_000 });
  } catch {
    return noContent;
  }

  try {
    const body = await request.json();
    const incoming: IncomingEvent[] = Array.isArray(body?.events)
      ? body.events.slice(0, MAX_EVENTS_PER_REQUEST)
      : [];

    if (incoming.length === 0) return noContent;

    const context = await resolveAnalyticsContext();

    for (const item of incoming) {
      if (!isEventName(item?.name)) continue;
      if (!isClientReportable(item.name as EventName)) continue;

      await track(
        item.name as EventName,
        { userId: context.userId, anonymousId: context.anonymousId, seasonId: context.seasonId },
        readProps(item.props),
      );
    }

    if (context.isNewAnonymous && context.anonymousId) {
      noContent.cookies.set(ANONYMOUS_ID_COOKIE, context.anonymousId, ANONYMOUS_ID_COOKIE_OPTIONS);
    }
  } catch (error) {
    // Swallowed on purpose. Analytics is never worth a visible error.
    console.error('[analytics] collect failed:', error);
  }

  return noContent;
}
