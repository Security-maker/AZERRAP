const CACHE_NAME = 'sentinelle-pro-camera-20261031-r1';
const CDN_CACHE_NAME = 'sentinelle-cdn-security-20261022-r1';
const APP_SHELL = [
  './vendor/maps/leaflet-maplibre-gl-0.1.4.js',
  './planning-tools.js?v=planning-20261030-r3',
  './operational-map.js?v=map-pan-20261030-r2',
  './operational-map.css?v=map-20261026-r1',
  './phase3.css?v=dock-20261031-r1',
  './ui-runtime.js?v=dock-20261031-r1',
  './premium.css?v=phase3-20261026-r4',
  './interventions.js?v=phase3-20261026-r4',
  './',
  './index.html',
  './style.css?v=593',
  './app.js?v=camera-20261031-r1',
  './sentinelle-config.js',
  './supabase-compat.js?v=camera-20261031-r1',
  './supabase-config.js?v=510',
  './supabase-config.js',
  './supabase-bridge.js?v=camera-20261031-r1',
  './manifest.json',
  './manifest-client.json',
  './offline.html',
  './client.html',
  './client-style.css?v=597',
  './client-app.js?v=phase3-20261026-r4',
  './reset-password.html',
  './reset-password.js?v=593',
  './assets/logo.png',
  './assets/client-logo.png',
  './assets/favicon.png',
  './assets/icons/icon-192.png',
  './assets/icons/client-180.png',
  './assets/icons/client-192.png',
  './assets/icons/client-512.png'
];

const TRUSTED_OFFLINE_CDN = new Set([
  'www.gstatic.com',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
]);

self.addEventListener('install', event => {
  // V5.8.8.6 : un asset secondaire manquant ne doit plus faire échouer
  // l'installation complète du Service Worker sur iOS/GitHub Pages.
  event.waitUntil((async()=>{
    const cache = await caches.open(CACHE_NAME);
    for (const asset of APP_SHELL) {
      try { await cache.add(asset); }
      catch (error) { console.warn('[Sentinelle SW] cache ignoré', asset, error); }
    }
  })());
  // Pas de skipWaiting forcé : on évite de couper une mission déjà ouverte.
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil((async()=>{
    // Old clients cannot attest that their drafts and active operation are safe.
    // Wait for all app windows to close; do not force activation mid-shift.
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if(!windows.length) await self.skipWaiting();
    else event.source?.postMessage({type:'UPDATE_DEFERRED',reason:'open_windows'});
  })());
});

self.addEventListener('activate', event => {
  // Keep old versioned assets during coexistence; no automatic cache eviction.
  // A later cleanup needs an explicit verified transition window.

});

async function networkFirst(request, cacheName=CACHE_NAME, fallback=null){
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (_) {
    // Never let a retained historical cache supply another version's shell.
    const cache = await caches.open(cacheName);
    return (await cache.match(request)) || (fallback ? await cache.match(fallback) : null) || Response.error();
  }
}

async function staleWhileRevalidate(request){
  const cache = await caches.open(CDN_CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone()).catch(() => {});
    return response;
  }).catch(() => null);
  return cached || await network || Response.error();
}

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { body:event.data?.text?.() || 'Nouvelle information Sentinelle Pro' }; }
  const title = String(payload.title || 'Sentinelle Pro');
  const options = {
    body:String(payload.body || payload.message || 'Nouvelle information opérationnelle'),
    icon:payload.icon || './assets/icons/icon-192.png',
    badge:payload.badge || './assets/icons/icon-192.png',
    tag:String(payload.tag || payload.notificationId || `sentinelle-${Date.now()}`),
    renotify:Boolean(payload.renotify),
    requireInteraction:Boolean(payload.requireInteraction),
    data:{ url:payload.url || './index.html', route:payload.route || 'home', ...(payload.data || {}) }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Only application entry points in this worker scope are notification destinations.
function safeNotificationUrl(value, route='home'){
  const base=new URL('./index.html',self.registration.scope);
  const fallback=new URL(base);fallback.searchParams.set('route',String(route||'home'));
  try {
    const u=new URL(value||fallback.href,base);
    const client=new URL('./client.html',base);
    if(u.origin===base.origin && !u.username && !u.password && [base.pathname,client.pathname].includes(u.pathname)) return u.href;
  } catch (_) {}
  return fallback.href;
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const notificationData = event.notification?.data || {};
  const fallback = `./index.html?route=${encodeURIComponent(notificationData.route || 'home')}`;
  const targetUrl = safeNotificationUrl(notificationData.url, notificationData.route);
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    for (const client of clientsList) {
      try {
        const current = new URL(client.url);
        const target = new URL(targetUrl);
        if (current.origin === target.origin) {
          await client.focus();
          if ('navigate' in client) await client.navigate(targetUrl).catch(()=>{});
          return;
        }
      } catch (_) {}
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.headers.has('authorization')) {
    event.respondWith(fetch(request, {cache:'no-store'}));
    return;
  }
  if (TRUSTED_OFFLINE_CDN.has(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Only public shell resources may use cache. API/Storage reads must reach the
  // server, including same-origin recipe proxies and navigations to signed PDFs.
  const shellPaths = new Set(APP_SHELL.map(path => new URL(path, self.registration.scope).pathname));
  const assetPath = new URL('./assets/', self.registration.scope).pathname;
  // Public map libraries are cached only when the QG actually opens the map.
  // No tile prefetch, no business API or Storage response enters this cache.
  const mapAssets = new Set(['maplibre-gl-5.24.0.js','maplibre-gl-5.24.0.css','leaflet-maplibre-gl-0.0.22.js'].map(name=>new URL('./vendor/maps/'+name,self.registration.scope).pathname));
  if (!shellPaths.has(url.pathname) && !url.pathname.startsWith(assetPath) && !mapAssets.has(url.pathname)) {
    event.respondWith(fetch(request, {cache:'no-store'}));
    return;
  }
  if (request.mode === 'navigate') {
    const clientPortal = /\/client\.html$/i.test(url.pathname);
    const resetPortal = /\/reset-password\.html$/i.test(url.pathname);
    const fallbackPage = resetPortal ? './reset-password.html' : (clientPortal ? './client.html' : './index.html');
    event.respondWith(networkFirst(request, CACHE_NAME, fallbackPage).then(async response => {
      if (response && response.type !== 'error') return response;
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(fallbackPage)) || (await cache.match('./offline.html')) || Response.error();
    }));
    return;
  }
  event.respondWith(networkFirst(request, CACHE_NAME));
});
