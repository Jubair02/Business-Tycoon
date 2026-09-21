// ============================================
// Bangladesh Business Tycoon - Analytics Tests
// ============================================
//
// The whole point of computing these in-repo rather than in a vendor's
// dashboard is that the definitions can be argued with. So they are tested —
// particularly the three that analytics implementations usually get wrong:
// immature cohorts, day boundaries, and identity stitching.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  dayKey,
  daysBetween,
  addDays,
  stitchIdentities,
  computeFunnel,
  computeRetention,
  computeSessions,
  computeDropOff,
  percentile,
  DHAKA_OFFSET_MINUTES,
  type AnalyticsEventRow,
} from '@/lib/analytics/metrics';
import {
  EVENTS,
  EVENT_NAMES,
  EVENT_LABELS,
  ONBOARDING_FUNNEL,
  isEventName,
  isClientReportable,
  CLIENT_REPORTABLE,
} from '@/lib/analytics/events';
import { sanitiseProps } from '@/lib/analytics/track';
import {
  normaliseScreen,
  trackClient,
  __resetAnalyticsQueue,
  __analyticsQueueLength,
} from '@/lib/analytics/client';
import { isPlausibleAnonymousId, newAnonymousId } from '@/lib/analytics/identity';

function event(
  name: string,
  at: string,
  who: { userId?: string; anonymousId?: string },
  props?: Record<string, unknown>,
): AnalyticsEventRow {
  return {
    name,
    userId: who.userId ?? null,
    anonymousId: who.anonymousId ?? null,
    occurredAt: new Date(at),
    props,
  };
}

describe('event taxonomy', () => {
  it('is a closed set', () => {
    expect(isEventName(EVENTS.SIGNED_UP)).toBe(true);
    expect(isEventName('whatever_someone_felt_like')).toBe(false);
    expect(isEventName(42)).toBe(false);
  });

  it('labels every event', () => {
    for (const name of EVENT_NAMES) {
      expect(EVENT_LABELS[name], `${name} has no label`).toBeTruthy();
    }
  });

  it('lets the browser report only what the browser can observe', () => {
    // A client claiming a purchase completed, or a profit was made, is worth
    // nothing — those must come from the server.
    expect(isClientReportable(EVENTS.SCREEN_VIEWED)).toBe(true);
    expect(isClientReportable(EVENTS.PURCHASE_COMPLETED)).toBe(false);
    expect(isClientReportable(EVENTS.FIRST_PROFIT)).toBe(false);
    expect(isClientReportable(EVENTS.AD_REWARD_GRANTED)).toBe(false);
  });

  it('keeps the client-reportable set small', () => {
    expect(CLIENT_REPORTABLE.length).toBeLessThan(EVENT_NAMES.length / 3);
  });
});

describe('day bucketing', () => {
  it('buckets by Dhaka time, not UTC', () => {
    // 21:00 UTC on the 20th is 03:00 on the 21st in Dhaka. Bucketing in UTC
    // would file an evening session under the wrong day for an audience that
    // is entirely in Bangladesh.
    expect(dayKey(new Date('2026-09-20T21:00:00Z'))).toBe('2026-09-21');
    expect(dayKey(new Date('2026-09-20T17:00:00Z'))).toBe('2026-09-20');
  });

  it('uses a +6 offset', () => {
    expect(DHAKA_OFFSET_MINUTES).toBe(360);
  });

  it('counts whole days between keys', () => {
    expect(daysBetween('2026-09-01', '2026-09-08')).toBe(7);
    expect(daysBetween('2026-09-08', '2026-09-01')).toBe(-7);
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0);
  });

  it('adds days across a month boundary', () => {
    expect(addDays('2026-09-28', 7)).toBe('2026-10-05');
  });

  it('does not throw on a malformed key', () => {
    expect(daysBetween('nonsense', '2026-09-01')).toBe(0);
    expect(addDays('nonsense', 3)).toBe('nonsense');
  });
});

