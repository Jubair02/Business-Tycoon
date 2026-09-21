'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  calendarServerSnapshot,
  calendarSnapshot,
  loadCalendar,
  refreshCalendar,
  subscribeToCalendar,
  type CalendarPayload,
} from '@/lib/calendar/client-store';

/**
 * How often the calendar is re-read.
 *
 * A game day is a real minute, so the world's date moves fast enough that a
 * strip saying "Eid in 3 days" would be wrong within five minutes of a player
 * leaving the tab open.
 */
const REFRESH_MS = 60_000;

/**
 * The shared calendar.
 *
 * Subscribed to rather than copied into state: the payload lives outside React,
 * several components want the same one, and mirroring it with an effect is the
 * cascading-render pattern React 19 flags.
 */
export function useCalendar(year?: number): CalendarPayload | null {
  const payload = useSyncExternalStore(
    subscribeToCalendar,
    calendarSnapshot,
    calendarServerSnapshot,
  );

  useEffect(() => {
    void loadCalendar(year);
    const id = setInterval(() => void refreshCalendar(year), REFRESH_MS);
    return () => clearInterval(id);
  }, [year]);

  return payload;
}
