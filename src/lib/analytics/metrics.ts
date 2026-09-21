// ============================================
// Bangladesh Business Tycoon - Analytics Metrics
// ============================================
//
// Funnels, retention, sessions and drop-off — computed here, purely, so the
// definitions are reviewable in a pull request rather than being whatever a
// vendor's dashboard decided.
//
// Three things in here are the ones analytics implementations usually get
// wrong, and each is tested:
//
//   1. **Immature cohorts.** A cohort that signed up yesterday has not had the
//      chance to come back on day 7. Counting it as 0% drags every D7 figure
//      towards zero and makes retention look like it is collapsing whenever
//      sign-ups grow. Cohorts are only measured once the day has fully elapsed.
//
//   2. **Day boundaries.** "Daily active" in UTC is wrong by six hours for an
//      audience that is entirely in Bangladesh — an evening session lands on
//      the previous day. Days are bucketed in Asia/Dhaka.
//
//   3. **Identity stitching.** A funnel that starts before sign-up has to
//      connect the anonymous browser to the account it became, or every
//      pre-signup step reads as a dead end.

import type { EventName } from './events';
import { EVENT_LABELS } from './events';

/**
 * Bangladesh Standard Time, UTC+6, with no daylight saving.
 *
 * A fixed offset is correct rather than lazy: BST has had no DST since a brief
 * experiment in 2009. If that ever changes this becomes a real timezone lookup.
 */
export const DHAKA_OFFSET_MINUTES = 6 * 60;

export interface AnalyticsEventRow {
  name: string;
  userId: string | null;
  anonymousId: string | null;
  occurredAt: Date;
  props?: Record<string, unknown>;
}

