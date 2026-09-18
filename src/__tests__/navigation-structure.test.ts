// ============================================
// Bangladesh Business Tycoon - Navigation Structure Tests
// ============================================
//
// Ten top-level destinations were consolidated into six sections. The rule that
// makes that safe is that nothing was deleted: every route that existed before
// still exists and still resolves, it is just reached through the section it
// belongs to. These tests hold that rule.

import { describe, it, expect } from 'vitest';
import {
  ROUTES,
  NAV_SECTIONS,
  findSection,
  isSectionActive,
  sectionTabs,
  isTabActive,
} from '@/lib/game-routes';

/** The ten destinations that used to have their own icon in the bar. */
const FORMER_TOP_LEVEL = [
  ROUTES.dashboard,
  ROUTES.businesses,
  ROUTES.portfolio,
  ROUTES.market,
  ROUTES.competition,
  ROUTES.bank,
  ROUTES.leaderboard,
  ROUTES.news,
  ROUTES.achievements,
  ROUTES.settings,
];

describe('navigation sections', () => {
  it('shows six destinations, down from ten', () => {
    expect(NAV_SECTIONS).toHaveLength(6);
  });

  it('still reaches every screen that used to be top-level', () => {
    for (const route of FORMER_TOP_LEVEL) {
      expect(findSection(route), `${route} is not reachable from the nav`).toBeDefined();
    }
  });

  it('puts every route in exactly one section', () => {
    const seen = new Map<string, string>();
    for (const section of NAV_SECTIONS) {
      for (const route of section.routes) {
        expect(seen.has(route.href), `${route.href} appears in two sections`).toBe(false);
        seen.set(route.href, section.id);
      }
    }
    // The nav has grown since the consolidation — Store and Classroom were
    // added later — so this asserts the invariant that matters, which is that
    // nothing was dropped, not that the count is frozen.
    for (const route of FORMER_TOP_LEVEL) {
      expect(seen.has(route), `${route} is no longer in the nav`).toBe(true);
    }
    expect(seen.size).toBeGreaterThanOrEqual(FORMER_TOP_LEVEL.length);
  });

  it('opens each section on its first route', () => {
    for (const section of NAV_SECTIONS) {
      expect(section.href).toBe(section.routes[0].href);
    }
  });

  it('folds the two pairs that overlapped into their parents', () => {
    // Portfolio is a view of your businesses; Competition is a view of the market.
    expect(findSection(ROUTES.portfolio)!.id).toBe(findSection(ROUTES.businesses)!.id);
    expect(findSection(ROUTES.competition)!.id).toBe(findSection(ROUTES.market)!.id);
  });
});

describe('findSection', () => {
  it('claims a nested business detail route for Businesses', () => {
    expect(findSection('/businesses/abc123')!.id).toBe('businesses');
  });

  it('claims the new-business wizard for Businesses', () => {
    expect(findSection(ROUTES.newBusiness)!.id).toBe('businesses');
  });

  it('returns nothing for a path outside the game shell', () => {
    expect(findSection('/')).toBeUndefined();
    expect(findSection('/login')).toBeUndefined();
  });

  it('prefers the longest matching route, not the first one declared', () => {
    // A short prefix in one section must not swallow a longer route in another.
    for (const section of NAV_SECTIONS) {
      for (const route of section.routes) {
        expect(findSection(route.href)!.id).toBe(section.id);
      }
    }
  });
});

describe('isSectionActive', () => {
  it('lights the owning section for a nested route', () => {
    const businesses = NAV_SECTIONS.find(s => s.id === 'businesses')!;
    expect(isSectionActive(businesses, '/businesses/abc123')).toBe(true);
  });

  it('lights Businesses, not Dashboard, on the portfolio screen', () => {
    const businesses = NAV_SECTIONS.find(s => s.id === 'businesses')!;
    const dashboard = NAV_SECTIONS.find(s => s.id === 'dashboard')!;
    expect(isSectionActive(businesses, ROUTES.portfolio)).toBe(true);
    expect(isSectionActive(dashboard, ROUTES.portfolio)).toBe(false);
  });

  it('lights exactly one section for any in-game path', () => {
    for (const route of FORMER_TOP_LEVEL) {
      const lit = NAV_SECTIONS.filter(s => isSectionActive(s, route));
      expect(lit, `${route} lit ${lit.length} sections`).toHaveLength(1);
    }
  });
});

describe('sectionTabs', () => {
  it('shows no tab bar for a section with a single screen', () => {
    expect(sectionTabs(ROUTES.dashboard)).toHaveLength(0);
    expect(sectionTabs(ROUTES.bank)).toHaveLength(0);
  });

  it('shows the sibling screens for a section with more than one', () => {
    const tabs = sectionTabs(ROUTES.market);
    expect(tabs.map(t => t.href)).toEqual([ROUTES.market, ROUTES.competition]);
  });

  it('shows the same tabs from either screen in the section', () => {
    expect(sectionTabs(ROUTES.competition)).toEqual(sectionTabs(ROUTES.market));
    expect(sectionTabs(ROUTES.portfolio)).toEqual(sectionTabs(ROUTES.businesses));
  });

  it('shows the Businesses tabs on a business detail screen', () => {
    expect(sectionTabs('/businesses/abc123').map(t => t.href))
      .toEqual([ROUTES.businesses, ROUTES.portfolio]);
  });

  it('shows nothing outside the game shell', () => {
    expect(sectionTabs('/')).toHaveLength(0);
  });
});

describe('isTabActive', () => {
  it('marks the open screen', () => {
    const tabs = sectionTabs(ROUTES.competition);
    const active = tabs.filter(t => isTabActive(t, ROUTES.competition));
    expect(active).toHaveLength(1);
    expect(active[0].href).toBe(ROUTES.competition);
  });

  it('keeps the parent tab marked on a nested route', () => {
    const tabs = sectionTabs('/businesses/abc123');
    expect(isTabActive(tabs[0], '/businesses/abc123')).toBe(true);
    expect(isTabActive(tabs[1], '/businesses/abc123')).toBe(false);
  });
});
