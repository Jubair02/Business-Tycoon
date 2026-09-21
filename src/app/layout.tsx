import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Providers from "./providers";
import { getLocale } from "@/lib/i18n/server";
import { LOCALE_META } from "@/lib/i18n/config";
import { AnalyticsProvider } from "@/components/game/AnalyticsProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bangladesh Business Tycoon 🇧🇩",
  description: "Build your business empire in Bangladesh! Start with a tea stall and grow into a tycoon managing restaurants, clothing shops, electronics stores, and more across Dhaka, Chattogram, Sylhet, Rajshahi, and Khulna.",
  keywords: ["Bangladesh", "business tycoon", "tycoon game", "simulation", "management"],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🇧🇩</text></svg>",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `lang` has to be right on the server: it is what a screen reader announces
  // the page in, and what the browser uses to render and break Bengali text.
  const locale = await getLocale();

  return (
    <html lang={LOCALE_META[locale].tag} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers locale={locale}>
          {children}
          <Toaster richColors position="top-right" />
          <AnalyticsProvider />
        </Providers>
      </body>
    </html>
  );
}
