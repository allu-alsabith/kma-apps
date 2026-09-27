// Service Worker for Attendo Supermarket 4-App Suite
// Provides full offline capabilities for Kiosk, Staff Mobile App, Admin Portal, and Apps Manager

const CACHE_NAME = 'attendo-hypermarket-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest-staff.json',
  '/manifest-kiosk.json',
  '/manifest-admin.json',
  '/manifest-manager.json',
  '/icons/icon.svg'
];

// Pre-cache core shell files on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Clean up old caches on activate and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercept fetch requests with intelligent offline-first / stale-while-revalidate strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Exclude Firebase live polling, Firestore streaming, Cloud Auth, and Vite dev modules from SW caching
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.pathname.includes('/v1/projects/') ||
    url.pathname.includes('/google.firestore.') ||
    url.pathname.startsWith('/@') ||
    url.pathname.includes('/src/') ||
    url.pathname.includes('/node_modules/') ||
    url.pathname.includes('vite')
  ) {
    return;
  }

  // 1. Navigation requests (e.g. visiting /?app=staff, /?app=kiosk, etc.)
  // If network is down, serve cached index.html so the SPA starts up instantly offline!
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Fall back to cached URL, or cached root '/' or '/index.html'
          const cachedExact = await caches.match(event.request);
          if (cachedExact) return cachedExact;
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;
          return caches.match('/');
        })
    );
    return;
  }

  // 2. Google Fonts stylesheets and font binaries: Cache-first with background update
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        }).catch(() => new Response('', { status: 408 }));
      })
    );
    return;
  }

  // 3. Static assets, JS scripts, CSS chunks, Vite modules, and icons
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Fetch in background to update cache (Stale-While-Revalidate)
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => null);

      // Return cached version if present, otherwise await network
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetchPromise.then((res) => {
        if (res) return res;
        // If offline and request is an image or script not yet cached, return empty fallback
        return new Response('Offline asset unavailable', { status: 503 });
      });
    })
  );
});

// Message listener to trigger skip waiting on app update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
