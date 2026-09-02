'use client';

import { useGameStore } from '@/store/game-store';
import { LayoutDashboard, Store, TrendingUp, Trophy, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  view: 'dashboard' | 'businesses' | 'market' | 'leaderboard' | 'news';
  label: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { view: 'businesses', label: 'Businesses', icon: <Store className="h-5 w-5" /> },
  { view: 'market', label: 'Market', icon: <TrendingUp className="h-5 w-5" /> },
  { view: 'leaderboard', label: 'Ranks', icon: <Trophy className="h-5 w-5" /> },
  { view: 'news', label: 'News', icon: <Newspaper className="h-5 w-5" /> },
];

export default function Navigation() {
  const { view, setView } = useGameStore();

  const currentView = NAV_ITEMS.find(n => n.view === view) ? view : 'dashboard';

  return (
    <>
      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t">
        <div className="flex items-center justify-around h-16 safe-area-pb">
          {NAV_ITEMS.map((item) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[56px]',
                  isActive ? 'text-green-700' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className={cn('transition-colors', isActive ? '' : 'opacity-60')}>
                  {item.icon}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-1 w-5 h-0.5 rounded-full" style={{ background: '#006a4e' }} />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-14 bottom-0 w-52 flex-col bg-white border-r z-40">
        <div className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                style={isActive ? { background: '#006a4e' } : {}}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t">
          <div className="text-[10px] text-muted-foreground text-center">
            Bangladesh Business Tycoon
          </div>
        </div>
      </aside>
    </>
  );
}
