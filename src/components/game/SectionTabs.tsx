'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { sectionTabs, isTabActive } from '@/lib/game-routes';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/I18nProvider';

/**
 * The second level of navigation.
 *
 * Consolidating ten destinations into six meant four screens lost their icon in
 * the bar. They are not gone — they moved inside the section they belonged to
 * all along, and this is where they surface. Sections holding a single screen
 * render nothing at all, so the tab bar only appears where there is a genuine
 * choice to make.
 *
 * `usePathname` needs no Suspense boundary here: this project does not enable
 * `cacheComponents`, so the pathname resolves during prerendering.
 */
export default function SectionTabs() {
  const pathname = usePathname();
  const t = useT();
  const tabs = sectionTabs(pathname);

  if (tabs.length === 0) return null;

  return (
    <nav
      aria-label={t('nav.sectionLabel')}
      className="md:hidden px-4 pt-3"
    >
      <div className="inline-flex w-full gap-1 rounded-xl border border-[var(--bt-hairline)] bg-[var(--bt-surface-2)] p-1">
        {tabs.map((tab) => {
          const active = isTabActive(tab, pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold transition-all duration-200 min-h-[36px] flex items-center justify-center',
                active
                  ? 'bg-[var(--bt-surface-1)] text-[var(--bt-emerald)] shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t(tab.label)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
