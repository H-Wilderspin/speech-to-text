/* The build replaces these two markers; this file is not served directly. */
const version = '__BUILD_VERSION__';
const files = __PRECACHE_FILES__; // eslint-disable-line no-undef
const scope = self.registration.scope;
const prefix = `speech-to-text:${scope}:`;
const cacheName = `${prefix}${version}`;
const urls = files.map((file) => new URL(file, scope).href);
const shellUrl = new URL('index.html', scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(urls.map(url => new Request(url, { cache: 'reload' })))));
  // Updates wait until all old tabs close, preserving in-memory transcripts.
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith(prefix) && key !== cacheName).map((key) => caches.delete(key)),
  )));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const appUrl = new URL(scope);
  if (url.origin !== appUrl.origin || !url.href.startsWith(scope)) return;
  const isShell = request.mode === 'navigate' && (url.pathname === appUrl.pathname || url.href === shellUrl);
  if (!isShell && !urls.includes(url.href)) return;
  event.respondWith(caches.open(cacheName).then(async (cache) => {
    // These exact, public build assets do not vary by request headers. Static hosts
    // may send Vary: Origin; module requests and precache requests differ there.
    const cached = await cache.match(isShell ? shellUrl : url.href, { ignoreVary: true });
    return cached ?? fetch(request);
  }));
});
