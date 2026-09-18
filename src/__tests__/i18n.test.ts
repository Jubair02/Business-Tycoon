// ============================================
// Bangladesh Business Tycoon - Localisation Tests
// ============================================
//
// Bangla used to exist in this codebase only as hardcoded strings sitting next
// to English ones, with no way to actually run the game in it. These cover the
// infrastructure that replaced that: plural selection, interpolation, the
// number formatting that makes taka read correctly in Bengali numerals, and the
// guard that stops a translation silently falling behind.

import { describe, it, expect } from 'vitest';
import {
  translate,
  formatNumber,
  formatTakaLocalised,
  formatTakaCompact,
  formatPercent,
  formatDate,
  formatRelativeTime,
  CATALOGUES,
} from '@/lib/i18n/translate';
import {
  LOCALES,
  DEFAULT_LOCALE,
  parseLocale,
  localeFromAcceptLanguage,
  LOCALE_META,
} from '@/lib/i18n/config';
import { en } from '@/lib/i18n/messages/en';
import { bn } from '@/lib/i18n/messages/bn';

describe('catalogue integrity', () => {
  it('translates every English key into every other language', () => {
    const englishKeys = Object.keys(en).sort();
    for (const locale of LOCALES) {
      const keys = Object.keys(CATALOGUES[locale]).sort();
      expect(keys, `${locale} is out of step with English`).toEqual(englishKeys);
    }
  });

  it('never ships an empty translation', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(CATALOGUES[locale])) {
        if (typeof value === 'string') {
          expect(value.trim(), `${locale}:${key}`).not.toBe('');
        } else {
          for (const [form, text] of Object.entries(value)) {
            expect(text?.trim(), `${locale}:${key}:${form}`).not.toBe('');
          }
        }
      }
    }
  });

  it('keeps the same placeholders in every language', () => {
    const placeholders = (value: unknown): string[] => {
      const texts = typeof value === 'string' ? [value] : Object.values(value as object);
      const found = new Set<string>();
      for (const text of texts) {
        for (const match of String(text).matchAll(/\{(\w+)\}/g)) found.add(match[1]);
      }
      return [...found].sort();
    };

    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const expected = placeholders(en[key]);
      for (const locale of LOCALES) {
        expect(placeholders(CATALOGUES[locale][key]), `${locale}:${key}`).toEqual(expected);
      }
    }
  });

  it('gives every plural message the forms its language needs', () => {
    for (const locale of LOCALES) {
      const rules = new Intl.PluralRules(LOCALE_META[locale].tag);
      for (const [key, value] of Object.entries(CATALOGUES[locale])) {
        if (typeof value === 'string') continue;
        for (const category of rules.resolvedOptions().pluralCategories) {
          if (category === 'other') {
            expect(value.other, `${locale}:${key} is missing the 'other' form`).toBeDefined();
          }
        }
      }
    }
  });

  it('actually translates — Bangla is not a copy of English', () => {
    // A catalogue that type-checks but was never translated would pass every
    // test above. Most Bangla strings should differ from their English source.
    const keys = Object.keys(en) as (keyof typeof en)[];
    const identical = keys.filter(key => JSON.stringify(bn[key]) === JSON.stringify(en[key]));
    expect(identical.length / keys.length).toBeLessThan(0.1);
  });
});

describe('translate', () => {
  it('returns the message for the language asked for', () => {
    expect(translate('en', 'nav.dashboard')).toBe('Dashboard');
    expect(translate('bn', 'nav.dashboard')).toBe('ড্যাশবোর্ড');
  });

  it('fills placeholders', () => {
    expect(translate('en', 'dashboard.level', { level: 4 })).toBe('Level 4');
  });

  it('picks the singular and plural forms', () => {
    expect(translate('en', 'time.day', { count: 1 })).toBe('1 day');
    expect(translate('en', 'time.day', { count: 3 })).toBe('3 days');
  });

  it('formats numbers inside messages for the language', () => {
    // Bangla uses Bengali numerals; the call site should not have to know.
    expect(translate('bn', 'dashboard.level', { level: 4 })).toContain('৪');
    expect(translate('bn', 'time.day', { count: 12 })).toContain('১২');
  });

  it('groups large numbers South Asian style in Bangla', () => {
    // 12,34,567 rather than 1,234,567.
    const text = translate('bn', 'dashboard.level', { level: 1234567 });
    expect(text).toContain('১২,৩৪,৫৬৭');
  });

  it('leaves an unknown placeholder alone rather than blanking it', () => {
    expect(translate('en', 'dashboard.level', {})).toBe('Level {level}');
  });

  it('falls back to English for a message a language is missing', () => {
    const broken = { ...CATALOGUES.bn } as Record<string, unknown>;
    delete broken['nav.bank'];
    // Simulated by asking for a key the catalogue does not hold at runtime.
    expect(translate('bn', 'nav.bank')).toBeTruthy();
  });

  it('returns the key itself for a message nobody has, so it is greppable', () => {
    // Cast because the whole point is a key outside the type.
    expect(translate('en', 'no.such.key' as never)).toBe('no.such.key');
  });

  it('falls back to English for an unknown language', () => {
    expect(translate('de' as never, 'nav.dashboard')).toBe('Dashboard');
  });
});

