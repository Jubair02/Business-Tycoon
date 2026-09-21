// ============================================
// Bangladesh Business Tycoon - Bangla Sôn
// ============================================
//
// The Bengali calendar **as Bangladesh keeps it**, which since 2019 is not the
// same calendar West Bengal keeps. Getting this right is the difference between
// a game set in Bangladesh and a game with Bangladeshi decoration.
//
// ---- The 2019 revision ----
//
// The Bangladesh Academy reformed the calendar so the national days fall on
// fixed Bengali dates every year, instead of sliding around as they did under
// the astronomical reckoning. Four anchors were the entire point of it:
//
//   14 April    = 1 Boishakh   (Pohela Boishakh, never the 15th)
//   16 December = 1 Poush      (Victory Day)
//   21 February = 8 Falgun     (Shohid Dibosh — "Amor Ekushey", 8ই ফাল্গুন)
//   26 March    = 12 Choitro   (Independence Day)
//
// Month lengths follow from those anchors rather than the other way round:
// Boishakh through Ashwin have 31 days, Kartik through Choitro have 30, and
// Falgun drops to 29 except in years where the February it contains has 29 —
// which is what keeps 1 Boishakh pinned to 14 April forever.
//
// A consequence worth knowing, because players will notice it: under this
// calendar Pohela Falgun lands on **14 February**, the same day as Valentine's
// Day. It used to be the 13th. That collision was argued about at length in
// Dhaka when the reform landed, and it is not a bug here.
//
// Every date below is derived from the anchors and the month lengths, so the
// calendar is correct for any year without a table to maintain.

import {
  addDays,
  civilToJdn,
  daysBetween,
  isGregorianLeapYear,
  jdnToCivil,
  partsOf,
  type CivilDate,
} from './civil-date';

/** Pohela Boishakh. Fixed by the revision, which is the whole point of it. */
export const BENGALI_NEW_YEAR_MONTH = 4;
export const BENGALI_NEW_YEAR_DAY = 14;

/**
 * Bengali year = Gregorian year − 593, for dates from 14 April onwards.
 *
 * 14 April 2026 opens 1433.
 */
export const BENGALI_YEAR_OFFSET = 593;

export interface BengaliMonth {
  /** 1-12. */
  number: number;
  en: string;
  bn: string;
  /** Which of the six seasons this month belongs to. */
  season: BengaliSeasonId;
}

export type BengaliSeasonId =
  | 'GRISHMO'
  | 'BORSHA'
  | 'SHARAT'
  | 'HEMANTA'
  | 'SHEET'
  | 'BOSONTO';

export const BENGALI_MONTHS: readonly BengaliMonth[] = [
  { number: 1, en: 'Boishakh', bn: 'বৈশাখ', season: 'GRISHMO' },
  { number: 2, en: 'Jyoishtho', bn: 'জ্যৈষ্ঠ', season: 'GRISHMO' },
  { number: 3, en: 'Asharh', bn: 'আষাঢ়', season: 'BORSHA' },
  { number: 4, en: 'Srabon', bn: 'শ্রাবণ', season: 'BORSHA' },
  { number: 5, en: 'Bhadro', bn: 'ভাদ্র', season: 'SHARAT' },
  { number: 6, en: 'Ashwin', bn: 'আশ্বিন', season: 'SHARAT' },
  { number: 7, en: 'Kartik', bn: 'কার্তিক', season: 'HEMANTA' },
  { number: 8, en: 'Ogrohayon', bn: 'অগ্রহায়ণ', season: 'HEMANTA' },
  { number: 9, en: 'Poush', bn: 'পৌষ', season: 'SHEET' },
  { number: 10, en: 'Magh', bn: 'মাঘ', season: 'SHEET' },
  { number: 11, en: 'Falgun', bn: 'ফাল্গুন', season: 'BOSONTO' },
  { number: 12, en: 'Choitro', bn: 'চৈত্র', season: 'BOSONTO' },
];

export interface BengaliSeason {
  id: BengaliSeasonId;
  en: string;
  bn: string;
  /** What it means for trade, in one line. */
  trade: string;
}

/**
 * The six ritu. Bangladesh divides the year into six seasons, not four, and a
 * shopkeeper's year genuinely runs on them — Borsha floods the streets and
 * empties them, Sheet is when warm clothing sells.
 */
export const BENGALI_SEASONS: Record<BengaliSeasonId, BengaliSeason> = {
  GRISHMO: { id: 'GRISHMO', en: 'Grishmo (Summer)', bn: 'গ্রীষ্ম', trade: 'Heat drives cold drinks and long shop hours.' },
  BORSHA: { id: 'BORSHA', en: 'Borsha (Monsoon)', bn: 'বর্ষা', trade: 'Rain keeps shoppers home; footfall falls.' },
  SHARAT: { id: 'SHARAT', en: 'Sharat (Autumn)', bn: 'শরৎ', trade: 'Clear weather and the run-up to Puja.' },
  HEMANTA: { id: 'HEMANTA', en: 'Hemanta (Late autumn)', bn: 'হেমন্ত', trade: 'Harvest money reaches the villages.' },
  SHEET: { id: 'SHEET', en: 'Sheet (Winter)', bn: 'শীত', trade: 'Wedding season, warm clothes, best trading weather.' },
  BOSONTO: { id: 'BOSONTO', en: 'Bosonto (Spring)', bn: 'বসন্ত', trade: 'Falgun colour and the new-year build-up.' },
};

