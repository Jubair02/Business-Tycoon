'use client';

import { useGameStore } from '@/store/game-store';
import { formatTakaShort, getBusinessType, getCity } from '@/lib/game-data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Plus, TrendingUp, TrendingDown, Building2, MapPin, Users, Star, Package, UserPlus, ArrowUpCircle, Briefcase } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Generate a deterministic mini sparkline from a seed string
const getMiniSparkline = (seed: string): number[] => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < 5; i++) {
    hash = ((hash << 3) ^ (hash >>> 2)) & 0x7fffffff;
    bars.push(20 + (hash % 60));
  }
  return bars;
};

export default function BusinessList() {
  const { businesses, setView, selectBusiness } = useGameStore();

  // Computed values for summary bar
  const totalBusinesses = businesses.length;
  const totalDailyProfit = businesses.reduce((sum: number, b: any) => sum + (b.dailyProfit || 0), 0);
  const totalStaff = businesses.reduce((sum: number, b: any) => sum + (b._count?.employees || 0), 0);

  // Best performer
  const bestPerformer = businesses.length > 0
    ? businesses.reduce((best: any, b: any) => (b.dailyProfit || 0) > (best?.dailyProfit || 0) ? b : best, null)
    : null;

  return (
    <div className="p-3 md:p-4 space-y-5 pb-24 md:pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="game-badge-gradient">Your Businesses</span>
          <span className="text-xs font-bold text-muted-foreground bg-muted rounded-full px-2 py-0.5">{businesses.length}</span>
        </h2>
        <Button size="sm" onClick={() => setView('new-business')} className="gap-1.5 text-white text-xs rounded-lg shadow-sm hover:shadow-md transition-shadow game-btn-shimmer" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </div>

      {/* Summary Bar */}
      {businesses.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="grid grid-cols-3 gap-2">
            <div className="game-stat-card rounded-lg p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Businesses</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: '#006a4e' }}>{totalBusinesses}</p>
            </div>
            <div className="game-stat-card rounded-lg p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Daily Profit</p>
              <p className={cn('text-sm font-bold mt-0.5', totalDailyProfit >= 0 ? 'text-green-700' : 'text-red-600')}>
                {totalDailyProfit >= 0 ? '+' : ''}{formatTakaShort(totalDailyProfit)}
              </p>
            </div>
            <div className="game-stat-card rounded-lg p-2.5 text-center">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Total Staff</p>
              <p className="text-sm font-bold mt-0.5" style={{ color: '#006a4e' }}>
                <Users className="h-3 w-3 inline mr-0.5" />{totalStaff}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {businesses.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-xl">
            <CardContent className="game-empty-state">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-2" style={{ background: 'linear-gradient(135deg, rgba(0,106,78,0.08), rgba(0,168,107,0.12))' }}>
                <span className="game-empty-icon" style={{ fontSize: '2.5rem', margin: 0, opacity: 0.5, filter: 'none' }}>🏗️</span>
              </div>
              <p className="game-empty-title">No Businesses Yet</p>
              <p className="game-empty-desc">Create your first business to start earning profits in Bangladesh!</p>
              <button className="game-empty-action" onClick={() => setView('new-business')}>
                <Plus className="h-3.5 w-3.5 inline mr-1" style={{ verticalAlign: '-1px' }} />Create Your First Business
              </button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {businesses.map((b: any, i: number) => {
            const bt = getBusinessType(b.type);
            const city = getCity(b.city);
            const profit = b.dailyProfit || 0;
            const isPositive = profit >= 0;
            const isBest = bestPerformer && bestPerformer.id === b.id;
            const sparkBars = getMiniSparkline(b.id || b.name);
            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
              >
                <Card className={cn(
                  'cursor-pointer rounded-xl transition-all duration-300 hover:shadow-lg relative overflow-hidden',
                  isBest ? 'hover:border-green-400 border-green-300' : 'hover:border-green-200'
                )} onClick={() => selectBusiness(b.id)}>
                  {/* Best performer star badge */}
                  {isBest && (
                    <div className="absolute top-2 right-2 z-10">
                      <Badge className="text-[9px] font-bold px-1.5 py-0 rounded-full text-white" style={{ background: 'linear-gradient(135deg, #006a4e, #00a86b)' }}>
                        <Star className="h-2.5 w-2.5 mr-0.5" />
                        Best
                      </Badge>
                    </div>
                  )}
                  <div
                    className="h-1 rounded-t-xl"
                    style={{
                      background: isPositive
                        ? 'linear-gradient(90deg, #006a4e, #00a86b)'
                        : 'linear-gradient(90deg, #f42a41, #f87171)',
                    }}
                  />
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn('text-3xl p-2.5 rounded-xl shrink-0 shadow-sm', bt?.bgColor || 'bg-gray-50')}>
                        {bt?.icon || '🏪'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate pr-12">{b.name}</div>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground font-medium">
                          <MapPin className="h-3 w-3" />
                          {city?.name} <span className="text-border">·</span> {bt?.name}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          <Badge variant="secondary" className="text-[10px] px-2 py-0 rounded-full font-semibold bg-green-50 text-green-700">
                            Lv.{b.level || 1}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] px-2 py-0 rounded-full font-medium">
                            {b._count?.inventories || 0} items
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] px-2 py-0 rounded-full font-medium">
                            {b._count?.employees || 0} staff
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <hr className="game-divider-gradient my-3" />
                    <div className="space-y-2.5">
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">
                          <span>Reputation</span>
                          <span className="normal-case">{b.reputation || 0}%</span>
                        </div>
                        <Progress value={b.reputation || 0} className="h-1.5 rounded-full" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-medium">Daily Profit</span>
                          {/* CSS-only sparkline */}
                          <div className="flex items-end gap-[1.5px] h-4" aria-hidden="true">
                            {sparkBars.map((h, bi) => (
                              <div
                                key={bi}
                                className="rounded-sm"
                                style={{
                                  width: '2.5px',
                                  height: `${h}%`,
                                  background: isPositive
                                    ? 'linear-gradient(180deg, rgba(0, 106, 78, 0.6), rgba(0, 106, 78, 0.2))'
                                    : 'linear-gradient(180deg, rgba(244, 42, 65, 0.5), rgba(244, 42, 65, 0.15))',
                                  transition: 'height 0.3s ease',
                                }}
                              />
                            ))}
                          </div>
                        </div>
                        <span className={cn(
                          'text-sm font-bold flex items-center gap-1 px-2 py-0.5 rounded-lg',
                          isPositive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        )}>
                          {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {isPositive ? '+' : ''}{formatTakaShort(profit)}
                        </span>
                      </div>
                    </div>
                    {/* Quick-action button row */}
                    <hr className="game-divider-gradient my-3" />
                    <div className="flex items-center gap-1.5">
                      <button
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        onClick={(e) => { e.stopPropagation(); selectBusiness(b.id); }}
                      >
                        <Package className="h-3 w-3" />
                        Inventory
                      </button>
                      <button
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        onClick={(e) => { e.stopPropagation(); selectBusiness(b.id); }}
                      >
                        <UserPlus className="h-3 w-3" />
                        Hire
                      </button>
                      <button
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        onClick={(e) => { e.stopPropagation(); selectBusiness(b.id); }}
                      >
                        <ArrowUpCircle className="h-3 w-3" />
                        Upgrade
                      </button>
                    </div>
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
