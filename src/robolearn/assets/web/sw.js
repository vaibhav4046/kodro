/* Kodro service worker: offline-after-first-load for the static web build.
 *
 * Precaches the app shell on install, then serves same-origin GETs cache-first
 * and runtime-caches anything else it fetches (fonts, images). CROSS-ORIGIN
 * requests are never touched: a BYOK cloud call or a localhost Ollama call
 * passes straight through, so the service worker can never intercept, cache, or
 * leak an AI request. Bumping CACHE invalidates the old shell on activate.
 */
'use strict';
const CACHE = 'kodro-shell-v1';
const SHELL = [
  './', './index.html', './styles.css', './bundle.js',
  './interpreter.js', './sound.js', './bridge.js',
  './vendor/react.production.min.js', './vendor/react-dom.production.min.js',
  './vendor/three.min.js', './vendor/fonts.css',
  './manifest.webmanifest', './icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Per-item best-effort: a single missing shell asset should not abort the
      // whole install and leave the app with no cache at all.
      .then((cache) => Promise.all(SHELL.map((u) => cache.add(u).catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (BYOK / Ollama)
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});
