// offline shell cache; data always comes from Supabase (network)
const CACHE = 'triton-v2-__BUILD__';
const SHELL = ['./', 'index.html', 'style.css?v=__BUILD__', 'vendor.js?v=__BUILD__', 'app.js?v=__BUILD__', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'].concat(__HAS_LOGO__ ? ['icons/logo-256.png'] : []);
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) {}
  const title = data.title || 'TRITON';
  const opts = {
    body: data.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: data.tag || 'triton',
    renotify: !!data.renotify,
    data: { url: data.url || './' },
    lang: 'uk'
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil((async () => {
    const abs = new URL(target, self.registration.scope).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of windows) {
      try { c.postMessage({ type: 'triton-push-nav', url: abs }); } catch (err) {}
      if ('focus' in c) { await c.focus(); return; }
    }
    await self.clients.openWindow(abs);
  })());
});
