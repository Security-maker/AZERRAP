importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE_NAME = 'sentinelle-pro-v5-6-4-onesignal-combined-worker';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  './manifest.json',
  './offline.html',
  './assets/logo.png',
  './assets/favicon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // L’ancien fichier dédié OneSignal reste servi directement pour compatibilité,
  // mais les nouveaux abonnements utilisent le Worker principal combiné.
  if (url.pathname.endsWith('/push/onesignal/OneSignalSDKWorker.js')) {
    event.respondWith(fetch(request, { cache:'no-store' }));
    return;
  }

  event.respondWith(
    fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match('./offline.html')))
  );
});

