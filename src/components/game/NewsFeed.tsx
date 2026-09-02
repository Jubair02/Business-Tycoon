'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Newspaper, Zap, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function NewsFeed() {
  const { news, events, setNews } = useGameStore();
  const [loading, setLoading] = useState(false);

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
    if (news.length === 0) fetchNews();
  }, []);

  const getCategoryColor = (category: string) => {
    switch (category?.toUpperCase()) {
      case 'ECONOMY': return 'bg-green-100 text-green-700 border-green-200';
      case 'BUSINESS': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'WEATHER': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      case 'EVENT': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'POLITICS': return 'bg-red-100 text-red-700 border-red-200';
      case 'TRADE': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
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

  return (
    <div className="p-3 md:p-4 space-y-4 pb-24 md:pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Newspaper className="h-5 w-5" style={{ color: '#006a4e' }} /> News & Events
        </h2>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchNews} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {events.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> Active Events ({events.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {events.map((event: any) => (
              <div key={event.id} className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-start gap-2">
                  <span className="text-lg shrink-0">{event.icon || '📢'}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{event.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</div>
                    {event.endsAt && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600">
                        <Clock className="h-3 w-3" />
                        {formatTime(event.endsAt)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <h3 className="text-sm font-semibold">Latest News</h3>

      {loading && news.length === 0 ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : news.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-2">📰</div>
            <p className="text-sm text-muted-foreground">No news yet. Advance to the next day to generate news!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {news.map((article: any, i: number) => (
            <motion.div
              key={article.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card className="game-card-hover">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2.5">
                    <Badge className={`text-[10px] border shrink-0 mt-0.5 ${getCategoryColor(article.category)}`} variant="outline">
                      {article.category}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-snug">{article.title}</div>
                      {article.summary && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.summary}</div>
                      )}
                      <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatTime(article.createdAt || article.updatedAt)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
