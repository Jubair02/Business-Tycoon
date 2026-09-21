// ============================================
// Bangladesh Business Tycoon - Civil dates
// ============================================
//
// A calendar day, as people mean it: `2026-04-14`, not an instant. Everything
// in this folder works in these, because "is it Pohela Boishakh?" is a question
// about a date in Dhaka, not about a moment in UTC.
//
// Bangladesh is UTC+6 with no daylight saving — it ran DST for a few months in
// 2009 and has not since — so a fixed offset is correct here rather than lazy.
// The same constant backs the analytics day buckets.

/** Bangladesh Standard Time. UTC+6, no DST. */
export const DHAKA_OFFSET_MINUTES = 6 * 60;

/** `YYYY-MM-DD`. */
export type CivilDate = string;

const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCivilDate(value: unknown): value is CivilDate {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  // Rejects 2026-02-30 and 2026-13-01, which the regex alone would accept.
  // `Date` gives NaN for those, and `toISOString` throws on NaN rather than
  // returning anything a comparison could reject — so the guard is explicit.
  const parsed = fromCivilDate(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

/** The calendar day an instant falls on, in Dhaka. */
export function toCivilDate(at: Date, offsetMinutes = DHAKA_OFFSET_MINUTES): CivilDate {
  return new Date(at.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

/**
 * Midnight Dhaka on a civil date, as an instant.
 *
 * Used for formatting only. Nothing in this folder does arithmetic on the
 * result — days are counted with `addDays`, which cannot drift.
 */
export function fromCivilDate(day: CivilDate): Date {
  return new Date(`${day}T00:00:00Z`);
}

export interface CivilParts {
  year: number;
  /** 1-12. */
  month: number;
  /** 1-31. */
  day: number;
}

export function partsOf(day: CivilDate): CivilParts {
  const match = ISO_DATE.exec(day);
  if (!match) return { year: NaN, month: NaN, day: NaN };
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function civilDateOf({ year, month, day }: CivilParts): CivilDate {
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  // The year is padded too: the Hijri epoch converts to 622 CE, and `622-07-19`
  // is not a date any parser here accepts.
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** `YYYY-MM-DD` plus N days. Returns the input unchanged if it is malformed. */
export function addDays(day: CivilDate, count: number): CivilDate {
  const base = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(base)) return day;
  return new Date(base + count * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from one civil date to another. Negative when `to` is earlier. */
export function daysBetween(from: CivilDate, to: CivilDate): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / DAY_MS);
}

export function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInGregorianYear(year: number): number {
  return isGregorianLeapYear(year) ? 366 : 365;
}

/** 0 = Sunday. */
export function weekdayOf(day: CivilDate): number {
  return fromCivilDate(day).getUTCDay();
}

// ============================================
// Julian Day Numbers
// ============================================
//
// The common currency between calendars. Converting Hijri to Gregorian directly
// is a mess of special cases; converting each to a day count and subtracting is
// not. These are the standard integer-arithmetic conversions — no floating
// point, so they cannot drift for any year the game will ever see.

export function civilToJdn(day: CivilDate): number {
  const { year, month, day: d } = partsOf(day);
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    d +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

export function jdnToCivil(jdn: number): CivilDate {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);

  return civilDateOf({
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: 100 * b + d - 4800 + Math.floor(m / 10),
  });
}
