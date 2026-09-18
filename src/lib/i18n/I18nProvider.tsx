'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_OPTIONS,
  LOCALE_META,
  parseLocale,
  type Locale,
} from './config';
import {
  translate,
  formatNumber,
  formatTakaLocalised,
  formatTakaCompact,
  formatPercent,
  formatDate,
  formatRelativeTime,
  type MessageKey,
  type TranslateParams,
} from './translate';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a key. */
  t: (key: MessageKey, params?: TranslateParams) => string;
  /** Locale-aware formatters, pre-bound so call sites never pass the locale. */
  n: (value: number) => string;
  taka: (value: number) => string;
  takaShort: (value: number) => string;
  percent: (fraction: number) => string;
  date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  since: (value: Date | string | number) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Makes the chosen language available to the client tree.
 *
 * The locale is resolved on the server and passed in, so the first paint is
 * already in the right language — switching it on the client afterwards would
 * mean every player briefly seeing English.
 */
export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(parseLocale(initialLocale));

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);

    // Remembered in a cookie rather than localStorage: the server needs it to
    // set `<html lang>` and to render the first paint in the right language,
    // and only a cookie is sent with the document request.
    try {
      const { maxAge, path, sameSite } = LOCALE_COOKIE_OPTIONS;
      document.cookie =
        `${LOCALE_COOKIE}=${next}; path=${path}; max-age=${maxAge}; samesite=${sameSite}`;
    } catch {
      // A browser refusing cookies still gets the language for this session.
    }

    if (typeof document !== 'undefined') {
      document.documentElement.lang = LOCALE_META[next].tag;
    }
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
      n: value => formatNumber(value, locale),
      taka: value => formatTakaLocalised(value, locale),
      takaShort: value => formatTakaCompact(value, locale),
      percent: fraction => formatPercent(fraction, locale),
      date: (value, options) => formatDate(value, locale, options),
      since: value => formatRelativeTime(value, locale),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Read the current language and its formatters.
 *
 * Falls back to English outside a provider rather than throwing: a stray
 * component rendered in isolation (a test, a storybook page) should render in
 * English, not crash.
 */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (context) return context;

  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => {},
    t: (key, params) => translate(DEFAULT_LOCALE, key, params),
    n: value => formatNumber(value, DEFAULT_LOCALE),
    taka: value => formatTakaLocalised(value, DEFAULT_LOCALE),
    takaShort: value => formatTakaCompact(value, DEFAULT_LOCALE),
    percent: fraction => formatPercent(fraction, DEFAULT_LOCALE),
    date: (value, options) => formatDate(value, DEFAULT_LOCALE, options),
    since: value => formatRelativeTime(value, DEFAULT_LOCALE),
  };
}

/** Shorthand for components that only need the translate function. */
export function useT() {
  return useI18n().t;
}