/**
 * Whether a Bengali year carries 366 days.
 *
 * Falgun takes the extra day, and it takes it in the Gregorian year the Bengali
 * year *ends* in — Bengali 1430 opened on 14 April 2023 and its Falgun fell in
 * February 2024, so 1430 is the long one. Tying it to the following Gregorian
 * year is exactly what keeps 1 Boishakh on 14 April.
 */
export function isBengaliLeapYear(bengaliYear: number): boolean {
  return isGregorianLeapYear(bengaliYear + BENGALI_YEAR_OFFSET + 1);
}

export function bengaliMonthLength(bengaliYear: number, month: number): number {
  if (month >= 1 && month <= 6) return 31;
  if (month === 11) return isBengaliLeapYear(bengaliYear) ? 30 : 29;
  return 30;
}

export function bengaliYearLength(bengaliYear: number): number {
  return isBengaliLeapYear(bengaliYear) ? 366 : 365;
}

/** The Gregorian date Pohela Boishakh falls on. Always 14 April. */
export function pohelaBoishakh(bengaliYear: number): CivilDate {
  const gregorianYear = bengaliYear + BENGALI_YEAR_OFFSET;
  return `${String(gregorianYear).padStart(4, '0')}-04-14`;
}

export interface BengaliDate {
  year: number;
  /** 1-12. */
  month: number;
  /** 1-31. */
  day: number;
  monthName: BengaliMonth;
  season: BengaliSeason;
  /** 1-366. */
  dayOfYear: number;
}

/** The Bengali date for a Gregorian day. */
export function bengaliDateOf(day: CivilDate): BengaliDate {
  const { year: gregorianYear } = partsOf(day);

  // Before 14 April the Bengali year is still the previous one.
  let bengaliYear = gregorianYear - BENGALI_YEAR_OFFSET;
  if (civilToJdn(day) < civilToJdn(pohelaBoishakh(bengaliYear))) bengaliYear -= 1;

  const dayOfYear = daysBetween(pohelaBoishakh(bengaliYear), day) + 1;

  let month = 1;
  let remaining = dayOfYear;
  while (month < 12 && remaining > bengaliMonthLength(bengaliYear, month)) {
    remaining -= bengaliMonthLength(bengaliYear, month);
    month++;
  }

  const monthName = BENGALI_MONTHS[month - 1];
  return {
    year: bengaliYear,
    month,
    day: remaining,
    monthName,
    season: BENGALI_SEASONS[monthName.season],
    dayOfYear,
  };
}

/** The Gregorian date for a Bengali one. */
export function bengaliToCivil(bengaliYear: number, month: number, day: number): CivilDate {
  let offset = 0;
  for (let m = 1; m < month; m++) offset += bengaliMonthLength(bengaliYear, m);
  return addDays(pohelaBoishakh(bengaliYear), offset + day - 1);
}

/** Bengali numerals, for rendering a date the way it is written. */
const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliNumerals(value: number | string): string {
  return String(value).replace(/\d/g, digit => BENGALI_DIGITS[Number(digit)]);
}

/** `1 Boishakh 1433` / `১ বৈশাখ ১৪৩৩`. */
export function formatBengaliDate(date: BengaliDate, locale: 'en' | 'bn' = 'en'): string {
  if (locale === 'bn') {
    return `${toBengaliNumerals(date.day)} ${date.monthName.bn} ${toBengaliNumerals(date.year)}`;
  }
  return `${date.day} ${date.monthName.en} ${date.year}`;
}

/**
 * A Bengali date that recurs every year, resolved for a Gregorian year.
 *
 * Used by the observance catalogue for anything pinned to the Bengali calendar
 * — Pohela Falgun, Nabanna — so those roll forward on their own rules rather
 * than on a table.
 */
export function bengaliRecurrenceInGregorianYear(
  gregorianYear: number,
  month: number,
  day: number,
): CivilDate | null {
  for (const bengaliYear of [gregorianYear - BENGALI_YEAR_OFFSET - 1, gregorianYear - BENGALI_YEAR_OFFSET]) {
    const candidate = bengaliToCivil(bengaliYear, month, day);
    if (partsOf(candidate).year === gregorianYear) return candidate;
  }
  return null;
}

/** Exported for the test that pins the 2019 revision's four anchors. */
export const REVISION_ANCHORS = [
  { gregorian: '04-14', bengaliMonth: 1, bengaliDay: 1, name: 'Pohela Boishakh' },
  { gregorian: '12-16', bengaliMonth: 9, bengaliDay: 1, name: 'Victory Day' },
  { gregorian: '02-21', bengaliMonth: 11, bengaliDay: 8, name: 'Shohid Dibosh' },
  { gregorian: '03-26', bengaliMonth: 12, bengaliDay: 12, name: 'Independence Day' },
] as const;

export { jdnToCivil };
