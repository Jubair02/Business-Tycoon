// ============================================
// The Bangladeshi calendar
// GET /api/calendar        — the world's date, what is on, what is coming
// GET /api/calendar?year=  — a full year, for the calendar screen
// ============================================
//
// Open to anyone signed in or not: the calendar is public information about
// Bangladesh, and the welcome screen shows it before an account exists.
//
// Every date carries its `certainty`. The client is expected to render it —
// see the note at the top of `lib/calendar/observances.ts` for why an estimated
// Eid date set in the same type as Victory Day is a lie by omission.

import { NextResponse, type NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { getActiveSeason } from '@/lib/game/seasons/seasons';
import {
  calendarDay,
  observancesInYear,
  todayInDhaka,
  type ResolvedObservance,
} from '@/lib/calendar/calendar';
import { gameDayToCivilDate } from '@/lib/calendar/game-clock';
import { bengaliDateOf, formatBengaliDate } from '@/lib/calendar/bengali';
import { seasonalDemandFor } from '@/lib/calendar/seasonal-demand';
import { confirmedCoverage, confirmedDataIsStale } from '@/lib/calendar/confirmed';
import { daysBetween, partsOf, type CivilDate } from '@/lib/calendar/civil-date';
import type { TradeId } from '@/lib/calendar/observances';

const TRADES: TradeId[] = ['TEA_STALL', 'GROCERY', 'CLOTHING', 'MOBILE', 'RESTAURANT'];

/**
 * How far either side of the current year the screen may look.
 *
 * Bounded so a request for year 999999 cannot ask the resolver to walk an
 * absurd range, but wide enough to be a calendar rather than a teaser — a
 * player looking a decade ahead to see where Eid lands is a reasonable thing
 * to want, and every one of those years resolves from rules alone.
 */
const YEAR_RANGE = 20;

function serialise(resolved: ResolvedObservance, today: CivilDate) {
  const { observance } = resolved;
  return {
    id: observance.id,
    en: observance.en,
    bn: observance.bn,
    kind: observance.kind,
    date: resolved.date,
    endDate: resolved.endDate,
    certainty: resolved.certainty,
    window: resolved.window ?? null,
    publicHoliday: observance.publicHoliday,
    spanDays: observance.spanDays ?? 1,
    tradeNote: observance.tradeNote,
    tradeNoteBn: observance.tradeNoteBn,
    daysAway: daysBetween(today, resolved.date),
    /** Which trades it moves, and by how much at its strongest. */
    peaks: TRADES.map(trade => {
      const windows = observance.demand.filter(w => w.trade === 'ALL' || w.trade === trade);
      if (windows.length === 0) return null;
      const strongest = windows.reduce((best, w) =>
        Math.abs(w.peak - 1) > Math.abs(best.peak - 1) ? w : best,
      );
      return { trade, peak: strongest.peak };
    }).filter((p): p is { trade: TradeId; peak: number } => p !== null),
  };
}

function bengaliPayload(date: CivilDate) {
  const bengali = bengaliDateOf(date);
  return {
    day: bengali.day,
    month: bengali.month,
    year: bengali.year,
    monthEn: bengali.monthName.en,
    monthBn: bengali.monthName.bn,
    formattedEn: formatBengaliDate(bengali, 'en'),
    formattedBn: formatBengaliDate(bengali, 'bn'),
    season: {
      id: bengali.season.id,
      en: bengali.season.en,
      bn: bengali.season.bn,
      trade: bengali.season.trade,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const season = await getActiveSeason();
    const gameDay = season?.gameDay ?? 1;

    // The date *inside the game*, which is the one the economy runs on. The
    // real Dhaka date is sent alongside it because they are not the same thing
    // and the screen says so.
    const worldDate = gameDayToCivilDate(season?.startedAt, gameDay);
    const realDate = todayInDhaka();

    const day = calendarDay(worldDate);
    const coverage = confirmedCoverage();

    const requestedYear = Number(new URL(request.url).searchParams.get('year'));
    const thisYear = partsOf(worldDate).year;
    const year = Number.isFinite(requestedYear)
      ? Math.min(thisYear + YEAR_RANGE, Math.max(thisYear - YEAR_RANGE, Math.trunc(requestedYear)))
      : thisYear;

    return NextResponse.json({
      world: {
        date: worldDate,
        gameDay,
        seasonNumber: season?.number ?? null,
        seasonName: season?.name ?? null,
        bengali: bengaliPayload(worldDate),
      },
      real: { date: realDate, bengali: bengaliPayload(realDate) },

      today: day.today.map(r => serialise(r, worldDate)),
      upcoming: day.upcoming.map(r => serialise(r, worldDate)),
      daysToNext: day.daysToNext,

      /** What the calendar is doing to each trade today. */
      demand: Object.fromEntries(
        TRADES.map(trade => {
          const seasonal = seasonalDemandFor(worldDate, trade);
          return [
            trade,
            {
              multiplier: Number(seasonal.multiplier.toFixed(3)),
              factors: seasonal.factors.map(f => ({
                source: f.source,
                label: f.label,
                labelBn: f.labelBn,
                multiplier: Number(f.multiplier.toFixed(3)),
              })),
            },
          ];
        }),
      ),

      year: {
        year,
        canGoBack: year > thisYear - YEAR_RANGE,
        canGoForward: year < thisYear + YEAR_RANGE,
        observances: observancesInYear(year).map(r => serialise(r, worldDate)),
      },

      /**
       * How far the gazette table reaches. Sent so the screen can say "dates
       * after 2026 are estimates" instead of leaving the player to assume they
       * are not.
       */
      coverage: coverage ? { ...coverage, stale: confirmedDataIsStale() } : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
