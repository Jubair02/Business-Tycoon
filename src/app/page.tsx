'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/game-store';
import WelcomeScreen from '@/components/game/WelcomeScreen';
import TopBar, { TopBarSkeleton } from '@/components/game/TopBar';
import Dashboard, { DashboardSkeleton } from '@/components/game/Dashboard';
import BusinessList from '@/components/game/BusinessList';
import BusinessDetail from '@/components/game/BusinessDetail';
import NewBusiness from '@/components/game/NewBusiness';
import MarketView from '@/components/game/MarketView';
import LeaderboardView from '@/components/game/LeaderboardView';
import NewsFeed from '@/components/game/NewsFeed';
import AchievementsView from '@/components/game/AchievementsView';
import BankView from '@/components/game/BankView';
import Navigation from '@/components/game/Navigation';
import SettingsView from '@/components/game/SettingsView';
import HintBar from '@/components/game/HintBar';
import DailySummary from '@/components/game/DailySummary';
import TutorialOverlay from '@/components/game/TutorialOverlay';
import { toast } from 'sonner';
import { AutoTickSync } from '@/components/game/AutoTickSync';

export default function Home() {
  const {
    view,
    setView,
    setPlayer,
    setBusinesses,
    setCurrentBusiness,
    selectBusiness,
    selectedBusinessId,
    setEvents,
    setNews,
    setLeaderboard,
    setAchievements,
    setGameDay,
    setLoading,
    isLoading,
    player,
    businesses,
    currentBusiness,
  } = useGameStore();

  const [isTicking, setIsTicking] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [preTickBusinesses, setPreTickBusinesses] = useState<any[]>([]);
  const [autoTickSpeed, setAutoTickSpeed] = useState<string>('off');
  const initDone = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoTickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTickingRef = useRef(false);

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
      }
    } catch {
      // silent
    }
  }, [setGameDay]);

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

  const initGame = useCallback(async () => {
    if (initDone.current) return;
    initDone.current = true;
    try {
      await fetch('/api/game/init', { method: 'POST' });
    } catch {
      // silent - game might already be initialized
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      await initGame();
      const pData = await fetchPlayer();
      if (pData) {
        setView('dashboard');
        await Promise.all([
          fetchBusinesses(),
          fetchEvents(),
          fetchNews(),
          fetchLeaderboard(),
          fetchGameDay(),
          fetchAchievements(),
        ]);
        setInitialized(true);
      } else {
        setView('welcome');
        setInitialized(true);
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  // Keep fetchAllData in a ref so the interval always calls the latest version
  const fetchAllDataRef = useRef(fetchAllData);
  fetchAllDataRef.current = fetchAllData;

  // Auto-tick timer based on speed setting
  useEffect(() => {
    if (autoTickTimer.current) {
      clearInterval(autoTickTimer.current);
      autoTickTimer.current = null;
    }
    if (autoTickSpeed === 'off' || view === 'welcome') return;
    const intervals: Record<string, number> = { slow: 120000, normal: 60000, fast: 30000 };
    const interval = intervals[autoTickSpeed] || 60000;
    autoTickTimer.current = setInterval(async () => {
      if (isTickingRef.current) return;
      isTickingRef.current = true;
      setIsTicking(true);
      try {
        setPreTickBusinesses([...useGameStore.getState().businesses]);
        const res = await fetch('/api/game/tick', { method: 'POST' });
        if (res.ok) {
          await fetchAllDataRef.current();
          setShowSummary(true);
        }
      } catch { /* silent */ }
      finally {
        isTickingRef.current = false;
        setIsTicking(false);
      }
    }, interval);
    return () => {
      if (autoTickTimer.current) clearInterval(autoTickTimer.current);
    };
  }, [autoTickSpeed, view]);

  useEffect(() => {
    if (view !== 'welcome') {
      refreshTimer.current = setInterval(fetchAllData, 30000);
    }
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [view, fetchAllData]);

  useEffect(() => {
    if (selectedBusinessId && view === 'business-detail') {
      fetchCurrentBusiness(selectedBusinessId);
    }
  }, [selectedBusinessId, view, fetchCurrentBusiness]);

  const handleRegister = async (name: string) => {
    setRegistering(true);
    try {
      const res = await fetch('/api/player/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlayer(data);
        setView('dashboard');
        toast.success(`Welcome, ${name}! Your empire begins now.`);
        await Promise.all([
          fetchBusinesses(),
          fetchEvents(),
          fetchNews(),
          fetchLeaderboard(),
          fetchGameDay(),
          fetchAchievements(),
        ]);
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  const handleNextDay = async () => {
    if (isTicking) return;
    setIsTicking(true);
    try {
      // Save current businesses before the tick for comparison
      setPreTickBusinesses([...businesses]);
      const res = await fetch('/api/game/tick', { method: 'POST' });
      if (res.ok) {
        await fetchAllData();
        // Show daily summary after data refresh
        setShowSummary(true);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Tick failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setIsTicking(false);
    }
  };

  const handleSelectBusiness = (id: string) => {
    selectBusiness(id);
    fetchCurrentBusiness(id);
  };

  const showTopBar = view !== 'welcome' && initialized;
  const showNav = view !== 'welcome' && initialized;
  const isDetailView = view === 'business-detail' || view === 'new-business';

  const renderView = () => {
    switch (view) {
      case 'welcome':
        return <WelcomeScreen onRegister={handleRegister} isLoading={registering} />;
      case 'dashboard':
        return <Dashboard />;
      case 'businesses':
        return <BusinessList />;
      case 'business-detail':
        return <BusinessDetail />;
      case 'new-business':
        return <NewBusiness />;
      case 'market':
        return <MarketView />;
      case 'bank':
        return <BankView />;
      case 'leaderboard':
        return <LeaderboardView />;
      case 'news':
        return <NewsFeed />;
      case 'achievements':
        return <AchievementsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <Dashboard />;
    }
  };

  if (!initialized) {
    return (
      <div className="min-h-screen bg-white">
        <TopBarSkeleton />
        <div className="p-4 max-w-2xl mx-auto space-y-4 mt-4">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {showTopBar && <TopBar onNextDay={handleNextDay} isTicking={isTicking} />}

      <main className={`flex-1 ${showNav ? 'md:pl-52' : ''}`}>
        {view === 'dashboard' && <div className="mt-2"><HintBar /></div>}
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className={isDetailView ? 'max-w-2xl mx-auto' : 'max-w-3xl mx-auto'}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {showNav && <Navigation />}

      <DailySummary
        open={showSummary}
        onClose={() => setShowSummary(false)}
        previousBusinesses={preTickBusinesses}
      />

      {showTopBar && businesses.length === 0 && <TutorialOverlay />}
      {/* Sync auto-tick speed from localStorage */}
      <AutoTickSync speed={autoTickSpeed} onSpeedChange={setAutoTickSpeed} />
    </div>
  );
}
