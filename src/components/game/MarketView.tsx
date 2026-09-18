'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { CITIES, BUSINESS_TYPES, getCity, getBusinessType } from '@/lib/game-data';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  TrendingUp, TrendingDown, Minus, LineChart, Search, Flame,
  Activity, X, ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MarketProduct {
  id?: string;
  name: string;
  icon?: string;
  category?: string;
  currentPrice?: number;
  basePrice?: number;
  currentDemand?: number;
}

type SortKey = 'trend' | 'demand' | 'price' | 'name';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'trend', label: 'Movers' },
  { key: 'demand', label: 'Demand' },
  { key: 'price', label: 'Price' },
  { key: 'name', label: 'A–Z' },
];

/** Deterministic 7-point series from a seed, so a product's sparkline is
 *  stable across renders instead of reshuffling on every tick. */
const getSparklineBars = (seed: string): number[] => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < 7; i++) {
    hash = ((hash << 3) ^ (hash >>> 2)) & 0x7fffffff;
    bars.push(24 + (hash % 62));
  }
  return bars;
};

const changeOf = (p: MarketProduct) => {
  const base = p.basePrice || 0;
  if (!base) return 0;
  return ((p.currentPrice || 0) - base) / base;
};

const demandBand = (demand: number) =>
  demand >= 1.2 ? 'high' : demand >= 0.8 ? 'mid' : 'low';

const DEMAND_META = {
  high: { label: 'High', tone: 'bt-tone-emerald' },
  mid: { label: 'Steady', tone: 'bt-tone-amber' },
  low: { label: 'Low', tone: 'bt-tone-crimson' },
} as const;

