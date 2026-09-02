'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import {
  formatTaka, formatTakaShort, getBusinessType, getCity, GAME_CONFIG
} from '@/lib/game-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Wallet, Building2, Users, TrendingUp, TrendingDown, ArrowRight,
  Zap, Package, Plus, Flame, Newspaper, BarChart3, Clock, Shield
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 }
  }
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 }
};

export default function Dashboard() {
  const { player, businesses, events, news, setView, gameDay } = useGameStore();
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
  }, []);

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

  const formatLogTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHrs = Math.floor(diffMins / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return `${Math.floor(diffHrs / 24)}d ago`;
    } catch { return ''; }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'REVENUE': return <TrendingUp className="h-3.5 w-3.5 text-green-600" />;
      case 'EXPENSE': return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
      case 'PROFIT': return <BarChart3 className="h-3.5 w-3.5 text-emerald-600" />;
      case 'HIRE': return <Users className="h-3.5 w-3.5 text-blue-600" />;
      case 'PURCHASE': return <Package className="h-3.5 w-3.5 text-amber-600" />;
      case 'UPGRADE': return <ArrowRight className="h-3.5 w-3.5 text-purple-600" />;
      case 'EVENT': return <Zap className="h-3.5 w-3.5 text-orange-500" />;
      case 'REPUTATION': return <Shield className="h-3.5 w-3.5 text-cyan-600" />;
      default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="p-3 md:p-4 space-y-4 pb-24 md:pb-4"
    >
      {/* Player Greeting */}
      <motion.div variants={item}>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bd-gradient flex items-center justify-center text-white text-xl font-bold shadow-lg">
            {player?.name?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">Welcome back, {player?.name || 'Tycoon'}!</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge className="text-[10px] px-1.5 py-0 text-white" style={{ background: '#006a4e' }}>
                Level {player?.level || 1}
              </Badge>
              <span className="text-xs text-muted-foreground">Day {gameDay}</span>
              {events.length > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-700 border-amber-300 bg-amber-50">
                  <Flame className="h-3 w-3 mr-0.5" /> {events.length} event{events.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        </div>
        {/* XP Progress */}
        {player && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Experience</span>
              <span>{player.experience || 0} / {getNextLevelExp(player.level || 1)} XP</span>
            </div>
            <Progress value={((player.experience || 0) / getNextLevelExp(player.level || 1)) * 100} className="h-1.5" />
          </div>
        )}
      </motion.div>

      {/* Stat Cards */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Card className="game-stat-card game-shimmer-overlay border-0 shadow-sm game-fade-up game-stagger-1">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-7 w-7 rounded-lg bg-green-100 flex items-center justify-center">
                <Wallet className="h-3.5 w-3.5 text-green-700" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Cash</span>
            </div>
            <div className="text-base font-bold" style={{ color: '#006a4e' }}>
              {formatTakaShort(player?.cash || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="game-stat-card game-shimmer-overlay border-0 shadow-sm game-fade-up game-stagger-2">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-amber-700" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Net Worth</span>
            </div>
            <div className="text-base font-bold">
              {formatTakaShort(player?.netWorth || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="game-stat-card game-shimmer-overlay border-0 shadow-sm game-fade-up game-stagger-3">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="h-3.5 w-3.5 text-blue-700" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Businesses</span>
            </div>
            <div className="text-base font-bold">{businesses.length}</div>
          </CardContent>
        </Card>

        <Card className="game-stat-card game-shimmer-overlay border-0 shadow-sm game-fade-up game-stagger-4">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-purple-700" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Staff</span>
            </div>
            <div className="text-base font-bold">{totalEmployees}</div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Daily Performance Row */}
      <motion.div variants={item} className="grid grid-cols-3 gap-2.5">
        <Card className="border-0 shadow-sm bg-green-50/50">
          <CardContent className="p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Revenue</div>
            <div className="text-sm font-bold text-green-700">{formatTakaShort(totalDailyRevenue)}</div>
            <div className="text-[9px] text-muted-foreground">today</div>
          </CardContent>
        </Card>
        <Card className={`border-0 shadow-sm ${totalDailyProfit >= 0 ? 'bg-emerald-50/50' : 'bg-red-50/50'}`}>
          <CardContent className="p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Profit</div>
            <div className={`text-sm font-bold flex items-center justify-center gap-0.5 ${totalDailyProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {totalDailyProfit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {totalDailyProfit >= 0 ? '+' : ''}{formatTakaShort(totalDailyProfit)}
            </div>
            <div className="text-[9px] text-muted-foreground">today</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-cyan-50/50">
          <CardContent className="p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Reputation</div>
            <div className="text-sm font-bold">{avgReputation.toFixed(0)}%</div>
            <div className="text-[9px] text-muted-foreground">average</div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Profit Chart */}
      {profitChartData.length > 0 && (
        <motion.div variants={item}>
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2 game-section-header">
                <BarChart3 className="h-4 w-4" style={{ color: '#006a4e' }} />
                Business Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={profitChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#006a4e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#006a4e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 14 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatTaka(value), name === 'profit' ? 'Daily Profit' : 'Daily Revenue']}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                      labelFormatter={(label: string, payload: any) => payload?.[0]?.payload?.fullName || label}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#f59e0b" fill="url(#revenueGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="profit" stroke="#006a4e" fill="url(#profitGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Active Events */}
      {events.length > 0 && (
        <motion.div variants={item}>
          <Card className="border-amber-200 shadow-sm">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2 game-section-header">
                <Zap className="h-4 w-4 text-amber-500" />
                Active Events
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              {events.slice(0, 3).map((event: any) => (
                <div key={event.id} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50/50">
                  <span className="text-lg shrink-0">{event.icon || '📢'}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{event.title}</div>
                    <div className="text-[10px] text-muted-foreground line-clamp-1">{event.description}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick Business List */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-sm font-bold flex items-center gap-1.5 game-section-header">
            <Building2 className="h-4 w-4" style={{ color: '#006a4e' }} />
            Your Businesses
          </h3>
          {businesses.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-0.5 text-green-700 hover:text-green-800"
              onClick={() => setView('businesses')}
            >
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>

        {businesses.length === 0 ? (
          <Card className="border-dashed shadow-sm">
            <CardContent className="game-empty-state">
              <div className="game-empty-icon game-float">🏗️</div>
              <h4 className="game-empty-title">No Businesses Yet</h4>
              <p className="game-empty-desc">
                Create your first business to start earning taka!
              </p>
              <button
                className="game-empty-action"
                onClick={() => setView('new-business')}
              >
                <Plus className="h-3.5 w-3.5 inline mr-1" /> Create Business
              </button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {businesses.slice(0, 3).map((b: any, i: number) => {
              const bt = getBusinessType(b.type);
              const city = getCity(b.city);
              const profit = b.dailyProfit || 0;
              return (
                <motion.div
                  key={b.id}
                  variants={item}
                >
                  <Card
                    className="game-card-interactive game-shimmer-overlay shadow-sm"
                    onClick={() => useGameStore.getState().selectBusiness(b.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className={`text-2xl p-2 rounded-xl ${bt?.bgColor || 'bg-gray-50'} shrink-0`}>
                          {bt?.icon || '🏪'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate">{b.name}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                              Lv.{b.level || 1}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {bt?.name} · {city?.name}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex-1">
                              <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                                <span>Reputation</span>
                                <span>{(b.reputation || 0).toFixed(0)}%</span>
                              </div>
                              <Progress value={b.reputation || 0} className="h-1" />
                            </div>
                            <div className={`text-xs font-bold flex items-center gap-0.5 ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {profit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {formatTakaShort(profit)}/day
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

      {/* Activity Feed */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-sm font-bold flex items-center gap-1.5 game-section-header">
            <Clock className="h-4 w-4" style={{ color: '#006a4e' }} />
            Recent Activity
          </h3>
        </div>

        {loadingLogs ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Card key={i}><CardContent className="p-3"><Skeleton className="h-10 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <Card className="border-dashed shadow-sm">
            <CardContent className="py-6 text-center">
              <div className="text-3xl mb-1.5">📋</div>
              <p className="text-xs text-muted-foreground">No activity yet. Start playing to see your business log!</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm">
            <CardContent className="p-2">
              <div className="space-y-0.5">
                {logs.slice(0, 8).map((log: any, i: number) => (
                  <div
                    key={log.id}
                    className={`flex items-start gap-2 p-2 rounded-lg game-activity-item ${i % 2 === 0 ? 'bg-muted/30' : ''}`}
                  >
                    <div className="mt-0.5 shrink-0">{getLogIcon(log.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs leading-snug">{log.message}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatLogTime(log.createdAt)}
                        {log.amount !== null && log.amount !== undefined && (
                          <span className={`ml-1 font-medium ${log.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {log.amount >= 0 ? '+' : ''}{formatTaka(log.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Recent News */}
      {news.length > 0 && (
        <motion.div variants={item}>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-bold flex items-center gap-1.5 game-section-header">
              <Newspaper className="h-4 w-4" style={{ color: '#006a4e' }} />
              Latest News
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-0.5 text-green-700 hover:text-green-800"
              onClick={() => setView('news')}
            >
              More <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-1.5">
            {news.slice(0, 3).map((article: any) => (
              <Card key={article.id} className="game-card-hover shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Badge
                      className={`text-[9px] border shrink-0 mt-0.5 ${
                        article.category?.toUpperCase() === 'ECONOMY' ? 'bg-green-100 text-green-700 border-green-200' :
                        article.category?.toUpperCase() === 'WEATHER' ? 'bg-cyan-100 text-cyan-700 border-cyan-200' :
                        article.category?.toUpperCase() === 'EVENT' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                        'bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                      variant="outline"
                    >
                      {article.category}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium leading-snug">{article.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{article.content}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-3 md:p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-3"><Skeleton className="h-14 w-full" /></CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="p-4"><Skeleton className="h-40 w-full" /></CardContent></Card>
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Card key={i}><CardContent className="p-3"><Skeleton className="h-12 w-full" /></CardContent></Card>
        ))}
      </div>
    </div>
  );
}
