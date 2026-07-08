const CACHE_NAME = 'sentinelle-pro-lite-v4-8-intel';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  './manifest.json',
  './offline.html',
  './assets/logo.png',
  './assets/favicon.png',
  './push/onesignal/OneSignalSDKWorker.js'
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
  event.respondWith(
    fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match('./offline.html')))
  );
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch(error) { payload = {}; }
  const notification = payload.notification || payload.webpush?.notification || payload.data || {};
  const title = notification.title || payload.data?.title || 'Sentinelle Pro';
  const body = notification.body || payload.data?.message || 'Nouveau message Flash du QG';
  const options = {
    body,
    icon: './assets/icons/icon-192.png',
    badge: './assets/icons/icon-192.png',
    data: { url: './index.html', ...(payload.data || {}) },
    requireInteraction: notification.requireInteraction ?? true,
    tag: notification.tag || 'sentinelle-flash',
    vibrate: [200, 100, 200]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification?.data?.url || './index.html';
  event.waitUntil(clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
    for (const client of list) {
      if ('focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