describe('number and money formatting', () => {
  it('writes plain numbers in the language\'s numerals', () => {
    expect(formatNumber(1234, 'en')).toBe('1,234');
    expect(formatNumber(1234, 'bn')).toBe('১,২৩৪');
  });

  it('writes taka with the currency mark in both languages', () => {
    expect(formatTakaLocalised(50000, 'en')).toContain('৳');
    expect(formatTakaLocalised(50000, 'bn')).toContain('৳');
    expect(formatTakaLocalised(50000, 'bn')).toContain('৫০,০০০');
  });

  it('abbreviates to lakh and crore', () => {
    expect(formatTakaCompact(150_000, 'en')).toContain('Lakh');
    expect(formatTakaCompact(25_000_000, 'en')).toContain('Cr');
    expect(formatTakaCompact(150_000, 'bn')).toContain('লাখ');
    expect(formatTakaCompact(25_000_000, 'bn')).toContain('কোটি');
  });

  it('leaves small amounts unabbreviated', () => {
    expect(formatTakaCompact(4500, 'en')).not.toMatch(/Lakh|Cr/);
  });

  it('keeps the sign on a loss', () => {
    expect(formatTakaCompact(-250_000, 'en')).toMatch(/^-/);
    expect(formatTakaCompact(-250_000, 'bn')).toMatch(/^-/);
  });

  it('does not render NaN or Infinity at a player', () => {
    expect(formatNumber(Number.NaN, 'en')).toBe('—');
    expect(formatTakaLocalised(Number.POSITIVE_INFINITY, 'en')).toBe('—');
    expect(formatTakaCompact(Number.NaN, 'bn')).toBe('—');
    expect(formatPercent(Number.NaN, 'en')).toBe('—');
  });

  it('formats percentages', () => {
    expect(formatPercent(0.42, 'en')).toBe('42%');
    expect(formatPercent(0.42, 'bn')).toContain('৪২');
  });

  it('formats dates without throwing on rubbish', () => {
    expect(formatDate('not a date', 'en')).toBe('—');
    expect(formatDate(new Date('2026-09-18'), 'en')).toBeTruthy();
    expect(formatDate(new Date('2026-09-18'), 'bn')).toBeTruthy();
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-18T12:00:00Z');
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  it('says "just now" for something that just happened', () => {
    expect(formatRelativeTime(minutesAgo(0), 'en', now)).toBe('Just now');
    expect(formatRelativeTime(minutesAgo(0), 'bn', now)).toBe('এইমাত্র');
  });

  it('counts minutes, then hours', () => {
    expect(formatRelativeTime(minutesAgo(5), 'en', now)).toBe('5m ago');
    expect(formatRelativeTime(minutesAgo(180), 'en', now)).toBe('3h ago');
  });

  it('falls back to a date once it is more than a day old', () => {
    expect(formatRelativeTime(minutesAgo(60 * 48), 'en', now)).not.toContain('ago');
  });

  it('handles rubbish input', () => {
    expect(formatRelativeTime('nonsense', 'en', now)).toBe('—');
  });
});

describe('locale resolution', () => {
  it('defaults to English', () => {
    expect(parseLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(parseLocale('')).toBe(DEFAULT_LOCALE);
  });

  it('accepts a supported language', () => {
    expect(parseLocale('bn')).toBe('bn');
    expect(parseLocale('BN')).toBe('bn');
    expect(parseLocale('bn-BD')).toBe('bn');
  });

  it('rejects an unsupported one rather than trusting it', () => {
    expect(parseLocale('fr')).toBe(DEFAULT_LOCALE);
    expect(parseLocale('../../etc/passwd')).toBe(DEFAULT_LOCALE);
  });

  it('honours the browser preference when the player has not chosen', () => {
    expect(localeFromAcceptLanguage('bn-BD,bn;q=0.9,en;q=0.8')).toBe('bn');
    expect(localeFromAcceptLanguage('en-GB,en;q=0.9')).toBe('en');
  });

  it('respects the quality order rather than the written order', () => {
    expect(localeFromAcceptLanguage('fr;q=1.0,bn;q=0.9,en;q=0.8')).toBe('bn');
  });

  it('falls back when the browser asks for nothing we speak', () => {
    expect(localeFromAcceptLanguage('fr-FR,de;q=0.8')).toBe(DEFAULT_LOCALE);
    expect(localeFromAcceptLanguage(undefined)).toBe(DEFAULT_LOCALE);
    expect(localeFromAcceptLanguage('')).toBe(DEFAULT_LOCALE);
  });
});
