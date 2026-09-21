'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useCalendar } from '@/hooks/use-calendar';
import { ROUTES } from '@/lib/game-routes';
import CertaintyBadge from './calendar/CertaintyBadge';
import type { CalendarObservance } from '@/lib/calendar/client-store';

/**
 * What is happening in Bangladesh right now, and what is about to.
 *
 * On the dashboard rather than behind a menu because it is a *trading* signal,
 * not decoration: a clothing shop that does not restock before the last ten
 * days of Ramadan has missed the biggest week of its year, and the player needs
 * to be told that while they can still act on it.
 */
export default function ObservanceStrip() {
  const { t, locale } = useI18n();
  const calendar = useCalendar();

  if (!calendar) return null;

  const { world, today, upcoming } = calendar;
  const next = upcoming[0];
  const headline = today[0] ?? next;

  // Nothing on and nothing coming: the strip would be an empty box.
  if (!headline) return null;

  const isNow = today.length > 0;
  const name = (o: CalendarObservance) => (locale === 'bn' ? o.bn : o.en);
  const note = (o: CalendarObservance) => (locale === 'bn' ? o.tradeNoteBn : o.tradeNote);

  return (
    <div className="px-3 md:px-4">
      <Card className={cn('game-gradient-card overflow-hidden', isNow && 'border-emerald-300 dark:border-emerald-800')}>
        <CardContent className="p-3">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bt-tone',
                isNow ? 'bt-tone-emerald' : 'bt-tone-sky',
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {isNow ? t('calendar.onNow') : t('calendar.comingUp')}
                </span>
                <p className="truncate text-sm font-semibold">{name(headline)}</p>
                <CertaintyBadge certainty={headline.certainty} compact />
                {!isNow && (
                  <span className="bt-numeric text-xs font-semibold text-muted-foreground">
                    {headline.daysAway === 1
                      ? t('calendar.inDays.one')
                      : t('calendar.inDays', { count: headline.daysAway })}
                  </span>
                )}
                {headline.publicHoliday && (
                  <Badge variant="outline" className="bt-tone bt-tone-crimson rounded-full px-2 text-[10px]">
                    {t('calendar.publicHoliday')}
                  </Badge>
                )}
              </div>

              {/* The reason a player should care, in their own language. */}
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{note(headline)}</p>

              {/* Which trades it moves, so the signal is actionable rather than trivia. */}
              {headline.peaks.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {headline.peaks.map(peak => {
                    const up = peak.peak >= 1;
                    return (
                      <span
                        key={peak.trade}
                        className={cn(
                          'bt-tone inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
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

              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="truncate text-[10px] text-muted-foreground">
                  {locale === 'bn' ? world.bengali.formattedBn : world.bengali.formattedEn}
                  {' · '}
                  {locale === 'bn' ? world.bengali.season.bn : world.bengali.season.en}
                </span>
                <Link
                  href={ROUTES.calendar}
                  className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  {t('calendar.viewFullYear')}
                  <ChevronRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
