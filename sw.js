// ARVON AgentOS — Service Worker v1.0
const CACHE = 'arvon-os-v1';

// Assets to cache on install
const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400;1,600&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
];

// Install — pre-cache shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => {
      // Cache what we can, skip failures (CDN might block)
      return Promise.allSettled(
        PRECACHE.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for assets, network-first for API calls
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never intercept Anthropic API or n8n calls — always live
  if (
    url.hostname === 'api.anthropic.com' ||
    url.hostname.includes('n8n.cloud') ||
    url.hostname.includes('notion.so') ||
    url.hostname.includes('telegram.org')
  ) {
    return; // Let these go straight to network
  }

  // For navigation requests — serve app shell
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('/index.html').then(cached => {
        return cached || fetch(e.request).catch(() => cached);
      })
    );
    return;
  }

  // For everything else — cache first, fall back to network
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        // Cache successful GET responses
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached); // Offline fallback
    })
  );
});

// Background sync placeholder (for future offline-first features)
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-posts') {
    console.log('ARVON AgentOS: background sync triggered');
  }
});

// Push notification handler (for future Telegram-style alerts)
self.addEventListener('push', (e) => {
  if (!e.data) return;
  const data = e.data.json();
  self.registration.showNotification(data.title || 'ARVON AgentOS', {
    body: data.body || 'New agent update',
    icon: '/manifest.json',
    badge: '/manifest.json',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
  });
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(e.notification.data?.url || '/');
    })
  );
});
