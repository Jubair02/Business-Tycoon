// ============================================
// Bangladesh Business Tycoon - Hijri calendar
// ============================================
//
// The tabular (arithmetic) Islamic calendar, which is what lets Ramadan and
// both Eids roll forward correctly for any year without a lookup table that
// expires.
//
// ---- The thing this module must not pretend ----
//
// **In Bangladesh these dates are not computed. They are decided.** A lunar
// month begins when the crescent is actually sighted, and the Jatiya Chand
// Dekha Committee announces it the evening before. Bangladesh routinely
// observes Eid a day after Saudi Arabia for exactly this reason.
//
// So everything here is an *estimate*, and the type system says so: callers get
// an `earliest`/`latest` window, never a bare date they can mistake for fact. A
// confirmed date from the gazette always wins — see `confirmed.ts`.
//
// ---- How good is the estimate? ----
//
// Checked against what Bangladesh actually observed:
//
//   | Observance          | Tabular    | Observed   | Error |
//   |---------------------|------------|------------|-------|
//   | Ramadan 1446 begins | 2025-03-01 | 2025-03-02 | +1 d  |
//   | Eid-ul-Fitr 1446    | 2025-03-31 | 2025-03-31 | exact |
//   | Eid-ul-Adha 1446    | 2025-06-07 | 2025-06-07 | exact |
//
// Note the shape of that: the error is not a constant. Ramadan 1446 ran 30 days
// in Bangladesh against the tabular 29, so a blanket "+1 day for Bangladesh"
// correction — tempting, and wrong — would have moved Eid off a date it had
// already got right. Hence a symmetric ±1 day window and no fudge factor.

import { civilToJdn, jdnToCivil, type CivilDate } from './civil-date';

/**
 * 1 Muharram 1 AH = 16 July 622 CE (Julian), JDN 1948440.
 *
 * The constant is 1948439 because the day number is 1-based.
 */
const HIJRI_EPOCH_JDN = 1948439;

/**
 * Leap years within each 30-year cycle.
 *
 * This is the standard "Kuwaiti" variant (type IIa), the one almost every civil
 * Hijri implementation uses. Others shift a leap year by one, which moves a
 * date by a day — immaterial next to the ±1 sighting window above.
 */
const LEAP_YEARS_IN_CYCLE = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29];

export const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  'Jumada al-Ula',
  'Jumada al-Akhirah',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qi'dah",
  'Dhu al-Hijjah',
] as const;

/** 1-based month numbers, so call sites read as the calendar does. */
export const HIJRI_MONTH = {
  MUHARRAM: 1,
  SAFAR: 2,
  RABI_AL_AWWAL: 3,
  RABI_AL_THANI: 4,
  JUMADA_AL_ULA: 5,
  JUMADA_AL_AKHIRAH: 6,
  RAJAB: 7,
  SHABAN: 8,
  RAMADAN: 9,
  SHAWWAL: 10,
  DHU_AL_QIDAH: 11,
  DHU_AL_HIJJAH: 12,
} as const;

export interface HijriDate {
  year: number;
  /** 1-12. */
  month: number;
  /** 1-30. */
  day: number;
}

export function isHijriLeapYear(year: number): boolean {
  // `((year % 30) + 30) % 30` rather than `year % 30` so years before the epoch
  // do not produce a negative remainder that matches nothing.
  const positionInCycle = (((year % 30) + 30) % 30) || 30;
  return LEAP_YEARS_IN_CYCLE.includes(positionInCycle);
}

/** Months alternate 30 and 29 days; the last gains a day in a leap year. */
export function hijriMonthLength(year: number, month: number): number {
  if (month === 12) return isHijriLeapYear(year) ? 30 : 29;
  return month % 2 === 1 ? 30 : 29;
}

export function hijriToJdn({ year, month, day }: HijriDate): number {
  return (
    day +
    Math.ceil(29.5 * (month - 1)) +
    (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) +
    HIJRI_EPOCH_JDN
  );
}

export function jdnToHijri(jdn: number): HijriDate {
  const year = Math.floor((30 * (jdn - HIJRI_EPOCH_JDN) + 10646) / 10631);
  const firstOfYear = hijriToJdn({ year, month: 1, day: 1 });
  const dayOfYear = jdn - firstOfYear;

  let month = 1;
  let remaining = dayOfYear;
  while (month < 12 && remaining >= hijriMonthLength(year, month)) {
    remaining -= hijriMonthLength(year, month);
    month++;
  }

  return { year, month, day: remaining + 1 };
}

/** The tabular Hijri date for a Gregorian day. An estimate, like everything here. */
export function hijriOf(day: CivilDate): HijriDate {
  return jdnToHijri(civilToJdn(day));
}

/**
 * A date that depends on a moon sighting.
 *
 * `expected` is the arithmetic answer and `earliest`/`latest` bound where the
 * real thing lands. Callers render the window, not the point — an app that
 * tells someone in Dhaka the wrong Eid date with a straight face is worse than
 * one that says "around the 21st, confirmed by sighting".
 */
export interface EstimatedDate {
  expected: CivilDate;
  earliest: CivilDate;
  latest: CivilDate;
}

/** How far the tabular calendar can be from what is observed, in days. */
export const SIGHTING_UNCERTAINTY_DAYS = 1;

export function hijriToCivil(date: HijriDate): EstimatedDate {
  const jdn = hijriToJdn(date);
  return {
    expected: jdnToCivil(jdn),
    earliest: jdnToCivil(jdn - SIGHTING_UNCERTAINTY_DAYS),
    latest: jdnToCivil(jdn + SIGHTING_UNCERTAINTY_DAYS),
  };
}

/**
 * Every Gregorian year a Hijri date falls in — usually once, occasionally twice.
 *
 * The lunar year is ~11 days shorter than the solar one, so an observance drifts
 * earlier each year and can land in January and again in December. Ramadan did
 * this in 2030 and will again. A function returning one date per year would
 * silently drop the second, which is the kind of bug nobody notices until a
 * player points at an empty month.
 */
export function hijriDatesInGregorianYear(
  gregorianYear: number,
  month: number,
  day: number,
): EstimatedDate[] {
  const hijriYear = jdnToHijri(civilToJdn(`${gregorianYear}-07-01`)).year;
  const found: EstimatedDate[] = [];

  for (const year of [hijriYear - 1, hijriYear, hijriYear + 1]) {
    const candidate = hijriToCivil({ year, month, day });
    if (candidate.expected.startsWith(String(gregorianYear))) found.push(candidate);
  }

  return found;
}
