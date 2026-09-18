'use client';

import { useEffect, useMemo, useState } from 'react';
import { ROUTES, businessRoute } from '@/lib/game-routes';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { formatTaka, formatTakaShort, getBusinessType, getCity } from '@/lib/game-data';
import { getLocation, EXPANSION_CONFIG } from '@/lib/game/expansion';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Users, TrendingUp, TrendingDown, Crown,
  Plus, Clock, MapPin, ChevronRight, Target, Globe, Timer,
  Briefcase, Receipt, Coins, HeartPulse, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PortfolioBusiness {
  id: string;
  name: string;
  type: string;
  city: string;
  location: string | null;
  level: number;
  reputation: number;
  healthScore: number;
  dailyRevenue: number;
  dailyExpense: number;
  dailyProfit: number;
  totalRevenue: number;
  totalProfit: number;
  cash: number;
  satisfactionScore: number;
  loyaltyScore: number;
  npsScore: number;
  brandAwareness: number;
  setupDaysRemaining: number;
  inventoryCount: number;
  totalStock: number;
  employeeCount: number;
  activeCampaigns: number;
}

interface PortfolioData {
  totalDailyRevenue: number;
  totalDailyExpense: number;
  totalDailyProfit: number;
  totalRevenue: number;
  totalProfit: number;
  totalCash: number;
  totalInventoryValue: number;
  totalEmployees: number;
  totalBusinesses: number;
  avgHealthScore: number;
  avgSatisfaction: number;
  avgLoyalty: number;
  bestPerforming: { id: string; name: string; profit: number } | null;
  worstPerforming: { id: string; name: string; profit: number } | null;
  citySpread: Record<string, number>;
  typeSpread: Record<string, number>;
}

interface PortfolioResponse {
  player: {
    id: string;
    name: string;
    cash: number;
    netWorth: number;
    level: number;
    experience: number;
    expansionCount: number;
    lastExpansionAt: number;
  };
  portfolio: PortfolioData;
  businesses: PortfolioBusiness[];
  gameDay: number;
  maxBusinesses: number;
}

type HoldingSort = 'profit' | 'health' | 'name';

const HOLDING_SORTS: { key: HoldingSort; label: string }[] = [
  { key: 'profit', label: 'Profit' },
  { key: 'health', label: 'Health' },
  { key: 'name', label: 'A–Z' },
];

/** Allocation slice hues — distinct enough to tell apart in a stacked meter. */
const ALLOC_COLORS = [
  'oklch(0.55 0.13 162)',
  'oklch(0.62 0.13 250)',
  'oklch(0.66 0.14 78)',
  'oklch(0.60 0.13 288)',
  'oklch(0.64 0.11 212)',
  'oklch(0.58 0.14 20)',
];

const ease = [0.16, 1, 0.3, 1] as const;

/** Stacked allocation bar + legend. Shows concentration risk at a glance,
 *  which a column of counts never did. */
