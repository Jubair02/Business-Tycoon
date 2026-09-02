'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { formatTaka, formatTakaShort, getBusinessType, getCity, PRODUCTS } from '@/lib/game-data';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sun,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Package,
  Flame,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailySummaryProps {
  open: boolean;
  onClose: () => void;
  previousBusinesses: any[];
}

interface MarketPriceEntry {
  productName: string;
  city: string;
  priceMultiplier: number;
  demandMultiplier: number;
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

export default function DailySummary({ open, onClose, previousBusinesses }: DailySummaryProps) {
  const { businesses, events, gameDay } = useGameStore();
  const [marketPrices, setMarketPrices] = useState<MarketPriceEntry[]>([]);
  const [loadingMarket, setLoadingMarket] = useState(false);

  // Build a lookup for previous business data
  const prevBizMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const b of previousBusinesses) {
      map[b.id] = b;
    }
    return map;
  }, [previousBusinesses]);

  // Fetch market prices for the player's cities
  useEffect(() => {
    if (!open) return;

    const playerCities = [...new Set(businesses.map((b: any) => b.city))];
    if (playerCities.length === 0) return;

    const fetchMarket = async () => {
      setLoadingMarket(true);
      try {
        const city = playerCities[0];
        const res = await fetch(`/api/market?city=${city}`);
        if (res.ok) {
          const data = await res.json();
          setMarketPrices(data);
        }
      } catch {
        // silent
      }
      setLoadingMarket(false);
    };

    fetchMarket();
  }, [open, businesses]);

  // Compute business summaries
  const businessSummaries = useMemo(() => {
    return businesses.map((b: any) => {
      const prev = prevBizMap[b.id];
      const bt = getBusinessType(b.type);
      const city = getCity(b.city);
      const revenue = b.dailyRevenue || 0;
      const expense = b.dailyExpense || 0;
      const profit = b.dailyProfit || 0;
      const repChange = prev ? b.reputation - prev.reputation : 0;
      const hasInventories = (b._count?.inventories || 0) > 0;
      const likelyStockout = hasInventories && revenue === 0 && expense > 0;

      return {
        id: b.id,
        name: b.name,
        type: b.type,
        icon: bt?.icon || '\uD83C\uDFEA',
        typeName: bt?.name || 'Unknown',
        city: city?.name || b.city,
        level: b.level || 1,
        revenue,
        expense,
        profit,
        reputation: b.reputation || 0,
        repChange,
        likelyStockout,
      };
    });
  }, [businesses, prevBizMap]);

  // Total daily profit
  const totalProfit = useMemo(() => {
    return businessSummaries.reduce((sum, b) => sum + b.profit, 0);
  }, [businessSummaries]);

  const totalRevenue = useMemo(() => {
    return businessSummaries.reduce((sum, b) => sum + b.revenue, 0);
  }, [businessSummaries]);

  const totalExpense = useMemo(() => {
    return businessSummaries.reduce((sum, b) => sum + b.expense, 0);
  }, [businessSummaries]);

  // Detect events that started recently (within last 2 minutes = this tick)
  const newEvents = useMemo(() => {
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    return events.filter((e: any) => {
      try {
        const start = new Date(e.startsAt).getTime();
        return start > twoMinutesAgo;
      } catch {
        return false;
      }
    });
  }, [events]);

  // Ongoing events (not new, max 2)
  const ongoingEvents = useMemo(() => {
    const newEventIds = new Set(newEvents.map((e) => e.id));
    return events.filter((e) => !newEventIds.has(e.id)).slice(0, 2);
  }, [events, newEvents]);

  // Market highlights: biggest gain and biggest drop
  const marketHighlights = useMemo(() => {
    if (marketPrices.length === 0) return [];

    const sorted = [...marketPrices].sort(
      (a, b) => b.priceMultiplier - a.priceMultiplier
    );

    const highlights: { name: string; multiplier: number; direction: 'up' | 'down' }[] = [];

    // Biggest gain
    const top = sorted[0];
    if (top && top.priceMultiplier > 1.01) {
      highlights.push({
        name: top.productName,
        multiplier: top.priceMultiplier,
        direction: 'up',
      });
    }

    // Biggest drop
    const bottom = sorted[sorted.length - 1];
    if (bottom && bottom.priceMultiplier < 0.99) {
      highlights.push({
        name: bottom.productName,
        multiplier: bottom.priceMultiplier,
        direction: 'down',
      });
    }

    // Most extreme demand change for variety
    if (marketPrices.length > 2) {
      const demandSorted = [...marketPrices].sort(
        (a, b) => Math.abs(b.demandMultiplier - 1) - Math.abs(a.demandMultiplier - 1)
      );
      const extremeDemand = demandSorted[0];
      if (extremeDemand && !highlights.find((h) => h.name === extremeDemand.productName)) {
        highlights.push({
          name: extremeDemand.productName,
          multiplier: extremeDemand.demandMultiplier,
          direction: extremeDemand.demandMultiplier > 1 ? 'up' : 'down',
        });
      }
    }

    return highlights.slice(0, 3);
  }, [marketPrices]);

  // Get product icon
  const getProductIcon = (name: string): string => {
    for (const category of Object.values(PRODUCTS)) {
      const found = category.find((p) => p.name === name);
      if (found) return found.icon || '\uD83D\uDCE6';
    }
    return '\uD83D\uDCE6';
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0"
        showCloseButton={false}
      >
        {/* Green Header Bar */}
        <div
          className="px-4 py-3.5 shrink-0"
          style={{ background: 'linear-gradient(135deg, #006a4e 0%, #008c66 100%)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Sun className="h-5 w-5 text-yellow-300" />
            </div>
            <div>
              <DialogTitle className="text-white text-base font-bold">
                Day {gameDay} Results
              </DialogTitle>
              <DialogDescription className="text-green-100 text-[11px] mt-0.5">
                Here&apos;s what happened today
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4" style={{ scrollbarWidth: 'thin' }}>
          {/* Business Summaries */}
          {businessSummaries.length > 0 && (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="space-y-2.5"
            >
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Business Performance
              </h3>

              {businessSummaries.map((biz) => {
                const isProfitable = biz.profit >= 0;
                const repUp = biz.repChange > 0;
                const repDown = biz.repChange < 0;

                return (
                  <motion.div
                    key={biz.id}
                    variants={cardVariants}
                    transition={{ duration: 0.3 }}
                  >
                    <div className={cn(
                      'rounded-xl border p-3 transition-colors',
                      isProfitable
                        ? 'bg-green-50/60 border-green-200/60'
                        : 'bg-red-50/40 border-red-200/60'
                    )}>
                      {/* Business header */}
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="text-xl shrink-0">{biz.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold truncate">{biz.name}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                              Lv.{biz.level}
                            </Badge>
                            {biz.likelyStockout && (
                              <Badge className="text-[9px] px-1 py-0 bg-amber-500 text-white border-0 shrink-0">
                                <Package className="h-2.5 w-2.5 mr-0.5" />
                                Out of Stock!
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {biz.typeName} &middot; {biz.city}
                          </div>
                        </div>
                      </div>

                      {/* Financials grid */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* Revenue */}
                        <div className="text-center">
                          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Revenue</div>
                          <div className="text-xs font-semibold text-green-700 flex items-center justify-center gap-0.5 mt-0.5">
                            <TrendingUp className="h-3 w-3" />
                            {formatTakaShort(biz.revenue)}
                          </div>
                        </div>

                        {/* Expenses */}
                        <div className="text-center">
                          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Expenses</div>
                          <div className="text-xs font-semibold text-red-600 flex items-center justify-center gap-0.5 mt-0.5">
                            <TrendingDown className="h-3 w-3" />
                            {formatTakaShort(biz.expense)}
                          </div>
                        </div>

                        {/* Net Profit */}
                        <div className="text-center">
                          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Profit</div>
                          <div className={cn(
                            'text-xs font-bold flex items-center justify-center gap-0.5 mt-0.5',
                            isProfitable ? 'text-green-700' : 'text-red-600'
                          )}>
                            {isProfitable ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {isProfitable ? '+' : ''}{formatTakaShort(biz.profit)}
                          </div>
                        </div>
                      </div>

                      {/* Reputation change */}
                      {(repUp || repDown) && (
                        <div className={cn(
                          'mt-2 pt-2 border-t flex items-center gap-1.5 text-[10px]',
                          repUp ? 'border-green-200/60 text-green-700' : 'border-red-200/60 text-red-600'
                        )}>
                          {repUp ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )}
                          <span>
                            Reputation {repUp ? '+' : ''}{biz.repChange.toFixed(1)}%
                          </span>
                          <span className="text-muted-foreground">
                            &rarr; {biz.reputation.toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Events Section */}
          {(newEvents.length > 0 || ongoingEvents.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Flame className="h-3.5 w-3.5" />
                Events
              </h3>

              <div className="space-y-1.5">
                {newEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200/60"
                  >
                    <span className="text-base shrink-0 mt-0.5">{event.icon || '\u26A0'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold">{event.title}</span>
                        <Badge className="text-[8px] px-1 py-0 bg-orange-500 text-white border-0">NEW</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        {event.description}
                      </div>
                    </div>
                  </div>
                ))}

                {ongoingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/40"
                  >
                    <span className="text-base shrink-0 mt-0.5">{event.icon || '\u26A0'}</span>
                    <div className="min-w-0">
                      <span className="text-xs font-medium">{event.title}</span>
                      <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        {event.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Market Highlights */}
          {loadingMarket ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : marketHighlights.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.35 }}
            >
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3.5 w-3.5" />
                Market Highlights
              </h3>

              <div className="space-y-1.5">
                {marketHighlights.map((item, i) => (
                  <div
                    key={`${item.name}-${i}`}
                    className={cn(
                      'flex items-center gap-2.5 p-2.5 rounded-lg',
                      item.direction === 'up'
                        ? 'bg-green-50/60 border border-green-200/40'
                        : 'bg-red-50/40 border border-red-200/40'
                    )}
                  >
                    <span className="text-base shrink-0">{getProductIcon(item.name)}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium">{item.name}</span>
                    </div>
                    <div className={cn(
                      'flex items-center gap-0.5 text-xs font-semibold',
                      item.direction === 'up' ? 'text-green-700' : 'text-red-600'
                    )}>
                      {item.direction === 'up' ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      {((item.multiplier - 1) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t bg-muted/30 px-4 py-3">
          {/* Total summary row */}
          <div className="flex items-center justify-between mb-3">
            <div className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Daily Profit</div>
              <div className={cn(
                'text-lg font-bold flex items-center gap-1',
                totalProfit >= 0 ? 'text-green-700' : 'text-red-600'
              )}>
                {totalProfit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                {totalProfit >= 0 ? '+' : ''}{formatTaka(totalProfit)}
              </div>
            </div>
            <div className="text-right space-y-0.5">
              <div className="text-[10px] text-muted-foreground">Revenue: <span className="text-green-700 font-medium">{formatTakaShort(totalRevenue)}</span></div>
              <div className="text-[10px] text-muted-foreground">Expenses: <span className="text-red-600 font-medium">{formatTakaShort(totalExpense)}</span></div>
            </div>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              onClick={onClose}
              className="w-full sm:w-auto text-white"
              style={{ background: '#006a4e' }}
            >
              Continue
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
