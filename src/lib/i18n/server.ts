// ============================================
// Bangladesh Business Tycoon - Server-side locale
// ============================================
//
// Resolving the language on the server is what makes the first paint correct.
// Doing it on the client would show every Bangla player a flash of English on
// every navigation, and would leave `<html lang>` lying about the content —
// which matters for screen readers and for how the browser hyphenates and
// renders Bengali text.

import { cookies, headers } from 'next/headers';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_META,
  localeFromAcceptLanguage,
  parseLocale,
  type Locale,
} from './config';
import { translate, type MessageKey, type TranslateParams } from './translate';

/**
 * The language to render in.
 *
 * An explicit choice always wins; otherwise the browser's preference is
 * honoured, which means a Bangla-speaking player lands in Bangla without
 * having to find a setting first.
 */
export async function getLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const chosen = cookieStore.get(LOCALE_COOKIE)?.value;
    if (chosen) return parseLocale(chosen);

    const headerStore = await headers();
    return localeFromAcceptLanguage(headerStore.get('accept-language'));
  } catch {
    // Called outside a request scope (a build-time render, say).
    return DEFAULT_LOCALE;
  }
}

/** The BCP 47 tag for `<html lang>`. */
export async function getLocaleTag(): Promise<string> {
  return LOCALE_META[await getLocale()].tag;
}

/** Translate in a server component. */
export async function getT() {
  const locale = await getLocale();
  return (key: MessageKey, params?: TranslateParams) => translate(locale, key, params);
}
