'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/store/game-store';
import { formatTakaShort } from '@/lib/game-data';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Sun, Bell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import PlayerProfile from './PlayerProfile';
import NotificationCenter from './NotificationCenter';
import { ThemeToggleButton } from './ThemeToggle';
import { useCalendar } from '@/hooks/use-calendar';
import { useI18n } from '@/lib/i18n/I18nProvider';

interface TopBarProps {
  /** ISO timestamp of the next scheduled day, or null if unknown. */
  nextTickAt: string | null;
  /** False when no server clock is running, so nothing is counting down. */
  schedulerEnabled: boolean;
}

/**
 * Format the time left until `nextTickAt`, relative to `now`.
 *
 * Pulled out of the component so the label is derived during render rather
 * than pushed into state from inside an effect.
 */
function formatCountdown(nextTickAt: string | null, now: number): string | null {
  if (!nextTickAt) return null;

  const target = new Date(nextTickAt).getTime();
  if (!Number.isFinite(target)) return null;

  const remainingMs = target - now;
  // The poll that refreshes `nextTickAt` runs on its own interval, so the
  // countdown can reach zero before the next value arrives.
  if (remainingMs <= 0) return 'any moment';

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // A game day is four real hours, so this counts in hours far more often than
  // it counts in seconds. Before the clock slowed it only ever formatted
  // minutes, which would have rendered the common case as "239m 45s".
  if (hours > 0) return `${hours}h ${minutes}m`;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/**
 * A once-per-second clock.
 *
 * The day used to be advanced by a "Next Day" button, which moved the shared
 * world for every player at once. The server keeps the clock now, so the top
 * bar reports time remaining instead of offering a control.
 */
function useTickingNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

export default function TopBar({ nextTickAt, schedulerEnabled }: TopBarProps) {
  const { player, gameDay } = useGameStore();
  const { locale } = useI18n();
  const calendar = useCalendar();
  const bengaliDate = calendar
    ? locale === 'bn'
      ? calendar.world.bengali.formattedBn
      : calendar.world.bengali.formattedEn
    : null;
  const now = useTickingNow();
  const countdown = useMemo(() => formatCountdown(nextTickAt, now), [nextTickAt, now]);
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
    // Comparing against the previous render's value needs somewhere to keep it,
    // and the arrow is a pure reaction to cash having moved.
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
      <header className="bt-glass sticky top-0 z-50 flex h-14 items-center px-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🇧🇩</span>
          <span className="font-bold text-sm" style={{ color: '#006a4e' }}>BD Tycoon</span>
        </div>
      </header>
    );
  }

  return (
    <header className="bt-glass sticky top-0 z-50 game-border-bottom-animate relative">
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
              {/* The world's Bangladeshi date, always in view. A game set here
                  should say what day it is here, not only which tick it is. */}
              {bengaliDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="hidden truncate sm:inline" title={calendar?.world.date}>
                    {bengaliDate}
                  </span>
                </>
              )}
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
                cashDirection === 'up' ? 'text-green-600 dark:text-green-400' : cashDirection === 'down' ? 'text-red-500 dark:text-red-400' : ''
              }`} style={!cashDirection ? { color: '#006a4e' } : {}}>
                {formatTakaShort(player.cash)}
              </div>
              {cashDirection && (
                <span className={`absolute -top-1 -right-2 text-xs font-bold cash-flash ${
                  cashDirection === 'up' ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'
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
              className={`h-4.5 w-4.5 transition-colors ${unreadCount > 0 ? 'text-[var(--bt-emerald)] game-bell-swing' : 'text-muted-foreground'}`}
            />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1 game-badge-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <ThemeToggleButton />
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
              className={`h-4.5 w-4.5 transition-colors ${unreadCount > 0 ? 'text-[var(--bt-emerald)] game-bell-swing' : 'text-muted-foreground'}`}
            />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1 game-badge-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <ThemeToggleButton className="md:hidden" />

          <div
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-white text-xs md:text-sm shrink-0 game-shimmer-overlay"
            style={{ background: 'linear-gradient(135deg, #006a4e 0%, #00895e 60%, #00a86b 100%)' }}
            title={
              schedulerEnabled
                ? 'The world advances on a server clock, the same for every player.'
                : 'No game clock is running on the server.'
            }
          >
            <Sun className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '3s' }} aria-hidden="true" />
            <span className="bt-numeric whitespace-nowrap" aria-live="off">
              {!schedulerEnabled
                ? 'Clock paused'
                : countdown
                  ? <><span className="hidden sm:inline">Next day in </span>{countdown}</>
                  : <span className="hidden sm:inline">Next day soon</span>}
            </span>
          </div>
        </div>
      </div>

      <PlayerProfile open={profileOpen} onOpenChange={setProfileOpen} />
      <NotificationCenter open={notifOpen} onOpenChange={handleNotifOpenChange} />
    </header>
  );
}

export function TopBarSkeleton() {
  return (
    <header className="bt-glass sticky top-0 z-50">
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
