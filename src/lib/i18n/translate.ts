// ============================================
// Bangladesh Business Tycoon - Translation & formatting
// ============================================
//
// Pure. No React, no cookies, no Prisma — so plural selection, interpolation
// and money formatting can be tested directly, in both languages.

import { DEFAULT_LOCALE, LOCALE_META, type Locale } from './config';
import { en, type Catalogue, type MessageKey, type MessageValue } from './messages/en';
import { bn } from './messages/bn';

export const CATALOGUES: Record<Locale, Catalogue> = { en, bn };

export type { MessageKey };

export type TranslateParams = Record<string, string | number> & { count?: number };

/**
 * Choose the plural form for a count.
 *
 * `Intl.PluralRules` knows each language's categories; English and Bangla both
 * use one/other, but nothing here assumes that, so adding a language with
 * few/many later needs no change.
 */
function selectPluralForm(
  value: Exclude<MessageValue, string>,
  locale: Locale,
  count: number,
): string {
  const rule = new Intl.PluralRules(LOCALE_META[locale].tag).select(count);
  return value[rule] ?? value.other ?? value.one ?? '';
}

/** Replace `{name}` placeholders with their values. */
function interpolate(template: string, params: TranslateParams, locale: Locale): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    // Numbers are formatted for the locale, so Bangla gets Bengali numerals and
    // lakh/crore grouping without every call site remembering to ask for it.
    return typeof value === 'number' ? formatNumber(value, locale) : String(value);
  });
}

/**
 * Translate a key.
 *
 * Falls back to English, then to the key itself. Returning the key is
 * deliberate: a missing message should be obvious in the UI and greppable in a
 * bug report, not silently blank.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  params: TranslateParams = {},
): string {
  const catalogue = CATALOGUES[locale] ?? CATALOGUES[DEFAULT_LOCALE];
  const value: MessageValue | undefined =
    catalogue[key] ?? CATALOGUES[DEFAULT_LOCALE][key];

  if (value === undefined) return key;

  const template =
    typeof value === 'string'
      ? value
      : selectPluralForm(value, locale, params.count ?? 0);

  return interpolate(template, params, locale);
}

// ============================================
// Number, money and date formatting
// ============================================

const numberFormatters = new Map<string, Intl.NumberFormat>();

function numberFormatter(locale: Locale, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE_META[locale].tag, options);
    numberFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * A plain number in the player's language.
 *
 * `bn-BD` gives Bengali numerals and the South Asian grouping — ১২,৩৪,৫৬৭
 * rather than 1,234,567 — which is the whole reason this goes through `Intl`
 * instead of `toLocaleString('en-BD')` as the game used to.
 */
export function formatNumber(value: number, locale: Locale = DEFAULT_LOCALE): string {
  if (!Number.isFinite(value)) return '—';
  return numberFormatter(locale).format(value);
}

/** Taka, written out in full. */
export function formatTakaLocalised(value: number, locale: Locale = DEFAULT_LOCALE): string {
  if (!Number.isFinite(value)) return '—';
  return `৳ ${numberFormatter(locale, { maximumFractionDigits: 0 }).format(Math.round(value))}`;
}

/**
 * Taka, abbreviated to lakh and crore.
 *
 * Kept as a formatting function rather than a message so the thresholds live in
 * one place; the unit words themselves come from the catalogue.
 */
export function formatTakaCompact(value: number, locale: Locale = DEFAULT_LOCALE): string {
  if (!Number.isFinite(value)) return '—';

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 10_000_000) {
    const crore = numberFormatter(locale, { maximumFractionDigits: 2 }).format(abs / 10_000_000);
    return `${sign}৳ ${translate(locale, 'money.crore', { value: crore })}`;
  }
  if (abs >= 100_000) {
    const lakh = numberFormatter(locale, { maximumFractionDigits: 2 }).format(abs / 100_000);
    return `${sign}৳ ${translate(locale, 'money.lakh', { value: lakh })}`;
  }
  return `${sign}৳ ${numberFormatter(locale, { maximumFractionDigits: 0 }).format(abs)}`;
}

/** A percentage, in the player's numerals. */
export function formatPercent(fraction: number, locale: Locale = DEFAULT_LOCALE): string {
  if (!Number.isFinite(fraction)) return '—';
  return numberFormatter(locale, { style: 'percent', maximumFractionDigits: 0 }).format(fraction);
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatDate(
  value: Date | string | number,
  locale: Locale = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const key = `${locale}:${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(LOCALE_META[locale].tag, options);
    dateFormatters.set(key, formatter);
  }
  return formatter.format(date);
}

/**
 * A short "how long ago" string.
 *
 * Built from catalogue messages rather than `Intl.RelativeTimeFormat` because
 * the game's phrasing is deliberately terse ("2h ago") and consistent across
 * both languages.
 */
export function formatRelativeTime(
  value: Date | string | number,
  locale: Locale = DEFAULT_LOCALE,
  now: Date = new Date(),
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (diffMinutes < 1) return translate(locale, 'time.justNow');
  if (diffMinutes < 60) return translate(locale, 'time.minutesAgo', { count: diffMinutes });

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return translate(locale, 'time.hoursAgo', { count: diffHours });

  return formatDate(date, locale);
}
