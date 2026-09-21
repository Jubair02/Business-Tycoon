// ============================================
// Bangladesh Business Tycoon - Calendar resolution
// ============================================
//
// Turns the rules in `observances.ts` into actual dates, for any year, with an
// honest certainty attached to each one. Pure — no Prisma, no clock, no React —
// so every date in the game can be tested directly.
//
// The resolution order is the whole design:
//
//   1. A confirmed date from the gazette, if we have one.  → CONFIRMED
//   2. Otherwise the rule computes it.                     → FIXED or ESTIMATED
//   3. Except announced-only rules, which produce nothing rather than a guess.
//
// Step 3 is the one that takes discipline. It would be easy to approximate
// Durga Puja and be within a few days most years; it would also mean a Hindu
// player in Dhaka seeing the wrong date for the biggest festival of their year.

import {
  addDays,
  daysBetween,
  partsOf,
  toCivilDate,
  type CivilDate,
} from './civil-date';
import { bengaliDateOf, bengaliRecurrenceInGregorianYear, type BengaliDate } from './bengali';
import { hijriDatesInGregorianYear, SIGHTING_UNCERTAINTY_DAYS } from './hijri';
import { confirmedDate } from './confirmed';
import {
  OBSERVANCES,
  type Certainty,
  type Observance,
} from './observances';

export interface ResolvedObservance {
  observance: Observance;
  /** The day it falls on. */
  date: CivilDate;
  /** Last day it runs, which equals `date` for a one-day observance. */
  endDate: CivilDate;
  certainty: Certainty;
  /**
   * Present only for estimates. The real date lands somewhere in here, and the
   * UI is expected to say so rather than printing `date` as fact.
   */
  window?: { earliest: CivilDate; latest: CivilDate };
}

/**
 * How far before an observance its commercial effect can start.
 *
 * Derived from the catalogue rather than guessed, so adding a longer Eid ramp
 * later cannot silently fall outside the search window and stop applying.
 */
export const MAX_LEAD_DAYS = Math.max(
  0,
  ...OBSERVANCES.flatMap(o => o.demand.map(w => -Math.min(w.from, w.to))),
);

export const MAX_TRAIL_DAYS = Math.max(
  0,
  ...OBSERVANCES.flatMap(o => [
    ...o.demand.map(w => Math.max(w.from, w.to)),
    (o.spanDays ?? 1) - 1,
  ]),
);

/** Every occurrence of one observance in a Gregorian year. Usually one. */
export function resolveObservance(
  observance: Observance,
  gregorianYear: number,
): ResolvedObservance[] {
  const span = Math.max(1, observance.spanDays ?? 1);
  const withSpan = (date: CivilDate, certainty: Certainty, window?: ResolvedObservance['window']) => ({
    observance,
    date,
    endDate: addDays(date, span - 1),
    certainty,
    window,
  });

  // A gazetted date always wins, whatever the rule would have said.
  const confirmed = confirmedDate(observance.id, gregorianYear);
  if (confirmed) return [withSpan(confirmed, 'CONFIRMED')];

  switch (observance.rule.kind) {
    case 'GREGORIAN': {
      const { month, day } = observance.rule;
      const pad = (n: number) => String(n).padStart(2, '0');
      return [withSpan(`${gregorianYear}-${pad(month)}-${pad(day)}`, 'FIXED')];
    }

    case 'BENGALI': {
      // Fixed in Gregorian terms too, since the 2019 revision — which is what
      // that revision was for.
      const date = bengaliRecurrenceInGregorianYear(
        gregorianYear,
        observance.rule.month,
        observance.rule.day,
      );
      return date ? [withSpan(date, 'FIXED')] : [];
    }

    case 'HIJRI': {
      const { month, day } = observance.rule;
      return hijriDatesInGregorianYear(gregorianYear, month, day).map(estimate =>
        withSpan(estimate.expected, 'ESTIMATED', {
          earliest: estimate.earliest,
          latest: estimate.latest,
        }),
      );
    }

    case 'ANNOUNCED_ONLY':
      // Nothing to compute, and nothing confirmed. Better an absent date than a
      // confident wrong one.
      return [];
  }
}

