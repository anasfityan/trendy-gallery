const CACHE = 'tg-v10';
const CORE = ['./index.html','./manifest.json','./logo.png','./icon-192.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
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

function canStore(request, response) {
  if (!isSameOrigin(request)) return false;
  if (!response || !response.ok || response.type !== 'basic') return false;
  if (request.method !== 'GET') return false;

  const destination = request.destination;
  return destination === 'document' ||
    destination === 'style' ||
    destination === 'script' ||
    destination === 'image' ||
    destination === 'manifest' ||
    destination === 'font';
}

async function putSafe(request, response) {
  if (!canStore(request, response)) return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response.clone());
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    await putSafe(request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  await putSafe(request, response);
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then(async response => {
      await putSafe(request, response);
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }

  const fresh = await refresh;
  if (fresh) return fresh;
  throw new Error('Network unavailable and resource is not cached');
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // External APIs, Google Apps Script, import proxies and remote product images
  // are intentionally left to the browser. They are never persisted by this SW.
  if (!isSameOrigin(request)) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'manifest') {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

  // Unknown same-origin GET requests stay network-only by default.
});
