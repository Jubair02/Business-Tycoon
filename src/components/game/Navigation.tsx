'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useGameStore } from '@/store/game-store';
import { NAV_SECTIONS, isSectionActive, type NavSection } from '@/lib/game-routes';
import {
  LayoutDashboard,
  Store,
  TrendingUp,
  Trophy,
  Landmark,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/I18nProvider';

/**
 * Six destinations, not ten.
 *
 * The structure lives in `game-routes.ts`; this component only draws it. The
 * sections that hold more than one screen show their siblings as tabs above the
 * content (see `SectionTabs`) rather than as more icons down here.
 */
const ICONS: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard className="h-5 w-5" />,
  store: <Store className="h-5 w-5" />,
  trending: <TrendingUp className="h-5 w-5" />,
  bank: <Landmark className="h-5 w-5" />,
  trophy: <Trophy className="h-5 w-5" />,
  more: <MoreHorizontal className="h-5 w-5" />,
};

/** The section that carries the active-events badge. */
const EVENTS_BADGE_SECTION = 'more';

export default function Navigation() {
  const { events } = useGameStore();
  const pathname = usePathname();
  const t = useT();
  const activeEvents = events?.length || 0;

  const badgeFor = (section: NavSection) =>
    section.id === EVENTS_BADGE_SECTION ? activeEvents : 0;

  return (
    <>
      {/* Mobile Bottom Nav */}
      <nav className="bt-glass-top md:hidden fixed bottom-0 left-0 right-0 z-50 shadow-[0_-4px_20px_oklch(0_0_0/0.08)]">
        {/* Six destinations fit one row on a 360px screen at 60px each, which
            keeps every target above the 44px minimum. Ten needed 455px and had
            to be folded into two rows, with two of them off-screen behind a
            hidden scrollbar. */}
        <div className="grid grid-cols-6 py-1.5 safe-area-pb">
          {NAV_SECTIONS.map((section, idx) => {
            const active = isSectionActive(section, pathname);
            const badge = badgeFor(section);
            return (
              <Link
                key={section.id}
                href={section.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 rounded-xl transition-all duration-200 min-h-[44px] game-slide-in-bottom game-mobile-nav-tooltip',
                  active
                    ? 'text-[var(--bt-emerald)] scale-105'
                    : 'text-muted-foreground hover:text-foreground hover:scale-105'
                )}
                data-label={t(section.label)}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className={cn('transition-colors duration-200', active ? '' : 'opacity-60')}>
                  {ICONS[section.icon]}
                </div>
                <span className="text-[10px] font-semibold leading-tight">{t(section.mobileLabel)}</span>
                {active && (
                  <div className="absolute bottom-1 w-5 h-0.5 rounded-full game-nav-bounce" style={{ background: 'linear-gradient(90deg, #006a4e, #00a86b)', boxShadow: '0 0 8px rgba(0,106,78,0.3)' }} />
                )}
                {badge > 0 && !active && (
                  <span className="absolute top-0.5 right-1 h-4 w-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center game-badge-pulse" style={{ background: '#f42a41' }}>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-14 bottom-0 w-52 flex-col border-r z-40 game-sidebar-gradient-bar bg-[linear-gradient(to_bottom,var(--bt-surface-1),color-mix(in_oklch,var(--bt-emerald)_5%,var(--bt-surface-2)))]">
        {/* Logo/brand section at top */}
        <div className="px-3 pt-5 pb-3 border-b border-green-100/50 dark:border-green-900/60">
          <div className="flex items-center gap-2.5 px-2">
            <span className="text-xl">🇧🇩</span>
            <div>
              <div className="text-xs font-bold game-gradient-text">{t('nav.brand')}</div>
              <div className="text-[9px] text-muted-foreground uppercase" style={{ letterSpacing: '0.12em' }}>{t('nav.menu')}</div>
            </div>
          </div>
        </div>
        <div className="flex-1 px-3 space-y-1 pt-3">
          {NAV_SECTIONS.map((section) => {
            const active = isSectionActive(section, pathname);
            const badge = badgeFor(section);
            return (
              <div key={section.id}>
                <Link
                  href={section.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    active
                      ? 'text-white shadow-md shadow-green-200/50 scale-[1.02]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-green-50/60 dark:hover:bg-green-950/40 hover:scale-[1.02]'
                  )}
                  style={active ? { background: 'linear-gradient(135deg, #006a4e 0%, #00895e 60%, #00a86b 100%)' } : {}}
                >
                  {ICONS[section.icon]}
                  {t(section.label)}
                  {badge > 0 && (
                    <span className={cn(
                      'absolute right-2 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center',
                      active ? 'bg-[var(--bt-surface-1)] text-[var(--bt-emerald)] game-badge-pulse' : 'text-white game-badge-pulse'
                    )} style={!active ? { background: '#f42a41' } : {}}>
                      {badge}
                    </span>
                  )}
                </Link>

                {/* The open section lists its screens beneath it, so the sidebar
                    still shows every destination at a glance. */}
                {active && section.routes.length > 1 && (
                  <div className="mt-1 ml-4 space-y-0.5 border-l border-green-200/60 dark:border-green-900/60 pl-3">
                    {section.routes.map((route) => {
                      const tabActive = pathname === route.href || pathname.startsWith(`${route.href}/`);
                      return (
                        <Link
                          key={route.href}
                          href={route.href}
                          aria-current={tabActive ? 'page' : undefined}
                          className={cn(
                            'block rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                            tabActive
                              ? 'text-[var(--bt-emerald)] bg-green-50/70 dark:bg-green-950/40'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {t(route.label)}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="p-3 border-t border-green-100/50 dark:border-green-900/60">
          <div className="text-[10px] text-muted-foreground text-center">
            Bangladesh Business Tycoon
          </div>
        </div>
      </aside>
    </>
  );
}