export default function MarketView() {
  const { selectedCity, setSelectedCity } = useGameStore();
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('trend');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ city: selectedCity, type: selectedType });
        const res = await fetch(`/api/market/products?${params}`);
        if (res.ok && !cancelled) setProducts(await res.json());
      } catch {
        // silent — the empty state covers a failed fetch
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProducts();
    return () => { cancelled = true; };
  }, [selectedCity, selectedType]);

  /* ---- Market pulse: the synthesis that turns a price list into a market ---- */
  const pulse = useMemo(() => {
    if (!products.length) return { rising: 0, falling: 0, hot: 0, avgDemand: 0 };
    let rising = 0, falling = 0, hot = 0, demandSum = 0;
    for (const p of products) {
      const c = changeOf(p);
      if (c > 0.02) rising++;
      else if (c < -0.02) falling++;
      const d = p.currentDemand || 1;
      demandSum += d;
      if (d >= 1.2) hot++;
    }
    return {
      rising,
      falling,
      hot,
      avgDemand: Math.round((demandSum / products.length) * 100),
    };
  }, [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? products.filter((p) => p.name?.toLowerCase().includes(q))
      : products;

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'trend':
          return Math.abs(changeOf(b)) - Math.abs(changeOf(a));
        case 'demand':
          return (b.currentDemand || 0) - (a.currentDemand || 0);
        case 'price':
          return (b.currentPrice || 0) - (a.currentPrice || 0);
        default:
          return (a.name || '').localeCompare(b.name || '');
      }
    });
    return sorted;
  }, [products, query, sort]);

  /* Category sections only make sense in the unsorted "all types" browse.
     Once you sort by movers or demand, a flat ranked list is the point. */
  const sections = useMemo(() => {
    if (selectedType !== 'all' || sort !== 'name') return null;
    const map = new Map<string, MarketProduct[]>();
    for (const p of visible) {
      const cat = p.category || 'OTHER';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return [...map].map(([cat, items]) => ({ type: getBusinessType(cat), items }));
  }, [visible, selectedType, sort]);

  const city = getCity(selectedCity);
  const activeFilters = (query ? 1 : 0) + (selectedType !== 'all' ? 1 : 0);

  const renderRow = (p: MarketProduct, i: number) => {
    const change = changeOf(p);
    const demand = p.currentDemand || 1;
    const band = demandBand(demand);
    const bt = getBusinessType(p.category || '');
    const bars = getSparklineBars(p.id || p.name);
    const dir = change > 0.02 ? 'up' : change < -0.02 ? 'down' : 'flat';
    const tone = dir === 'up' ? 'bt-tone-emerald' : dir === 'down' ? 'bt-tone-crimson' : 'bt-tone-sky';
    const TrendIcon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;

    return (
      <motion.article
        key={p.id || p.name}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: Math.min(i, 12) * 0.025, ease: [0.16, 1, 0.3, 1] }}
        className={cn('bt-surface bt-rail bt-sheen overflow-hidden', tone)}
      >
        <div className="flex items-center gap-3 py-2.5 pl-4 pr-3">
          <span className="bt-medallion bt-medallion-sm" aria-hidden="true">
            {p.icon || '📦'}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="truncate text-sm font-semibold tracking-tight">{p.name}</h4>
              {bt && (
                <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
                  {bt.name}
                </span>
              )}
            </div>

            {/* Demand as a meter reads faster than a coloured word. */}
            <div className="mt-1.5 flex items-center gap-2">
              <div
                className={cn('bt-meter h-1 w-10 shrink-0 sm:w-14', DEMAND_META[band].tone)}
                role="img"
                aria-label={`Demand ${DEMAND_META[band].label}`}
              >
                <span
                  style={{
                    width: `${Math.min(100, (demand / 1.6) * 100)}%`,
                    background: 'linear-gradient(90deg, color-mix(in oklch, var(--_t) 60%, transparent), var(--_t))',
                  }}
                />
              </div>
              <span className={cn('text-[11px] font-medium', DEMAND_META[band].tone, 'bt-tone-text')}>
                {DEMAND_META[band].label}
              </span>
              <span className="bt-numeric hidden truncate text-[11px] text-muted-foreground min-[420px]:inline">
                base ৳{(p.basePrice || 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Trend series — dropped below 380px where it would crowd the price. */}
          <div className="hidden h-8 items-end gap-[3px] min-[380px]:flex" aria-hidden="true">
            {bars.map((h, bi) => (
              <span key={bi} className="bt-sparkbar" style={{ height: `${h}%` }} />
            ))}
          </div>

          <div className="shrink-0 text-right">
            <div className="bt-figure text-sm">৳{(p.currentPrice || 0).toLocaleString()}</div>
            <div className="bt-tone-text mt-0.5 flex items-center justify-end gap-0.5 text-[11px] font-semibold">
              <TrendIcon className="h-3 w-3" aria-hidden="true" />
              <span className="bt-numeric">
                {change > 0 ? '+' : ''}{(change * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </motion.article>
    );
  };

  return (
    <div className="bt-page bt-page-narrow bt-stack">
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="bt-chip h-10 w-10" aria-hidden="true">
            <LineChart className="h-5 w-5" />
          </span>
          <div>
            <h2 className="bt-gradient-text text-xl font-bold leading-tight">Market</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Live prices in {city?.name ?? '—'} · demand shifts with active events
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bt-numeric gap-1.5 rounded-full px-2.5 py-1 text-[11px]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 game-pulse-soft" />
          {products.length} tracked
        </Badge>
      </header>

      {/* ── Market pulse ─────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label="Market summary">
        {[
          { label: 'Rising', value: pulse.rising, Icon: TrendingUp, tone: 'bt-tone-emerald' },
          { label: 'Falling', value: pulse.falling, Icon: TrendingDown, tone: 'bt-tone-crimson' },
          { label: 'In demand', value: pulse.hot, Icon: Flame, tone: 'bt-tone-amber' },
          { label: 'Avg demand', value: `${pulse.avgDemand}%`, Icon: Activity, tone: 'bt-tone-sky' },
        ].map(({ label, value, Icon, tone }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className={cn('bt-tile p-3', tone)}
          >
            <div className="flex items-center gap-1.5">
              <Icon className="bt-tone-text h-3.5 w-3.5" aria-hidden="true" />
              <span className="bt-label">{label}</span>
            </div>
            <p className="bt-figure bt-tone-text mt-1.5 text-xl">
              {loading ? '—' : value}
            </p>
          </motion.div>
        ))}
      </section>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <section
        className="bt-glass sticky top-2 z-10 space-y-2.5 rounded-2xl border p-2.5"
        aria-label="Filter market"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              className="h-10 rounded-lg pl-9 pr-9 text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="bt-tap absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="h-10 flex-1 rounded-lg text-xs sm:w-[150px] sm:flex-none" aria-label="City">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="h-10 flex-1 rounded-lg text-xs sm:w-[160px] sm:flex-none" aria-label="Business type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {BUSINESS_TYPES.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <ArrowUpDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="bt-seg" role="group" aria-label="Sort products">
              {SORTS.map((s) => (
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
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={() => { setQuery(''); setSelectedType('all'); }}
              className="shrink-0 text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      </section>

      {/* ── Results ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading market prices">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bt-surface p-3">
              <div className="bt-skeleton h-11 w-full" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bt-surface bt-empty">
          <span className="bt-chip bt-tone-sky mb-3 h-14 w-14" aria-hidden="true">
            <Search className="h-6 w-6" />
          </span>
          <h3 className="text-sm font-semibold">Nothing matches</h3>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
            {products.length === 0
              ? `No market data for ${city?.name ?? 'this city'} yet. Try another city or category.`
              : 'No products match your search. Try a different term or reset the filters.'}
          </p>
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={() => { setQuery(''); setSelectedType('all'); }}
              className="bt-btn-primary bt-tap mt-4 rounded-lg px-4 py-2 text-xs font-semibold"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : sections ? (
        <div className="space-y-6">
          {sections.map((section, si) => (
            <section key={section.type?.id || si}>
              <h3 className="bt-section-title mb-2.5 text-sm">
                <span aria-hidden="true">{section.type?.icon}</span>
                <span className="bt-gradient-text">{section.type?.name || 'Other'}</span>
                <span className="bt-numeric rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {section.items.length}
                </span>
              </h3>
              <div className="space-y-2">
                {section.items.map((p, i) => renderRow(p, i))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-2">{visible.map((p, i) => renderRow(p, i))}</div>
      )}
    </div>
  );
}
