'use client';

import { useEffect, useState } from 'react';
import { ROUTES, businessRoute } from '@/lib/game-routes';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import {
  formatTaka, formatTakaShort, getBusinessType, getCity
} from '@/lib/game-data';
import { EXPANSION_CONFIG } from '@/lib/game/expansion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Wallet, Building2, Users, TrendingUp, TrendingDown, ArrowRight,
  Zap, Package, Plus, Flame, Newspaper, BarChart3, Clock, Shield,
  LayoutGrid, Timer, Gem, ClipboardList, Sparkles,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { cn } from '@/lib/utils';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { ease: [0.16, 1, 0.3, 1] as const, duration: 0.4 } },
};

/** Headline stats. Net worth carries the gold treatment — it's the
 *  score that actually matters in a tycoon game, so it gets the
 *  prestige colour and everything else stays emerald/neutral. */
function StatTile({
  label, value, icon: Icon, tone, emphasis,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone: 'emerald' | 'gold' | 'sky' | 'violet';
  emphasis?: boolean;
}) {
  return (
    <div className={cn('bt-surface bt-sheen relative p-3.5 sm:p-4', emphasis && 'bt-edge bt-edge-gold')}>
      <div className="flex items-center gap-2">
        <span className={cn('bt-tone grid h-7 w-7 place-items-center rounded-lg', `bt-tone-${tone}`)}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="bt-label truncate">{label}</span>
      </div>
      <p
        className={cn(
          'bt-figure mt-2 text-xl sm:text-2xl',
          emphasis ? 'bt-text-gold' : tone === 'emerald' ? 'bt-text-profit' : 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Revenue / profit / reputation strip. Values are abbreviated
 *  (formatTakaShort), so three columns still read cleanly at 375px. */
function PulseTile({
  label, value, sub, tone, icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'emerald' | 'crimson' | 'sky';
  icon?: React.ElementType;
}) {
  return (
    <div className="bt-surface p-3 text-center">
      <p className="bt-label">{label}</p>
      <p
        className={cn(
          'bt-figure mt-1.5 flex items-center justify-center gap-1 text-base sm:text-lg',
          tone === 'emerald' && 'bt-text-profit',
          tone === 'crimson' && 'bt-text-loss',
        )}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { player, businesses, events, news, gameDay } = useGameStore();
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoadingLogs(true);
      try {
        const res = await fetch('/api/player/logs');
        if (res.ok) setLogs(await res.json());
      } catch { /* silent */ }
      setLoadingLogs(false);
    };
    fetchLogs();
  }, [gameDay]);

  const totalEmployees = businesses.reduce((sum: number, b: any) => sum + (b._count?.employees || 0), 0);
  const totalDailyProfit = businesses.reduce((sum: number, b: any) => sum + (b.dailyProfit || 0), 0);
  const totalDailyRevenue = businesses.reduce((sum: number, b: any) => sum + (b.dailyRevenue || 0), 0);
  const avgReputation = businesses.length > 0
    ? businesses.reduce((sum: number, b: any) => sum + (b.reputation || 0), 0) / businesses.length
    : 0;

  const profitChartData = businesses
    .filter((b: any) => b.dailyProfit !== undefined)
    .map((b: any) => {
      const bt = getBusinessType(b.type);
      return {
        name: bt?.icon || '🏪',
        fullName: b.name,
        profit: Math.round(b.dailyProfit || 0),
        revenue: Math.round(b.dailyRevenue || 0),
      };
    });

  const getNextLevelExp = (level: number) => level * 1000;
  const xpCurrent = player?.experience || 0;
  const xpTarget = getNextLevelExp(player?.level || 1);
  const xpPercent = Math.min(100, (xpCurrent / xpTarget) * 100);

  const formatLogTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHrs = Math.floor(diffMins / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return `${Math.floor(diffHrs / 24)}d ago`;
    } catch { return ''; }
  };

  const getLogIcon = (type: string) => {
    const map: Record<string, { Icon: React.ElementType; tone: string }> = {
      REVENUE: { Icon: TrendingUp, tone: 'bt-tone-emerald' },
      EXPENSE: { Icon: TrendingDown, tone: 'bt-tone-crimson' },
      PROFIT: { Icon: BarChart3, tone: 'bt-tone-emerald' },
      HIRE: { Icon: Users, tone: 'bt-tone-sky' },
      PURCHASE: { Icon: Package, tone: 'bt-tone-amber' },
      UPGRADE: { Icon: ArrowRight, tone: 'bt-tone-violet' },
      EVENT: { Icon: Zap, tone: 'bt-tone-amber' },
      REPUTATION: { Icon: Shield, tone: 'bt-tone-sky' },
      LEVEL_UP: { Icon: Sparkles, tone: 'bt-tone-violet' },
    };
    const { Icon, tone } = map[type] || { Icon: Clock, tone: 'bt-tone-sky' };
    return (
      <span className={cn('bt-tone grid h-7 w-7 shrink-0 place-items-center rounded-lg', tone)}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="bt-page bt-stack"
    >
      {/* ─── Player header ─────────────────────────────────────── */}
      <motion.section variants={item} className="bt-surface-raised bt-ambient overflow-hidden p-4 sm:p-5">
        <div className="flex items-start gap-3.5 sm:items-center">
          <div className="relative shrink-0">
            <div
              className="grid h-12 w-12 place-items-center rounded-2xl text-lg font-black text-white shadow-lg sm:h-14 sm:w-14 sm:text-xl"
              style={{ background: 'linear-gradient(135deg, var(--bt-emerald-deep), var(--bt-emerald-bright))' }}
            >
              {player?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <span
              className="absolute -bottom-1 -right-1 grid h-6 min-w-6 place-items-center rounded-full border-2 border-[var(--bt-surface-1)] px-1 text-[0.625rem] font-black"
              style={{ background: 'linear-gradient(135deg, var(--bt-gold-deep), var(--bt-gold-bright))', color: 'oklch(0.2 0.02 75)' }}
              aria-label={`Level ${player?.level || 1}`}
            >
              {player?.level || 1}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="bt-label">Day {gameDay}</p>
            <h1 className="mt-0.5 truncate text-lg font-bold tracking-tight sm:text-xl">
              Welcome back, {player?.name || 'Tycoon'}
            </h1>
            {events.length > 0 && (
              <Badge variant="outline" className="bt-tone bt-tone-amber mt-2 gap-1 rounded-full text-xs font-semibold">
                <Flame className="h-3 w-3" aria-hidden="true" />
                {events.length} active event{events.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {player && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="bt-label">Experience</span>
              <span className="bt-numeric font-semibold text-muted-foreground">
                {xpCurrent.toLocaleString()} / {xpTarget.toLocaleString()} XP
              </span>
            </div>
            <Progress
              value={xpPercent}
              className="h-2"
              aria-label={`Level ${player.level || 1} progress: ${Math.round(xpPercent)} percent`}
            />
          </div>
        )}
      </motion.section>

      {/* ─── Headline stats ────────────────────────────────────── */}
      <motion.section variants={item} aria-label="Key figures">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
          <StatTile label="Cash" value={formatTakaShort(player?.cash || 0)} icon={Wallet} tone="emerald" />
          <StatTile label="Net Worth" value={formatTakaShort(player?.netWorth || 0)} icon={Gem} tone="gold" emphasis />
          <StatTile label="Businesses" value={String(businesses.length)} icon={Building2} tone="sky" />
          <StatTile label="Staff" value={String(totalEmployees)} icon={Users} tone="violet" />
        </div>
      </motion.section>

      {/* ─── Today's pulse ─────────────────────────────────────── */}
      <motion.section variants={item} aria-label="Today's performance">
        <div className="grid grid-cols-3 gap-2.5">
          <PulseTile label="Revenue" value={formatTakaShort(totalDailyRevenue)} sub="today" tone="emerald" />
          <PulseTile
            label="Profit"
            value={`${totalDailyProfit >= 0 ? '+' : ''}${formatTakaShort(totalDailyProfit)}`}
            sub="today"
            tone={totalDailyProfit >= 0 ? 'emerald' : 'crimson'}
            icon={totalDailyProfit >= 0 ? TrendingUp : TrendingDown}
          />
          <PulseTile label="Reputation" value={`${avgReputation.toFixed(0)}%`} sub="average" tone="sky" />
        </div>
      </motion.section>

      {/* ─── Performance chart ─────────────────────────────────── */}
      {profitChartData.length > 0 && (
        <motion.section variants={item}>
          <div className="bt-surface-raised overflow-hidden">
            <header className="flex items-center gap-2.5 border-b border-[var(--bt-hairline)] px-4 py-3">
              <span className="bt-tone bt-tone-emerald grid h-7 w-7 place-items-center rounded-lg">
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-bold tracking-tight">Business Performance</h2>
            </header>
            <div className="h-44 px-1 py-3 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={profitChartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--bt-emerald)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--bt-emerald)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--bt-gold)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--bt-gold)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 15 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v))}
                  />
                  <Tooltip
                    cursor={{ stroke: 'var(--bt-hairline)', strokeWidth: 1 }}
                    formatter={(value: number, name: string) => [
                      formatTaka(value),
                      name === 'profit' ? 'Daily Profit' : 'Daily Revenue',
                    ]}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 12,
                      border: '1px solid var(--bt-hairline)',
                      background: 'var(--bt-surface-1)',
                      color: 'var(--foreground)',
                      boxShadow: 'var(--bt-shadow-lg)',
                    }}
                    labelFormatter={(label: string, payload: any) => payload?.[0]?.payload?.fullName || label}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="var(--bt-gold)" fill="url(#revenueGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="profit" stroke="var(--bt-emerald)" fill="url(#profitGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Legend: shape + label, never colour alone */}
            <div className="flex items-center justify-center gap-5 border-t border-[var(--bt-hairline)] px-4 py-2.5">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-0.5 w-4 rounded-full" style={{ background: 'var(--bt-emerald)' }} />
                Profit
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-0.5 w-4 rounded-full" style={{ background: 'var(--bt-gold)' }} />
                Revenue
              </span>
            </div>
          </div>
        </motion.section>
      )}

      {/* ─── Active events ─────────────────────────────────────── */}
      {events.length > 0 && (
        <motion.section variants={item}>
          <div className="bt-surface-raised overflow-hidden">
            <header className="flex items-center gap-2.5 border-b border-[var(--bt-hairline)] px-4 py-3">
              <span className="bt-tone bt-tone-amber grid h-7 w-7 place-items-center rounded-lg">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-bold tracking-tight">Active Events</h2>
            </header>
            <ul className="divide-y divide-[var(--bt-hairline)]">
              {events.slice(0, 3).map((event: any) => (
                <li key={event.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="bt-medallion bt-medallion-sm !h-9 !w-9 !text-lg" aria-hidden="true">
                    {event.icon || '📢'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{event.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{event.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </motion.section>
      )}

      {/* ─── Portfolio summary ─────────────────────────────────── */}
      {businesses.length > 1 && (
        <motion.section variants={item}>
          <div className="bt-surface-raised bt-edge p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="bt-tone bt-tone-emerald grid h-10 w-10 shrink-0 place-items-center rounded-xl">
                  <LayoutGrid className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">Your Portfolio</p>
                  <p className="bt-numeric truncate text-xs text-muted-foreground">
                    {businesses.length} businesses · {formatTakaShort(totalDailyProfit)}/day profit
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="bt-btn-primary bt-tap h-10 w-full gap-1.5 rounded-xl sm:w-auto"
                onClick={() => router.push(ROUTES.portfolio)}
              >
                View portfolio <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            {businesses.some((b: any) => b.setupDaysRemaining > 0) && (
              <ul className="mt-3 space-y-1.5 border-t border-[var(--bt-hairline)] pt-3">
                {businesses.filter((b: any) => b.setupDaysRemaining > 0).map((b: any) => (
                  <li key={b.id} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Timer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate font-semibold text-foreground">{b.name}</span>
                    <span>— {b.setupDaysRemaining}d setup remaining</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.section>
      )}

      {/* ─── Business list ─────────────────────────────────────── */}
      <motion.section variants={item}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="bt-section-title flex-1 text-sm">
            <Building2 className="h-4 w-4 text-[var(--bt-emerald)]" aria-hidden="true" />
            Your Businesses
          </h2>
          {businesses.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="bt-tap h-9 shrink-0 gap-1 text-xs font-semibold text-[var(--bt-emerald)]"
              onClick={() => router.push(ROUTES.portfolio)}
            >
              Portfolio <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {businesses.length === 0 ? (
          <div className="bt-surface border-dashed p-8 text-center">
            <span className="bt-medallion bt-medallion-lg mx-auto mb-4">
              <Building2 className="h-7 w-7 text-[var(--bt-emerald)]" aria-hidden="true" />
            </span>
            <h3 className="text-base font-bold">No businesses yet</h3>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
              Every empire starts somewhere. Open your first venture and start earning taka.
            </p>
            <Button
              className="bt-btn-primary bt-tap mt-5 h-11 gap-1.5 rounded-xl px-5 font-semibold"
              onClick={() => router.push(ROUTES.newBusiness)}
            >
              <Plus className="h-4 w-4" /> Create business
            </Button>
          </div>
        ) : (
          <div className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3">
            {businesses.slice(0, 3).map((b: any) => {
              const bt = getBusinessType(b.type);
              const city = getCity(b.city);
              const profit = b.dailyProfit || 0;
              const isSetup = b.setupDaysRemaining > 0;
              const isProfit = profit >= 0;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => router.push(businessRoute(b.id))}
                  className="bt-surface bt-interactive bt-sheen w-full p-3.5 text-left"
                  aria-label={`Open ${b.name}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="bt-medallion bt-medallion-md" aria-hidden="true">
                      {bt?.icon || '🏪'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-bold">{b.name}</span>
                        <Badge variant="outline" className="shrink-0 rounded-full px-1.5 text-xs font-semibold">
                          Lv.{b.level || 1}
                        </Badge>
                        {isSetup && (
                          <Badge variant="outline" className="bt-tone bt-tone-sky shrink-0 gap-0.5 rounded-full px-1.5 text-xs font-semibold">
                            <Timer className="h-2.5 w-2.5" aria-hidden="true" />
                            {b.setupDaysRemaining}d
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {bt?.name} · {city?.name}
                      </p>

                      <div className="mt-2.5 flex items-end gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                            <span>Reputation</span>
                            <span className="bt-numeric font-semibold">{(b.reputation || 0).toFixed(0)}%</span>
                          </div>
                          <Progress value={b.reputation || 0} className="h-1.5" />
                        </div>
                        <span
                          className={cn(
                            'bt-numeric flex shrink-0 items-center gap-0.5 text-sm font-bold',
                            isProfit ? 'bt-text-profit' : 'bt-text-loss',
                          )}
                        >
                          {isProfit ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {formatTakaShort(profit)}
                        </span>
                      </div>

                      {isSetup && (
                        <p className="bt-tone bt-tone-sky mt-2.5 flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium">
                          <Timer className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
                          Setup in progress — operating at {Math.round(EXPANSION_CONFIG.setupRevenueMultiplier * 100)}% capacity
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </motion.section>

      {/* ─── Activity feed ─────────────────────────────────────── */}
      <motion.section variants={item}>
        <h2 className="bt-section-title mb-3 text-sm">
          <Clock className="h-4 w-4 text-[var(--bt-emerald)]" aria-hidden="true" />
          Recent Activity
        </h2>

        {loadingLogs ? (
          <div className="bt-surface divide-y divide-[var(--bt-hairline)]">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="bt-surface border-dashed p-7 text-center">
            <span className="bt-medallion bt-medallion-md mx-auto mb-3">
              <ClipboardList className="h-5 w-5 text-[var(--bt-emerald)]" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted-foreground">
              No activity yet. Start playing to build your business log.
            </p>
          </div>
        ) : (
          <ul className="bt-surface divide-y divide-[var(--bt-hairline)] overflow-hidden">
            {logs.slice(0, 8).map((log: any) => (
              <li key={log.id} className="flex items-start gap-3 p-3 transition-colors hover:bg-[var(--bt-surface-2)]">
                {getLogIcon(log.type)}
                <div className="min-w-0 flex-1">
                  <p className="text-[0.8125rem] leading-snug">{log.message}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="bt-numeric">{formatLogTime(log.createdAt)}</span>
                    {log.amount !== null && log.amount !== undefined && (
                      <span className={cn('bt-numeric font-semibold', log.amount >= 0 ? 'bt-text-profit' : 'bt-text-loss')}>
                        {log.amount >= 0 ? '+' : ''}{formatTaka(log.amount)}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      {/* ─── News ──────────────────────────────────────────────── */}
      {news.length > 0 && (
        <motion.section variants={item}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="bt-section-title flex-1 text-sm">
              <Newspaper className="h-4 w-4 text-[var(--bt-emerald)]" aria-hidden="true" />
              Latest News
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="bt-tap h-9 shrink-0 gap-1 text-xs font-semibold text-[var(--bt-emerald)]"
              onClick={() => router.push(ROUTES.news)}
            >
              More <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {news.slice(0, 3).map((article: any) => {
              const category = article.category?.toUpperCase();
              const tone =
                category === 'ECONOMY' ? 'bt-tone-emerald' :
                category === 'WEATHER' ? 'bt-tone-sky' :
                category === 'EVENT' ? 'bt-tone-violet' : 'bt-tone-amber';
              return (
                <article key={article.id} className="bt-surface bt-interactive p-3.5">
                  <Badge variant="outline" className={cn('bt-tone rounded-full text-xs font-semibold', tone)}>
                    {article.category}
                  </Badge>
                  <h3 className="mt-2 text-[0.8125rem] font-semibold leading-snug">{article.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.content}</p>
                </article>
              );
            })}
          </div>
        </motion.section>
      )}
    </motion.div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="bt-page bt-stack">
      <div className="bt-surface-raised p-4 sm:p-5">
        <div className="flex items-center gap-3.5">
          <Skeleton className="h-12 w-12 rounded-2xl sm:h-14 sm:w-14" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-48" />
          </div>
        </div>
        <Skeleton className="mt-4 h-2 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bt-surface p-3.5 sm:p-4">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="mt-2 h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bt-surface p-3"><Skeleton className="h-12 w-full" /></div>
        ))}
      </div>
      <div className="bt-surface-raised p-4"><Skeleton className="h-44 w-full sm:h-56" /></div>
      <div className="grid gap-2.5 lg:grid-cols-2 xl:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bt-surface p-3.5"><Skeleton className="h-16 w-full" /></div>
        ))}
      </div>
    </div>
  );
}
