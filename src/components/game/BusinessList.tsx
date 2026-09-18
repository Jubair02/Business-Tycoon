'use client';

import { useGameStore } from '@/store/game-store';
import { ROUTES, businessRoute } from '@/lib/game-routes';
import { useRouter } from 'next/navigation';
import { formatTakaShort, getBusinessType, getCity } from '@/lib/game-data';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Plus, TrendingUp, TrendingDown, Building2, MapPin, Users, Star,
  Package, UserPlus, ArrowUpCircle, Coins,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Deterministic mini sparkline from a seed string
const getMiniSparkline = (seed: string): number[] => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < 7; i++) {
    hash = ((hash << 3) ^ (hash >>> 2)) & 0x7fffffff;
    bars.push(25 + (hash % 60));
  }
  return bars;
};

function SummaryTile({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone: 'emerald' | 'gold' | 'sky' | 'crimson';
}) {
  return (
    <div className="bt-surface p-3 text-center sm:p-3.5">
      <span
        className={cn('bt-tone mx-auto grid h-7 w-7 place-items-center rounded-lg', `bt-tone-${tone}`)}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <p className="bt-label mt-2">{label}</p>
      <p
        className={cn(
          'bt-figure mt-1 text-base sm:text-lg',
          tone === 'emerald' && 'bt-text-profit',
          tone === 'gold' && 'bt-text-gold',
          tone === 'crimson' && 'bt-text-loss',
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default function BusinessList() {
  const router = useRouter();
  const { businesses } = useGameStore();

  const totalBusinesses = businesses.length;
  const totalDailyProfit = businesses.reduce((sum: number, b: any) => sum + (b.dailyProfit || 0), 0);
  const totalStaff = businesses.reduce((sum: number, b: any) => sum + (b._count?.employees || 0), 0);

  const bestPerformer = businesses.length > 0
    ? businesses.reduce((best: any, b: any) => ((b.dailyProfit || 0) > (best?.dailyProfit || 0) ? b : best), null)
    : null;

  // Quick actions all open the business detail; they differ only in
  // which tab the player lands on, so they share one handler.
  const quickActions = [
    { label: 'Inventory', icon: Package },
    { label: 'Hire', icon: UserPlus },
    { label: 'Upgrade', icon: ArrowUpCircle },
  ];

  return (
    <div className="bt-page bt-stack">
      {/* ─── Header ────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bt-tone bt-tone-emerald grid h-10 w-10 shrink-0 place-items-center rounded-xl">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">Your Businesses</h1>
            <p className="bt-numeric text-xs text-muted-foreground">
              {totalBusinesses} {totalBusinesses === 1 ? 'venture' : 'ventures'} in operation
            </p>
          </div>
        </div>
        <Button
          onClick={() => router.push(ROUTES.newBusiness)}
          className="bt-btn-primary bt-tap h-10 shrink-0 gap-1.5 rounded-xl px-4 font-semibold"
        >
          <Plus className="h-4 w-4" /> New business
        </Button>
      </header>

      {/* ─── Summary ───────────────────────────────────────────── */}
      {businesses.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          aria-label="Portfolio summary"
        >
          <div className="grid grid-cols-3 gap-2.5">
            <SummaryTile label="Ventures" value={String(totalBusinesses)} icon={Building2} tone="sky" />
            <SummaryTile
              label="Daily Profit"
              value={`${totalDailyProfit >= 0 ? '+' : ''}${formatTakaShort(totalDailyProfit)}`}
              icon={Coins}
              tone={totalDailyProfit >= 0 ? 'emerald' : 'crimson'}
            />
            <SummaryTile label="Total Staff" value={String(totalStaff)} icon={Users} tone="gold" />
          </div>
        </motion.section>
      )}

      {/* ─── Empty state ───────────────────────────────────────── */}
      {businesses.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="bt-surface border-dashed p-10 text-center">
            <span className="bt-medallion bt-medallion-lg mx-auto mb-4">
              <Building2 className="h-7 w-7 text-[var(--bt-emerald)]" aria-hidden="true" />
            </span>
            <h2 className="text-base font-bold sm:text-lg">No businesses yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Your empire starts with a single shop. Pick a venture, choose a city, and start
              turning taka into more taka.
            </p>
            <Button
              onClick={() => router.push(ROUTES.newBusiness)}
              className="bt-btn-primary bt-tap mt-6 h-11 gap-1.5 rounded-xl px-5 font-semibold"
            >
              <Plus className="h-4 w-4" /> Create your first business
            </Button>
          </div>
        </motion.div>
      ) : (
        /* ─── Business grid ───────────────────────────────────── */
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {businesses.map((b: any, i: number) => {
            const bt = getBusinessType(b.type);
            const city = getCity(b.city);
            const profit = b.dailyProfit || 0;
            const isPositive = profit >= 0;
            const isBest = bestPerformer && bestPerformer.id === b.id && businesses.length > 1;
            const sparkBars = getMiniSparkline(b.id || b.name);

            return (
              <motion.article
                key={b.id}
                initial={{ opacity: 0, scale: 0.97, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'bt-surface bt-interactive bt-edge relative flex flex-col',
                  isBest && 'bt-edge-gold',
                  !isPositive && !isBest && 'bt-edge-loss',
                )}
                onClick={() => router.push(businessRoute(b.id))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(businessRoute(b.id));
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Open ${b.name}`}
              >
                {isBest && (
                  <Badge
                    className="bt-btn-gold absolute right-3 top-3 z-10 gap-0.5 rounded-full border-0 px-2 py-0.5 text-xs font-bold"
                  >
                    <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                    Top earner
                  </Badge>
                )}

                <div className="flex-1 p-4">
                  {/* Identity */}
                  <div className="flex items-start gap-3">
                    <span className="bt-medallion bt-medallion-lg" aria-hidden="true">
                      {bt?.icon || '🏪'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className={cn('truncate text-sm font-bold sm:text-base', isBest && 'pr-24')}>
                        {b.name}
                      </h2>
                      <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {city?.name}
                        <span aria-hidden="true">·</span>
                        {bt?.name}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="bt-tone bt-tone-emerald rounded-full px-2 text-xs font-bold">
                          Lv.{b.level || 1}
                        </Badge>
                        <Badge variant="secondary" className="bt-numeric rounded-full px-2 text-xs font-medium">
                          {b._count?.inventories || 0} items
                        </Badge>
                        <Badge variant="secondary" className="bt-numeric rounded-full px-2 text-xs font-medium">
                          {b._count?.employees || 0} staff
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <hr className="my-3.5 border-[var(--bt-hairline)]" />

                  {/* Reputation */}
                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="bt-label">Reputation</span>
                      <span className="bt-numeric text-xs font-bold">{b.reputation || 0}%</span>
                    </div>
                    <Progress
                      value={b.reputation || 0}
                      className="h-1.5"
                      aria-label={`Reputation ${b.reputation || 0} percent`}
                    />
                  </div>

                  {/* Profit + sparkline */}
                  <div className="mt-3.5 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="bt-label">Daily Profit</p>
                      <p
                        className={cn(
                          'bt-figure mt-1 flex items-center gap-1 text-lg',
                          isPositive ? 'bt-text-profit' : 'bt-text-loss',
                        )}
                      >
                        {isPositive
                          ? <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                          : <TrendingDown className="h-4 w-4 shrink-0" aria-hidden="true" />}
                        {isPositive ? '+' : ''}{formatTakaShort(profit)}
                      </p>
                    </div>
                    <div className="flex h-9 shrink-0 items-end gap-[3px]" aria-hidden="true">
                      {sparkBars.map((h, bi) => (
                        <span
                          key={bi}
                          className="w-[3px] rounded-full transition-[height] duration-300"
                          style={{
                            height: `${h}%`,
                            background: isPositive
                              ? 'linear-gradient(180deg, var(--bt-emerald), color-mix(in oklch, var(--bt-emerald) 25%, transparent))'
                              : 'linear-gradient(180deg, var(--bt-crimson), color-mix(in oklch, var(--bt-crimson) 25%, transparent))',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick actions — 44px targets on touch */}
                <div className="grid grid-cols-3 gap-1 border-t border-[var(--bt-hairline)] p-1.5">
                  {quickActions.map(({ label, icon: Icon }) => (
                    <button
                      key={label}
                      type="button"
                      className="bt-tap gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-[var(--bt-surface-2)] hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(businessRoute(b.id));
                      }}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{label}</span>
                    </button>
                  ))}
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}