describe('identity stitching', () => {
  it('connects an anonymous browser to the account it became', () => {
    const events = [
      event(EVENTS.VISITED, '2026-09-01T10:00:00Z', { anonymousId: 'anon-1' }),
      event(EVENTS.SIGNED_UP, '2026-09-01T10:05:00Z', { userId: 'user-1', anonymousId: 'anon-1' }),
    ];
    expect(stitchIdentities(events).get('anon-1')).toBe('user-1');
  });

  it('makes the pre-signup funnel connect', () => {
    // Without stitching this reports that nobody who visited ever signed up.
    const events = [
      event(EVENTS.VISITED, '2026-09-01T10:00:00Z', { anonymousId: 'anon-1' }),
      event(EVENTS.SIGNED_UP, '2026-09-01T10:05:00Z', { userId: 'user-1', anonymousId: 'anon-1' }),
      event(EVENTS.FIRST_BUSINESS_OPENED, '2026-09-01T10:09:00Z', { userId: 'user-1' }),
    ];

    const funnel = computeFunnel(events, [
      EVENTS.VISITED,
      EVENTS.SIGNED_UP,
      EVENTS.FIRST_BUSINESS_OPENED,
    ]);

    expect(funnel[0].users).toBe(1);
    expect(funnel[1].users).toBe(1);
    expect(funnel[2].users).toBe(1);
    expect(funnel[2].conversionFromStart).toBe(1);
  });
});

