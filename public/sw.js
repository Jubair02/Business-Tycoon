// ============================================
// Bangladesh Business Tycoon - Service Worker
// ============================================
//
// Two jobs, deliberately kept small:
//
//  1. An offline shell, so a player on a patchy mobile connection — which is
//     most of this game's audience — gets a page that explains itself instead
//     of the browser's dinosaur.
//  2. Push notifications, which are the point of installing at all: "your
//     Gulshan shop is out of stock" is only useful if it arrives while the game
//     is closed.
//
// What it deliberately does NOT do is cache API responses. This game's state is
// a live simulation on a server clock; serving a stale cached `/api/player` to
// someone who has been away for a day would show them figures that are simply
// wrong. Only the shell and static assets are cached.

const VERSION = 'v1';
const SHELL_CACHE = `bd-tycoon-shell-${VERSION}`;
const ASSET_CACHE = `bd-tycoon-assets-${VERSION}`;

const OFFLINE_URL = '/offline.html';

const SHELL_ASSETS = [
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      // A failed precache must not leave the worker uninstalled forever; the
      // fetch handler falls back gracefully when the shell is missing.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('bd-tycoon-') && !key.endsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Navigations are network-first with an offline fallback; static assets are
 * cache-first. Everything else — which is to say the API — is left entirely
 * alone, so the game never reads a stale simulation.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return (
          cached ??
          new Response('You are offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        );
      }),
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:png|jpg|jpeg|svg|webp|woff2?|css|js)$/.test(url.pathname);

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Only cache a response we can actually reuse.
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL));
    }),
  );
});

// ---- Push ----

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Bangladesh Business Tycoon', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Bangladesh Business Tycoon';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Tagging by kind means a second "out of stock" replaces the first rather
    // than stacking six of them on the lock screen.
    tag: payload.tag || 'bd-tycoon',
    renotify: Boolean(payload.renotify),
    data: { url: payload.url || '/dashboard' },
    lang: payload.lang || 'en',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an open tab rather than opening a second one.
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
