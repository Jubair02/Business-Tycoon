'use client';

import { useI18n } from '@/lib/i18n/I18nProvider';
import { LOCALES, LOCALE_META, type Locale } from '@/lib/i18n/config';
import { cn } from '@/lib/utils';

/**
 * Switch the interface language.
 *
 * Each option is written in its own language — a player looking for Bangla is
 * looking for "বাংলা", not for a row labelled "Bangla" in English they may not
 * read. The choice is stored in a cookie so the server can render the next page
 * in the right language from the first byte.
 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="radiogroup"
      aria-label={t('settings.language')}
      className="inline-flex w-full gap-1 rounded-xl border border-[var(--bt-hairline)] bg-[var(--bt-surface-2)] p-1"
    >
      {LOCALES.map((code: Locale) => {
        const meta = LOCALE_META[code];
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setLocale(code)}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 min-h-[40px] flex items-center justify-center gap-2',
              active
                ? 'bg-[var(--bt-surface-1)] text-[var(--bt-emerald)] shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span aria-hidden="true">{meta.flag}</span>
            <span lang={meta.tag}>{meta.nativeName}</span>
          </button>
        );
      })}
    </div>
  );
}
