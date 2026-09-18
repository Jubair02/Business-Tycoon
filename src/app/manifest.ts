import type { MetadataRoute } from 'next';

/**
 * Web app manifest.
 *
 * The target market is overwhelmingly mobile and data-conscious, and app-store
 * distribution is not part of this product's plan — so installability is the
 * cheapest route to a home-screen icon and to push notifications, which iOS
 * only grants to installed web apps.
 *
 * Served from `app/manifest.ts` rather than a static file so the content stays
 * in one language with the rest of the metadata and is type-checked.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bangladesh Business Tycoon',
    short_name: 'BD Tycoon',
    description:
      'Build a business empire in Bangladesh — start with a tea stall and grow into a conglomerate across Dhaka, Chattogram, Sylhet, Rajshahi and Khulna.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#006a4e',
    categories: ['games', 'business', 'simulation'],
    lang: 'en-BD',
    dir: 'ltr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // A maskable icon has its content inside the safe zone so Android can
      // crop it to whatever shape the launcher uses without clipping the mark.
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Dashboard', short_name: 'Dashboard', url: '/dashboard' },
      { name: 'My shops', short_name: 'Shops', url: '/businesses' },
      { name: 'Market', short_name: 'Market', url: '/market' },
    ],
  };
}
