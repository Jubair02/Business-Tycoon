// ============================================
// Analytics report
// GET /api/analytics/report
// ============================================
//
// The answer to the four questions worth asking before anything else gets
// built: how many people finish onboarding, do they come back on D1/D7/D30,
// how long is a session, and where do they stop.
//
// ---- Access ----
//
// Gated on `ANALYTICS_REPORT_TOKEN`, compared in constant time. This is not a
// player-facing endpoint and there is no admin role in the schema yet; a shared
// secret in the environment is the honest version of what this is. If an admin
// role arrives, this should move behind it.
//
// With no token configured the route refuses rather than opening — a missing
// environment variable must never be the thing that publishes the numbers.

import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import {
  computeFunnel,
  computeRetention,
  computeSessions,
  computeDropOff,
  DEFAULT_RETENTION_DAYS,
  type AnalyticsEventRow,
} from '@/lib/analytics/metrics';
import { ONBOARDING_FUNNEL, PURCHASE_FUNNEL } from '@/lib/analytics/events';
import { ANALYTICS_CONFIG } from '@/lib/analytics/config';

/** How far back a report may reach, so one request cannot pull the whole table. */
const MAX_WINDOW_DAYS = 120;
const DEFAULT_WINDOW_DAYS = 30;
/** A hard ceiling on rows loaded into memory for the pure functions. */
const MAX_ROWS = 200_000;

function tokenMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function parseProps(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  const expected = process.env.ANALYTICS_REPORT_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: 'Reporting is not configured. Set ANALYTICS_REPORT_TOKEN.' },
      { status: 503 },
    );
  }

  const header = request.headers.get('authorization');
  const provided = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!tokenMatches(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedDays = Number(url.searchParams.get('days') ?? DEFAULT_WINDOW_DAYS);
  const windowDays = Number.isFinite(requestedDays)
    ? Math.min(MAX_WINDOW_DAYS, Math.max(1, Math.floor(requestedDays)))
    : DEFAULT_WINDOW_DAYS;

  const now = new Date();
  const since = new Date(now.getTime() - windowDays * 86_400_000);

  const rows = await db.analyticsEvent.findMany({
    where: { occurredAt: { gte: since } },
    select: { name: true, userId: true, anonymousId: true, occurredAt: true, props: true },
    orderBy: { occurredAt: 'asc' },
    take: MAX_ROWS,
  });

  const events: AnalyticsEventRow[] = rows.map(row => ({
    name: row.name,
    userId: row.userId,
    anonymousId: row.anonymousId,
    occurredAt: row.occurredAt,
    props: parseProps(row.props),
  }));

  // Retention over a 30-day window cannot see a 30-day cohort. The report says
  // so explicitly rather than showing a confident-looking blank.
  const retention = computeRetention(events, now, DEFAULT_RETENTION_DAYS);

  return NextResponse.json({
    window: { days: windowDays, since: since.toISOString(), until: now.toISOString() },
    truncated: rows.length >= MAX_ROWS,
    totalEvents: rows.length,
    onboarding: computeFunnel(events, ONBOARDING_FUNNEL),
    purchase: computeFunnel(events, PURCHASE_FUNNEL),
    retention,
    sessions: computeSessions(events, ANALYTICS_CONFIG.sessionGapMinutes),
    dropOff: computeDropOff(events, now, ANALYTICS_CONFIG.quietAfterDays),
    notes: [
      `Days are bucketed in Asia/Dhaka (UTC+6).`,
      `Retention counts only cohorts whose Nth day has fully elapsed; a ${windowDays}-day window cannot measure a longer horizon.`,
      `Drop-off is the last screen seen before ${ANALYTICS_CONFIG.quietAfterDays} days of silence — correlation, not cause.`,
    ],
  });
}