describe('computeFunnel', () => {
  const events = [
    // Three visitors, two sign up, one opens a shop.
    event(EVENTS.VISITED, '2026-09-01T10:00:00Z', { anonymousId: 'a' }),
    event(EVENTS.VISITED, '2026-09-01T10:00:00Z', { anonymousId: 'b' }),
    event(EVENTS.VISITED, '2026-09-01T10:00:00Z', { anonymousId: 'c' }),
    event(EVENTS.SIGNED_UP, '2026-09-01T10:01:00Z', { userId: 'u-a', anonymousId: 'a' }),
    event(EVENTS.SIGNED_UP, '2026-09-01T10:01:00Z', { userId: 'u-b', anonymousId: 'b' }),
    event(EVENTS.FIRST_BUSINESS_OPENED, '2026-09-01T10:02:00Z', { userId: 'u-a' }),
  ];

  const steps = [EVENTS.VISITED, EVENTS.SIGNED_UP, EVENTS.FIRST_BUSINESS_OPENED];

  it('counts distinct actors at each step', () => {
    const funnel = computeFunnel(events, steps);
    expect(funnel.map(s => s.users)).toEqual([3, 2, 1]);
  });

  it('reports where players stop', () => {
    const funnel = computeFunnel(events, steps);
    expect(funnel[1].droppedHere).toBe(1);
    expect(funnel[2].droppedHere).toBe(1);
  });

  it('reports conversion from the start and from the step before', () => {
    const funnel = computeFunnel(events, steps);
    expect(funnel[2].conversionFromStart).toBeCloseTo(1 / 3, 6);
    expect(funnel[2].conversionFromPrevious).toBeCloseTo(1 / 2, 6);
  });

  it('counts a repeat action once', () => {
    const repeated = [
      ...events,
      event(EVENTS.FIRST_BUSINESS_OPENED, '2026-09-01T11:00:00Z', { userId: 'u-a' }),
    ];
    expect(computeFunnel(repeated, steps)[2].users).toBe(1);
  });

  it('never reports a step gaining users', () => {
    // Someone whose sign-up was never recorded but who opened a shop must not
    // make the funnel widen, which would produce negative drop-off.
    const skipped = [
      event(EVENTS.VISITED, '2026-09-01T10:00:00Z', { anonymousId: 'a' }),
      event(EVENTS.FIRST_BUSINESS_OPENED, '2026-09-01T10:02:00Z', { userId: 'u-z' }),
      event(EVENTS.FIRST_STOCK_BOUGHT, '2026-09-01T10:03:00Z', { userId: 'u-z' }),
    ];
    const funnel = computeFunnel(skipped, [
      EVENTS.VISITED, EVENTS.SIGNED_UP, EVENTS.FIRST_BUSINESS_OPENED, EVENTS.FIRST_STOCK_BOUGHT,
    ]);

    for (let i = 1; i < funnel.length; i++) {
      expect(funnel[i].users).toBeLessThanOrEqual(funnel[i - 1].users);
      expect(funnel[i].droppedHere).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles an empty stream without dividing by zero', () => {
    const funnel = computeFunnel([], steps);
    expect(funnel.map(s => s.users)).toEqual([0, 0, 0]);
    expect(funnel[1].conversionFromStart).toBe(0);
  });

  it('covers the whole onboarding funnel', () => {
    expect(computeFunnel(events, ONBOARDING_FUNNEL)).toHaveLength(ONBOARDING_FUNNEL.length);
  });
});

describe('computeRetention', () => {
  it('counts an actor as retained for any activity that day', () => {
    // First seen the 1st, came back on the 2nd. That is D1.
    const events = [
      event(EVENTS.SIGNED_UP, '2026-09-01T06:00:00Z', { userId: 'u1' }),
      event(EVENTS.SESSION_STARTED, '2026-09-02T06:00:00Z', { userId: 'u1' }),
    ];

    const report = computeRetention(events, new Date('2026-09-10T06:00:00Z'), [1]);
    const cohort = report.cohorts[0];

    expect(cohort.cohortDay).toBe('2026-09-01');
    expect(cohort.size).toBe(1);
    expect(cohort.points[0]).toMatchObject({ day: 1, retained: 1, rate: 1, measurable: true });
  });

  it('does not count an actor who never came back', () => {
    const events = [event(EVENTS.SIGNED_UP, '2026-09-01T06:00:00Z', { userId: 'u1' })];
    const report = computeRetention(events, new Date('2026-09-10T06:00:00Z'), [1]);
    expect(report.cohorts[0].points[0]).toMatchObject({ retained: 0, rate: 0, measurable: true });
  });

  it('refuses to measure a cohort that has not had the chance to come back', () => {
    // THE classic bug. A cohort that signed up yesterday has not had a day 7,
    // and counting it as 0% drags every D7 figure towards zero exactly when
    // sign-ups are growing — making healthy growth look like collapse.
    const events = [event(EVENTS.SIGNED_UP, '2026-09-20T06:00:00Z', { userId: 'u1' })];
    const report = computeRetention(events, new Date('2026-09-21T06:00:00Z'), [1, 7, 30]);
    const points = report.cohorts[0].points;

    expect(points.find(p => p.day === 7)).toMatchObject({ measurable: false, rate: null, retained: null });
    expect(points.find(p => p.day === 30)).toMatchObject({ measurable: false, rate: null });
  });

  it('excludes immature cohorts from the overall figure', () => {
    const events = [
      // Mature: signed up long ago, came back on day 1.
      event(EVENTS.SIGNED_UP, '2026-09-01T06:00:00Z', { userId: 'old' }),
      event(EVENTS.SESSION_STARTED, '2026-09-02T06:00:00Z', { userId: 'old' }),
      // Immature: signed up today, no chance to return.
      event(EVENTS.SIGNED_UP, '2026-09-21T06:00:00Z', { userId: 'new' }),
    ];

    const report = computeRetention(events, new Date('2026-09-21T12:00:00Z'), [1]);
    const overall = report.overall.find(o => o.day === 1)!;

    // Only the mature cohort counts, so D1 reads 100% rather than 50%.
    expect(overall.cohortsCounted).toBe(1);
    expect(overall.usersCounted).toBe(1);
    expect(overall.rate).toBe(1);
  });

  it('treats a day still in progress as not yet measurable', () => {
    // Exactly one day elapsed: day 1 is happening right now, so a final
    // number would understate it.
    const events = [event(EVENTS.SIGNED_UP, '2026-09-20T06:00:00Z', { userId: 'u1' })];
    const report = computeRetention(events, new Date('2026-09-21T10:00:00Z'), [1]);
    expect(report.cohorts[0].points[0].measurable).toBe(false);
  });

  it('groups actors into the cohort of the day they were first seen', () => {
    const events = [
      event(EVENTS.SIGNED_UP, '2026-09-01T06:00:00Z', { userId: 'a' }),
      event(EVENTS.SIGNED_UP, '2026-09-01T07:00:00Z', { userId: 'b' }),
      event(EVENTS.SIGNED_UP, '2026-09-02T06:00:00Z', { userId: 'c' }),
    ];
    const report = computeRetention(events, new Date('2026-09-20T06:00:00Z'), [1]);

    expect(report.cohorts.map(c => [c.cohortDay, c.size])).toEqual([
      ['2026-09-01', 2],
      ['2026-09-02', 1],
    ]);
  });

  it('returns nulls rather than zeros when there is no data', () => {
    const report = computeRetention([], new Date('2026-09-21T06:00:00Z'));
    expect(report.cohorts).toEqual([]);
    expect(report.overall.every(o => o.rate === null)).toBe(true);
  });
});

describe('computeSessions', () => {
  it('splits on a gap longer than the threshold', () => {
    const events = [
      event(EVENTS.SCREEN_VIEWED, '2026-09-01T10:00:00Z', { userId: 'u1' }),
      event(EVENTS.SCREEN_VIEWED, '2026-09-01T10:10:00Z', { userId: 'u1' }),
      // 45 minutes later — a new session.
      event(EVENTS.SCREEN_VIEWED, '2026-09-01T10:55:00Z', { userId: 'u1' }),
      event(EVENTS.SCREEN_VIEWED, '2026-09-01T11:05:00Z', { userId: 'u1' }),
    ];

    const stats = computeSessions(events, 30);
    expect(stats.sessions).toBe(2);
    expect(stats.actors).toBe(1);
    expect(stats.medianMinutes).toBe(10);
  });

  it('reports single-event sessions separately rather than as zero-length', () => {
    // A bounce has no measurable length; averaging it in as 0 would drag the
    // median towards zero and make every session look shorter than it was.
    const events = [
      event(EVENTS.SESSION_STARTED, '2026-09-01T10:00:00Z', { userId: 'u1' }),
      event(EVENTS.SESSION_STARTED, '2026-09-01T10:00:00Z', { userId: 'u2' }),
      event(EVENTS.SCREEN_VIEWED, '2026-09-01T10:20:00Z', { userId: 'u2' }),
    ];

    const stats = computeSessions(events, 30);
    expect(stats.sessions).toBe(2);
    expect(stats.singleEventSessions).toBe(1);
    expect(stats.medianMinutes).toBe(20);
  });

  it('keeps actors separate', () => {
    const events = [
      event(EVENTS.SCREEN_VIEWED, '2026-09-01T10:00:00Z', { userId: 'u1' }),
      event(EVENTS.SCREEN_VIEWED, '2026-09-01T10:05:00Z', { userId: 'u2' }),
    ];
    expect(computeSessions(events).actors).toBe(2);
  });

  it('handles an empty stream', () => {
    const stats = computeSessions([]);
    expect(stats).toMatchObject({ sessions: 0, actors: 0, medianMinutes: 0, meanMinutes: 0 });
  });
});

describe('percentile', () => {
  it('returns the median', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it('interpolates between neighbours', () => {
    expect(percentile([10, 20], 0.5)).toBe(15);
  });

  it('handles empty and single-value series', () => {
    expect(percentile([], 0.5)).toBe(0);
    expect(percentile([7], 0.9)).toBe(7);
  });

  it('clamps a fraction outside 0-1', () => {
    expect(percentile([1, 2, 3], 5)).toBe(3);
    expect(percentile([1, 2, 3], -1)).toBe(1);
  });
});

describe('computeDropOff', () => {
  it('reports the last screen an actor saw before going quiet', () => {
    const events = [
      event(EVENTS.SCREEN_VIEWED, '2026-09-01T10:00:00Z', { userId: 'u1' }, { screen: '/dashboard' }),
      event(EVENTS.SCREEN_VIEWED, '2026-09-01T10:05:00Z', { userId: 'u1' }, { screen: '/businesses/new' }),
      event(EVENTS.SCREEN_VIEWED, '2026-09-01T10:00:00Z', { userId: 'u2' }, { screen: '/businesses/new' }),
    ];

    const dropOff = computeDropOff(events, new Date('2026-09-10T10:00:00Z'), 3);
    expect(dropOff[0]).toMatchObject({ screen: '/businesses/new', actors: 2, share: 1 });
  });

  it('ignores actors who are still around', () => {
    const events = [
      event(EVENTS.SCREEN_VIEWED, '2026-09-21T10:00:00Z', { userId: 'u1' }, { screen: '/dashboard' }),
    ];
    expect(computeDropOff(events, new Date('2026-09-21T12:00:00Z'), 3)).toEqual([]);
  });

  it('ignores a screen view with no screen recorded', () => {
    const events = [
      event(EVENTS.SCREEN_VIEWED, '2026-09-01T10:00:00Z', { userId: 'u1' }, {}),
    ];
    expect(computeDropOff(events, new Date('2026-09-10T10:00:00Z'), 3)).toEqual([]);
  });
});

describe('sanitiseProps', () => {
  it('keeps ordinary props', () => {
    expect(sanitiseProps({ businessType: 'TEA_STALL', city: 'DHAKA', amount: 5000, first: true }))
      .toEqual({ businessType: 'TEA_STALL', city: 'DHAKA', amount: 5000, first: true });
  });

  it('strips anything that could be personal', () => {
    const clean = sanitiseProps({
      email: 'someone@example.com',
      userEmail: 'someone@example.com',
      password: 'hunter2',
      sessionToken: 'abc',
      ipAddress: '1.2.3.4',
      playerName: 'Rahim',
      keep: 'yes',
    });
    expect(clean).toEqual({ keep: 'yes' });
  });

  it('bounds a long string rather than storing a payload', () => {
    const clean = sanitiseProps({ note: 'x'.repeat(1000) });
    expect((clean.note as string).length).toBeLessThanOrEqual(120);
  });

  it('drops non-finite numbers rather than storing NaN', () => {
    expect(sanitiseProps({ value: Number.NaN })).toEqual({ value: 0 });
  });

  it('caps how many props one event may carry', () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < 50; i++) many[`k${i}`] = i;
    expect(Object.keys(sanitiseProps(many)).length).toBeLessThanOrEqual(12);
  });

  it('handles undefined', () => {
    expect(sanitiseProps(undefined)).toEqual({});
  });
});

