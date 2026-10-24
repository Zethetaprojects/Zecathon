// ZECKATHON service worker.
//
// - API requests are never intercepted or cached: they carry private, logged-in
//   data (teams, submissions) that must not be stored on shared computers.
// - Page navigations are network-first, so a new deploy shows up on the first
//   load; the cached shell is only used when offline.
// - Fingerprinted build assets (/assets/*) and images are cache-first: their
//   file names change on every build, so a cached copy is never stale.
//
// Bumping CACHE_NAME deletes older caches (v1 stored API responses).
const CACHE_NAME = 'zecathon-v2';
const OFFLINE_URL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(OFFLINE_URL, clone)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || /\.(png|jpe?g|gif|webp|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
            }
            return response;
          })
      )
    );
  }
});
