'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { formatTaka, formatTakaShort, getBusinessType, getCity } from '@/lib/game-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, TrendingUp, TrendingDown, Store, Star, Newspaper, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { player, businesses, news, events, setView, selectBusiness } = useGameStore();
  const profitHistory = useMemo(() => {
    if (businesses.length === 0) {
      return [{ day: 1, profit: 0 }, { day: 2, profit: 0 }, { day: 3, profit: 0 }];
    }
    return businesses.map((b: any, i: number) => ({ day: i + 1, profit: b.dailyProfit || 0 }));
  }, [businesses]);

  const totalBusinesses = businesses.length;
  const totalProfit = businesses.reduce((sum: number, b: any) => sum + (b.dailyProfit || 0), 0);
  const avgReputation = totalBusinesses > 0
    ? Math.round(businesses.reduce((sum: number, b: any) => sum + (b.reputation || 0), 0) / totalBusinesses)
    : 0;

  if (!player) return null;

  return (
    <div className="p-3 md:p-4 space-y-4 pb-24 md:pb-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-l-4" style={{ borderLeftColor: '#006a4e' }}>
            <CardContent className="p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Net Worth</div>
              <div className="text-lg font-bold mt-0.5" style={{ color: '#006a4e' }}>{formatTakaShort(player.netWorth)}</div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className={totalProfit >= 0 ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}>
            <CardContent className="p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Daily Profit</div>
              <div className={`text-lg font-bold mt-0.5 flex items-center gap-1 ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {totalProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {formatTakaShort(Math.abs(totalProfit))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Businesses</div>
              <div className="text-lg font-bold mt-0.5 flex items-center gap-1">
                <Store className="h-4 w-4" /> {totalBusinesses}
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Reputation</div>
              <div className="text-lg font-bold mt-0.5 flex items-center gap-1">
                <Star className="h-4 w-4" /> {avgReputation}%
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Business Profit Overview</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <div className="h-48 md:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={profitHistory}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#006a4e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#006a4e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatTakaShort(v)} />
                  <Tooltip formatter={(value: number) => [formatTaka(value), 'Profit']} />
                  <Area type="monotone" dataKey="profit" stroke="#006a4e" fill="url(#profitGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {events.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-amber-300">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" /> Active Events
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {events.map((event: any) => (
                <div key={event.id} className="flex items-start gap-3 p-2 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="text-xl shrink-0">{event.icon || '📢'}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{event.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{event.description}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Your Businesses</h3>
          <Button size="sm" onClick={() => setView('new-business')} className="gap-1 text-white text-xs" style={{ background: '#006a4e' }}>
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        </div>
        {businesses.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <div className="text-4xl mb-2">🏪</div>
              <p className="text-sm text-muted-foreground mb-3">No businesses yet! Start your empire.</p>
              <Button onClick={() => setView('new-business')} className="text-white" style={{ background: '#006a4e' }}>
                <Plus className="h-4 w-4 mr-1" /> Create Your First Business
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {businesses.map((b: any, i: number) => {
              const bt = getBusinessType(b.type);
              const city = getCity(b.city);
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                >
                  <Card
                    className="game-card-interactive"
                    onClick={() => selectBusiness(b.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`text-3xl p-2 rounded-lg ${bt?.bgColor || 'bg-gray-50'}`}>
                          {bt?.icon || '🏪'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{b.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span>{bt?.name}</span>
                            <span>·</span>
                            <span>{city?.name}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex-1">
                              <div className="text-[10px] text-muted-foreground">Reputation</div>
                              <Progress value={b.reputation || 0} className="h-1.5 mt-0.5" />
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-bold ${(b.dailyProfit || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {(b.dailyProfit || 0) >= 0 ? '+' : ''}{formatTakaShort(b.dailyProfit || 0)}/day
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {news.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Newspaper className="h-4 w-4" /> Recent News
            </h3>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setView('news')}>
              View All
            </Button>
          </div>
          <div className="space-y-2">
            {news.slice(0, 3).map((n: any) => (
              <Card key={n.id} className="game-card-hover">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Badge variant="secondary" className="text-[10px] shrink-0 mt-0.5">{n.category}</Badge>
                    <div className="min-w-0">
                      <div className="text-sm font-medium line-clamp-1">{n.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.summary}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-3"><Skeleton className="h-4 w-16 mb-2" /><Skeleton className="h-6 w-24" /></CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="p-4"><Skeleton className="h-48 w-full" /></CardContent></Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[...Array(2)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
