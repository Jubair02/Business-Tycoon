'use client';

import { ThemeProvider } from 'next-themes';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import type { Locale } from '@/lib/i18n/config';

/**
 * Client-side providers for the whole app.
 *
 * next-themes writes the `dark` class onto <html>, which is what the
 * `@custom-variant dark (&:is(.dark *))` rule in globals.css keys off.
 * It also injects a blocking inline script so the correct theme is applied
 * before first paint — no white flash on reload for dark-mode players.
 */
export default function Providers({
  children,
  locale,
}: {
  children: React.ReactNode;
  /** Resolved on the server so the first paint is already in the right language. */
  locale: Locale;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="bd-tycoon-theme"
    >
      <I18nProvider initialLocale={locale}>{children}</I18nProvider>
    </ThemeProvider>
  );
}
