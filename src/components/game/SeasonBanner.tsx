'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface SeasonSummary {
  number: number;
  name: string;
  gameDay: number;
  lengthDays: number;
  daysRemaining: number;
  progress: number;
}

interface AccountRecord {
  prestige: number;
  tier: { tier: number; label: string };
  seasonsPlayed: number;
  bestRank: number | null;
}

/**
 * Where the season stands, and what the player has to show for previous ones.
 *
 * Deliberately on the dashboard rather than buried in a menu: a fixed-length
 * season only creates urgency if the player can see it running out, and a reset
 * only feels fair if what survives it is visible before it happens.
 */
export default function SeasonBanner() {
  const { t, n } = useI18n();
  const [season, setSeason] = useState<SeasonSummary | null>(null);
  const [account, setAccount] = useState<AccountRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/seasons')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        setSeason(data.season ?? null);
        setAccount(data.account ?? null);
      })
      .catch(() => {
        // The banner is context, not function — a failure hides it.
      });
    return () => { cancelled = true; };
  }, []);

  if (!season) return null;

  // The last week is when the ladder actually matters, so it reads differently.
  const endingSoon = season.daysRemaining <= 7;

  return (
    <div className="px-3 md:px-4">
      <Card className={cn('game-gradient-card overflow-hidden', endingSoon && 'border-amber-300 dark:border-amber-800')}>
        <CardContent className="p-3">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bt-tone',
                endingSoon ? 'bt-tone-amber' : 'bt-tone-emerald',
              )}
            >
              <CalendarClock className="h-3.5 w-3.5" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold">{season.name}</p>
                <span
                  className={cn(
                    'bt-numeric shrink-0 text-xs font-semibold',
                    endingSoon ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                  )}
                >
                  {t('season.daysLeft', { count: season.daysRemaining })}
                </span>
              </div>

              <Progress value={season.progress * 100} className="mt-2 h-1" />

              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {t('season.progress', { day: season.gameDay, total: season.lengthDays })}
              </p>

              {account && (account.seasonsPlayed > 0 || account.prestige > 0) && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="bt-tone bt-tone-emerald gap-1 rounded-full px-2 text-[10px]">
                    <Trophy className="h-2.5 w-2.5" aria-hidden="true" />
                    {account.tier.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {t('season.prestige')} {n(account.prestige)}
                    {account.bestRank !== null && ` · ${t('season.bestFinish')} ${t('season.rank', { rank: account.bestRank })}`}
                  </span>
                </div>
              )}

              {/* The reset is stated before it happens, not discovered after. */}
              {endingSoon && (
                <p className="mt-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                  {t('season.resetNotice', { cash: '৳5,00,000' })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
