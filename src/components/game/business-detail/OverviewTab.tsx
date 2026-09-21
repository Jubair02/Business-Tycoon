'use client';

import { motion } from 'framer-motion';
import { BarChart3, DollarSign, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { formatTaka, formatTakaShort } from '@/lib/game-data';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useBusinessDetail } from './context';
import SeasonalDemandPanel from '../calendar/SeasonalDemandPanel';

/**
 * The day at a glance: takings, costs and the most recent activity.
 *
 * Split out of `BusinessDetail.tsx`, which had grown to 1,729 lines — long
 * past the point where the panel you were editing could be found, let alone
 * reviewed. The markup is unchanged; only its home is.
 */
export default function OverviewTab() {
  const {
    bt,
    currentBusiness,
    expenses,
    logs,
    profit,
    revenue,
  } = useBusinessDetail();

  return (
    <>
      {/* What the Bangladeshi calendar is doing to this shop today, named. */}
      <SeasonalDemandPanel businessType={currentBusiness.type} />

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        {[
          {
            label: 'Daily Revenue',
            value: formatTakaShort(revenue),
            tone: 'bt-tone-emerald',
            text: 'bt-text-profit',
            Icon: TrendingUp,
          },
          {
            label: 'Daily Profit',
            value: `${profit >= 0 ? '+' : ''}${formatTakaShort(profit)}`,
            tone: profit >= 0 ? 'bt-tone-emerald' : 'bt-tone-crimson',
            text: profit >= 0 ? 'bt-text-profit' : 'bt-text-loss',
            Icon: profit >= 0 ? TrendingUp : TrendingDown,
          },
          {
            label: 'Daily Expenses',
            value: formatTakaShort(expenses),
            tone: 'bt-tone-amber',
            text: '',
            Icon: DollarSign,
          },
          {
            label: 'Reputation',
            value: `${currentBusiness.reputation || 0}%`,
            tone: 'bt-tone-violet',
            text: '',
            Icon: Star,
          },
        ].map(({ label, value, tone, text, Icon }) => (
          <div key={label} className="bt-surface bt-sheen p-3.5">
            <div className="flex items-center gap-2">
              <span className={cn('bt-tone grid h-7 w-7 place-items-center rounded-lg', tone)}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="bt-label truncate">{label}</span>
            </div>
            <p className={cn('bt-figure mt-2 text-xl', text)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Profit Breakdown */}
      <Card className="mb-4 game-gradient-card game-shine">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold game-gradient-text">Profit Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-muted-foreground">Revenue</span>
            </div>
            <span className="font-medium text-green-600 dark:text-green-400">+{formatTakaShort(revenue)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500 dark:text-red-400" />
              <span className="text-muted-foreground">Expenses</span>
            </div>
            <span className="font-medium text-red-500 dark:text-red-400">-{formatTakaShort(expenses)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm font-bold">
            <span>Net Profit</span>
            <span className={profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
              {profit >= 0 ? '+' : ''}{formatTakaShort(profit)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4 game-shine">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold game-gradient-text">Reputation</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Progress value={currentBusiness.reputation || 0} className="h-3" />
          <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
            <span>Poor</span><span>Average</span><span>Excellent</span>
          </div>
        </CardContent>
      </Card>

      {/* Business Performance chart from logs */}
      <Card className="game-shine">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold game-gradient-text flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" /> Performance History
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {logs.length > 0 ? (() => {
            const profitLogs = logs.filter((l: any) => l.type === 'PROFIT' || l.type === 'LOSS').slice(-14);
            if (profitLogs.length === 0) return (
              <div className="h-24 flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">No profit data yet. Your chart builds as the days pass.</p>
                </div>
              </div>
            );
            const maxAbs = Math.max(...profitLogs.map((l: any) => Math.abs(l.amount || 0)), 1);
            return (
              <div className="space-y-0.5">
                <div className="h-24 flex items-end gap-[3px]">
                  {profitLogs.map((log: any, i: number) => {
                    const amount = log.amount || 0;
                    const h = Math.max(5, (Math.abs(amount) / maxAbs) * 85 + 10);
                    const isPositive = amount >= 0;
                    return (
                      <motion.div
                        key={log.id || i}
                        className="flex-1 rounded-t"
                        style={{
                          height: `${h}%`,
                          background: isPositive
                            ? 'linear-gradient(to top, rgba(0, 106, 78, 0.7), rgba(0, 168, 107, 0.4))'
                            : 'linear-gradient(to top, rgba(244, 42, 65, 0.6), rgba(244, 42, 65, 0.3))',
                        }}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: i * 0.03, duration: 0.3 }}
                        title={`${formatTaka(amount)}`}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
                  <span>Last {profitLogs.length} days</span>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-green-600 dark:bg-green-600/60 inline-block" /> Profit</span>
                    <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-red-500 dark:bg-red-500/60 inline-block" /> Loss</span>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="h-24 flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">No data yet. Your chart builds as the days pass.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
