'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import TopBar, { TopBarSkeleton } from '@/components/game/TopBar';
import { DashboardSkeleton } from '@/components/game/Dashboard';
import Navigation from '@/components/game/Navigation';
import HintBar from '@/components/game/HintBar';
import FirstWeekGuide from '@/components/game/FirstWeekGuide';
import SeasonBanner from '@/components/game/SeasonBanner';
import DailySummary from '@/components/game/DailySummary';
import TutorialOverlay from '@/components/game/TutorialOverlay';
import SectionTabs from '@/components/game/SectionTabs';
import WhileYouWereAway, { type OfflineSummary } from '@/components/game/WhileYouWereAway';
import { OFFLINE_CONFIG } from '@/lib/game/offline/offline-config';
import ClaimedSaveNotice from '@/components/game/ClaimedSaveNotice';
import { ROUTES, isDetailRoute } from '@/lib/game-routes';

/**
 * Persistent game chrome: top bar, navigation, polling and the post-tick
 * summary.
 *
 * This lives in the route group's layout, so it is mounted once and survives
 * navigation between screens — the polling timers are not torn down and
 * rebuilt on every route change.
 *
 * The day is advanced by the server's own clock (`lib/game/scheduler.ts`), not
 * from here. This component watches `/api/game/state` for the day to change and
 * reacts to it; it never asks for a tick.
 */