/** The calendar day an instant falls on, in Dhaka. `YYYY-MM-DD`. */
export function dayKey(at: Date, offsetMinutes: number = DHAKA_OFFSET_MINUTES): string {
  const shifted = new Date(at.getTime() + offsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/** Whole days from one day key to another. Negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

// ============================================
// Identity
// ============================================

/**
 * Collapse anonymous browsers into the accounts they became.
 *
 * An event carrying both ids — sign-up does — is the link. Without this the
 * onboarding funnel reports that nobody who visited ever signed up, because
 * the two halves are keyed differently.
 */
export function stitchIdentities(events: AnalyticsEventRow[]): Map<string, string> {
  const anonToUser = new Map<string, string>();

  for (const event of events) {
    if (event.userId && event.anonymousId && !anonToUser.has(event.anonymousId)) {
      anonToUser.set(event.anonymousId, event.userId);
    }
  }

  return anonToUser;
}

/** The canonical actor for an event, after stitching. */
export function identityOf(
  event: AnalyticsEventRow,
  anonToUser: Map<string, string>,
): string | null {
  if (event.userId) return event.userId;
  if (event.anonymousId) return anonToUser.get(event.anonymousId) ?? `anon:${event.anonymousId}`;
  return null;
}

// ============================================
// Funnel
// ============================================

export interface FunnelStep {
  name: string;
  label: string;
  /** Distinct actors who reached this step. */
  users: number;
  /** Share of step 1 that reached here, 0-1. */
  conversionFromStart: number;
  /** Share of the previous step that reached here, 0-1. */
  conversionFromPrevious: number;
  /** Actors who reached the previous step and never reached this one. */
  droppedHere: number;
}

/**
 * Where players stop.
 *
 * An actor counts at a step if they ever fired it — not only if they fired the
 * steps in order. Ordering is a property of the product, not of the data, and
 * requiring it would silently drop anyone who did two things in one minute and
 * had them recorded out of order.
 */
export function computeFunnel(
  events: AnalyticsEventRow[],
  steps: readonly string[],
): FunnelStep[] {
  const anonToUser = stitchIdentities(events);

  const actorsByStep = new Map<string, Set<string>>();
  for (const step of steps) actorsByStep.set(step, new Set());

  for (const event of events) {
    const bucket = actorsByStep.get(event.name);
    if (!bucket) continue;
    const identity = identityOf(event, anonToUser);
    if (identity) bucket.add(identity);
  }

  const counts = steps.map(step => actorsByStep.get(step)!.size);
  // A later step can only be reached through the earlier ones, so the series is
  // clamped to be non-increasing. Without this, an event recorded for someone
  // who skipped a step reads as negative drop-off.
  for (let i = 1; i < counts.length; i++) {
    counts[i] = Math.min(counts[i], counts[i - 1]);
  }

  const start = counts[0] ?? 0;

  return steps.map((step, index) => {
    const users = counts[index];
    const previous = index === 0 ? users : counts[index - 1];
    return {
      name: step,
      label: EVENT_LABELS[step as EventName] ?? step,
      users,
      conversionFromStart: start > 0 ? users / start : 0,
      conversionFromPrevious: previous > 0 ? users / previous : 0,
      droppedHere: Math.max(0, previous - users),
    };
  });
}

// ============================================
// Retention
// ============================================

export interface RetentionPoint {
  /** 1, 7 or 30. */
  day: number;
  /** Cohort members who came back on that day. Null when not yet measurable. */
  retained: number | null;
  /** 0-1, or null when not yet measurable. */
  rate: number | null;
  /** False when the day has not fully elapsed for this cohort yet. */
  measurable: boolean;
}

export interface RetentionCohort {
  /** The Dhaka day these actors were first seen. */
  cohortDay: string;
  size: number;
  points: RetentionPoint[];
}

export interface RetentionReport {
  cohorts: RetentionCohort[];
  /** Weighted across mature cohorts only, so recent sign-ups cannot drag it. */
  overall: { day: number; rate: number | null; cohortsCounted: number; usersCounted: number }[];
}

export const DEFAULT_RETENTION_DAYS = [1, 7, 30];

/**
 * Cohort retention.
 *
 * An actor is "retained on day N" if they did anything at all on the Nth day
 * after the day they were first seen. Any event counts — a player who opened
 * the game and looked at their shops came back, whether or not they bought
 * anything.
 */
export function computeRetention(
  events: AnalyticsEventRow[],
  now: Date = new Date(),
  days: number[] = DEFAULT_RETENTION_DAYS,
): RetentionReport {
  const anonToUser = stitchIdentities(events);

  /** identity -> set of active Dhaka days */
  const activeDays = new Map<string, Set<string>>();

  for (const event of events) {
    const identity = identityOf(event, anonToUser);
    if (!identity) continue;
    const day = dayKey(event.occurredAt);
    const set = activeDays.get(identity) ?? new Set<string>();
    set.add(day);
    activeDays.set(identity, set);
  }

  /** cohortDay -> identities first seen that day */
  const cohorts = new Map<string, string[]>();
  for (const [identity, dayset] of activeDays) {
    const first = [...dayset].sort()[0];
    const members = cohorts.get(first) ?? [];
    members.push(identity);
    cohorts.set(first, members);
  }

  const today = dayKey(now);

  const cohortReports: RetentionCohort[] = [...cohorts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohortDay, members]) => {
      const elapsed = daysBetween(cohortDay, today);

      const points: RetentionPoint[] = days.map(day => {
        // The day must have fully elapsed. At exactly `elapsed === day` the
        // day is still in progress, and reporting it would understate.
        const measurable = elapsed > day;
        if (!measurable) return { day, retained: null, rate: null, measurable: false };

        const targetDay = addDays(cohortDay, day);
        const retained = members.filter(id => activeDays.get(id)?.has(targetDay)).length;

        return { day, retained, rate: members.length > 0 ? retained / members.length : 0, measurable: true };
      });

      return { cohortDay, size: members.length, points };
    });

  const overall = days.map(day => {
    const mature = cohortReports.filter(c => c.points.find(p => p.day === day)?.measurable);
    const usersCounted = mature.reduce((sum, c) => sum + c.size, 0);
    const retainedTotal = mature.reduce(
      (sum, c) => sum + (c.points.find(p => p.day === day)?.retained ?? 0),
      0,
    );

    return {
      day,
      rate: usersCounted > 0 ? retainedTotal / usersCounted : null,
      cohortsCounted: mature.length,
      usersCounted,
    };
  });

  return { cohorts: cohortReports, overall };
}

/** `YYYY-MM-DD` plus N days. */
export function addDays(day: string, count: number): string {
  const base = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(base)) return day;
  return new Date(base + count * 86_400_000).toISOString().slice(0, 10);
}

