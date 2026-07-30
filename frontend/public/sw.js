// Minimal Service Worker untuk mengaktifkan fitur PWA (Install to Desktop/Mobile)
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Pass-through without masking network errors
  e.respondWith(fetch(e.request));
});