function Allocation({
  title,
  Icon,
  entries,
}: {
  title: string;
  Icon: React.ElementType;
  entries: { key: string; label: string; icon?: string; count: number }[];
}) {
  const total = entries.reduce((s, e) => s + e.count, 0) || 1;

  return (
    <div className="bt-surface p-3.5">
      <h3 className="bt-label mb-2.5 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </h3>

      <div className="bt-meter mb-3" role="img" aria-label={`${title} allocation`}>
        {entries.map((e, i) => (
          <span
            key={e.key}
            style={{
              width: `${(e.count / total) * 100}%`,
              background: ALLOC_COLORS[i % ALLOC_COLORS.length],
            }}
          />
        ))}
      </div>

      <ul className="space-y-1.5">
        {entries.map((e, i) => (
          <li key={e.key} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: ALLOC_COLORS[i % ALLOC_COLORS.length] }}
              aria-hidden="true"
            />
            {e.icon && <span className="text-sm leading-none" aria-hidden="true">{e.icon}</span>}
            <span className="min-w-0 flex-1 truncate text-xs font-medium">{e.label}</span>
            <span className="bt-numeric text-xs font-semibold text-muted-foreground">
              {Math.round((e.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PortfolioView() {
  const router = useRouter();
  const { selectBusiness } = useGameStore();
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<HoldingSort>('profit');

  useEffect(() => {
    let cancelled = false;
    const fetchPortfolio = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/portfolio');
        if (res.ok && !cancelled) setData(await res.json());
      } catch {
        // silent — the empty state covers a failed fetch
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPortfolio();
    return () => { cancelled = true; };
  }, []);

  const p = data?.player;
  const portfolio = data?.portfolio;
  const bizList = useMemo(() => data?.businesses ?? [], [data]);
  const gameDay = data?.gameDay || 1;
  const maxBusinesses = data?.maxBusinesses || EXPANSION_CONFIG.maxBusinessesPerPlayer;
  const daysSinceExpansion = p ? gameDay - p.lastExpansionAt : 0;

  const holdings = useMemo(() => {
    const list = [...bizList];
    list.sort((a, b) => {
      if (sort === 'health') return b.healthScore - a.healthScore;
      if (sort === 'name') return a.name.localeCompare(b.name);
      return b.dailyProfit - a.dailyProfit;
    });
    return list;
  }, [bizList, sort]);

  /* ---- Loading ---------------------------------------------------------- */
  if (loading) {
    return (
      <div className="bt-page bt-page-narrow bt-stack" aria-busy="true" aria-label="Loading portfolio">
        <div className="bt-skeleton h-10 w-48" />
        <div className="bt-skeleton h-32 w-full rounded-2xl" />
        <div className="bt-metric-grid">
          {[...Array(4)].map((_, i) => <div key={i} className="bt-skeleton h-20 w-full rounded-xl" />)}
        </div>
        <div className="bt-skeleton h-40 w-full rounded-xl" />
      </div>
    );
  }

  /* ---- Empty ------------------------------------------------------------ */
  if (!portfolio || bizList.length === 0) {
    return (
      <div className="bt-page bt-page-narrow bt-stack">
        <header className="flex items-center gap-3">
          <span className="bt-chip h-10 w-10" aria-hidden="true">
            <Briefcase className="h-5 w-5" />
          </span>
          <div>
            <h2 className="bt-gradient-text text-xl font-bold leading-tight">Portfolio</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Everything you own, in one view</p>
          </div>
        </header>

        <div className="bt-surface bt-empty">
          <span className="bt-chip bt-tone-gold mb-3 h-14 w-14" aria-hidden="true">
            <Briefcase className="h-6 w-6" />
          </span>
          <h3 className="text-sm font-semibold">Your portfolio is empty</h3>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
            Open your first business and this page fills with holdings, allocation and performance.
          </p>
          <button
            type="button"
            onClick={() => router.push(ROUTES.newBusiness)}
            className="bt-btn-primary bt-tap mt-4 gap-1.5 rounded-lg px-4 py-2.5 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Create business
          </button>
        </div>
      </div>
    );
  }

  const profitPositive = portfolio.totalDailyProfit >= 0;
  const margin = portfolio.totalDailyRevenue > 0
    ? (portfolio.totalDailyProfit / portfolio.totalDailyRevenue) * 100
    : 0;

  const cityEntries = Object.entries(portfolio.citySpread)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      key: id,
      label: getCity(id)?.name || id,
      icon: getCity(id)?.icon,
      count,
    }));

  const typeEntries = Object.entries(portfolio.typeSpread)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      key: id,
      label: getBusinessType(id)?.name || id,
      icon: getBusinessType(id)?.icon,
      count,
    }));

  return (
    <div className="bt-page bt-page-narrow bt-stack">
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="bt-chip h-10 w-10" aria-hidden="true">
            <Briefcase className="h-5 w-5" />
          </span>
          <div>
            <h2 className="bt-gradient-text text-xl font-bold leading-tight">Portfolio</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {bizList.length} holding{bizList.length !== 1 ? 's' : ''} across {cityEntries.length} cit
              {cityEntries.length !== 1 ? 'ies' : 'y'}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bt-numeric rounded-full px-2.5 py-1 text-[11px]">
          Level {p?.level ?? 1}
        </Badge>
      </header>

      {/* ── Net worth hero ───────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        className="bt-surface-raised bt-edge bt-edge-gold bt-ambient overflow-hidden p-4 sm:p-5"
        aria-label="Net worth"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="bt-label">Net worth</p>
            <p className="bt-figure bt-gradient-text-gold mt-1 text-3xl sm:text-4xl">
              {formatTaka(p?.netWorth ?? 0)}
            </p>
            <p className="bt-numeric mt-1.5 text-xs text-muted-foreground">
              {formatTaka(p?.cash ?? 0)} liquid · {formatTakaShort(portfolio.totalInventoryValue)} in stock
            </p>
          </div>

          <div className="text-right">
            <p className="bt-label">Daily profit</p>
            <p className={cn(
              'bt-figure mt-1 flex items-center justify-end gap-1 text-2xl',
              profitPositive ? 'bt-text-profit' : 'bt-text-loss',
            )}>
              {profitPositive
                ? <TrendingUp className="h-5 w-5" aria-hidden="true" />
                : <TrendingDown className="h-5 w-5" aria-hidden="true" />}
              {profitPositive ? '+' : ''}{formatTakaShort(portfolio.totalDailyProfit)}
            </p>
            <p className="bt-numeric mt-1.5 text-xs text-muted-foreground">
              {margin.toFixed(1)}% margin
            </p>
          </div>
        </div>
      </motion.section>

      {/* ── Daily flow ───────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label="Daily performance">
        {[
          { label: 'Revenue / day', value: formatTakaShort(portfolio.totalDailyRevenue), Icon: TrendingUp, tone: 'bt-tone-emerald' },
          { label: 'Expense / day', value: formatTakaShort(portfolio.totalDailyExpense), Icon: Receipt, tone: 'bt-tone-amber' },
          { label: 'Lifetime profit', value: formatTakaShort(portfolio.totalProfit), Icon: Coins, tone: portfolio.totalProfit >= 0 ? 'bt-tone-gold' : 'bt-tone-crimson' },
          { label: 'Staff', value: portfolio.totalEmployees, Icon: Users, tone: 'bt-tone-violet' },
        ].map(({ label, value, Icon, tone }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 + i * 0.05, ease }}
            className={cn('bt-tile p-3.5', tone)}
          >
            <div className="flex items-center gap-1.5">
              <Icon className="bt-tone-text h-3.5 w-3.5" aria-hidden="true" />
              <span className="bt-label">{label}</span>
            </div>
            <p className="bt-figure bt-tone-text mt-1.5 text-xl">{value}</p>
          </motion.div>
        ))}
      </section>

      {/* ── Health band ──────────────────────────────────────────── */}
      <section className="bt-surface grid grid-cols-3 divide-x divide-border p-0" aria-label="Customer health">
        {[
          { label: 'Health', value: portfolio.avgHealthScore, Icon: HeartPulse },
          { label: 'Satisfaction', value: portfolio.avgSatisfaction, Icon: Target },
          { label: 'Loyalty', value: portfolio.avgLoyalty, Icon: Crown },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="px-3 py-3.5 text-center">
            <Icon className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <p className="bt-label">{label}</p>
            <p className="bt-figure mt-1 text-base">{value.toFixed(0)}%</p>
            <div className={cn('bt-meter mx-auto mt-1.5 h-1 w-10', value >= 60 ? 'bt-tone-emerald' : value >= 35 ? 'bt-tone-amber' : 'bt-tone-crimson')}>
              <span style={{ width: `${Math.min(100, value)}%`, background: 'var(--_t)' }} />
            </div>
          </div>
        ))}
      </section>

      {/* ── Best / worst ─────────────────────────────────────────── */}
      <section className="grid gap-2.5 sm:grid-cols-2" aria-label="Performance outliers">
        {portfolio.bestPerforming && (
          <button
            type="button"
            onClick={() => router.push(businessRoute(portfolio.bestPerforming!.id))}
            className={cn(
              'bt-surface bt-interactive bt-rail p-3.5 pl-4 text-left',
              portfolio.bestPerforming.profit >= 0 ? 'bt-tone-gold' : 'bt-tone-slate',
            )}
          >
            <div className="flex items-center gap-1.5">
              <Crown className="bt-tone-text h-3.5 w-3.5" aria-hidden="true" />
              <span className="bt-label">Best performer</span>
            </div>
            <p className="mt-1.5 truncate text-sm font-semibold">{portfolio.bestPerforming.name}</p>
            <p className={cn(
              'bt-numeric mt-0.5 text-xs font-semibold',
              portfolio.bestPerforming.profit >= 0 ? 'bt-text-profit' : 'bt-text-loss',
            )}>
              {portfolio.bestPerforming.profit >= 0 ? '+' : ''}
              {formatTakaShort(portfolio.bestPerforming.profit)}/day
            </p>
          </button>
        )}

        {portfolio.worstPerforming && bizList.length > 1 && (
          <button
            type="button"
            onClick={() => router.push(businessRoute(portfolio.worstPerforming!.id))}
            className={cn(
              'bt-surface bt-interactive bt-rail p-3.5 pl-4 text-left',
              portfolio.worstPerforming.profit < 0 ? 'bt-tone-crimson' : 'bt-tone-amber',
            )}
          >
            <div className="flex items-center gap-1.5">
              <Target className="bt-tone-text h-3.5 w-3.5" aria-hidden="true" />
              <span className="bt-label">Needs attention</span>
            </div>
            <p className="mt-1.5 truncate text-sm font-semibold">{portfolio.worstPerforming.name}</p>
            <p className={cn(
              'bt-numeric mt-0.5 text-xs font-semibold',
              portfolio.worstPerforming.profit >= 0 ? 'bt-tone-text' : 'bt-text-loss',
            )}>
              {portfolio.worstPerforming.profit >= 0 ? '+' : ''}
              {formatTakaShort(portfolio.worstPerforming.profit)}/day
            </p>
          </button>
        )}
      </section>

      {/* ── Allocation ───────────────────────────────────────────── */}
      <section className="grid gap-2.5 sm:grid-cols-2" aria-label="Allocation">
        <Allocation title="By city" Icon={Globe} entries={cityEntries} />
        <Allocation title="By sector" Icon={Layers} entries={typeEntries} />
      </section>

      {/* ── Expansion capacity ───────────────────────────────────── */}
      <section className="bt-surface p-3.5" aria-label="Expansion capacity">
        <div className="flex items-end justify-between">
          <h3 className="bt-label flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> Capacity
          </h3>
          <p className="bt-numeric text-xs text-muted-foreground">
            <span className="text-base font-bold text-foreground">{bizList.length}</span> / {maxBusinesses}
          </p>
        </div>

        {/* Slot pips read as capacity more directly than a progress bar. */}
        <div className="mt-2.5 flex gap-1.5" role="img" aria-label={`${bizList.length} of ${maxBusinesses} business slots used`}>
          {Array.from({ length: maxBusinesses }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i < bizList.length
                  ? 'bg-[linear-gradient(90deg,var(--bt-emerald),var(--bt-emerald-bright))]'
                  : 'bg-[var(--bt-surface-3)]',
              )}
            />
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="bt-well p-2.5 text-center">
            <p className="bt-label">Expansions</p>
            <p className="bt-figure mt-1 text-base">{p?.expansionCount ?? 0}</p>
          </div>
          <div className="bt-well p-2.5 text-center">
            <p className="bt-label">Days since last</p>
            <p className="bt-figure mt-1 text-base">
              {p && p.lastExpansionAt > 0 ? daysSinceExpansion : '—'}
            </p>
          </div>
        </div>

        {p && p.lastExpansionAt > 0 && daysSinceExpansion < EXPANSION_CONFIG.expansionCooldownDays && (
          <p className="bt-well-tone bt-tone-amber bt-tone-text mt-2.5 flex items-center gap-2 p-2.5 text-[11px] font-medium">
            <Timer className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Expansion cooldown — {EXPANSION_CONFIG.expansionCooldownDays - daysSinceExpansion} day
            {EXPANSION_CONFIG.expansionCooldownDays - daysSinceExpansion !== 1 ? 's' : ''} remaining
          </p>
        )}

        {bizList.length < maxBusinesses && (
          <button
            type="button"
            onClick={() => router.push(ROUTES.newBusiness)}
            className="bt-btn-primary bt-tap mt-3 w-full gap-1.5 rounded-lg py-2.5 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Open a new business
          </button>
        )}
      </section>

      {/* ── Holdings ─────────────────────────────────────────────── */}
      <section aria-label="Holdings">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="bt-section-title text-sm">
            <span className="bt-gradient-text">Holdings</span>
          </h3>
          <div className="bt-seg" role="group" aria-label="Sort holdings">
            {HOLDING_SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                className="bt-seg-item"
                data-active={sort === s.key}
                aria-pressed={sort === s.key}
                onClick={() => setSort(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {holdings.map((biz, i) => {
            const btData = getBusinessType(biz.type);
            const cityData = getCity(biz.city);
            const locData = biz.location ? getLocation(biz.location) : null;
            const isSetup = biz.setupDaysRemaining > 0;
            const profitable = biz.dailyProfit >= 0;
            const healthTone = biz.healthScore >= 60
              ? 'bt-tone-emerald'
              : biz.healthScore >= 35 ? 'bt-tone-amber' : 'bt-tone-crimson';

            return (
              <motion.button
                key={biz.id}
                type="button"
                onClick={() => router.push(businessRoute(biz.id))}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: Math.min(i, 10) * 0.03, ease }}
                className={cn(
                  'bt-surface bt-interactive bt-rail w-full overflow-hidden p-3 pl-4 text-left',
                  profitable ? 'bt-tone-emerald' : 'bt-tone-crimson',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="bt-medallion bt-medallion-sm" aria-hidden="true">
                    {btData?.icon || '🏪'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-semibold tracking-tight">{biz.name}</span>
                      <Badge variant="outline" className="bt-numeric rounded-full px-1.5 py-0 text-[9px]">
                        Lv.{biz.level}
                      </Badge>
                      {isSetup && (
                        <Badge className="bt-tone bt-tone-sky gap-1 rounded-full border px-1.5 py-0 text-[9px] font-semibold">
                          <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                          Setup {biz.setupDaysRemaining}d
                        </Badge>
                      )}
                    </div>

                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <span>{btData?.name}</span>
                      <span aria-hidden="true">·</span>
                      <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {cityData?.name}{locData ? ` · ${locData.name}` : ''}
                      </span>
                    </p>

                    <div className="mt-1.5 flex items-center gap-2">
                      <div className={cn('bt-meter h-1 max-w-[7rem] flex-1', healthTone)}>
                        <span style={{ width: `${Math.min(100, biz.healthScore)}%`, background: 'var(--_t)' }} />
                      </div>
                      <span className="bt-numeric text-[10px] text-muted-foreground">
                        {biz.healthScore.toFixed(0)}% health
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className={cn(
                      'bt-figure flex items-center justify-end gap-0.5 text-sm',
                      profitable ? 'bt-text-profit' : 'bt-text-loss',
                    )}>
                      {profitable
                        ? <TrendingUp className="h-3 w-3" aria-hidden="true" />
                        : <TrendingDown className="h-3 w-3" aria-hidden="true" />}
                      {formatTakaShort(biz.dailyProfit)}
                    </div>
                    <p className="bt-label mt-0.5">per day</p>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </div>

                {isSetup && (
                  <p className="bt-well-tone bt-tone-sky bt-tone-text mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 p-2 text-[10px] font-medium">
                    <Timer className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>
                      Setup in progress — {biz.setupDaysRemaining} day
                      {biz.setupDaysRemaining > 1 ? 's' : ''} left
                    </span>
                    <span className="ml-auto opacity-80">
                      {Math.round(EXPANSION_CONFIG.setupRevenueMultiplier * 100)}% capacity
                    </span>
                  </p>
                )}
              </motion.button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
