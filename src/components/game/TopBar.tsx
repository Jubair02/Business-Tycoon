'use client';

import { useMemo } from 'react';
import { useGameStore } from '@/store/game-store';
import { formatTakaShort } from '@/lib/game-data';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Sun, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TopBarProps {
  onNextDay: () => Promise<void>;
  isTicking: boolean;
}

export default function TopBar({ onNextDay, isTicking }: TopBarProps) {
  const { player, gameDay } = useGameStore();
  const cashDirection = useMemo(() => {
    if (!player) return null;
    return null;
  }, [player?.cash]);

  if (!player) {
    return (
      <header className="sticky top-0 z-50 h-14 bg-white/80 backdrop-blur-md border-b flex items-center px-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🇧🇩</span>
          <span className="font-bold text-sm" style={{ color: '#006a4e' }}>BD Tycoon</span>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-white via-white/95 to-green-50/80 backdrop-blur-md game-border-bottom-animate">
      <div className="flex items-center justify-between h-14 px-3 md:px-4">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <span className="text-lg shrink-0">🇧🇩</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold truncate max-w-[100px] md:max-w-none">
                {player.name}
              </span>
              <Badge className="text-[9px] px-1 py-0 text-white font-bold" style={{ background: 'linear-gradient(135deg, #006a4e, #00a86b)' }}>
                {player.level || 1}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="md:hidden" style={cashDirection === 'up' ? { color: '#16a34a' } : cashDirection === 'down' ? { color: '#dc2626' } : undefined}>{formatTakaShort(player.cash)}</span>
              <span className="md:hidden">·</span>
              <span>Day {gameDay}</span>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 relative">
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase" style={{ letterSpacing: '0.1em' }}>Cash</div>
            <div className="relative">
              <div className={`text-sm font-bold transition-colors duration-300 ${
                cashDirection === 'up' ? 'text-green-600' : cashDirection === 'down' ? 'text-red-500' : ''
              }`} style={!cashDirection ? { color: '#006a4e' } : {}}>
                {formatTakaShort(player.cash)}
              </div>
              {cashDirection && (
                <span className={`absolute -top-1 -right-2 text-xs font-bold cash-flash ${
                  cashDirection === 'up' ? 'text-green-500' : 'text-red-500'
                }`}>
                  {cashDirection === 'up' ? '↑' : '↓'}
                </span>
              )}
            </div>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase" style={{ letterSpacing: '0.1em' }}>Net Worth</div>
            <div className="text-sm font-bold">
              {formatTakaShort(player.netWorth)}
            </div>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase" style={{ letterSpacing: '0.1em' }}>Day</div>
            <div className="text-sm font-bold">{gameDay}</div>
          </div>
        </div>

        <Button
          onClick={onNextDay}
          disabled={isTicking}
          size="sm"
          className="gap-1.5 text-white text-xs md:text-sm shrink-0 game-next-day-glow game-shine"
          style={{ background: 'linear-gradient(135deg, #006a4e 0%, #00895e 60%, #00a86b 100%)' }}
        >
          {isTicking ? (
            <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Sun className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '3s' }} />
          )}
          <span className="hidden sm:inline">Next Day</span>
          <ArrowRight className="h-3 w-3 sm:hidden" />
        </Button>
      </div>
    </header>
  );
}

export function TopBarSkeleton() {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
    </header>
  );
}
