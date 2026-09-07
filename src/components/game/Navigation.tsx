'use client';

import { useGameStore } from '@/store/game-store';
import { LayoutDashboard, Store, TrendingUp, Trophy, Newspaper, Medal, Landmark, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  view: 'dashboard' | 'businesses' | 'market' | 'competition' | 'bank' | 'leaderboard' | 'news' | 'achievements' | 'settings';
  label: string;
  mobileLabel: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', mobileLabel: 'Home', icon: <LayoutDashboard className="h-5 w-5" /> },
  { view: 'businesses', label: 'Businesses', mobileLabel: 'Biz', icon: <Store className="h-5 w-5" /> },
  { view: 'market', label: 'Market', mobileLabel: 'Market', icon: <TrendingUp className="h-5 w-5" /> },
  { view: 'competition', label: 'Competition', mobileLabel: 'Compete', icon: <Users className="h-5 w-5" /> },
  { view: 'bank', label: 'Bank', mobileLabel: 'Bank', icon: <Landmark className="h-5 w-5" /> },
  { view: 'leaderboard', label: 'Ranks', mobileLabel: 'Ranks', icon: <Trophy className="h-5 w-5" /> },
  { view: 'news', label: 'News', mobileLabel: 'News', icon: <Newspaper className="h-5 w-5" /> },
  { view: 'achievements', label: 'Achievements', mobileLabel: 'Awards', icon: <Medal className="h-5 w-5" /> },
  { view: 'settings', label: 'Settings', mobileLabel: 'More', icon: <Settings className="h-5 w-5" /> },
];

export default function Navigation() {
  const { view, setView, events } = useGameStore();

  const currentView = NAV_ITEMS.find(n => n.view === view) ? view : 'dashboard';
  const activeEvents = events?.length || 0;

  return (
    <>
      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-white/95 via-white/90 to-white/80 backdrop-blur-xl border-t shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-around h-16 safe-area-pb overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {NAV_ITEMS.map((item, idx) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 px-1.5 py-1 rounded-xl transition-all duration-200 min-w-[44px] flex-shrink-0 game-slide-in-bottom game-mobile-nav-tooltip',
                  isActive
                    ? 'text-green-700 scale-105 shadow-md shadow-green-200/40'
                    : 'text-muted-foreground hover:text-foreground hover:scale-105'
                )}
                data-label={item.label}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className={cn('transition-colors duration-200', isActive ? '' : 'opacity-60')}>
                  {item.icon}
                </div>
                <span className="text-[10px] font-semibold leading-tight">{item.mobileLabel}</span>
                {isActive && (
                  <div className="absolute bottom-1 w-5 h-0.5 rounded-full game-nav-bounce" style={{ background: 'linear-gradient(90deg, #006a4e, #00a86b)', boxShadow: '0 0 8px rgba(0,106,78,0.3)' }} />
                )}
                {item.view === 'news' && activeEvents > 0 && !isActive && (
                  <span className="absolute top-0.5 right-1.5 h-4 w-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center game-badge-pulse" style={{ background: '#f42a41' }}>
                    {activeEvents > 9 ? '9+' : activeEvents}
                  </span>
                )}
                {item.view === 'businesses' && activeEvents > 0 && !isActive && (
                  <span className="absolute top-0.5 right-1.5 h-2 w-2 rounded-full bg-orange-500 game-badge-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-14 bottom-0 w-52 flex-col bg-gradient-to-b from-white to-green-50/30 border-r z-40 game-sidebar-gradient-bar">
        {/* Logo/brand section at top */}
        <div className="px-3 pt-5 pb-3 border-b border-green-100/50">
          <div className="flex items-center gap-2.5 px-2">
            <span className="text-xl">🇧🇩</span>
            <div>
              <div className="text-xs font-bold game-gradient-text">BD Tycoon</div>
              <div className="text-[9px] text-muted-foreground uppercase" style={{ letterSpacing: '0.12em' }}>Game Menu</div>
            </div>
          </div>
        </div>
        <div className="flex-1 px-3 space-y-1 pt-3">
          {NAV_ITEMS.map((item) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={cn(
                  'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'text-white shadow-md shadow-green-200/50 scale-[1.02]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-green-50/60 hover:scale-[1.02]'
                )}
                style={isActive ? { background: 'linear-gradient(135deg, #006a4e 0%, #00895e 60%, #00a86b 100%)' } : {}}
              >
                {item.icon}
                {item.label}
                {item.view === 'news' && activeEvents > 0 && (
                  <span className={cn(
                    'absolute right-2 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center',
                    isActive ? 'bg-white text-green-700 game-badge-pulse' : 'text-white game-badge-pulse'
                  )} style={!isActive ? { background: '#f42a41' } : {}}>
                    {activeEvents}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t border-green-100/50">
          <div className="text-[10px] text-muted-foreground text-center">
            Bangladesh Business Tycoon
          </div>
        </div>
      </aside>
    </>
  );
}