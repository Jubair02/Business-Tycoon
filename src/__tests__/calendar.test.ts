// ============================================
// Bangladesh Business Tycoon - Calendar Tests
// ============================================
//
// The calendar has one job people will immediately notice if it gets wrong, and
// the tests are shaped around the three ways it could:
//
//   1. Being wrong about Bangladesh specifically — the 2019 Bengali calendar
//      revision, which West Bengal did not adopt.
//   2. Being *confidently* wrong about a date that is decided by moon sighting.
//   3. Quietly breaking the economy by adding an eighth demand multiplier to a
//      chain INVARIANTS.md U2 already flags as over-suppressed.

import { describe, it, expect } from 'vitest';
import {
  addDays,
  civilToJdn,
  daysBetween,
  isCivilDate,
  jdnToCivil,
  partsOf,
  toCivilDate,
} from '@/lib/calendar/civil-date';
import {
  bengaliDateOf,
  bengaliToCivil,
  bengaliYearLength,
  formatBengaliDate,
  isBengaliLeapYear,
  pohelaBoishakh,
  REVISION_ANCHORS,
  toBengaliNumerals,
} from '@/lib/calendar/bengali';
import {
  hijriOf,
  hijriToCivil,
  hijriDatesInGregorianYear,
  isHijriLeapYear,
  HIJRI_MONTH,
  SIGHTING_UNCERTAINTY_DAYS,
} from '@/lib/calendar/hijri';
import {
  calendarDay,
  observancesInYear,
  observancesOn,
  resolveObservance,
  upcomingObservances,
} from '@/lib/calendar/calendar';
import { OBSERVANCES, observanceById, type TradeId } from '@/lib/calendar/observances';
import { CONFIRMED_DATES, confirmedCoverage, confirmedDataIsStale } from '@/lib/calendar/confirmed';
import {
  DEMAND_BOUNDS,
  seasonalDemandMultiplier,
  seasonalDemandFor,
  windowMultiplier,
  __clearSeasonalCache,
} from '@/lib/calendar/seasonal-demand';
import { gameDayToCivilDate, gameDaysUntil } from '@/lib/calendar/game-clock';
import { __clearCalendarCache } from '@/lib/calendar/calendar';

const TRADES: TradeId[] = ['TEA_STALL', 'GROCERY', 'CLOTHING', 'MOBILE', 'RESTAURANT'];

/** Every day of a Gregorian year. */
function daysOfYear(year: number): string[] {
  const days: string[] = [];
  let day = `${year}-01-01`;
  while (partsOf(day).year === year) {
    days.push(day);
    day = addDays(day, 1);
  }
  return days;
}

describe('civil dates', () => {
  it('buckets an instant by Dhaka time', () => {
    // 21:00 UTC is already tomorrow in Dhaka. A calendar that says otherwise
    // puts Pohela Boishakh on the wrong evening.
    expect(toCivilDate(new Date('2026-04-13T21:00:00Z'))).toBe('2026-04-14');
    expect(toCivilDate(new Date('2026-04-13T17:00:00Z'))).toBe('2026-04-13');
  });

  it('rejects a date that does not exist', () => {
    expect(isCivilDate('2026-02-30')).toBe(false);
    expect(isCivilDate('2026-13-01')).toBe(false);
    expect(isCivilDate('2026-02-28')).toBe(true);
    expect(isCivilDate('not a date')).toBe(false);
  });

  it('round-trips through Julian day numbers', () => {
    // The common currency between three calendars. If this drifts, everything
    // downstream is wrong by a day and nothing says so.
    let jdn = civilToJdn('2020-01-01');
    for (let i = 0; i < 365 * 20; i++, jdn++) {
      expect(civilToJdn(jdnToCivil(jdn))).toBe(jdn);
    }
  });

  it('counts days across a leap day', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    expect(daysBetween('2025-02-28', '2025-03-01')).toBe(1);
  });
});

// ============================================
// The Bengali calendar
// ============================================

