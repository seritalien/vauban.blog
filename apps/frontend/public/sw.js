// Vauban Blog Service Worker
// Version: 1.1.0

const CACHE_NAME = 'vauban-v1';
const STATIC_CACHE = 'vauban-static-v1';
const DYNAMIC_CACHE = 'vauban-dynamic-v1';
const IPFS_CACHE = 'vauban-ipfs-v1';
const IPFS_CACHE_MAX_ENTRIES = 200;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches + trim IPFS cache
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    Promise.all([
      // Delete obsolete caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== IPFS_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      // Trim IPFS cache if it exceeds the max
      trimIPFSCache(),
    ])
  );
  // Take control of all clients immediately
  self.clients.claim();
});

/**
 * Trim the IPFS cache to stay under IPFS_CACHE_MAX_ENTRIES.
 * Evicts oldest entries first (FIFO by insertion order).
 */
async function trimIPFSCache() {
  try {
    const cache = await caches.open(IPFS_CACHE);
    const keys = await cache.keys();
    if (keys.length > IPFS_CACHE_MAX_ENTRIES) {
      const toDelete = keys.length - IPFS_CACHE_MAX_ENTRIES;
      console.log(`[SW] Trimming IPFS cache: removing ${toDelete} entries`);
      await Promise.all(
        keys.slice(0, toDelete).map((key) => cache.delete(key))
      );
    }
  } catch (err) {
    console.error('[SW] Error trimming IPFS cache:', err);
  }
}

// Fetch event - strategy depends on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // IPFS content: network-first, cache response, fallback to cache
  // IPFS content is immutable by design (CID = hash of content), safe to cache forever
  if (url.pathname.startsWith('/api/ipfs/') && !url.pathname.endsWith('/add')) {
    event.respondWith(handleIPFSRequest(request));
    return;
  }

  // Skip other API calls and external resources
  if (url.pathname.startsWith('/api/') || !url.origin.includes(self.location.origin)) {
    return;
  }

  // Skip Arweave requests (handled by arweave gateway)
  if (url.pathname.includes('arweave')) {
    return;
  }

  event.respondWith(
    // Try network first
    fetch(request)
      .then((response) => {
        // Don't cache non-OK responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache the response for future use
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      })
      .catch(async () => {
        // Network failed, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // For navigation requests, return offline page
        if (request.mode === 'navigate') {
          const offlinePage = await caches.match('/offline');
          if (offlinePage) {
            return offlinePage;
          }
        }

        // Return a basic offline response
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      })
  );
});

/**
 * Handle IPFS requests with network-first, cache-fallback strategy.
 * Since IPFS CIDs are content-addressed (hash = content), responses
 * are immutable and safe to cache indefinitely.
 */
async function handleIPFSRequest(request) {
  try {
    const response = await fetch(request);

    if (response && response.status === 200) {
      const cache = await caches.open(IPFS_CACHE);
      cache.put(request, response.clone());
      return response;
    }

    // Non-200 response — try cache fallback
    const cached = await caches.match(request);
    return cached || response;
  } catch (_err) {
    // Network error — serve from cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response('IPFS content unavailable offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'New notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Vauban Blog', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
