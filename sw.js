const CACHE = 'tg-v9';
const CORE = ['./index.html','./manifest.json','./logo.png','./icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function isSameOrigin(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

function shouldCache(request, response) {
  if (!isSameOrigin(request)) return false;
  if (!response || !response.ok) return false;
  if (response.type !== 'basic') return false;

  const destination = request.destination;
  return destination === 'document' ||
    destination === 'style' ||
    destination === 'script' ||
    destination === 'image' ||
    destination === 'manifest';
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (shouldCache(request, response)) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }

    throw error;
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;

  // Never intercept cross-origin requests such as Google Apps Script,
  // product import proxies, remote stores, or third-party image APIs.
  // Those responses must stay fresh and must not accumulate in the app cache.
  if (!isSameOrigin(request)) return;

  event.respondWith(networkFirst(request));
});
