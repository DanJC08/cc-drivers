const VERSION = 'cc-conductores-v1.0.9';

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== VERSION).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Para HTML siempre fresco, sin caché
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request, {cache: 'no-store'}).catch(()=>caches.match("./login.html")));
    return;
  }
  // Para assets si usa caché
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(res => {
        return caches.open(VERSION).then(cache => {
          cache.put(e.request, res.clone());
          return res;
        });
      });
    })
  );
});
