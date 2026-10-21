'use strict';
const CACHE = 'macro-studio-cd53171dccc4b829';
const ASSETS = ["index.html", "app-bootstrap.js", "style.css", "app.js", "nutrition.js", "nutrition-display.js", "weekly-generator.js", "weekly-manual-plan.js", "generator-professional-ui.js", "generator-catalog.js", "equivalences.js", "equivalence-catalog.js", "equivalences-ui.js", "equivalenze/index.html", "equivalenze/app.js", "Macro_Studio_2_0_CREA_semplice.html", "weekly-pdf.js", "pdf-lib.min.js", "professional-pdf-model.js", "pdf-fontkit.umd.min.js", "pdf-fonts.js", "professional-pdf-ui.js", "professional-pdf-ui.css", "shared-meals.js", "shared-meals-ui.js", "shared-meals.css", "offline.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "food-catalog-data.js", "food-catalog.js"];
const ROOT = new URL('./', self.location.href).href;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const path of ASSETS) {
      const url = new URL(path, ROOT).href;
      const response = await fetch(url, {cache:'reload', credentials:'same-origin', redirect:'error'});
      if (!response.ok || (path.endsWith('.js') && !(response.headers.get('Content-Type') || '').includes('javascript'))) throw new Error('Offline asset unavailable: ' + path);
      await cache.put(url, response);
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('macro-studio-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Only cache this app's shell. Do not intercept authentication or external sources.
  if (event.request.mode === 'navigate' && (url.pathname === new URL(ROOT).pathname || url.pathname === new URL('index.html', ROOT).pathname)) {
    event.respondWith((async () => {
      try { return await fetch(event.request); }
      catch { return (await caches.open(CACHE)).match(new URL('index.html', ROOT).href); }
    })());
  } else if (ASSETS.some(path => new URL(path, ROOT).href === url.href)) {
    // Prefer current files online, including when a new HTML page meets an older cache.
    // Failed requests must never overwrite the last working offline copy.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(event.request, {cache:'no-cache'});
        if (response.ok) { await cache.put(event.request, response.clone()); return response; }
        return (await cache.match(event.request)) || response;
      } catch (error) {
        const saved = await cache.match(event.request);
        if (saved) return saved;
        throw error;
      }
    })());
  }
});
