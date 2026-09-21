'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, ChevronLeft, ChevronRight, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useCalendar } from '@/hooks/use-calendar';
import CertaintyBadge from './calendar/CertaintyBadge';
import type { CalendarObservance } from '@/lib/calendar/client-store';
import type { ObservanceKind } from '@/lib/calendar/observances';

const KIND_TONE: Record<ObservanceKind, string> = {
  NATIONAL: 'bt-tone-crimson',
  ISLAMIC: 'bt-tone-emerald',
  HINDU: 'bt-tone-amber',
  BUDDHIST: 'bt-tone-gold',
  CHRISTIAN: 'bt-tone-violet',
  CULTURAL: 'bt-tone-sky',
  SEASONAL: 'bt-tone-slate',
};

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_BN = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];

function monthOf(date: string): number {
  return Number(date.slice(5, 7)) - 1;
}

/**
 * The Bangladeshi year, as a shopkeeper sees it.
 *
 * Grouped by Gregorian month because that is how a player plans, with the
 * Bengali date and season alongside. Every religious date carries its certainty
 * — see `CertaintyBadge`.
 */
export default function CalendarView() {
  const { t, locale, n } = useI18n();
  const [year, setYear] = useState<number | undefined>(undefined);
  const calendar = useCalendar(year);

  if (!calendar) {
    return (
      <div className="space-y-3 px-3 py-4 md:px-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const { world, year: yearData, coverage } = calendar;
  const bengali = locale === 'bn' ? world.bengali.formattedBn : world.bengali.formattedEn;
  const months = locale === 'bn' ? MONTHS_BN : MONTHS_EN;

  const name = (o: CalendarObservance) => (locale === 'bn' ? o.bn : o.en);
  const note = (o: CalendarObservance) => (locale === 'bn' ? o.tradeNoteBn : o.tradeNote);

  const byMonth = new Map<number, CalendarObservance[]>();
  for (const observance of yearData.observances) {
    const month = monthOf(observance.date);
    byMonth.set(month, [...(byMonth.get(month) ?? []), observance]);
  }

  return (
    <div className="space-y-3 px-3 py-4 md:px-4">
      {/* ---- Where the world is today ---- */}
      <Card className="game-gradient-card overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="bt-tone bt-tone-emerald mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold">{t('calendar.title')}</h1>
              <p className="text-xs text-muted-foreground">{t('calendar.subtitle')}</p>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="bt-surface-raised p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('calendar.today')}</p>
                  <p className="bt-numeric mt-0.5 truncate text-sm font-semibold">{world.date}</p>
                </div>
                <div className="bt-surface-raised p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('calendar.bengaliDate')}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold">{bengali}</p>
                </div>
                <div className="bt-surface-raised p-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('calendar.season')}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold">
                    {locale === 'bn' ? world.bengali.season.bn : world.bengali.season.en}
                  </p>
                </div>
              </div>

              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {world.bengali.season.trade}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- How far the confirmed dates reach ---- */}
      {coverage && (
        <div
          className={cn(
            'bt-surface flex items-start gap-2 p-3 text-[11px] leading-relaxed',
            coverage.stale ? 'bt-edge bt-edge-gold' : '',
          )}
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-muted-foreground">
            {coverage.stale
              ? t('calendar.coverageStale')
              : t('calendar.coverage', { year: String(coverage.to) })}
            {' '}
            {t('calendar.estimatedNote')}
          </p>
        </div>
      )}

      {/* ---- The year ---- */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2"
          disabled={!yearData.canGoBack}
          onClick={() => setYear(yearData.year - 1)}
          aria-label={t('calendar.previousYear')}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <p className="bt-numeric text-sm font-semibold">{t('calendar.year', { year: String(yearData.year) })}</p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2"
          disabled={!yearData.canGoForward}
          onClick={() => setYear(yearData.year + 1)}
          aria-label={t('calendar.nextYear')}
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>

      <div className="space-y-3">
        {months.map((monthName, index) => {
          const entries = byMonth.get(index) ?? [];
          if (entries.length === 0) return null;

          return (
            <div key={monthName} className="bt-surface-raised overflow-hidden">
              <div className="border-b border-[var(--bt-hairline)] px-3 py-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {monthName}
                </h2>
              </div>

              <ul className="divide-y divide-[var(--bt-hairline)]">
                {entries.map(observance => {
                  const isToday = observance.date <= world.date && world.date <= observance.endDate;

                  return (
                    <li
                      key={`${observance.id}-${observance.date}`}
                      className={cn('p-3', isToday && 'bg-emerald-50/60 dark:bg-emerald-950/20')}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-11 shrink-0 text-center">
                          <p className="bt-numeric text-lg font-bold leading-none">
                            {n(Number(observance.date.slice(8, 10)))}
                          </p>
                          {observance.spanDays > 1 && (
                            <p className="mt-0.5 text-[9px] text-muted-foreground">
                              {t('calendar.runsFor', { count: observance.spanDays })}
                            </p>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-sm font-semibold">{name(observance)}</p>
                            <Badge
                              variant="outline"
                              className={cn('bt-tone rounded-full px-2 text-[10px]', KIND_TONE[observance.kind])}
                            >
                              {t(`calendar.kind.${observance.kind}` as const)}
                            </Badge>
                            <CertaintyBadge certainty={observance.certainty} />
                            {observance.publicHoliday && (
                              <Badge variant="outline" className="bt-tone bt-tone-crimson rounded-full px-2 text-[10px]">
                                {t('calendar.publicHoliday')}
                              </Badge>
                            )}
                            {isToday && (
                              <Badge className="rounded-full bg-emerald-600 px-2 text-[10px] text-white">
                                {t('calendar.today.badge')}
                              </Badge>
                            )}
                          </div>

                          {/* Estimated dates show the window, not just the guess. */}
                          {observance.window && (
                            <p className="bt-numeric mt-1 text-[10px] text-amber-700 dark:text-amber-400">
                              {t('calendar.window', {
                                from: observance.window.earliest,
                                to: observance.window.latest,
                              })}
                            </p>
                          )}

                          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                            {note(observance)}
                          </p>

                          {observance.peaks.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {observance.peaks.map(peak => {
                                const up = peak.peak >= 1;
                                return (
                                  <span
                                    key={peak.trade}
                                    className={cn(
                                      'bt-tone inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]',
                                      up ? 'bt-tone-emerald' : 'bt-tone-crimson',
                                    )}
                                  >
                                    {up ? (
                                      <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" />
                                    ) : (
                                      <TrendingDown className="h-2.5 w-2.5" aria-hidden="true" />
                                    )}
                                    <span className="bt-numeric">{peak.peak.toFixed(1)}×</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