// ============================================
// Sessions
// ============================================

export const SESSION_GAP_MINUTES = 30;

export interface SessionStats {
  sessions: number;
  actors: number;
  /** Minutes. */
  medianMinutes: number;
  meanMinutes: number;
  p90Minutes: number;
  /** Sessions with a single event, which have no measurable length. */
  singleEventSessions: number;
}

/**
 * Group an event stream into sessions.
 *
 * A session ends after `gapMinutes` of silence. A session with one event has a
 * length of zero, which is true but not interesting — it is reported separately
 * so it cannot quietly drag the median down.
 */
export function computeSessions(
  events: AnalyticsEventRow[],
  gapMinutes: number = SESSION_GAP_MINUTES,
): SessionStats {
  const anonToUser = stitchIdentities(events);

  const byActor = new Map<string, Date[]>();
  for (const event of events) {
    const identity = identityOf(event, anonToUser);
    if (!identity) continue;
    const list = byActor.get(identity) ?? [];
    list.push(event.occurredAt);
    byActor.set(identity, list);
  }

  const lengths: number[] = [];
  let sessions = 0;
  let singleEventSessions = 0;
  const gapMs = gapMinutes * 60_000;

  for (const times of byActor.values()) {
    const sorted = [...times].sort((a, b) => a.getTime() - b.getTime());

    let start = sorted[0];
    let previous = sorted[0];
    let eventsInSession = 1;

    const close = () => {
      sessions++;
      if (eventsInSession === 1) singleEventSessions++;
      else lengths.push((previous.getTime() - start.getTime()) / 60_000);
    };

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].getTime() - previous.getTime() > gapMs) {
        close();
        start = sorted[i];
        eventsInSession = 1;
      } else {
        eventsInSession++;
      }
      previous = sorted[i];
    }
    close();
  }

  return {
    sessions,
    actors: byActor.size,
    medianMinutes: percentile(lengths, 0.5),
    meanMinutes: lengths.length > 0 ? lengths.reduce((s, v) => s + v, 0) / lengths.length : 0,
    p90Minutes: percentile(lengths, 0.9),
    singleEventSessions,
  };
}

/** Linear-interpolation percentile. Returns 0 for an empty series. */
export function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];

  const position = (sorted.length - 1) * Math.max(0, Math.min(1, fraction));
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

// ============================================
// Where players stop
// ============================================

export interface DropOffPoint {
  screen: string;
  /** Actors whose last recorded screen was this one before going quiet. */
  actors: number;
  share: number;
}

/**
 * The last screen an actor saw before going quiet.
 *
 * Not proof of causation — a player may have simply finished — but it is the
 * cheapest available answer to "where do people stop", and it is the question
 * the roadmap actually needs answered.
 */
export function computeDropOff(
  events: AnalyticsEventRow[],
  now: Date = new Date(),
  quietAfterDays = 3,
): DropOffPoint[] {
  const anonToUser = stitchIdentities(events);

  /** identity -> most recent event */
  const last = new Map<string, AnalyticsEventRow>();
  /** identity -> most recent screen view */
  const lastScreen = new Map<string, string>();

  for (const event of events) {
    const identity = identityOf(event, anonToUser);
    if (!identity) continue;

    const previous = last.get(identity);
    if (!previous || event.occurredAt > previous.occurredAt) last.set(identity, event);

    if (event.name === 'screen_viewed') {
      const screen = typeof event.props?.screen === 'string' ? event.props.screen : null;
      if (screen) {
        const previousScreen = lastScreen.get(identity);
        if (!previousScreen || !previous || event.occurredAt >= previous.occurredAt) {
          lastScreen.set(identity, screen);
        }
      }
    }
  }

  const cutoff = now.getTime() - quietAfterDays * 86_400_000;
  const counts = new Map<string, number>();
  let quiet = 0;

  for (const [identity, event] of last) {
    if (event.occurredAt.getTime() > cutoff) continue; // still around
    const screen = lastScreen.get(identity);
    if (!screen) continue;
    quiet++;
    counts.set(screen, (counts.get(screen) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([screen, actors]) => ({ screen, actors, share: quiet > 0 ? actors / quiet : 0 }))
    .sort((a, b) => b.actors - a.actors);
}
