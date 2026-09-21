// ============================================
// Bangladesh Business Tycoon - Route map
// ============================================
//
// The game used to switch between screens with a `view` value held in the
// zustand store, which meant no URLs: the back button, refresh and shareable
// links all did nothing. Every screen is now a real route; this module is the
// single place those paths are defined.

export const ROUTES = {
  welcome: '/',
  dashboard: '/dashboard',
  businesses: '/businesses',
  newBusiness: '/businesses/new',
  portfolio: '/portfolio',
  market: '/market',
  competition: '/competition',
  bank: '/bank',
  leaderboard: '/leaderboard',
  news: '/news',
  calendar: '/calendar',
  achievements: '/achievements',
  store: '/store',
  classroom: '/classroom',
  settings: '/settings',
} as const;

/** Detail route for a single business. */
export function businessRoute(id: string): string {
  return `/businesses/${id}`;
}

/** Routes rendered inside the narrower detail column. */
export function isDetailRoute(pathname: string): boolean {
  return pathname.startsWith('/businesses/');
}

// ============================================
// Navigation structure
// ============================================
//
// Ten top-level destinations was too many to hold in mind, and two pairs of
// them plainly overlapped: Portfolio is a view of your Businesses, and
// Competition is a view of the Market. On a 360px phone the ten needed 455px
// and had to be folded into two rows of icons.
//
// They are now grouped into six sections. Every route still exists and still
// works — nothing is deleted and no bookmark breaks — but a section with more
// than one route surfaces its siblings as tabs inside the section rather than
// as another icon in the bar. See `SectionTabs`.

import type { MessageKey } from '@/lib/i18n/messages/en';

export interface NavRoute {
  href: string;
  /** Message key for the tab label inside the section. */
  label: MessageKey;
}

export interface NavSection {
  id: string;
  /** Message key for the sidebar label. */
  label: MessageKey;
  /** Message key for the bottom-bar label, which has far less room. */
  mobileLabel: MessageKey;
  /** Icon name, resolved to a component in `Navigation`. */
  icon: string;
  /** Where the section opens. Always the first route. */
  href: string;
  routes: NavRoute[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'dashboard',
    label: 'nav.dashboard',
    mobileLabel: 'nav.dashboard.short',
    icon: 'dashboard',
    href: ROUTES.dashboard,
    routes: [{ href: ROUTES.dashboard, label: 'business.overview' }],
  },
  {
    id: 'businesses',
    label: 'nav.businesses',
    mobileLabel: 'nav.businesses.short',
    icon: 'store',
    href: ROUTES.businesses,
    routes: [
      { href: ROUTES.businesses, label: 'nav.tab.myShops' },
      { href: ROUTES.portfolio, label: 'nav.tab.portfolio' },
    ],
  },
  {
    id: 'market',
    label: 'nav.market',
    mobileLabel: 'nav.market.short',
    icon: 'trending',
    href: ROUTES.market,
    routes: [
      { href: ROUTES.market, label: 'nav.tab.prices' },
      { href: ROUTES.competition, label: 'nav.tab.competition' },
    ],
  },
  {
    id: 'bank',
    label: 'nav.bank',
    mobileLabel: 'nav.bank.short',
    icon: 'bank',
    href: ROUTES.bank,
    routes: [{ href: ROUTES.bank, label: 'nav.tab.loans' }],
  },
  {
    id: 'progress',
    label: 'nav.ranks',
    mobileLabel: 'nav.ranks.short',
    icon: 'trophy',
    href: ROUTES.leaderboard,
    routes: [
      { href: ROUTES.leaderboard, label: 'nav.tab.leaderboard' },
      { href: ROUTES.achievements, label: 'nav.tab.achievements' },
    ],
  },
  {
    id: 'more',
    label: 'nav.more',
    mobileLabel: 'nav.more.short',
    icon: 'more',
    href: ROUTES.news,
    routes: [
      { href: ROUTES.news, label: 'nav.tab.news' },
      { href: ROUTES.calendar, label: 'nav.tab.calendar' },
      { href: ROUTES.store, label: 'nav.tab.store' },
      { href: ROUTES.classroom, label: 'nav.tab.classroom' },
      { href: ROUTES.settings, label: 'nav.tab.settings' },
    ],
  },
];

/**
 * The section a path belongs to, or undefined for a path outside the nav
 * (the welcome screen, say).
 *
 * Nested paths count as their parent: `/businesses/<id>` is in Businesses.
 * Longer routes are matched first so `/businesses/new` cannot be claimed by a
 * shorter prefix somewhere else.
 */
export function findSection(pathname: string): NavSection | undefined {
  let best: { section: NavSection; length: number } | undefined;

  for (const section of NAV_SECTIONS) {
    for (const route of section.routes) {
      const matches = pathname === route.href || pathname.startsWith(`${route.href}/`);
      if (matches && (!best || route.href.length > best.length)) {
        best = { section, length: route.href.length };
      }
    }
  }

  return best?.section;
}

/** Whether a section's icon should be lit for the current path. */
export function isSectionActive(section: NavSection, pathname: string): boolean {
  return findSection(pathname)?.id === section.id;
}

/**
 * The tabs to show above the current screen, or an empty array when the
 * section holds a single route and a tab bar would be noise.
 */
export function sectionTabs(pathname: string): NavRoute[] {
  const section = findSection(pathname);
  if (!section || section.routes.length < 2) return [];
  return section.routes;
}

/** Whether a tab is the one currently open. */
export function isTabActive(tab: NavRoute, pathname: string): boolean {
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}
