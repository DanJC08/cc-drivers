const CACHE_NAME = 'cc-clientes-v4';
const urlsToCache = [
  '/cc-drivers/clientes/clientes-app.html',
  '/cc-drivers/assets/css/clientes.css',
  '/cc-drivers/assets/js/clientes.js',
  '/cc-drivers/assets/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
