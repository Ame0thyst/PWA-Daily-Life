/**
 * sw.js — Daily Journal Service Worker
 * Pre-caches application shell for offline-first operation.
 * Network-first for navigation (HTML) so code updates deploy immediately to mobile.
 * Cache-first for immutable static assets (icons, fonts, hashed scripts).
 */
const CACHE_NAME = 'journal-static-v3';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and external API calls (e.g. script.google.com)
  if (req.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  // 1. Navigation (HTML): Network-first with cache fallback
  // Ensures any new GitHub push is loaded immediately when online
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseToCache);
              cache.put('./index.html', responseToCache.clone());
              cache.put('./', responseToCache.clone());
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          return (await caches.match(req)) || (await caches.match('./index.html')) || (await caches.match('./'));
        })
    );
    return;
  }

  // 2. Static assets: Cache-first with network fallback
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});

// Listen for SKIP_WAITING signal from client
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync support for Chromium browsers
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-journal') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_SYNC' });
        });
      })
    );
  }
});
