'use client';

import { useGameStore } from '@/store/game-store';
import { formatTakaShort } from '@/lib/game-data';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sun, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TopBarProps {
  onNextDay: () => Promise<void>;
  isTicking: boolean;
}

export default function TopBar({ onNextDay, isTicking }: TopBarProps) {
  const { player, gameDay } = useGameStore();

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
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
      <div className="flex items-center justify-between h-14 px-3 md:px-4">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <span className="text-lg shrink-0">🇧🇩</span>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate max-w-[100px] md:max-w-none">
              {player.name}
            </div>
            <div className="text-[10px] text-muted-foreground md:hidden">
              Lvl {player.level} · Day {gameDay}
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Cash</div>
            <div className="text-sm font-bold" style={{ color: '#006a4e' }}>
              {formatTakaShort(player.cash)}
            </div>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Net Worth</div>
            <div className="text-sm font-bold">
              {formatTakaShort(player.netWorth)}
            </div>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Day</div>
            <div className="text-sm font-bold">{gameDay}</div>
          </div>
        </div>

        <Button
          onClick={onNextDay}
          disabled={isTicking}
          size="sm"
          className="gap-1.5 text-white text-xs md:text-sm shrink-0"
          style={{ background: '#006a4e' }}
        >
          {isTicking ? (
            <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Sun className="h-3.5 w-3.5" />
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
