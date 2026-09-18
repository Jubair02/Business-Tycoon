// ============================================
// Bangladesh Business Tycoon - Localisation Config
// ============================================
//
// Bangla appeared in this game only as hardcoded strings sitting next to
// English ones — `nameBn` on a city, a stray `ঢাকা` in a label — with no way to
// actually run the interface in Bangla. For a game whose entire positioning is
// that it is set in Bangladesh, that is the single most obvious gap.
//
// This is the infrastructure that was missing. It is deliberately built on the
// platform's own `Intl` rather than on a dependency: the app has no locale
// routing to hang `next-intl` off, the whole surface is one product with two
// languages, and `Intl` already knows how Bangla pluralises, groups digits into
// lakh and crore, and renders Bengali numerals.

export const LOCALES = ['en', 'bn'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Where the chosen language is remembered. Read on the server to set `lang`. */
export const LOCALE_COOKIE = 'bd-tycoon-locale';

export const LOCALE_COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax' as const,
};

export interface LocaleMeta {
  code: Locale;
  /** The language's name in that language, which is what a switcher should show. */
  nativeName: string;
  englishName: string;
  /** BCP 47 tag for `Intl` and the `lang` attribute. */
  tag: string;
  flag: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { code: 'en', nativeName: 'English', englishName: 'English', tag: 'en-BD', flag: '🇬🇧' },
  bn: { code: 'bn', nativeName: 'বাংলা', englishName: 'Bangla', tag: 'bn-BD', flag: '🇧🇩' },
};

/** Narrow an untrusted string to a supported locale. */
export function parseLocale(value: string | undefined | null): Locale {
  if (!value) return DEFAULT_LOCALE;
  const normalised = value.trim().toLowerCase().split('-')[0];
  return (LOCALES as readonly string[]).includes(normalised)
    ? (normalised as Locale)
    : DEFAULT_LOCALE;
}

/**
 * Pick a locale from an `Accept-Language` header.
 *
 * Only consulted when the player has not chosen for themselves — an explicit
 * choice always wins over what the browser guesses.
 */
export function localeFromAcceptLanguage(header: string | undefined | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const preferences = header
    .split(',')
    .map(part => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find(p => p.trim().startsWith('q='));
      const quality = q ? Number(q.split('=')[1]) : 1;
      return { tag: tag.trim().toLowerCase(), quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter(p => p.tag)
    .sort((a, b) => b.quality - a.quality);

  for (const preference of preferences) {
    const base = preference.tag.split('-')[0];
    if ((LOCALES as readonly string[]).includes(base)) return base as Locale;
  }

  return DEFAULT_LOCALE;
}