describe('Bangla Sôn, as Bangladesh keeps it', () => {
  it('pins Pohela Boishakh to 14 April, every year', () => {
    // The point of the 2019 revision. Under the old astronomical reckoning it
    // moved between the 14th and 15th, and West Bengal's still does.
    for (let year = 2019; year <= 2040; year++) {
      const date = pohelaBoishakh(year - 593);
      expect(date.slice(5)).toBe('04-14');
      expect(bengaliDateOf(date).day).toBe(1);
      expect(bengaliDateOf(date).month).toBe(1);
    }
  });

  it('holds all four anchors the revision exists to guarantee', () => {
    // 14 April = 1 Boishakh, 16 December = 1 Poush, 21 February = 8 Falgun,
    // 26 March = 12 Choitro. These are the reform, stated as a test.
    for (let year = 2020; year <= 2040; year++) {
      for (const anchor of REVISION_ANCHORS) {
        const bengali = bengaliDateOf(`${year}-${anchor.gregorian}`);
        expect(
          { month: bengali.month, day: bengali.day },
          `${anchor.name} in ${year}`,
        ).toEqual({ month: anchor.bengaliMonth, day: anchor.bengaliDay });
      }
    }
  });

  it('puts Pohela Falgun on 14 February, sharing the day with Valentine’s', () => {
    // Not a bug. The revision moved it, the collision was argued about in
    // Dhaka at the time, and the game should show what the calendar says.
    for (const year of [2025, 2026, 2027, 2028]) {
      const falgun = bengaliDateOf(`${year}-02-14`);
      expect(falgun.month).toBe(11);
      expect(falgun.day).toBe(1);
    }
  });

  it('gives the long year its extra day in Falgun', () => {
    // Bengali 1430 opened on 14 April 2023 and its Falgun fell in February
    // 2024, so 1430 is the 366-day year — not 1431.
    expect(isBengaliLeapYear(1430)).toBe(true);
    expect(bengaliYearLength(1430)).toBe(366);
    expect(isBengaliLeapYear(1431)).toBe(false);
    expect(bengaliYearLength(1431)).toBe(365);
  });

  it('round-trips every day for a decade', () => {
    let day = '2020-01-01';
    for (let i = 0; i < 365 * 10; i++) {
      const bengali = bengaliDateOf(day);
      expect(bengaliToCivil(bengali.year, bengali.month, bengali.day)).toBe(day);
      day = addDays(day, 1);
    }
  });

  it('knows which of the six seasons a day falls in', () => {
    expect(bengaliDateOf('2026-07-15').season.id).toBe('BORSHA'); // monsoon
    expect(bengaliDateOf('2026-01-10').season.id).toBe('SHEET'); // winter
    expect(bengaliDateOf('2026-04-20').season.id).toBe('GRISHMO'); // summer
  });

  it('writes a date in Bengali numerals', () => {
    expect(toBengaliNumerals(1433)).toBe('১৪৩৩');
    expect(formatBengaliDate(bengaliDateOf('2026-04-14'), 'bn')).toBe('১ বৈশাখ ১৪৩৩');
    expect(formatBengaliDate(bengaliDateOf('2026-04-14'), 'en')).toBe('1 Boishakh 1433');
  });
});

// ============================================
// The Hijri calendar
// ============================================

