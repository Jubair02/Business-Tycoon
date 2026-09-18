'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ROUTES } from '@/lib/game-routes';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { formatTakaShort, CITIES, BUSINESS_TYPES } from '@/lib/game-data';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, RefreshCw, Crown, Store, ChevronDown, Swords,
  Trophy, Target, Bot, Plus, MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Share {
  businessName: string;
  playerName: string;
  isAI: boolean;
  share: number;
  revenue: number;
}

interface MarketData {
  city: string;
  cityName: string;
  businessType: string;
  businessTypeName: string;
  totalDemand: number;
  totalBusinesses: number;
  aiBusinesses: number;
  playerBusinesses: number;
  playerMarketShare: number;
  playerRank: number;
  averageRevenue: number;
  topCompetitor: { name: string; share: number; isAI: boolean } | null;
  shares: Share[];
}

type Scope = 'all' | 'mine' | 'leading';

const SCOPES: { key: Scope; label: string }[] = [
  { key: 'all', label: 'All markets' },
  { key: 'mine', label: 'My markets' },
  { key: 'leading', label: 'Leading' },
];

/** Distinct hues for rival slices so the meter reads as a breakdown, not a
 *  gradient. The player is always emerald and always first. */
const RIVAL_COLORS = [
  'oklch(0.62 0.13 250)',
  'oklch(0.60 0.13 288)',
  'oklch(0.64 0.11 212)',
  'oklch(0.58 0.10 320)',
  'oklch(0.62 0.07 262)',
];

/** Pure loader — no state. Keeps setState local to whichever caller ran it,
 *  so the mount effect and the refresh button can own their own transitions. */
