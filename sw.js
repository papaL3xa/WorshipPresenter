// Minimal Service Worker untuk mengaktifkan fitur PWA (Install to Desktop/Mobile)
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Hanya pass-through, tidak melakukan cache offline berat
  // karena aplikasi ini membutuhkan koneksi ke Google Sheets
  e.respondWith(fetch(e.request).catch(() => new Response("Offline")));
});
