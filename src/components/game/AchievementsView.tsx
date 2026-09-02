'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Lock, Building2, TrendingUp, Users, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

type Category = 'ALL' | 'BUSINESS' | 'WEALTH' | 'SOCIAL' | 'MILESTONE';

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode }[] = [
  { id: 'ALL', label: 'All', icon: <Trophy className="h-3.5 w-3.5" /> },
  { id: 'BUSINESS', label: 'Business', icon: <Building2 className="h-3.5 w-3.5" /> },
  { id: 'WEALTH', label: 'Wealth', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { id: 'SOCIAL', label: 'Social', icon: <Users className="h-3.5 w-3.5" /> },
  { id: 'MILESTONE', label: 'Milestone', icon: <Calendar className="h-3.5 w-3.5" /> },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  BUSINESS: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  WEALTH: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  SOCIAL: { bg: 'bg-blue-50', text: 'text-blue-700' },
  MILESTONE: { bg: 'bg-purple-50', text: 'text-purple-700' },
};

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
    <div className="p-3 md:p-4 space-y-4 pb-24 md:pb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Trophy className="h-5 w-5" style={{ color: '#006a4e' }} /> Achievements
        </h2>
        <Badge
          className="text-xs font-semibold text-white"
          style={{ background: '#006a4e' }}
        >
          {unlockedCount}/{totalCount} Unlocked
        </Badge>
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm font-bold" style={{ color: '#006a4e' }}>
              {Math.round(progressPercent)}%
            </span>
          </div>
          <Progress value={progressPercent} className="h-2.5" />
        </CardContent>
      </Card>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilter(cat.id)}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 border',
              filter === cat.id
                ? 'text-white border-transparent'
                : 'bg-white text-muted-foreground border-border hover:text-foreground'
            )}
            style={filter === cat.id ? { background: '#006a4e' } : {}}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      {totalCount === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-2">🏆</div>
            <p className="text-sm text-muted-foreground">No achievements in this category.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((achievement: any, i: number) => {
            const catStyle = CATEGORY_COLORS[achievement.category] || { bg: 'bg-gray-50', text: 'text-gray-700' };
            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card
                  className={cn(
                    'relative overflow-hidden transition-all duration-200',
                    achievement.unlocked
                      ? 'border-2 shadow-sm hover:shadow-md'
                      : 'opacity-60 border border-dashed'
                  )}
                  style={
                    achievement.unlocked
                      ? { borderColor: '#006a4e' }
                      : {}
                  }
                >
                  {achievement.unlocked && (
                    <div
                      className="absolute top-0 left-0 right-0 h-0.5"
                      style={{
                        background: 'linear-gradient(90deg, #006a4e, #16a34a, #006a4e)',
                      }}
                    />
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-colors',
                          achievement.unlocked
                            ? 'bg-gradient-to-br from-green-50 to-emerald-100'
                            : 'bg-gray-100 grayscale'
                        )}
                      >
                        {achievement.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-sm font-semibold truncate',
                              achievement.unlocked ? 'text-foreground' : 'text-muted-foreground'
                            )}
                          >
                            {achievement.name}
                          </span>
                          {achievement.unlocked ? (
                            <svg
                              className="h-4 w-4 shrink-0"
                              style={{ color: '#006a4e' }}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {achievement.description}
                        </p>
                        <Badge
                          variant="secondary"
                          className={cn('text-[10px] mt-2 font-medium', catStyle.bg, catStyle.text)}
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
