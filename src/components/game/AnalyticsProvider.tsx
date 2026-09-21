'use client';

// ============================================
// Bangladesh Business Tycoon - Analytics Provider
// ============================================
//
// Renders nothing. It exists to answer three questions the server cannot see on
// its own: did this browser ever arrive, when does a session begin, and which
// screens does a player walk through before they stop.
//
// `visited` fires once per browser and `session_started` once per tab, because
// a funnel whose first step counts page loads is measuring the router, not
// people.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { EVENTS } from '@/lib/analytics/events';
import { startAnalytics, trackClient, trackScreen } from '@/lib/analytics/client';

const VISITED_KEY = 'bt-analytics-visited';
const SESSION_KEY = 'bt-analytics-session';

/** Storage is unavailable in some privacy modes; a missing flag is not an error. */
function readFlag(storage: Storage | undefined, key: string): boolean {
  try {
    return storage?.getItem(key) === '1';
  } catch {
    return true; // Treat as already-seen rather than firing on every load.
  }
}

function writeFlag(storage: Storage | undefined, key: string): void {
  try {
    storage?.setItem(key, '1');
  } catch {
    // Nothing to do.
  }
}

export function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    const teardown = startAnalytics();

    if (!readFlag(window.localStorage, VISITED_KEY)) {
      trackClient(EVENTS.VISITED);
      writeFlag(window.localStorage, VISITED_KEY);
    }

    if (!readFlag(window.sessionStorage, SESSION_KEY)) {
      trackClient(EVENTS.SESSION_STARTED);
      writeFlag(window.sessionStorage, SESSION_KEY);
    }

    return teardown;
  }, []);

  useEffect(() => {
    if (pathname) trackScreen(pathname);
  }, [pathname]);

  return null;
}
