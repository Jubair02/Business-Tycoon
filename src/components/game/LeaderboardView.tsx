'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { formatTaka, formatTakaShort, CITIES } from '@/lib/game-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Crown, Medal, Star, TrendingUp, Building2, Heart, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'networth', label: 'Net Worth', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { id: 'profit', label: 'Profit', icon: <Star className="h-3.5 w-3.5" /> },
  { id: 'businesses', label: 'Businesses', icon: <Building2 className="h-3.5 w-3.5" /> },
  { id: 'reputation', label: 'Reputation', icon: <Heart className="h-3.5 w-3.5" /> },
];

export default function LeaderboardView() {
  const { player, leaderboard, setLeaderboard, setSelectedCity, selectedCity } = useGameStore();
  const [type, setType] = useState('networth');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type });
      if (cityFilter !== 'all') params.set('city', cityFilter);
      const res = await fetch(`/api/leaderboard?${params}`);
      if (res.ok) {
        setLeaderboard(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [type, cityFilter, setLeaderboard]);

  const getMedal = (rank: number) => {
    if (rank === 0) return { emoji: '🥇', bg: 'game-podium-gold' };
    if (rank === 1) return { emoji: '🥈', bg: 'game-podium-silver' };
    if (rank === 2) return { emoji: '🥉', bg: 'game-podium-bronze' };
    return { emoji: null, bg: '' };
  };

  const getValue = (entry: any) => {
    switch (type) {
      case 'networth': return formatTakaShort(entry.netWorth || 0);
      case 'profit': return formatTakaShort(entry.totalProfit || 0);
      case 'businesses': return `${entry.businessCount || 0}`;
      case 'reputation': return `${Math.round(entry.maxReputation || 0)}%`;
      default: return '—';
    }
  };

  return (
    <div className="p-3 md:p-4 space-y-4 pb-24 md:pb-4">
      <h2 className="text-lg font-bold flex items-center gap-2 game-gradient-text">
        <Trophy className="h-5 w-5" style={{ color: '#006a4e' }} /> Leaderboard
      </h2>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={type === tab.id ? 'default' : 'outline'}
            size="sm"
            className={`gap-1 text-xs shrink-0 transition-all duration-200 ${type === tab.id ? 'text-white game-shine' : ''}`}
            style={type === tab.id ? { background: 'linear-gradient(135deg, #006a4e 0%, #00895e 60%, #00a86b 100%)' } : {}}
            onClick={() => setType(tab.id)}
          >
            {tab.icon} {tab.label}
          </Button>
        ))}
      </div>

      <Select value={cityFilter} onValueChange={setCityFilter}>
        <SelectTrigger className="w-full"><SelectValue placeholder="All Cities" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Cities</SelectItem>
          {CITIES.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-2">🏆</div>
            <p className="text-sm text-muted-foreground">No leaderboard data yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry: any, i: number) => {
            const medal = getMedal(i);
            const isMe = player && entry.playerId === player.id;
            return (
              <motion.div
                key={entry.playerId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className={cn(
                  'border transition-all duration-200 game-shine',
                  medal.bg,
                  isMe && 'ring-2 border-green-400 shadow-lg shadow-green-100',
                  medal.emoji ? 'border' : '',
                )} style={isMe ? { borderColor: '#006a4e', ringColor: '#006a4e' } : {}}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 text-center shrink-0">
                        {medal.emoji ? (
                          <span className="text-xl">{medal.emoji}</span>
                        ) : (
                          <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{entry.name}</span>
                          {isMe && (
                            <Badge className="text-[10px] text-white font-bold px-2" style={{ background: 'linear-gradient(135deg, #006a4e, #00a86b)' }}>
                              ⭐ You
                            </Badge>
                          )}
                          {i === 0 && !medal.emoji && <Crown className="h-3.5 w-3.5 text-yellow-500" />}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {entry.businessCount || 0} businesses
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold" style={{ color: '#006a4e' }}>{getValue(entry)}</div>
                        <div className="text-[10px] text-muted-foreground capitalize">{type === 'networth' ? 'net worth' : type}</div>
                      </div>
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
