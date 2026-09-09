'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import {
  formatTaka, formatTakaShort, BUSINESS_TYPES, CITIES, getBusinessType, getCity,
} from '@/lib/game-data';
import {
  getLocation, EXPANSION_CONFIG,
} from '@/lib/game/expansion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Wallet, Building2, Users, TrendingUp, TrendingDown, ArrowRight,
  Zap, Plus, BarChart3, Clock, Star, AlertTriangle, MapPin,
  LayoutGrid, ChevronRight, Crown, Target, Globe, Timer,
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

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export default function PortfolioView() {
  const { setView, selectBusiness, player, businesses } = useGameStore();
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPortfolio = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/portfolio');
        if (res.ok) {
          setData(await res.json());
        }
      } catch { /* silent */ }
      setLoading(false);
    };
    fetchPortfolio();
  }, []);

  const p = data?.player;
  const portfolio = data?.portfolio;
  const bizList = data?.businesses || [];
  const gameDay = data?.gameDay || 1;
  const maxBusinesses = data?.maxBusinesses || EXPANSION_CONFIG.maxBusinessesPerPlayer;

  const daysSinceExpansion = p ? gameDay - p.lastExpansionAt : 0;

  const handleBusinessClick = (id: string) => {
    selectBusiness(id);
  };

  if (loading) {
    return (
      <div className="p-3 md:p-4 pb-24 md:pb-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-3"><div className="h-14 bg-muted animate-pulse rounded" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-4"><div className="h-32 bg-muted animate-pulse rounded" /></CardContent></Card>
      </div>
    );
  }

  if (!portfolio || bizList.length === 0) {
    return (
      <div className="p-3 md:p-4 pb-24 md:pb-4">
        <div className="flex items-center gap-2 mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
              <LayoutGrid className="h-4 w-4 text-white" />
            </div>
            <span className="game-badge-gradient">Portfolio</span>
          </h2>
        </div>
        <Card className="border-dashed shadow-sm">
          <CardContent className="py-8 text-center">
            <div className="text-4xl mb-2">📊</div>
            <h4 className="text-sm font-bold mb-1">No Businesses Yet</h4>
            <p className="text-xs text-muted-foreground mb-3">Create your first business to see your portfolio dashboard.</p>
            <Button
              onClick={() => setView('new-business')}
              className="gap-1.5 text-white rounded-lg"
              style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}
            >
              <Plus className="h-4 w-4" /> Create Business
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-3 md:p-4 space-y-4 pb-24 md:pb-4"
    >
      {/* Header */}
      <motion.div variants={item}>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
              <LayoutGrid className="h-4 w-4 text-white" />
            </div>
            <span className="game-badge-gradient">Portfolio</span>
          </h2>
          <Badge className="text-[10px] px-1.5 py-0 text-white" style={{ background: '#006a4e' }}>
            {bizList.length} Business{bizList.length !== 1 ? 'es' : ''}
          </Badge>
        </div>
      </motion.div>

      {/* Combined Metrics */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Card className="border-0 shadow-sm bg-green-50/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-7 w-7 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-green-700" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Daily Revenue</span>
            </div>
            <div className="text-base font-bold text-green-700">{formatTakaShort(portfolio.totalDailyRevenue)}</div>
          </CardContent>
        </Card>

        <Card className={cn('border-0 shadow-sm', portfolio.totalDailyProfit >= 0 ? 'bg-emerald-50/50' : 'bg-red-50/50')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', portfolio.totalDailyProfit >= 0 ? 'bg-emerald-100' : 'bg-red-100')}>
                {portfolio.totalDailyProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-700" /> : <TrendingDown className="h-3.5 w-3.5 text-red-600" />}
              </div>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Daily Profit</span>
            </div>
            <div className={cn('text-base font-bold', portfolio.totalDailyProfit >= 0 ? 'text-emerald-700' : 'text-red-600')}>
              {portfolio.totalDailyProfit >= 0 ? '+' : ''}{formatTakaShort(portfolio.totalDailyProfit)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-amber-50/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <Wallet className="h-3.5 w-3.5 text-amber-700" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total Profit</span>
            </div>
            <div className="text-base font-bold">{formatTakaShort(portfolio.totalProfit)}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-purple-50/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-purple-700" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Staff</span>
            </div>
            <div className="text-base font-bold">{portfolio.totalEmployees}</div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Secondary Metrics Row */}
      <motion.div variants={item} className="grid grid-cols-3 gap-2.5">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Daily Expense</div>
            <div className="text-sm font-bold text-amber-600">{formatTakaShort(portfolio.totalDailyExpense)}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Cumul. Revenue</div>
            <div className="text-sm font-bold">{formatTakaShort(portfolio.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Health</div>
            <div className="text-sm font-bold">{portfolio.avgHealthScore.toFixed(0)}%</div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Best / Worst Performing */}
      <motion.div variants={item} className="grid grid-cols-2 gap-2.5">
        {portfolio.bestPerforming && (
          <Card
            className="border-0 shadow-sm bg-green-50/30 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleBusinessClick(portfolio.bestPerforming!.id)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Crown className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Best Performer</span>
              </div>
              <div className="text-sm font-bold truncate">{portfolio.bestPerforming.name}</div>
              <div className="text-xs text-green-600 font-semibold mt-0.5">
                +{formatTakaShort(portfolio.bestPerforming.profit)}/day
              </div>
            </CardContent>
          </Card>
        )}
        {portfolio.worstPerforming && bizList.length > 1 && (
          <Card
            className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            style={{ background: portfolio.worstPerforming.profit < 0 ? 'rgba(239,68,68,0.05)' : undefined }}
            onClick={() => handleBusinessClick(portfolio.worstPerforming!.id)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Target className="h-3.5 w-3.5 text-red-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">Needs Attention</span>
              </div>
              <div className="text-sm font-bold truncate">{portfolio.worstPerforming.name}</div>
              <div className={cn('text-xs font-semibold mt-0.5', portfolio.worstPerforming.profit >= 0 ? 'text-amber-600' : 'text-red-600')}>
                {portfolio.worstPerforming.profit >= 0 ? '+' : ''}{formatTakaShort(portfolio.worstPerforming.profit)}/day
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* City & Type Spread */}
      <motion.div variants={item} className="grid grid-cols-2 gap-2.5">
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider">
              <Globe className="h-3.5 w-3.5" style={{ color: '#006a4e' }} />
              City Spread
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {Object.entries(portfolio.citySpread).map(([cityId, count]) => {
              const cityData = getCity(cityId);
              return (
                <div key={cityId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{cityData?.icon || '🏙️'}</span>
                    <span className="text-xs font-medium">{cityData?.name || cityId}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider">
              <Building2 className="h-3.5 w-3.5" style={{ color: '#006a4e' }} />
              Business Types
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {Object.entries(portfolio.typeSpread).map(([typeId, count]) => {
              const btData = getBusinessType(typeId);
              return (
                <div key={typeId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{btData?.icon || '🏪'}</span>
                    <span className="text-xs font-medium">{btData?.name || typeId}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>

      {/* Expansion Info */}
      <motion.div variants={item}>
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5" style={{ color: '#006a4e' }} />
              Expansion
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Businesses Owned</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold">{bizList.length}</span>
                <span className="text-xs text-muted-foreground">/ {maxBusinesses}</span>
              </div>
            </div>
            <Progress value={(bizList.length / maxBusinesses) * 100} className="h-1.5" />

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Expansion Count</span>
              <span className="text-sm font-bold">{p?.expansionCount || 0}</span>
            </div>

            {p && p.lastExpansionAt > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Days Since Last Expansion</span>
                <span className="text-sm font-bold">{daysSinceExpansion}</span>
              </div>
            )}

            {p && daysSinceExpansion < EXPANSION_CONFIG.expansionCooldownDays && p.lastExpansionAt > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50/50 border border-amber-200/60 text-xs text-amber-700 font-medium">
                <Timer className="h-3.5 w-3.5 shrink-0" />
                Cooldown: {EXPANSION_CONFIG.expansionCooldownDays - daysSinceExpansion} days remaining
              </div>
            )}

            {/* Satisfaction & Loyalty averages */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Satisfaction</div>
                <div className="text-sm font-bold">{portfolio.avgSatisfaction.toFixed(0)}%</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Loyalty</div>
                <div className="text-sm font-bold">{portfolio.avgLoyalty.toFixed(0)}%</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Health</div>
                <div className="text-sm font-bold">{portfolio.avgHealthScore.toFixed(0)}%</div>
              </div>
            </div>

            {bizList.length < maxBusinesses && (
              <Button
                onClick={() => setView('new-business')}
                className="w-full gap-1.5 text-white rounded-lg mt-2"
                style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}
              >
                <Plus className="h-4 w-4" /> Expand — Open New Business
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Business Comparison Cards */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" style={{ color: '#006a4e' }} />
            Business Comparison
          </h3>
        </div>
        <div className="space-y-2">
          {bizList.map((biz) => {
            const btData = getBusinessType(biz.type);
            const cityData = getCity(biz.city);
            const locData = biz.location ? getLocation(biz.location) : null;
            const profit = biz.dailyProfit;
            const isSetup = biz.setupDaysRemaining > 0;

            return (
              <motion.div key={biz.id} variants={item}>
                <Card
                  className="cursor-pointer shadow-sm hover:shadow-md transition-all game-card-interactive"
                  onClick={() => handleBusinessClick(biz.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('text-2xl p-2 rounded-xl shrink-0', btData?.bgColor || 'bg-gray-50')}>
                        {btData?.icon || '🏪'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">{biz.name}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                            Lv.{biz.level}
                          </Badge>
                          {isSetup && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-blue-50 text-blue-700 border border-blue-200 shrink-0" variant="outline">
                              <Clock className="h-2.5 w-2.5 mr-0.5" /> Setup {biz.setupDaysRemaining}d
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                          <span>{btData?.name}</span>
                          <span>·</span>
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {cityData?.name}
                          </span>
                          {locData && (
                            <>
                              <span>·</span>
                              <span>{locData.name}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex-1">
                            <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                              <span>Health</span>
                              <span>{biz.healthScore.toFixed(0)}%</span>
                            </div>
                            <Progress value={biz.healthScore} className="h-1" />
                          </div>
                          <div className={cn('text-xs font-bold flex items-center gap-0.5', profit >= 0 ? 'text-green-600' : 'text-red-500')}>
                            {profit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {formatTakaShort(profit)}/day
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      </div>
                    </div>

                    {/* Setup Period Indicator */}
                    {isSetup && (
                      <div className="mt-2 p-2 rounded-lg bg-blue-50/50 border border-blue-200/40">
                        <div className="flex items-center gap-2 text-[10px] text-blue-700 font-medium">
                          <Timer className="h-3 w-3 shrink-0" />
                          <span>Setup in progress — {biz.setupDaysRemaining} day{biz.setupDaysRemaining > 1 ? 's' : ''} remaining</span>
                          <span className="ml-auto text-blue-600">Operating at {Math.round(EXPANSION_CONFIG.setupRevenueMultiplier * 100)}% capacity</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