export default function GameShell({ children }: { children: React.ReactNode }) {
  const {
    setPlayer,
    setBusinesses,
    setCurrentBusiness,
    selectedBusinessId,
    setEvents,
    setNews,
    setLeaderboard,
    setAchievements,
    setGameDay,
    setLoading,
    businesses,
  } = useGameStore();

  const pathname = usePathname();

  const [initialized, setInitialized] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [awaySummary, setAwaySummary] = useState<OfflineSummary | null>(null);
  const [preTickBusinesses, setPreTickBusinesses] = useState<any[]>([]);
  const [clock, setClock] = useState<{ nextTickAt: string | null; schedulerEnabled: boolean }>({
    nextTickAt: null,
    schedulerEnabled: true,
  });
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Last day we have already reacted to, so the summary fires once per day. */
  const lastGameDayRef = useRef<number | null>(null);
  const syncingRef = useRef(false);

  const fetchPlayer = useCallback(async () => {
    try {
      const res = await fetch('/api/player');
      if (res.ok) {
        const data = await res.json();
        setPlayer(data);
        return data;
      }
      return null;
    } catch {
      return null;
    }
  }, [setPlayer]);

  const fetchBusinesses = useCallback(async () => {
    try {
      const res = await fetch('/api/businesses');
      if (res.ok) {
        const data = await res.json();
        setBusinesses(data);
        return data;
      }
      return [];
    } catch {
      return [];
    }
  }, [setBusinesses]);

  const fetchCurrentBusiness = useCallback(async (bizId: string) => {
    try {
      const res = await fetch(`/api/businesses/${bizId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentBusiness(data);
      }
    } catch {
      // silent
    }
  }, [setCurrentBusiness]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) setEvents(await res.json());
    } catch {
      // silent
    }
  }, [setEvents]);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/news?limit=10');
      if (res.ok) setNews(await res.json());
    } catch {
      // silent
    }
  }, [setNews]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard?type=networth');
      if (res.ok) setLeaderboard(await res.json());
    } catch {
      // silent
    }
  }, [setLeaderboard]);

  const fetchGameDay = useCallback(async () => {
    try {
      const res = await fetch('/api/game/state');
      if (res.ok) {
        const data = await res.json();
        setGameDay(data.gameDay || 1);
        setClock({
          nextTickAt: data.nextTickAt ?? null,
          schedulerEnabled: data.schedulerEnabled !== false,
        });
        return data as { gameDay?: number };
      }
      return null;
    } catch {
      return null;
    }
  }, [setGameDay]);

  /**
   * Tell the server we are here.
   *
   * This is what keeps a player's shops trading: the tick shutters the shops of
   * anyone who has not checked in within the offline grace window. The first
   * beat after an absence also brings back the report of what happened.
   */
  const sendHeartbeat = useCallback(async () => {
    try {
      const res = await fetch('/api/game/presence', { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.away) setAwaySummary(data.away as OfflineSummary);
    } catch {
      // A missed beat is not worth surfacing; the next one is a minute away,
      // and the grace window is hours wide.
    }
  }, []);

  const fetchAchievements = useCallback(async () => {
    try {
      const res = await fetch('/api/achievements');
      if (res.ok) setAchievements(await res.json());
    } catch {
      // silent
    }
  }, [setAchievements]);

  const fetchAllData = useCallback(async () => {
    const pData = await fetchPlayer();
    if (pData) {
      await Promise.all([
        fetchBusinesses(),
        fetchEvents(),
        fetchNews(),
        fetchLeaderboard(),
        fetchGameDay(),
        fetchAchievements(),
      ]);
      if (selectedBusinessId) {
        fetchCurrentBusiness(selectedBusinessId);
      }
    }
  }, [fetchPlayer, fetchBusinesses, fetchEvents, fetchNews, fetchLeaderboard, fetchGameDay, fetchAchievements, fetchCurrentBusiness, selectedBusinessId]);

  // Seeding is idempotent and independent of the player lookup, so it runs
  // alongside first paint rather than gating it.
  const initGame = useCallback(async () => {
    try {
      await fetch('/api/game/init', { method: 'POST' });
    } catch {
      // silent - game might already be initialized
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      void initGame();
      // Before anything else: mark the player present, so the very next tick
      // does not shutter the shops of someone who is plainly sitting here.
      void sendHeartbeat();
      await fetchAllData();
      lastGameDayRef.current = useGameStore.getState().gameDay ?? null;
      setInitialized(true);
      setLoading(false);
    };
    bootstrap();
    // Runs once for the lifetime of the shell.
  }, []);

  // fetchAllData changes identity whenever the selected business does, so it is
  // read through a ref to keep the polling intervals from being torn down and
  // rebuilt. fetchGameDay is stable and can be depended on directly.
  //
  // The ref is written in an effect rather than during render: a render may be
  // thrown away or replayed, and mutating a ref on the way through is exactly
  // the kind of side effect that makes that unsafe.
  const fetchAllDataRef = useRef(fetchAllData);
  useEffect(() => {
    fetchAllDataRef.current = fetchAllData;
  }, [fetchAllData]);

  /**
   * Watch the server clock and react when the day changes.
   *
   * `/api/game/state` is a single cheap read, so it is polled far more often
   * than the full data refresh — the point is to notice a new day promptly and
   * show the summary, not to re-fetch everything on a timer.
   *
   * Defined inside the effect so it always closes over the current refs without
   * a ref-of-a-callback being reassigned during render.
   */
  useEffect(() => {
    const syncClock = async (): Promise<void> => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        const state = await fetchGameDay();
        const day = state?.gameDay;
        if (typeof day !== 'number') return;

        const previous = lastGameDayRef.current;

        // The first reading establishes a baseline: someone opening the game on
        // day 40 should not be shown a summary for a day they were not there for.
        if (previous === null) {
          lastGameDayRef.current = day;
          return;
        }

        if (day > previous) {
          // Claim the day before awaiting, so a slow refresh cannot let the next
          // poll fire the summary for the same day a second time.
          lastGameDayRef.current = day;
          setPreTickBusinesses([...useGameStore.getState().businesses]);
          await fetchAllDataRef.current();
          setShowSummary(true);
        }
      } finally {
        syncingRef.current = false;
      }
    };

    clockTimer.current = setInterval(() => { void syncClock(); }, 10000);
    return () => {
      if (clockTimer.current) clearInterval(clockTimer.current);
    };
  }, [fetchGameDay]);

  useEffect(() => {
    refreshTimer.current = setInterval(() => { void fetchAllDataRef.current(); }, 30000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, []);

  /**
   * Presence heartbeat.
   *
   * On a timer, and again whenever the tab comes back to the foreground — a
   * phone that has been asleep fires no timers, so the return to visibility is
   * the beat that actually matters for a mobile player.
   */
  useEffect(() => {
    const timer = setInterval(() => { void sendHeartbeat(); }, OFFLINE_CONFIG.heartbeatMs);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void sendHeartbeat();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [sendHeartbeat]);

  if (!initialized) {
    return (
      <div className="min-h-screen bg-background">
        <TopBarSkeleton />
        <div className="p-4 max-w-2xl mx-auto space-y-4 mt-4">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar nextTickAt={clock.nextTickAt} schedulerEnabled={clock.schedulerEnabled} />

      <main className="flex-1 pb-28 md:pb-0 md:pl-52">
        {/* Second-level navigation for the sections that hold more than one
            screen. On desktop the sidebar already lists them, so this is the
            phone's equivalent. */}
        <div className="max-w-3xl mx-auto">
          <SectionTabs />
        </div>
        {pathname === ROUTES.dashboard && (
          <div className="mt-2 space-y-2">
            <SeasonBanner />
            <FirstWeekGuide />
            <HintBar />
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className={isDetailRoute(pathname) ? 'max-w-2xl mx-auto' : 'max-w-3xl mx-auto'}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <Navigation />

      <DailySummary
        open={showSummary}
        onClose={() => setShowSummary(false)}
        previousBusinesses={preTickBusinesses}
      />

      <WhileYouWereAway
        summary={awaySummary}
        onClose={() => {
          setAwaySummary(null);
          // The shops were woken by the heartbeat that produced this report, so
          // the figures on screen are a moment stale.
          void fetchAllDataRef.current();
        }}
      />

      {businesses.length === 0 && <TutorialOverlay />}
      <ClaimedSaveNotice />
    </div>
  );
}