describe('normaliseScreen', () => {
  it('collapses ids so screens group', () => {
    // Without this, "where do players stop" answers with one row per player.
    expect(normaliseScreen('/businesses/clx8f9a2b0000qwer1234asdf/inventory'))
      .toBe('/businesses/:id/inventory');
    expect(normaliseScreen('/cohorts/550e8400-e29b-41d4-a716-446655440000'))
      .toBe('/cohorts/:id');
    expect(normaliseScreen('/season/12/standings')).toBe('/season/:id/standings');
  });

  it('keeps real route segments', () => {
    expect(normaliseScreen('/dashboard')).toBe('/dashboard');
    expect(normaliseScreen('/businesses/new')).toBe('/businesses/new');
    expect(normaliseScreen('/')).toBe('/');
  });

  it('keeps identifiers out of the analytics table at all', () => {
    // Belt and braces with the PII rule: a screen name is the only free-text
    // prop recorded, so it must not be able to carry a player id.
    const screen = normaliseScreen('/businesses/clx8f9a2b0000qwer1234asdf');
    expect(screen).not.toContain('clx8f9a2b0000qwer1234asdf');
  });
});

describe('trackClient', () => {
  // These tests run under the node environment, where the module correctly
  // no-ops. `window` is stubbed so the browser path is the thing under test.
  const withWindow = (fn: () => void) => {
    const had = 'window' in globalThis;
    if (!had) (globalThis as { window?: unknown }).window = {};
    try {
      fn();
    } finally {
      if (!had) delete (globalThis as { window?: unknown }).window;
    }
  };

  beforeEach(() => {
    __resetAnalyticsQueue();
  });

  it('does nothing on the server', () => {
    // Rendering a page must not try to queue a browser event.
    trackClient(EVENTS.SCREEN_VIEWED, { screen: '/dashboard' });
    expect(__analyticsQueueLength()).toBe(0);
  });

  it('queues a client-observable event', () => {
    withWindow(() => {
      trackClient(EVENTS.SCREEN_VIEWED, { screen: '/dashboard' });
      expect(__analyticsQueueLength()).toBe(1);
    });
  });

  it('refuses to queue an event the server would reject anyway', () => {
    withWindow(() => {
      trackClient(EVENTS.PURCHASE_COMPLETED as never);
      trackClient(EVENTS.FIRST_PROFIT as never);
      expect(__analyticsQueueLength()).toBe(0);
    });
  });
});