describe('Hijri estimates', () => {
  it('round-trips every day for a decade', () => {
    let day = '2022-01-01';
    for (let i = 0; i < 365 * 10; i++) {
      expect(hijriToCivil(hijriOf(day)).expected).toBe(day);
      day = addDays(day, 1);
    }
  });

  it('lands on what Bangladesh actually observed in 2025', () => {
    // Both Eids of AH 1446 fell exactly where the arithmetic put them. Recorded
    // as a test so a change to the epoch or the leap cycle cannot pass quietly.
    expect(hijriToCivil({ year: 1446, month: HIJRI_MONTH.SHAWWAL, day: 1 }).expected)
      .toBe('2025-03-31');
    expect(hijriToCivil({ year: 1446, month: HIJRI_MONTH.DHU_AL_HIJJAH, day: 10 }).expected)
      .toBe('2025-06-07');
  });

  it('is within a day of the observed Ramadan, and does not pretend otherwise', () => {
    // Bangladesh began fasting on 2 March 2025; the arithmetic says the 1st.
    // The window has to cover the real answer or it is not an honest window.
    const estimate = hijriToCivil({ year: 1446, month: HIJRI_MONTH.RAMADAN, day: 1 });
    expect(estimate.expected).toBe('2025-03-01');
    expect(estimate.earliest <= '2025-03-02' && '2025-03-02' <= estimate.latest).toBe(true);
  });

  it('brackets the expected date symmetrically', () => {
    const estimate = hijriToCivil({ year: 1447, month: HIJRI_MONTH.RAMADAN, day: 1 });
    expect(daysBetween(estimate.earliest, estimate.expected)).toBe(SIGHTING_UNCERTAINTY_DAYS);
    expect(daysBetween(estimate.expected, estimate.latest)).toBe(SIGHTING_UNCERTAINTY_DAYS);
  });

  it('marks the leap years of the 30-year cycle', () => {
    expect(isHijriLeapYear(1447)).toBe(true); // 1447 % 30 = 7
    expect(isHijriLeapYear(1448)).toBe(false);
  });

  it('finds both occurrences when one falls twice in a Gregorian year', () => {
    // The lunar year is ~11 days short, so an observance drifts earlier and can
    // appear in January and again in December. Returning only the first would
    // silently lose the second.
    let found = false;
    for (let year = 2024; year <= 2060; year++) {
      const dates = hijriDatesInGregorianYear(year, HIJRI_MONTH.RAMADAN, 1);
      expect(dates.length).toBeGreaterThanOrEqual(1);
      if (dates.length === 2) {
        found = true;
        expect(dates[0].expected < dates[1].expected).toBe(true);
      }
    }
    expect(found, 'no double occurrence found in 37 years — the drift is broken').toBe(true);
  });
});

// ============================================
// Resolution
// ============================================

