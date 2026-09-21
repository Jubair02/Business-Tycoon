'use client';

import { CalendarDays, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useCalendar } from '@/hooks/use-calendar';

/**
 * Why today is busier or quieter than usual, on the shop's own screen.
 *
 * The tick multiplies a seasonal factor into demand. Left unexplained that is
 * just a number moving on its own, and the player learns nothing; named — "Eid
 * rush x2.7" — it is the game teaching how the Bangladeshi retail year works,
 * which is the whole point of setting it here.
 */
export default function SeasonalDemandPanel({ businessType }: { businessType: string }) {
  const { t, locale } = useI18n();
  const calendar = useCalendar();

  const demand = calendar?.demand?.[businessType];
  if (!calendar || !demand) return null;

  const { multiplier, factors } = demand;
  // Within a couple of percent of an average day there is nothing to explain.
  const notable = Math.abs(multiplier - 1) >= 0.02;
  const up = multiplier > 1;
  const swing = Math.round(Math.abs(multiplier - 1) * 100);

  return (
    <div className="bt-surface-raised mb-4 p-3">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bt-tone',
            !notable ? 'bt-tone-slate' : up ? 'bt-tone-emerald' : 'bt-tone-crimson',
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('calendar.demandToday')}
            </p>
            <span
              className={cn(
                'bt-numeric text-sm font-bold',
                !notable ? '' : up ? 'bt-text-profit' : 'bt-text-loss',
              )}
            >
              {multiplier.toFixed(2)}×
            </span>
            {notable && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                {up ? (
                  <TrendingUp className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-3 w-3" aria-hidden="true" />
                )}
                {swing}% {up ? t('calendar.aboveAverage') : t('calendar.belowAverage')}
              </span>
            )}
            {!notable && (
              <span className="text-[11px] text-muted-foreground">{t('calendar.averageDay')}</span>
            )}
          </div>

          {factors.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {factors.map(factor => (
                <li key={factor.source} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate text-muted-foreground">
                    {locale === 'bn' ? factor.labelBn : factor.label}
                  </span>
                  <span
                    className={cn(
                      'bt-numeric shrink-0 font-medium',
                      factor.multiplier >= 1 ? 'bt-text-profit' : 'bt-text-loss',
                    )}
                  >
                    {factor.multiplier.toFixed(2)}×
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">{t('calendar.noEffect')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