describe('isPlausibleAnonymousId', () => {
  it('accepts an id of the shape we issue', () => {
    expect(isPlausibleAnonymousId(newAnonymousId())).toBe(true);
  });

  it('rejects anything else', () => {
    // An attacker-chosen id could otherwise be used to write into another
    // browser's row, and an unbounded one as free storage.
    expect(isPlausibleAnonymousId('short')).toBe(false);
    expect(isPlausibleAnonymousId('x'.repeat(5000))).toBe(false);
    expect(isPlausibleAnonymousId("'; DROP TABLE AnalyticsEvent; --")).toBe(false);
    expect(isPlausibleAnonymousId(undefined)).toBe(false);
    expect(isPlausibleAnonymousId(12345)).toBe(false);
  });

  it('issues ids that are unique and unguessable', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newAnonymousId()));
    expect(ids.size).toBe(500);
    expect(newAnonymousId().length).toBeGreaterThanOrEqual(16);
  });
});

describe('the report endpoint', () => {
  const originalToken = process.env.ANALYTICS_REPORT_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) delete process.env.ANALYTICS_REPORT_TOKEN;
    else process.env.ANALYTICS_REPORT_TOKEN = originalToken;
  });

  async function get(headers: Record<string, string> = {}) {
    const { GET } = await import('@/app/api/analytics/report/route');
    const request = new Request('http://localhost/api/analytics/report', { headers });
    return GET(request as never);
  }

  it('refuses when no token is configured', async () => {
    // A missing environment variable must never be the thing that publishes
    // the numbers. Closed by default, not open by default.
    delete process.env.ANALYTICS_REPORT_TOKEN;
    expect((await get()).status).toBe(503);
  });

  it('refuses a missing or wrong token', async () => {
    process.env.ANALYTICS_REPORT_TOKEN = 'correct-horse-battery-staple';
    expect((await get()).status).toBe(401);
    expect((await get({ authorization: 'Bearer wrong' })).status).toBe(401);
    expect((await get({ authorization: 'correct-horse-battery-staple' })).status).toBe(401);
  });
});

