'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Newspaper, Zap, Clock, RefreshCw, TrendingUp, Cloud, Briefcase, Globe, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_CONFIG: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  ECONOMY: { bg: 'bg-green-50 dark:bg-green-950/40', text: 'text-green-700 dark:text-green-300', border: 'border-l-green-500', icon: <TrendingUp className="h-3 w-3" /> },
  BUSINESS: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-l-amber-500', icon: <Briefcase className="h-3 w-3" /> },
  WEATHER: { bg: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-l-cyan-500', icon: <Cloud className="h-3 w-3" /> },
  EVENT: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-l-purple-500', icon: <Zap className="h-3 w-3" /> },
  POLITICS: { bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300', border: 'border-l-red-500', icon: <Landmark className="h-3 w-3" /> },
  TRADE: { bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-l-orange-500', icon: <Globe className="h-3 w-3" /> },
};

const DEFAULT_CATEGORY = { bg: 'bg-gray-50 dark:bg-gray-950/40', text: 'text-gray-600 dark:text-gray-400', border: 'border-l-gray-400', icon: <Newspaper className="h-3 w-3" /> };

export default function NewsFeed() {
  const { news, events, setNews } = useGameStore();
  // Seeded from what the store already holds: arriving with news cached is not
  // a loading state, and arriving without it means a fetch is about to start.
  // Turning the flag on inside the effect is what React 19 flags.
  const [loading, setLoading] = useState(() => news.length === 0);

  /** The refresh button. An event handler may set state freely. */
  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/news?limit=30');
      if (res.ok) {
        setNews(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (news.length > 0) return;

    let cancelled = false;
    fetch('/api/news?limit=30')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled && data) setNews(data);
      })
      .catch(() => {
        // silent
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // Runs once: this is the initial load, not a subscription to `news`.
  }, []);

  const getCategoryConfig = (category: string) => {
    return CATEGORY_CONFIG[category?.toUpperCase()] || DEFAULT_CATEGORY;
  };

  const formatTime = (dateStr: string) => {
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
    } catch {
      return '';
    }
  };

  const getFreshness = (dateStr: string, index: number) => {
    if (index === 0) return 'fresh';
    if (index < 3) return 'recent';
    if (index < 10) return 'normal';
    return 'old';
  };

  const freshnessStyles: Record<string, string> = {
    fresh: 'opacity-100',
    recent: 'opacity-95',
    normal: 'opacity-85',
    old: 'opacity-70',
  };

  const freshnessDot: Record<string, string> = {
    fresh: 'bg-green-500 game-pulse-soft',
    recent: 'bg-green-400',
    normal: 'bg-gray-300',
    old: 'bg-gray-200 dark:bg-gray-900/50',
  };

  return (
    <div className="p-3 md:p-4 space-y-5 pb-24 md:pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
            <Newspaper className="h-4 w-4 text-white" />
          </div>
          <span className="game-badge-gradient">News & Events</span>
        </h2>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-green-50 dark:hover:bg-green-950/40 transition-colors" onClick={fetchNews} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Active Events */}
      {events.length > 0 && (
        <Card className="rounded-xl border-amber-200 dark:border-amber-900/60 game-amber-pulse overflow-hidden">
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #f59e0b, #f97316, #f59e0b)' }} />
          <CardHeader className="pb-2 pt-3.5 px-4">
            <CardTitle className="text-sm flex items-center gap-2 font-bold">
              <div className="w-6 h-6 rounded-md bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              Active Events
              <Badge className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60 rounded-full ml-1">{events.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3.5 space-y-2.5">
            {events.map((event: any, idx: number) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-3 rounded-xl bg-gradient-to-r from-amber-50/80 to-orange-50/40 border border-amber-200/80 dark:border-amber-900/60 transition-all hover:shadow-md hover:shadow-amber-100/50 hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0 game-float mt-0.5">{event.icon || '📢'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold leading-snug">{event.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2 font-medium">{event.description}</div>
                    {event.endsAt && (
                      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                        <Clock className="h-3 w-3" />
                        {formatTime(event.endsAt)}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2.5">
        <h3 className="text-sm font-bold game-badge-gradient">Latest News</h3>
        <span className="text-[10px] text-muted-foreground font-medium">{news.length} articles</span>
      </div>

      {loading && news.length === 0 ? (
        <div className="space-y-2.5">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="rounded-xl"><CardContent className="p-4"><Skeleton className="h-16 w-full rounded-lg" /></CardContent></Card>
          ))}
        </div>
      ) : news.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-dashed rounded-xl">
            <CardContent className="py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-950/40 flex items-center justify-center mx-auto mb-3">
                <Newspaper className="h-7 w-7" style={{ color: '#006a4e', opacity: 0.5 }} />
              </div>
              <p className="text-sm font-medium mb-1">No news yet</p>
              <p className="text-xs text-muted-foreground font-medium max-w-[220px] mx-auto">Stories arrive as the days pass.</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-2.5">
          {news.map((article: any, i: number) => {
            const catConfig = getCategoryConfig(article.category);
            const freshness = getFreshness(article.createdAt || article.updatedAt, i);
            return (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  'border-l-[3px] rounded-r-xl transition-all hover:shadow-sm hover:-translate-y-px',
                  catConfig.border,
                  freshnessStyles[freshness]
                )}
              >
                <Card className="rounded-tl-none border-l-0 rounded-r-xl rounded-tl-none">
                  <CardContent className="p-3.5">
                    <div className="flex items-start gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', catConfig.bg)}>
                        <span className={catConfig.text}>{catConfig.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={cn('text-[9px] font-semibold rounded-full px-2 py-0 shrink-0 uppercase tracking-wider border-0', catConfig.bg, catConfig.text)}
                          >
                            {article.category}
                          </Badge>
                          {freshness === 'fresh' && (
                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', freshnessDot[freshness])} />
                          )}
                        </div>
                        <div className="text-sm font-semibold leading-snug mt-1.5">{article.title}</div>
                        {article.content && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2 font-medium">{article.content}</div>
                        )}
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground font-medium">
                          <Clock className="h-3 w-3" />
                          {formatTime(article.createdAt || article.updatedAt)}
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
    </div>
  );
}