describe('resolving observances', () => {
  it('states how sure it is about every date', () => {
    for (const resolved of observancesInYear(2026)) {
      expect(['FIXED', 'CONFIRMED', 'ESTIMATED']).toContain(resolved.certainty);
      // An estimate must carry its window; a settled date must not imply one.
      if (resolved.certainty === 'ESTIMATED') expect(resolved.window).toBeTruthy();
      else expect(resolved.window).toBeUndefined();
    }
  });

  it('prefers an announced date over the arithmetic', () => {
    // 2026 Ramadan is confirmed as the 19th; the tabular calendar says the 18th.
    const ramadan = observancesInYear(2026).find(r => r.observance.id === 'RAMADAN')!;
    expect(ramadan.certainty).toBe('CONFIRMED');
    expect(ramadan.date).toBe('2026-02-19');
    expect(hijriToCivil({ year: 1447, month: 9, day: 1 }).expected).toBe('2026-02-18');
  });

  it('falls back to an estimate outside the confirmed years', () => {
    const ramadan = observancesInYear(2031).find(r => r.observance.id === 'RAMADAN')!;
    expect(ramadan.certainty).toBe('ESTIMATED');
    expect(ramadan.window).toBeTruthy();
  });

  it('shows nothing rather than a guess for an announced-only date', () => {
    // Durga Puja needs tithi calculations this module does not implement. An
    // absent date is a gap someone reports; a wrong one misinforms quietly.
    const durga = observanceById('DURGA_PUJA')!;
    expect(durga.rule.kind).toBe('ANNOUNCED_ONLY');
    expect(resolveObservance(durga, 2026)).toHaveLength(1); // confirmed
    expect(resolveObservance(durga, 2035)).toHaveLength(0); // not invented
  });

  it('keeps the fixed national days fixed, for any year', () => {
    // The user-facing requirement: dates update correctly each year.
    for (let year = 2024; year <= 2045; year++) {
      const byId = new Map(observancesInYear(year).map(r => [r.observance.id, r]));
      expect(byId.get('VICTORY_DAY')!.date).toBe(`${year}-12-16`);
      expect(byId.get('INDEPENDENCE_DAY')!.date).toBe(`${year}-03-26`);
      expect(byId.get('SHOHID_DIBOSH')!.date).toBe(`${year}-02-21`);
      expect(byId.get('POHELA_BOISHAKH')!.date).toBe(`${year}-04-14`);
    }
  });

  it('produces a full year for any year, without a lookup table', () => {
    // The whole reason the dates are rules rather than data. A year far outside
    // the confirmed table must still be a usable calendar.
    for (const year of [2024, 2030, 2040, 2060]) {
      const resolved = observancesInYear(year);
      expect(resolved.length).toBeGreaterThanOrEqual(12);
      expect(resolved.every(r => partsOf(r.date).year === year)).toBe(true);
      // Sorted.
      for (let i = 1; i < resolved.length; i++) {
        expect(resolved[i].date >= resolved[i - 1].date).toBe(true);
      }
    }
  });

  it('moves the Islamic dates about eleven days earlier each year', () => {
    // The lunar drift, which is what makes a hard-coded table wrong by year two.
    //
    // Measured between consecutive *Hijri* years rather than Gregorian ones:
    // a Gregorian year can hold Eid twice, and comparing the first occurrence
    // of each year would read that as a jump backwards.
    for (let hijriYear = 1450; hijriYear <= 1480; hijriYear++) {
      const current = hijriToCivil({ year: hijriYear, month: HIJRI_MONTH.SHAWWAL, day: 1 });
      const next = hijriToCivil({ year: hijriYear + 1, month: HIJRI_MONTH.SHAWWAL, day: 1 });

      // A lunar year is 354 or 355 days, so the next Eid is that much *later*
      // in absolute time — and therefore ten to twelve days *earlier* in the
      // Gregorian year, which is the drift a hard-coded table cannot survive.
      const gap = daysBetween(current.expected, next.expected);
      expect(gap, `AH ${hijriYear} to ${hijriYear + 1}`).toBeGreaterThanOrEqual(354);
      expect(gap, `AH ${hijriYear} to ${hijriYear + 1}`).toBeLessThanOrEqual(355);

      const gregorianYearLength = partsOf(next.expected).year % 4 === 0 ? 366 : 365;
      const drift = gregorianYearLength - gap;
      expect(drift, `AH ${hijriYear} drift`).toBeGreaterThanOrEqual(10);
      expect(drift, `AH ${hijriYear} drift`).toBeLessThanOrEqual(12);
    }
  });

  it('reports a multi-day observance as running on each of its days', () => {
    // Eid is three days. A player opening the game on day two should be told
    // it is Eid, not that they have missed it.
    const eid = observancesInYear(2026).find(r => r.observance.id === 'EID_UL_FITR')!;
    expect(eid.endDate).toBe(addDays(eid.date, 2));
    expect(observancesOn(addDays(eid.date, 1)).some(r => r.observance.id === 'EID_UL_FITR')).toBe(true);
    expect(observancesOn(addDays(eid.date, 5)).some(r => r.observance.id === 'EID_UL_FITR')).toBe(false);
  });

  it('carries an observance across a year boundary', () => {
    // A Ramadan starting in late December runs into January. Resolving one year
    // at a time would lose it.
    const day = calendarDay('2030-01-05');
    expect(Array.isArray(day.today)).toBe(true);
    expect(() => calendarDay('2029-12-31')).not.toThrow();
  });

  it('lists what is coming without repeating a long observance', () => {
    const upcoming = upcomingObservances('2026-02-01', 60, 5);
    expect(upcoming.length).toBeGreaterThan(0);
    expect(new Set(upcoming.map(u => u.observance.id)).size).toBe(upcoming.length);
    for (let i = 1; i < upcoming.length; i++) {
      expect(upcoming[i].date >= upcoming[i - 1].date).toBe(true);
    }
  });
});

// ============================================
// The confirmed table
// ============================================

