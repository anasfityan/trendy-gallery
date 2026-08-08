const CACHE = 'tg-v17';
const CORE = ['./index.html','./manifest.json','./logo.png','./icon-192.png','./enhancements.js'];
const ENHANCEMENT_TAG = '<script src="./enhancements.js?v=17"></script>';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

function isSameOrigin(request) {
  try { return new URL(request.url).origin === self.location.origin; }
  catch { return false; }
}

function canStore(request, response) {
  if (!isSameOrigin(request) || !response || !response.ok || response.type !== 'basic' || request.method !== 'GET') return false;
  const d = request.destination;
  return d === 'document' || d === 'style' || d === 'script' || d === 'image' || d === 'manifest' || d === 'font';
}

async function putSafe(request, response) {
  if (!canStore(request, response)) return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response.clone());
}

async function injectEnhancements(response) {
  if (!response || !response.ok) return response;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  const html = await response.text();
  const clean = html.replace(/<script src="\.\/enhancements\.js(?:\?[^\"]*)?"><\/script>\s*/g, '');
  const enhanced = clean.includes('</body>') ? clean.replace('</body>', `${ENHANCEMENT_TAG}\n</body>`) : `${clean}\n${ENHANCEMENT_TAG}`;
  const headers = new Headers(response.headers); headers.delete('content-length');
  return new Response(enhanced, { status: response.status, statusText: response.statusText, headers });
}

async function networkFirstDocument(request) {
  try {
    const raw = await fetch(request, { cache: 'no-store' });
    const response = await injectEnhancements(raw);
    await putSafe(request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true }) || await caches.match('./index.html');
    if (cached) return injectEnhancements(cached);
    throw error;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    await putSafe(request, response);
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
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
  const refresh = fetch(request).then(async response => { await putSafe(request, response); return response; }).catch(() => null);
  if (cached) { event.waitUntil(refresh); return cached; }
  const fresh = await refresh;
  if (fresh) return fresh;
  throw new Error('Network unavailable and resource is not cached');
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || !isSameOrigin(request)) return;
  const path = new URL(request.url).pathname;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirstDocument(request));
    return;
  }
  if (path.endsWith('/enhancements.js') || path.endsWith('/product-import-api.js')) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.destination === 'style' || request.destination === 'script' || request.destination === 'manifest') {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});