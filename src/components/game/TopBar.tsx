'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/store/game-store';
import { formatTakaShort } from '@/lib/game-data';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Sun, ArrowRight, Bell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import PlayerProfile from './PlayerProfile';
import NotificationCenter from './NotificationCenter';

interface TopBarProps {
  onNextDay: () => Promise<void>;
  isTicking: boolean;
}

export default function TopBar({ onNextDay, isTicking }: TopBarProps) {
  const { player, gameDay } = useGameStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastSeenCountRef = useRef(0);
  const [cashDirection, setCashDirection] = useState<'up' | 'down' | null>(null);
  const prevCashRef = useRef<number | null>(null);
  useEffect(() => {
    if (!player) return;
    const prev = prevCashRef.current;
    prevCashRef.current = player.cash;
    if (prev === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tracking previous value requires effect + setState
    setCashDirection(player.cash > prev ? 'up' : player.cash < prev ? 'down' : null);
  }, [player?.cash]);

  const fetchLogCount = useCallback(async () => {
    try {
      const res = await fetch('/api/player/logs');
      if (res.ok) {
        const data = await res.json();
        const count = Array.isArray(data) ? data.length : 0;
        setUnreadCount(Math.max(0, count - lastSeenCountRef.current));
      }
    } catch {
      /* silent */
    }
  }, []);

  // Fetch initial log count on mount
  useEffect(() => {
    const initCount = async () => {
      try {
        const res = await fetch('/api/player/logs');
        if (res.ok) {
          const data = await res.json();
          const count = Array.isArray(data) ? data.length : 0;
          lastSeenCountRef.current = count;
          setUnreadCount(0);
        }
      } catch {
        /* silent */
      }
    };
    initCount();
    // Poll every 10 seconds for new logs
    const interval = setInterval(fetchLogCount, 10000);
    return () => clearInterval(interval);
  }, [fetchLogCount]);

  const handleNotifOpenChange = (open: boolean) => {
    setNotifOpen(open);
    if (open) {
      // Mark current count as seen when opening
      setUnreadCount(0);
    }
  };

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
    <header className="sticky top-0 z-50 bg-gradient-to-r from-white via-white/95 to-green-50/80 backdrop-blur-md game-border-bottom-animate relative">
      <div className="flex items-center justify-between h-14 px-3 md:px-4">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <span className="text-lg shrink-0">🇧🇩</span>
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-1.5 group cursor-pointer"
            >
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ring-1 ring-white/50"
                style={{ background: 'linear-gradient(135deg, #006a4e, #00a86b)' }}
              >
                {player.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <span className="text-sm font-semibold truncate max-w-[80px] md:max-w-none group-hover:underline underline-offset-2">
                {player.name}
              </span>
              <Badge className="text-[9px] px-1 py-0 text-white font-bold" style={{ background: 'linear-gradient(135deg, #006a4e, #00a86b)' }}>
                {player.level || 1}
              </Badge>
            </button>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="md:hidden" style={cashDirection === 'up' ? { color: '#16a34a' } : cashDirection === 'down' ? { color: '#dc2626' } : undefined}>{formatTakaShort(player.cash)}</span>
              <span className="md:hidden">·</span>
              <span>Day {gameDay}</span>
              {/* Auto-tick speed indicator dot */}
              <span className="inline-block w-1.5 h-1.5 rounded-full ml-1" style={{ background: 'var(--auto-tick-color, #d1d5db)' }} title="Auto-play status" />
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

          {/* Bell notification button - desktop, between stats and Next Day */}
          <Separator orientation="vertical" className="h-8" />
          <button
            type="button"
            onClick={() => handleNotifOpenChange(true)}
            className="relative p-1.5 rounded-lg hover:bg-muted/80 transition-colors"
            aria-label="Open notifications"
          >
            <Bell
              className={`h-4.5 w-4.5 transition-colors ${unreadCount > 0 ? 'text-green-700 game-bell-swing' : 'text-muted-foreground'}`}
            />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1 game-badge-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Bell notification button - mobile, left of Next Day */}
          <button
            type="button"
            onClick={() => handleNotifOpenChange(true)}
            className="relative p-1.5 rounded-lg hover:bg-muted/80 transition-colors md:hidden"
            aria-label="Open notifications"
          >
            <Bell
              className={`h-4.5 w-4.5 transition-colors ${unreadCount > 0 ? 'text-green-700 game-bell-swing' : 'text-muted-foreground'}`}
            />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1 game-badge-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <Button
            onClick={onNextDay}
            disabled={isTicking}
            size="sm"
            className="gap-1.5 text-white text-xs md:text-sm shrink-0 game-next-day-glow game-shine game-shimmer-overlay"
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
      </div>

      <PlayerProfile open={profileOpen} onOpenChange={setProfileOpen} />
      <NotificationCenter open={notifOpen} onOpenChange={handleNotifOpenChange} />
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
