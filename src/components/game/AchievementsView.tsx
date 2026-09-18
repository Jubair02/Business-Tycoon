'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Lock, Building2, TrendingUp, Users, Calendar, Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type Category = 'ALL' | 'BUSINESS' | 'WEALTH' | 'SOCIAL' | 'MILESTONE';

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'ALL', label: 'All', icon: <Trophy className="h-3.5 w-3.5" />, color: '#006a4e' },
  { id: 'BUSINESS', label: 'Business', icon: <Building2 className="h-3.5 w-3.5" />, color: '#059669' },
  { id: 'WEALTH', label: 'Wealth', icon: <TrendingUp className="h-3.5 w-3.5" />, color: '#d97706' },
  { id: 'SOCIAL', label: 'Social', icon: <Users className="h-3.5 w-3.5" />, color: '#7c3aed' },
  { id: 'MILESTONE', label: 'Milestone', icon: <Calendar className="h-3.5 w-3.5" />, color: '#db2777' },
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  BUSINESS: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-900/60', glow: 'rgba(5, 150, 105, 0.12)' },
  WEALTH: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-900/60', glow: 'rgba(217, 119, 6, 0.12)' },
  SOCIAL: { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-900/60', glow: 'rgba(124, 58, 237, 0.12)' },
  MILESTONE: { bg: 'bg-pink-50 dark:bg-pink-950/40', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-900/60', glow: 'rgba(219, 39, 119, 0.12)' },
};

const DEFAULT_STYLE = { bg: 'bg-gray-50 dark:bg-gray-950/40', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-900/60', glow: 'rgba(0,0,0,0.05)' };

export default function AchievementsView() {
  const { achievements } = useGameStore();
  const [filter, setFilter] = useState<Category>('ALL');

  const filtered = filter === 'ALL'
    ? achievements
    : achievements.filter((a: any) => a.category === filter);

  const unlockedCount = achievements.filter((a: any) => a.unlocked).length;
  const totalCount = achievements.length;
  const progressPercent = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  return (
    <div className="p-3 md:p-4 space-y-5 pb-24 md:pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}>
            <Trophy className="h-4 w-4 text-white" />
          </div>
          <span className="game-badge-gradient">Achievements</span>
        </h2>
        <Badge
          className="text-xs font-bold text-white rounded-full px-3 py-1 shadow-sm"
          style={{ background: 'linear-gradient(135deg, #006a4e, #00895e)' }}
        >
          <Star className="h-3 w-3 mr-1" />
          {unlockedCount}/{totalCount}
        </Badge>
      </div>

      {/* Progress bar */}
      <Card className="rounded-xl game-card-glow-subtle">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm font-bold game-badge-gradient">
              {Math.round(progressPercent)}%
            </span>
          </div>
          <Progress value={progressPercent} className="h-2.5 rounded-full" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-muted-foreground font-medium">{unlockedCount} unlocked</span>
            <span className="text-[10px] text-muted-foreground font-medium">{totalCount - unlockedCount} remaining</span>
          </div>
        </CardContent>
      </Card>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 game-scrollbar">
        {CATEGORIES.map((cat) => {
          const isActive = filter === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 shrink-0 border',
                isActive
                  ? 'text-white border-transparent shadow-md'
                  : 'bg-[var(--bt-surface-1)] text-muted-foreground border-border hover:text-foreground hover:shadow-sm'
              )}
              style={isActive ? { background: `linear-gradient(135deg, ${cat.color}, ${cat.color}dd)` } : {}}
            >
              {cat.icon} {cat.label}
            </button>
          );
        })}
      </div>

      {/* Achievement grid */}
      {totalCount === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="rounded-xl">
              <CardContent className="p-4">
                <Skeleton className="h-24 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-dashed rounded-xl">
            <CardContent className="py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-950/40 flex items-center justify-center mx-auto mb-3">
                <Trophy className="h-7 w-7" style={{ color: '#006a4e', opacity: 0.4 }} />
              </div>
              <p className="text-sm font-medium mb-1">No achievements here</p>
              <p className="text-xs text-muted-foreground font-medium max-w-[220px] mx-auto">Keep playing to unlock achievements in this category!</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((achievement: any, i: number) => {
            const catStyle = CATEGORY_STYLES[achievement.category] || DEFAULT_STYLE;
            const isUnlocked = achievement.unlocked;
            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                whileHover={isUnlocked ? { y: -2, transition: { duration: 0.2 } } : {}}
              >
                <Card
                  className={cn(
                    'relative overflow-hidden transition-all duration-300 rounded-xl',
                    isUnlocked
                      ? 'border-2 shadow-sm hover:shadow-lg game-card-glow-subtle'
                      : 'opacity-50 border border-dashed hover:opacity-65 transition-opacity'
                  )}
                  style={
                    isUnlocked
                      ? {
                          borderColor: 'rgba(0, 106, 78, 0.3)',
                          boxShadow: `inset 0 1px 0 0 ${catStyle.glow}`,
                        }
                      : {}
                  }
                >
                  {isUnlocked && (
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{
                        background: 'linear-gradient(90deg, #006a4e, #00a86b, #006a4e)',
                      }}
                    />
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-all duration-300',
                          isUnlocked
                            ? 'bg-gradient-to-br from-green-50 to-emerald-100 shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-950/50 grayscale opacity-60'
                        )}
                        style={isUnlocked ? { boxShadow: `0 0 16px -4px ${catStyle.glow}` } : {}}
                      >
                        {achievement.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-sm font-bold truncate',
                              isUnlocked ? 'text-foreground' : 'text-muted-foreground'
                            )}
                          >
                            {achievement.name}
                          </span>
                          {isUnlocked ? (
                            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #006a4e, #00a86b)' }}>
                              <Sparkles className="h-3 w-3 text-white" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-950/50 flex items-center justify-center shrink-0">
                              <Lock className="h-3 w-3 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium leading-relaxed">
                          {achievement.description}
                        </p>
                        <Badge
                          variant="secondary"
                          className={cn('text-[10px] mt-2.5 font-semibold rounded-full px-2.5', catStyle.bg, catStyle.text)}
                        >
                          {achievement.category}
                        </Badge>
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
