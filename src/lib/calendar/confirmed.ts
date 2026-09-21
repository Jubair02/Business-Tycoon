// ============================================
// Bangladesh Business Tycoon - Confirmed dates
// ============================================
//
// Dates that were announced rather than calculated.
//
// ---- Please read before trusting this file ----
//
// **These need checking against the government holiday gazette.** They are the
// best knowledge available when the calendar was written, and two kinds of date
// in here genuinely cannot be derived from first principles:
//
//   * **Islamic dates** depend on a local crescent sighting announced by the
//     Jatiya Chand Dekha Committee the evening before. The arithmetic estimate
//     in `hijri.ts` is good to about a day, and this table is how a year gets
//     from "about a day" to exact.
//
//   * **Hindu and Buddhist dates** need tithi and solar-month calculations from
//     the lunisolar calendar, which this module does not implement. Outside
//     this table they are **not shown at all**, rather than shown wrongly — an
//     absent Durga Puja is an obvious gap a player will report, a wrong one
//     quietly misinforms them.
//
// Everything degrades honestly when a year is missing: Hijri observances fall
// back to an estimate and are labelled as one, announced-only observances
// vanish, and `confirmedCoverage()` reports how far the table reaches so the
// calendar page can say so out loud. Nothing here is load-bearing for the app
// to work — it is load-bearing for the app to be *exact*.
//
// ---- Adding a year ----
//
// The gazette is published by the Ministry of Public Administration, usually in
// the last quarter of the preceding year. Add the entries, and
// `calendar.test.ts` will check they are well-formed and that they sit within
// the estimate's uncertainty window — a confirmed date more than a couple of
// days from the arithmetic is far more likely to be a typo than a real sighting.

import type { CivilDate } from './civil-date';

/** `observanceId` → the day it fell on, per Gregorian year. */
export type ConfirmedYear = Record<string, CivilDate>;

export const CONFIRMED_DATES: Record<number, ConfirmedYear> = {
  2025: {
    SHAB_E_BARAT: '2025-02-15',
    RAMADAN: '2025-03-02',
    EID_UL_FITR: '2025-03-31',
    BUDDHA_PURNIMA: '2025-05-11',
    EID_UL_ADHA: '2025-06-07',
    ASHURA: '2025-07-06',
    JANMASHTAMI: '2025-08-16',
    EID_E_MILADUNNABI: '2025-09-05',
    DURGA_PUJA: '2025-10-02',
  },
  2026: {
    SHAB_E_BARAT: '2026-02-04',
    RAMADAN: '2026-02-19',
    EID_UL_FITR: '2026-03-21',
    BUDDHA_PURNIMA: '2026-05-01',
    EID_UL_ADHA: '2026-05-27',
    ASHURA: '2026-06-26',
    JANMASHTAMI: '2026-09-04',
    EID_E_MILADUNNABI: '2026-08-26',
    DURGA_PUJA: '2026-10-21',
  },
};

/**
 * The span the confirmed table covers.
 *
 * Surfaced in the API and on the calendar page so a player looking at 2029 is
 * told those dates are estimates, instead of being left to assume they are not.
 */
export function confirmedCoverage(): { from: number; to: number } | null {
  const years = Object.keys(CONFIRMED_DATES).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (years.length === 0) return null;
  return { from: years[0], to: years[years.length - 1] };
}

export function confirmedDate(observanceId: string, gregorianYear: number): CivilDate | null {
  return CONFIRMED_DATES[gregorianYear]?.[observanceId] ?? null;
}

/**
 * Whether the table still reaches far enough to be useful.
 *
 * Not an error — the calendar keeps working on estimates — but the report
 * endpoint says so, because the failure mode of this file is that it silently
 * stops being updated and nobody notices the labels all turned into "estimated".
 */
export function confirmedDataIsStale(today: Date = new Date()): boolean {
  const coverage = confirmedCoverage();
  if (!coverage) return true;
  return coverage.to < today.getUTCFullYear() + 1;
}
