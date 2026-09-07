'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { formatTaka, formatTakaShort, CITIES, BUSINESS_TYPES } from '@/lib/game-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, BarChart3, TrendingUp, Crown, Store, Building2, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  shares: { businessName: string; playerName: string; isAI: boolean; share: number; revenue: number }[];
}

const PERSONALITY_ICONS: Record<string, string> = {
  CONSERVATIVE: '🛡️',
  BALANCED: '⚖️',
  AGGRESSIVE: '🔥',
  TRADER: '📊',
  EXPANSIONIST: '🌐',
};

export default function CompetitionView() {
  const { player } = useGameStore();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompetition = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ all: 'true' });
      const res = await fetch(`/api/market/competition?${params}`);
      if (res.ok) {
        setMarkets(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetition();
  }, []);

  const filteredMarkets = markets.filter(m => {
    if (selectedCity !== 'all' && m.city !== selectedCity) return false;
    if (selectedType !== 'all' && m.businessType !== selectedType) return false;
    return true;
  });

  // Calculate overall stats
  const totalPlayerMarkets = filteredMarkets.filter(m => m.playerBusinesses > 0).length;
  const avgShare = filteredMarkets.length > 0
    ? Math.round(filteredMarkets.reduce((sum, m) => sum + m.playerMarketShare, 0) / filteredMarkets.length)
    : 0;
  const leadingMarkets = filteredMarkets.filter(m => m.playerRank === 1).length;

  return (
    <div className="p-3 md:p-4 space-y-4 pb-24 md:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2 game-gradient-text">
          <Users className="h-5 w-5" style={{ color: '#006a4e' }} /> Market Competition
        </h2>
        <Button variant="outline" size="sm" onClick={fetchCompetition} disabled={loading} className="text-xs gap-1">
          <BarChart3 className="h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold" style={{ color: '#006a4e' }}>{avgShare}%</div>
            <div className="text-[10px] text-muted-foreground">Avg Market Share</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-amber-700">{leadingMarkets}</div>
            <div className="text-[10px] text-muted-foreground">Markets Leading</div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">{totalPlayerMarkets}</div>
            <div className="text-[10px] text-muted-foreground">Markets Active</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Select value={selectedCity} onValueChange={setSelectedCity}>
          <SelectTrigger className="flex-1 text-xs"><SelectValue placeholder="All Cities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {CITIES.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="flex-1 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {BUSINESS_TYPES.map(b => (
              <SelectItem key={b.id} value={b.id}>{b.icon} {b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Market Cards */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : filteredMarkets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-2">🏪</div>
            <p className="text-sm text-muted-foreground">No competition data yet. Start a business to compete!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredMarkets.map((market) => {
            const marketKey = `${market.city}-${market.businessType}`;
            const isExpanded = expandedMarket === marketKey;
            const hasPlayer = market.playerBusinesses > 0;

            return (
              <motion.div
                key={marketKey}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Card className={cn(
                  'border transition-all cursor-pointer hover:shadow-md',
                  hasPlayer && market.playerRank === 1 ? 'border-green-300 bg-green-50/30' : '',
                  hasPlayer && market.playerRank > 1 ? 'border-amber-200' : '',
                  !hasPlayer ? 'border-dashed opacity-70' : '',
                )}>
                  <CardContent
                    className="p-3"
                    onClick={() => setExpandedMarket(isExpanded ? null : marketKey)}
                  >
                    {/* Market Header */}
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
                        <div className="text-2xl">
                          {BUSINESS_TYPES.find(b => b.id === market.businessType)?.icon || '🏪'}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{market.businessTypeName}</span>
                          <span className="text-[10px] text-muted-foreground">• {market.cityName}</span>
                          {market.playerRank === 1 && hasPlayer && (
                            <Badge className="text-[9px] px-1.5 bg-green-600 text-white">🥇 Leading</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Store className="h-3 w-3" /> {market.totalBusinesses} businesses
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Users className="h-3 w-3" /> {market.aiBusinesses} AI competitors
                          </span>
                          {market.topCompetitor && (
                            <span className="text-[10px] text-muted-foreground">
                              Top: {market.topCompetitor.name} ({market.topCompetitor.share}%)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {hasPlayer ? (
                          <>
                            <div className={cn(
                              'text-lg font-bold',
                              market.playerMarketShare > 30 ? 'text-green-600' :
                              market.playerMarketShare > 15 ? 'text-amber-600' : 'text-red-500'
                            )}>
                              {market.playerMarketShare}%
                            </div>
                            <div className="text-[10px] text-muted-foreground">your share</div>
                          </>
                        ) : (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Not in market
                          </div>
                        )}
                      </div>
                      <ChevronRight className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        isExpanded && 'rotate-90'
                      )} />
                    </div>

                    {/* Share Bar */}
                    {hasPlayer && (
                      <div className="mt-2 flex h-3 rounded-full overflow-hidden bg-gray-100">
                        {market.shares
                          .sort((a, b) => b.share - a.share)
                          .map((share, i) => (
                            <div
                              key={i}
                              className={cn(
                                'transition-all',
                                !share.isAI ? 'bg-green-500' :
                                i === 0 ? 'bg-blue-400' :
                                i === 1 ? 'bg-indigo-400' :
                                i === 2 ? 'bg-purple-400' : 'bg-gray-300'
                              )}
                              style={{ width: `${Math.max(share.share, 2)}%` }}
                              title={`${share.playerName}: ${share.share}%`}
                            />
                          ))}
                      </div>
                    )}

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 border-t space-y-1.5">
                            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                              <Crown className="h-3 w-3" /> Market Breakdown
                            </div>
                            {market.shares
                              .sort((a, b) => b.share - a.share)
                              .map((share, i) => {
                                const isPlayer = !share.isAI;
                                return (
                                  <div key={i} className={cn(
                                    'flex items-center gap-2 p-1.5 rounded-md text-xs',
                                    isPlayer ? 'bg-green-50 border border-green-200' : 'bg-gray-50',
                                  )}>
                                    <span className="w-5 text-center font-bold text-muted-foreground">#{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1">
                                        <span className="font-medium truncate">{share.playerName}</span>
                                        {isPlayer && (
                                          <Badge className="text-[8px] px-1 bg-green-600 text-white">You</Badge>
                                        )}
                                        {share.isAI && (
                                          <Badge className="text-[8px] px-1 bg-blue-100 text-blue-700 border-blue-200">🤖 AI</Badge>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground">{share.businessName}</div>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-bold" style={{ color: '#006a4e' }}>{share.share}%</span>
                                      <span className="text-[10px] text-muted-foreground ml-1">({formatTakaShort(share.revenue)})</span>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
