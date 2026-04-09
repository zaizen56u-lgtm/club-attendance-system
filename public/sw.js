const CACHE_NAME = 'attendance-app-v2';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/input.html',
  '/board.html',
  '/admin.html',
  '/schedule.html',
  '/history.html',
  '/style.css',
  '/app.js',
  '/board.js',
  '/admin.js',
  '/schedule.js',
  '/history.js',
  '/icon.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// オンライン優先、オフライン時はキャッシュを返す
self.addEventListener('fetch', (event) => {
  // socket.io 通信やAPI通信のキャッシュは避ける
  if (event.request.url.includes('/socket.io/') || event.request.url.includes('/api/')) {
      return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