async function loadMarkets(): Promise<MarketData[] | null> {
  try {
    const res = await fetch('/api/market/competition?all=true');
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Roll a market's business-level shares up to one row per owner and locate
 *  the viewer in the result.
 *
 *  The API reports `playerMarketShare` / `playerRank` as "every non-AI
 *  business", so on a server with other human players those figures describe
 *  all humans combined rather than you — which is how a 61% share ended up
 *  sitting next to rank #3. Ranking by owner name here keeps the view honest
 *  with the data it is given. */
function standings(shares: Share[], me: string | undefined) {
  const byOwner = new Map<string, { owner: string; isAI: boolean; share: number; revenue: number; businesses: string[] }>();
  for (const s of shares) {
    const row = byOwner.get(s.playerName) ?? {
      owner: s.playerName, isAI: s.isAI, share: 0, revenue: 0, businesses: [],
    };
    row.share += s.share;
    row.revenue += s.revenue;
    row.businesses.push(s.businessName);
    byOwner.set(s.playerName, row);
  }

  const ranked = [...byOwner.values()].sort((a, b) => b.share - a.share);
  const myIndex = me ? ranked.findIndex((r) => !r.isAI && r.owner === me) : -1;

  return {
    ranked,
    mine: myIndex >= 0 ? ranked[myIndex] : null,
    myRank: myIndex >= 0 ? myIndex + 1 : null,
  };
}

type Resolved = { market: MarketData } & ReturnType<typeof standings>;

export default function CompetitionView() {
  const router = useRouter();
  const playerName = useGameStore((s) => s.player?.name);
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [scope, setScope] = useState<Scope>('all');
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompetition = useCallback(async () => {
    setLoading(true);
    const data = await loadMarkets();
    if (data) setMarkets(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setLoading(true);
      const data = await loadMarkets();
      if (cancelled) return;
      if (data) setMarkets(data);
      setLoading(false);
    };
    init();
    return () => { cancelled = true; };
  }, []);

  /* Resolve each market's standings once, then filter — the scope filter and
     the stats both need "is this mine?" answered the same way. */
  const resolved = useMemo(
    () => markets.map((m) => ({ market: m, ...standings(m.shares, playerName) })),
    [markets, playerName],
  );

  const filteredMarkets = useMemo(() => resolved.filter(({ market, mine, myRank }) => {
    if (selectedCity !== 'all' && market.city !== selectedCity) return false;
    if (selectedType !== 'all' && market.businessType !== selectedType) return false;
    if (scope === 'mine' && !mine) return false;
    if (scope === 'leading' && myRank !== 1) return false;
    return true;
  }), [resolved, selectedCity, selectedType, scope]);

  /* Stats describe the whole empire, not the current filter — otherwise the
     headline numbers move every time you narrow the list. */
  const stats = useMemo(() => {
    const contested = resolved.filter((r) => r.mine);
    const avgShare = contested.length
      ? Math.round(contested.reduce((sum, r) => sum + r.mine!.share, 0) / contested.length)
      : 0;
    return {
      avgShare,
      leading: contested.filter((r) => r.myRank === 1).length,
      active: contested.length,
      rivals: markets.reduce((sum, m) => sum + m.aiBusinesses, 0),
    };
  }, [resolved, markets]);

  const renderMarket = ({ market, ranked, mine, myRank }: Resolved, index: number) => {
    const marketKey = `${market.city}-${market.businessType}`;
    const isExpanded = expandedMarket === marketKey;
    const hasPlayer = !!mine;
    const isLeader = myRank === 1;
    const rivalCount = ranked.length - (hasPlayer ? 1 : 0);

    const tone = !hasPlayer
      ? 'bt-tone-sky'
      : isLeader
        ? 'bt-tone-emerald'
        : mine.share >= 15
          ? 'bt-tone-amber'
          : 'bt-tone-crimson';

    return (
      <motion.div
        key={marketKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: Math.min(index, 10) * 0.03, ease: [0.16, 1, 0.3, 1] }}
        className={cn('bt-surface bt-rail overflow-hidden', tone, !hasPlayer && 'opacity-80')}
      >
        <button
          type="button"
          onClick={() => setExpandedMarket(isExpanded ? null : marketKey)}
          aria-expanded={isExpanded}
          aria-controls={`market-panel-${marketKey}`}
          className="bt-interactive w-full rounded-[inherit] px-3 py-3 pl-4 text-left"
        >
          <div className="flex items-center gap-3">
            <span className="bt-medallion bt-medallion-sm" aria-hidden="true">
              {BUSINESS_TYPES.find((b) => b.id === market.businessType)?.icon || '🏪'}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h4 className="truncate text-sm font-semibold tracking-tight">
                  {market.businessTypeName}
                </h4>
                <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {market.cityName}
                </span>
                {isLeader && (
                  <Badge className="bt-tone bt-tone-gold gap-1 rounded-full border px-2 py-0 text-[10px] font-semibold">
                    <Trophy className="h-2.5 w-2.5" aria-hidden="true" /> Leading
                  </Badge>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Store className="h-3 w-3" aria-hidden="true" />
                  <span className="bt-numeric">{rivalCount}</span> rival{rivalCount !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <Bot className="h-3 w-3" aria-hidden="true" />
                  <span className="bt-numeric">{market.aiBusinesses}</span> AI
                </span>
                {ranked[0] && (
                  <span className="hidden truncate sm:inline">
                    Top: {ranked[0].owner}{' '}
                    <span className="bt-numeric">({Math.round(ranked[0].share)}%)</span>
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 text-right">
              {hasPlayer ? (
                <>
                  <div className="bt-figure bt-tone-text text-lg">
                    {Math.round(mine.share)}%
                  </div>
                  <div className="bt-label mt-0.5">Rank #{myRank}</div>
                </>
              ) : (
                <span className="bt-label">Not in market</span>
              )}
            </div>

            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                isExpanded && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </div>

          {/* Share meter — the whole market at a glance. */}
          <div className="mt-2.5">
            <div
              className={cn('bt-meter', !hasPlayer && 'opacity-60')}
              role="img"
              aria-label={
                hasPlayer
                  ? `Your share ${Math.round(mine.share)}% against ${rivalCount} rivals`
                  : `${rivalCount} owners competing, none of them you`
              }
            >
              {ranked.map((row, i) => (
                <span
                  key={row.owner}
                  style={{
                    width: `${Math.max(row.share, 1.5)}%`,
                    background: row.owner === playerName && !row.isAI
                      ? 'linear-gradient(90deg, var(--bt-emerald), var(--bt-emerald-bright))'
                      : RIVAL_COLORS[i % RIVAL_COLORS.length],
                  }}
                />
              ))}
            </div>
          </div>
        </button>

        {/* ── Expanded breakdown ─────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              id={`market-panel-${marketKey}`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 pl-4">
                <hr className="bt-divider mb-3" />
                <h5 className="bt-label mb-2 flex items-center gap-1.5">
                  <Crown className="h-3 w-3" aria-hidden="true" /> Market breakdown
                </h5>

                <ul className="space-y-1.5">
                  {ranked.map((row, i) => {
                    const isMe = !row.isAI && row.owner === playerName;
                    return (
                    <li
                      key={row.owner}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg p-2',
                        isMe ? 'bt-well-tone bt-tone-emerald' : 'bt-well',
                      )}
                    >
                      <span
                        className={cn(
                          'bt-numeric w-6 shrink-0 text-center text-xs font-bold',
                          i === 0 ? 'bt-text-gold' : 'text-muted-foreground',
                        )}
                      >
                        {i + 1}
                      </span>
                      <span
                        className="h-6 w-1 shrink-0 rounded-full"
                        style={{
                          background: isMe
                            ? 'linear-gradient(180deg, var(--bt-emerald), var(--bt-emerald-bright))'
                            : RIVAL_COLORS[i % RIVAL_COLORS.length],
                        }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-semibold">{row.owner}</span>
                          {isMe && (
                            <Badge className="bt-tone bt-tone-emerald rounded-full border px-1.5 py-0 text-[9px] font-bold">
                              You
                            </Badge>
                          )}
                          {row.isAI && (
                            <Badge variant="outline" className="gap-0.5 rounded-full px-1.5 py-0 text-[9px] font-semibold">
                              <Bot className="h-2.5 w-2.5" aria-hidden="true" /> AI
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {row.businesses.join(' · ')}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="bt-figure text-xs">{Math.round(row.share)}%</div>
                        <div className="bt-numeric text-[10px] text-muted-foreground">
                          {formatTakaShort(row.revenue)}
                        </div>
                      </div>
                    </li>
                    );
                  })}
                </ul>

                {!hasPlayer && (
                  <div className="bt-well-tone bt-tone-sky mt-3 flex flex-wrap items-center justify-between gap-2 p-2.5">
                    <p className="text-[11px] text-muted-foreground">
                      You have no presence in this market.
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push(ROUTES.newBusiness)}
                      className="bt-btn-primary bt-tap gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" /> Open here
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="bt-page bt-page-narrow bt-stack">
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="bt-chip h-10 w-10" aria-hidden="true">
            <Swords className="h-5 w-5" />
          </span>
          <div>
            <h2 className="bt-gradient-text text-xl font-bold leading-tight">Competition</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Where you stand against every rival, market by market
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchCompetition}
          disabled={loading}
          aria-label="Refresh competition data"
          className="bt-tap bt-surface bt-interactive ml-auto gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {/* ── Standing ─────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label="Competitive standing">
        {[
          { label: 'Avg share', value: `${stats.avgShare}%`, Icon: Target, tone: 'bt-tone-emerald' },
          { label: 'Leading', value: stats.leading, Icon: Trophy, tone: 'bt-tone-gold' },
          { label: 'Active in', value: stats.active, Icon: Store, tone: 'bt-tone-sky' },
          { label: 'AI rivals', value: stats.rivals, Icon: Bot, tone: 'bt-tone-violet' },
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
            <p className="bt-figure bt-tone-text mt-1.5 text-xl">{loading ? '—' : value}</p>
          </motion.div>
        ))}
      </section>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <section className="bt-glass sticky top-2 z-10 space-y-2.5 rounded-2xl border p-2.5" aria-label="Filter markets">
        <div className="bt-tabstrip" role="group" aria-label="Market scope">
          <div className="bt-seg">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                type="button"
                className="bt-seg-item"
                data-active={scope === s.key}
                aria-pressed={scope === s.key}
                onClick={() => setScope(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={selectedCity} onValueChange={setSelectedCity}>
            <SelectTrigger className="h-10 flex-1 rounded-lg text-xs" aria-label="City">
              <SelectValue placeholder="All Cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {CITIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="h-10 flex-1 rounded-lg text-xs" aria-label="Business type">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {BUSINESS_TYPES.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* ── Markets ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading markets">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bt-surface p-3">
              <div className="bt-skeleton h-16 w-full" />
            </div>
          ))}
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="bt-surface bt-empty">
          <span className="bt-chip bt-tone-sky mb-3 h-14 w-14" aria-hidden="true">
            <Users className="h-6 w-6" />
          </span>
          <h3 className="text-sm font-semibold">
            {markets.length === 0 ? 'No rivals yet' : 'No markets in this view'}
          </h3>
          <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
            {markets.length === 0
              ? 'Open your first business to enter a market and start competing.'
              : 'Nothing matches this scope. Widen the filters to see more markets.'}
          </p>
          {markets.length === 0 ? (
            <button
              type="button"
              onClick={() => router.push(ROUTES.newBusiness)}
              className="bt-btn-primary bt-tap mt-4 gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Create a business
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setScope('all'); setSelectedCity('all'); setSelectedType('all'); }}
              className="bt-btn-primary bt-tap mt-4 rounded-lg px-4 py-2 text-xs font-semibold"
            >
              Reset filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMarkets.map((row, i) => renderMarket(row, i))}
        </div>
      )}
    </div>
  );
}
