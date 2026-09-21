// ============================================
// Bangladesh Business Tycoon - Client Analytics
// ============================================
//
// A queue, not a request per event. Screen views arrive in bursts as a player
// moves around, and a fetch per view would add latency to navigation for data
// nobody reads in real time.
//
// Two things matter more here than they look:
//
//   1. **Flush on the way out.** The interesting player is the one who leaves.
//      `sendBeacon` on `visibilitychange` is the only reliable way to keep their
//      last events, because a `fetch` from `unload` is routinely cancelled.
//
//   2. **Screens, not URLs.** `/businesses/clx8f.../inventory` is one screen,
//      not one per player. Ids are collapsed before anything is recorded, which
//      also keeps identifiers out of the analytics table.

import { EVENTS, isClientReportable, type EventName } from './events';

const ENDPOINT = '/api/analytics/collect';
const FLUSH_INTERVAL_MS = 10_000;
const MAX_QUEUE = 40;

type Props = Record<string, string | number | boolean>;

interface QueuedEvent {
  name: EventName;
  props?: Props;
}

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Collapse ids out of a path so screens group.
 *
 * Matches cuids, uuids and bare numbers. Anything unrecognised is left alone —
 * a route segment that is genuinely part of the screen name should survive.
 */
export function normaliseScreen(pathname: string): string {
  return pathname
    .split('/')
    .map(segment => {
      if (!segment) return segment;
      if (/^c[a-z0-9]{20,}$/i.test(segment)) return ':id';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return ':id';
      if (/^\d+$/.test(segment)) return ':id';
      return segment;
    })
    .join('/') || '/';
}

function send(events: QueuedEvent[], useBeacon: boolean): void {
  if (events.length === 0) return;

  const body = JSON.stringify({ events });

  // `sendBeacon` survives the page going away; `fetch` from a closing tab does
  // not. It can refuse when the browser's beacon budget is spent, so the return
  // value is checked rather than assumed.
  if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const queued = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    if (queued) return;
  }

  void fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics failing is not something a player should ever see or feel.
  });
}

export function flushAnalytics(useBeacon = false): void {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  send(batch, useBeacon);
}

/** Queue a client-observable event. Anything else is rejected by the server anyway. */
export function trackClient(name: EventName, props?: Props): void {
  if (typeof window === 'undefined') return;
  if (!isClientReportable(name)) return;

  queue.push({ name, props });

  // Bound the queue so a runaway loop cannot grow it without limit; the oldest
  // events go, because the most recent are the ones that explain a drop-off.
  if (queue.length > MAX_QUEUE) {
    queue = queue.slice(-MAX_QUEUE);
    flushAnalytics();
  }
}

export function trackScreen(pathname: string): void {
  trackClient(EVENTS.SCREEN_VIEWED, { screen: normaliseScreen(pathname) });
}

/**
 * Start the flush timer and the visibility handler.
 *
 * Returns a teardown function. Safe to call twice — the second call is a no-op
 * so React's development double-invoke does not produce two timers.
 */
export function startAnalytics(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (timer) return () => {};

  timer = setInterval(() => flushAnalytics(), FLUSH_INTERVAL_MS);

  const onHidden = () => {
    if (document.visibilityState === 'hidden') flushAnalytics(true);
  };

  document.addEventListener('visibilitychange', onHidden);
  window.addEventListener('pagehide', () => flushAnalytics(true));

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', onHidden);
    flushAnalytics(true);
  };
}

/** Test seam. */
export function __resetAnalyticsQueue(): void {
  queue = [];
  if (timer) clearInterval(timer);
  timer = null;
}

/** Test seam. */
export function __analyticsQueueLength(): number {
  return queue.length;
}