/**
 * Everything in a Gregorian year, in order.
 *
 * Memoised. Resolving a year means walking the catalogue and doing Hijri and
 * Bengali conversions for each entry, and the tick asks for it once per trading
 * shop per day — plus 365 times over when computing an annual mean. Without the
 * cache that arithmetic dominated the tick.
 */
const yearCache = new Map<number, ResolvedObservance[]>();

export function observancesInYear(gregorianYear: number): ResolvedObservance[] {
  const cached = yearCache.get(gregorianYear);
  if (cached) return cached;

  const resolved = OBSERVANCES.flatMap(o => resolveObservance(o, gregorianYear)).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  yearCache.set(gregorianYear, resolved);
  return resolved;
}

/** Test seam: the cache would otherwise hide a change to the catalogue. */
export function __clearCalendarCache(): void {
  yearCache.clear();
}

/**
 * Everything whose date or span touches a window of days.
 *
 * Spans the adjacent years too: a Ramadan beginning in late December runs into
 * January, and asking only about one year would lose it.
 */
export function observancesBetween(from: CivilDate, to: CivilDate): ResolvedObservance[] {
  const firstYear = partsOf(from).year;
  const lastYear = partsOf(to).year;

  const resolved: ResolvedObservance[] = [];
  for (let year = firstYear - 1; year <= lastYear + 1; year++) {
    resolved.push(...observancesInYear(year));
  }

  return resolved
    .filter(r => r.endDate >= from && r.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The observances running on a given day. */
export function observancesOn(day: CivilDate): ResolvedObservance[] {
  return observancesBetween(day, day);
}

/**
 * What is coming, starting from a day.
 *
 * Deduplicated by observance so a thirty-day Ramadan does not fill the list
 * with itself, and capped so the dashboard strip has something to show without
 * the caller having to slice it.
 */
export function upcomingObservances(
  from: CivilDate,
  withinDays = 60,
  limit = 5,
): ResolvedObservance[] {
  const seen = new Set<string>();
  const results: ResolvedObservance[] = [];

  for (const resolved of observancesBetween(from, addDays(from, withinDays))) {
    // Already under way — that is "today", not "coming up".
    if (resolved.date < from) continue;
    if (seen.has(resolved.observance.id)) continue;
    seen.add(resolved.observance.id);
    results.push(resolved);
    if (results.length >= limit) break;
  }

  return results;
}

export interface CalendarDay {
  date: CivilDate;
  bengali: BengaliDate;
  /** Running today. */
  today: ResolvedObservance[];
  /** Coming, nearest first. */
  upcoming: ResolvedObservance[];
  /** Days until the next one, or null when nothing is in range. */
  daysToNext: number | null;
}

/** The full picture for one day: what date it is, and what is happening. */
export function calendarDay(day: CivilDate, lookAheadDays = 60): CalendarDay {
  const today = observancesOn(day);
  const upcoming = upcomingObservances(addDays(day, 1), lookAheadDays);

  return {
    date: day,
    bengali: bengaliDateOf(day),
    today,
    upcoming,
    daysToNext: upcoming.length > 0 ? daysBetween(day, upcoming[0].date) : null,
  };
}

/** The calendar day in Dhaka right now. */
export function todayInDhaka(now: Date = new Date()): CivilDate {
  return toCivilDate(now);
}

/**
 * How a date should be described when it is not certain.
 *
 * Returned as data rather than a formatted string so both languages can phrase
 * it themselves — "around 21 March" reads differently in Bangla.
 */
export function certaintyOf(resolved: ResolvedObservance): {
  certainty: Certainty;
  /** True when the UI must not present the date as settled. */
  approximate: boolean;
  uncertaintyDays: number;
} {
  const approximate = resolved.certainty === 'ESTIMATED';
  return {
    certainty: resolved.certainty,
    approximate,
    uncertaintyDays: approximate ? SIGHTING_UNCERTAINTY_DAYS : 0,
  };
}
