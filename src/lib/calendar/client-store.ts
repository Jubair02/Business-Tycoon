// ============================================
// Bangladesh Business Tycoon - Calendar client store
// ============================================
//
// The calendar shows up in four places — the top bar, the dashboard strip, the
// shop screen and the calendar page — and all four want the same answer. This
// is one fetch shared between them, subscribed to with `useSyncExternalStore`
// rather than mirrored into state by an effect, which is the pattern React 19's
// compiler rules push towards and which the rest of this codebase already uses.

import type { Certainty, ObservanceKind, TradeId } from './observances';

export interface CalendarBengali {
  day: number;
  month: number;
  year: number;
  monthEn: string;
  monthBn: string;
  formattedEn: string;
  formattedBn: string;
  season: { id: string; en: string; bn: string; trade: string };
}

export interface CalendarObservance {
  id: string;
  en: string;
  bn: string;
  kind: ObservanceKind;
  date: string;
  endDate: string;
  certainty: Certainty;
  window: { earliest: string; latest: string } | null;
  publicHoliday: boolean;
  spanDays: number;
  tradeNote: string;
  tradeNoteBn: string;
  daysAway: number;
  peaks: { trade: TradeId; peak: number }[];
}

export interface CalendarDemand {
  multiplier: number;
  factors: { source: string; label: string; labelBn: string; multiplier: number }[];
}

export interface CalendarPayload {
  world: {
    date: string;
    gameDay: number;
    seasonNumber: number | null;
    seasonName: string | null;
    bengali: CalendarBengali;
  };
  real: { date: string; bengali: CalendarBengali };
  today: CalendarObservance[];
  upcoming: CalendarObservance[];
  daysToNext: number | null;
  demand: Record<string, CalendarDemand>;
  year: {
    year: number;
    canGoBack: boolean;
    canGoForward: boolean;
    observances: CalendarObservance[];
  };
  coverage: { from: number; to: number; stale: boolean } | null;
}

type Listener = () => void;

let snapshot: CalendarPayload | null = null;
let inFlight: Promise<void> | null = null;
let loadedYear: number | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeToCalendar(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function calendarSnapshot(): CalendarPayload | null {
  return snapshot;
}

/** The server renders nothing for this, so the snapshot starts empty there. */
export function calendarServerSnapshot(): CalendarPayload | null {
  return null;
}

/**
 * Load the calendar, once.
 *
 * Concurrent callers share the in-flight request rather than each firing one —
 * four components mounting together used to mean four identical round trips.
 */
export function loadCalendar(year?: number): Promise<void> {
  const wantedYear = year ?? null;
  if (snapshot && wantedYear === loadedYear) return Promise.resolve();
  if (inFlight && wantedYear === loadedYear) return inFlight;

  loadedYear = wantedYear;
  const url = year ? `/api/calendar?year=${year}` : '/api/calendar';

  inFlight = fetch(url)
    .then(res => (res.ok ? res.json() : null))
    .then((data: CalendarPayload | null) => {
      if (data) {
        snapshot = data;
        emit();
      }
    })
    .catch(() => {
      // The calendar is context, not function. A failure hides it.
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/**
 * Drop what is cached and fetch again.
 *
 * The world's date moves with the game clock, so the strip would otherwise go
 * stale within a few real minutes.
 */
export function refreshCalendar(year?: number): Promise<void> {
  snapshot = null;
  loadedYear = null;
  inFlight = null;
  return loadCalendar(year);
}