describe('recording an event', () => {
  it('never throws', async () => {
    // The case that matters: the database is the thing most likely to fail,
    // and a failed analytics insert must not surface as a failed purchase. The
    // early-return paths below would pass with no swallow at all, so the
    // database is made to throw first.
    vi.resetModules();
    const create = vi.fn(() => Promise.reject(new Error('connection lost')));
    const findFirst = vi.fn(() => Promise.reject(new Error('connection lost')));
    const deleteMany = vi.fn(() => Promise.reject(new Error('connection lost')));
    vi.doMock('@/lib/db', () => ({ db: { analyticsEvent: { create, findFirst, deleteMany } } }));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const { track, trackOnce, pruneOldEvents } = await import('@/lib/analytics/track');

      await expect(track(EVENTS.SIGNED_UP, { userId: 'u1' })).resolves.toBeUndefined();
      await expect(trackOnce(EVENTS.FIRST_PROFIT, { userId: 'u1' })).resolves.toBeUndefined();
      await expect(pruneOldEvents()).resolves.toBe(0);

      // The mock has to be the thing that was called. Without this the test
      // would pass against the real client too — and the real client points at
      // a database with live players in it.
      expect(create).toHaveBeenCalled();
      expect(findFirst).toHaveBeenCalled();
      expect(deleteMany).toHaveBeenCalled();

      // Swallowed, but not silently — a broken analytics table should be
      // visible in the logs rather than simply producing empty reports.
      expect(errors).toHaveBeenCalled();
    } finally {
      errors.mockRestore();
      vi.doUnmock('@/lib/db');
      vi.resetModules();
    }
  });

  it('declines to write an event it cannot use', async () => {
    const { track, trackOnce } = await import('@/lib/analytics/track');

    // Neither id: cannot appear in a funnel or a cohort, so it is dropped
    // rather than stored as noise.
    await expect(track(EVENTS.SCREEN_VIEWED, { userId: null, anonymousId: null }))
      .resolves.toBeUndefined();
    // Not in the taxonomy.
    await expect(track('not_an_event' as never, { userId: 'u1' })).resolves.toBeUndefined();
    // `trackOnce` is per-account and has no account.
    await expect(trackOnce(EVENTS.FIRST_PROFIT, { anonymousId: 'a1' })).resolves.toBeUndefined();
  });
});