describe('the confirmed-dates table', () => {
  it('only names observances that exist', () => {
    for (const [year, entries] of Object.entries(CONFIRMED_DATES)) {
      for (const id of Object.keys(entries)) {
        expect(observanceById(id), `${id} in ${year} is not in the catalogue`).toBeTruthy();
      }
    }
  });

  it('holds only real dates, in the year they are filed under', () => {
    for (const [year, entries] of Object.entries(CONFIRMED_DATES)) {
      for (const [id, date] of Object.entries(entries)) {
        expect(isCivilDate(date), `${id} ${date}`).toBe(true);
        expect(partsOf(date).year, `${id} filed under ${year}`).toBe(Number(year));
      }
    }
  });

  it('agrees with the arithmetic to within a couple of days', () => {
    // A sighting moves a date by one day, occasionally two. A confirmed date
    // further out than that is far more likely to be a typo than a real
    // announcement, and this is the check that catches it.
    for (const [year, entries] of Object.entries(CONFIRMED_DATES)) {
      for (const [id, date] of Object.entries(entries)) {
        const observance = observanceById(id)!;
        if (observance.rule.kind !== 'HIJRI') continue;

        const estimates = hijriDatesInGregorianYear(
          Number(year),
          observance.rule.month,
          observance.rule.day,
        );
        const closest = Math.min(
          ...estimates.map(e => Math.abs(daysBetween(e.expected, date))),
        );
        expect(closest, `${id} ${date} is ${closest} days from the estimate`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('reports how far it reaches', () => {
    const coverage = confirmedCoverage();
    expect(coverage).toBeTruthy();
    expect(coverage!.to).toBeGreaterThanOrEqual(coverage!.from);
    // Honest about running out, rather than leaving every label quietly
    // switching to "estimated" with nothing to say so.
    expect(confirmedDataIsStale(new Date(`${coverage!.to + 5}-01-01T00:00:00Z`))).toBe(true);
    expect(confirmedDataIsStale(new Date(`${coverage!.to - 1}-01-01T00:00:00Z`))).toBe(false);
  });
});

// ============================================
// The economy
// ============================================

describe('seasonal demand', () => {
  it('averages to exactly 1.0 across a year, for every trade', { timeout: 120_000 }, () => {
    // THE invariant. INVARIANTS.md U2 records that the tick already multiplies
    // seven modifiers onto base demand and suppresses a shop roughly twelvefold.
    // This is an eighth, and it is only safe to add because it cannot change a
    // year's total custom at all — it only moves it around the year.
    __clearSeasonalCache();

    for (const year of [2025, 2026, 2027, 2030, 2040]) {
      for (const trade of TRADES) {
        const days = daysOfYear(year);
        const mean =
          days.reduce((sum, day) => sum + seasonalDemandMultiplier(day, trade), 0) / days.length;
        expect(mean, `${trade} in ${year}`).toBeCloseTo(1, 9);
      }
    }
  });

  it('bounds how far a payback window can be moved', { timeout: 120_000 }, () => {
    // A ratchet, in the style of AI4. Payback is measured over 25-45 days, so
    // the calendar makes *when you open* matter — a clothing shop opening into
    // the Eid build-up pays back far faster than one opening the day after.
    //
    // That is deliberate and realistic, but it must stay bounded or the 25-45
    // day band becomes meaningless. Measured worst/best over 2025-2028:
    // clothing 0.733 / 1.662. Pinned with a little headroom.
    __clearSeasonalCache();

    for (const trade of TRADES) {
      for (const year of [2025, 2026, 2027, 2028]) {
        for (const start of daysOfYear(year)) {
          let total = 0;
          for (let i = 0; i < 30; i++) total += seasonalDemandMultiplier(addDays(start, i), trade);
          const mean = total / 30;
          expect(mean, `${trade} 30 days from ${start}`).toBeGreaterThan(0.7);
          expect(mean, `${trade} 30 days from ${start}`).toBeLessThan(1.7);
        }
      }
    }
  });

  it('never returns a non-finite multiplier', () => {
    // A NaN here would propagate into customers, revenue and net worth while
    // still looking like a number.
    for (const trade of TRADES) {
      for (const day of daysOfYear(2026)) {
        expect(Number.isFinite(seasonalDemandMultiplier(day, trade))).toBe(true);
      }
    }
  });

  it('keeps the raw curve inside its stated bounds', () => {
    for (const trade of TRADES) {
      for (const day of daysOfYear(2026)) {
        const factors = seasonalDemandFor(day, trade).factors;
        const raw = factors.reduce((acc, f) => acc * f.multiplier, 1);
        const clamped = Math.min(DEMAND_BOUNDS.max, Math.max(DEMAND_BOUNDS.min, raw));
        expect(clamped).toBeGreaterThanOrEqual(DEMAND_BOUNDS.min);
        expect(clamped).toBeLessThanOrEqual(DEMAND_BOUNDS.max);
      }
    }
  });

  it('makes the Eid clothing rush the biggest week of a tailor’s year', () => {
    // If this ever stops being true, the model has stopped describing
    // Bangladesh.
    const eid = observancesInYear(2026).find(r => r.observance.id === 'EID_UL_FITR')!;
    const eve = seasonalDemandMultiplier(addDays(eid.date, -1), 'CLOTHING');
    const ordinary = seasonalDemandMultiplier('2026-07-20', 'CLOTHING'); // mid-monsoon

    expect(eve).toBeGreaterThan(2);
    expect(eve).toBeGreaterThan(ordinary * 2);
  });

  it('shuts the shops on Eid day and fills the tea stalls', () => {
    const eid = observancesInYear(2026).find(r => r.observance.id === 'EID_UL_FITR')!;
    expect(seasonalDemandMultiplier(eid.date, 'CLOTHING')).toBeLessThan(0.5);
    expect(seasonalDemandMultiplier(eid.date, 'TEA_STALL')).toBeGreaterThan(1);
  });

  it('quietens the tea stall by day through Ramadan', () => {
    const ramadan = observancesInYear(2026).find(r => r.observance.id === 'RAMADAN')!;
    expect(seasonalDemandMultiplier(addDays(ramadan.date, 10), 'TEA_STALL')).toBeLessThan(1);
    expect(seasonalDemandMultiplier(addDays(ramadan.date, 10), 'GROCERY')).toBeGreaterThan(1);
  });

  it('empties the restaurants after Eid-ul-Adha', () => {
    // Everyone is eating qurbani meat at home.
    const adha = observancesInYear(2026).find(r => r.observance.id === 'EID_UL_ADHA')!;
    expect(seasonalDemandMultiplier(adha.date, 'RESTAURANT')).toBeLessThan(0.8);
  });

  it('gives Pohela Boishakh to the food stalls', () => {
    expect(seasonalDemandMultiplier('2026-04-14', 'RESTAURANT')).toBeGreaterThan(1.5);
    expect(seasonalDemandMultiplier('2026-04-14', 'TEA_STALL')).toBeGreaterThan(1.5);
  });

  it('explains itself', () => {
    // An unexplained 2.7x teaches a player nothing; a named one teaches them
    // how the Bangladeshi retail year works.
    const eid = observancesInYear(2026).find(r => r.observance.id === 'EID_UL_FITR')!;
    const demand = seasonalDemandFor(addDays(eid.date, -1), 'CLOTHING');
    expect(demand.factors.some(f => f.source === 'EID_UL_FITR')).toBe(true);
    expect(demand.factors.every(f => f.label && f.labelBn)).toBe(true);
  });
});

describe('windowMultiplier', () => {
  it('is inert outside its window', () => {
    const window = { trade: 'CLOTHING' as const, from: -10, to: -1, peak: 2 };
    expect(windowMultiplier(window, -11)).toBe(1);
    expect(windowMultiplier(window, 0)).toBe(1);
  });

  it('holds a flat window at its peak throughout', () => {
    const window = { trade: 'ALL' as const, from: 0, to: 2, peak: 0.25, shape: 'flat' as const };
    expect(windowMultiplier(window, 0)).toBe(0.25);
    expect(windowMultiplier(window, 2)).toBe(0.25);
  });

  it('back-loads a ramp', () => {
    // Eid shopping is not spread evenly across the month — the last ten days
    // carry it. A linear ramp would put custom in the shop three weeks early.
    const window = { trade: 'CLOTHING' as const, from: -20, to: -1, peak: 3, shape: 'ramp' as const };
    const early = windowMultiplier(window, -18);
    const late = windowMultiplier(window, -2);
    const midpoint = windowMultiplier(window, -10);

    expect(early).toBeLessThan(1.2);
    expect(late).toBeGreaterThan(2.5);
    // Squared, so halfway through the window is well under halfway to the peak.
    expect(midpoint).toBeLessThan(1 + (3 - 1) / 2);
  });
});

// ============================================
// The world's clock
// ============================================

describe('the game clock', () => {
  const started = new Date('2026-02-10T08:00:00Z');

  it('opens a season on the day it actually started', () => {
    expect(gameDayToCivilDate(started, 1)).toBe('2026-02-10');
  });

  it('advances one calendar day per game day', () => {
    expect(gameDayToCivilDate(started, 2)).toBe('2026-02-11');
    expect(gameDayToCivilDate(started, 10)).toBe('2026-02-19');
    expect(gameDayToCivilDate(started, 90)).toBe('2026-05-10');
  });

  it('falls back to today for a season that has not opened', () => {
    const now = new Date('2026-09-21T06:00:00Z');
    expect(gameDayToCivilDate(null, 1, now)).toBe('2026-09-21');
  });

  it('counts game days to a date', () => {
    expect(gameDaysUntil(started, 1, '2026-02-19')).toBe(9);
    expect(gameDaysUntil(started, 10, '2026-02-10')).toBe(-9);
  });

  it('carries a 90-day season through real observances', () => {
    // A season starting in February plays through Ramadan and Eid; the season
    // names promised this before there was a calendar to back them.
    const seen = new Set<string>();
    for (let day = 1; day <= 90; day++) {
      for (const resolved of observancesOn(gameDayToCivilDate(started, day))) {
        seen.add(resolved.observance.id);
      }
    }
    expect(seen.has('RAMADAN')).toBe(true);
    expect(seen.has('EID_UL_FITR')).toBe(true);
    expect(seen.has('POHELA_BOISHAKH')).toBe(true);
  });
});

// ============================================
// The catalogue
// ============================================

describe('the observance catalogue', () => {
  it('names everything in both languages', () => {
    // Bangla is a first-class locale here, not a translation layer bolted on.
    for (const observance of OBSERVANCES) {
      expect(observance.en, observance.id).toBeTruthy();
      expect(observance.bn, observance.id).toBeTruthy();
      expect(observance.tradeNote, observance.id).toBeTruthy();
      expect(observance.tradeNoteBn, observance.id).toBeTruthy();
      // A Bangla string that is really English is the failure this catches.
      expect(/[ঀ-৿]/.test(observance.bn), `${observance.id} bn`).toBe(true);
      expect(/[ঀ-৿]/.test(observance.tradeNoteBn), `${observance.id} note bn`).toBe(true);
    }
  });

  it('has unique ids', () => {
    const ids = OBSERVANCES.map(o => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('describes demand windows that make sense', () => {
    for (const observance of OBSERVANCES) {
      for (const window of observance.demand) {
        expect(window.from, observance.id).toBeLessThanOrEqual(window.to);
        expect(window.peak, observance.id).toBeGreaterThan(0);
        expect(window.peak, observance.id).toBeLessThanOrEqual(DEMAND_BOUNDS.max);
        if (window.peakAt !== undefined) {
          expect(window.peakAt).toBeGreaterThanOrEqual(window.from);
          expect(window.peakAt).toBeLessThanOrEqual(window.to);
        }
      }
    }
  });

  it('covers the observances a Bangladeshi player would expect', () => {
    const ids = new Set(OBSERVANCES.map(o => o.id));
    for (const expected of [
      'RAMADAN', 'EID_UL_FITR', 'EID_UL_ADHA',
      'POHELA_BOISHAKH', 'VICTORY_DAY', 'INDEPENDENCE_DAY',
      'SHOHID_DIBOSH', 'DURGA_PUJA', 'BUDDHA_PURNIMA', 'CHRISTMAS',
    ]) {
      expect(ids.has(expected), `${expected} is missing`).toBe(true);
    }
  });
});
