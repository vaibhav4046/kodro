/* Kodro service worker: offline-after-first-load for the static web build.
 *
 * Precaches the app shell on install. On fetch it splits same-origin GETs:
 *   - the HTML entry point, the compiled bundle.js and lessons.json go
 *     NETWORK-FIRST (with a cache fallback) so a fresh deploy reaches returning
 *     visitors immediately instead of pinning them to the first shell they saw;
 *   - the rest of the shell (styles, vendored libs, fonts, icons) stays
 *     cache-first for a fast, offline-capable load, and refreshes wholesale when
 *     the SW updates (see CACHE below).
 * CROSS-ORIGIN requests are never touched: a BYOK cloud call or a localhost
 * Ollama call passes straight through, so the service worker can never
 * intercept, cache, or leak an AI request. Bumping CACHE invalidates the old
 * shell on activate.
 */
'use strict';
// build_web.cjs --static stamps this version with a short content hash of the
// shipped bundle in the EMITTED site/sw.js; the source keeps this stable 'v1'
// placeholder so diffs stay clean and the bundle freshness check never churns.
// A new deploy => new bundle hash => new SW file => the browser installs it,
// precaches the new shell, and deletes the stale cache on activate.
const CACHE = 'kodro-shell-v1';
const SHELL = [
  './', './index.html', './styles.css', './bundle.js',
  './interpreter.js', './sound.js', './bridge.js',
  // lessons.json is PRECACHED, not left to runtime caching. It is fetched
  // network-first (see isFreshFirst) so a new deploy reaches returning
  // visitors, but the runtime cache never populated on the FIRST visit: the
  // SW registers on window 'load', so it activates after the app's mount-time
  // listLessons() fetch has already gone straight to the network. A visitor
  // who then went offline kept the shell but lost all 18 lessons, and the
  // library sat on "Loading the offline lesson library..." forever because
  // bridge.js memoises the empty result. Precaching makes the cache fallback
  // exist from the first load, which is what index.html promises.
  './lessons.json',
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

// Same-origin requests that must reflect the LATEST deploy rather than a cached
// copy: the HTML document, the compiled app bundle, and the lessons payload
// (which bridge.js already fetches {cache:'no-cache'} -- cache-first here would
// silently defeat that). Everything else stays cache-first.
function isFreshFirst(url, req) {
  if (req.mode === 'navigation') return true; // the HTML document, any subpath
  const p = url.pathname;
  return p.endsWith('/') || p.endsWith('/index.html')
    || p.endsWith('/bundle.js') || p.endsWith('/lessons.json');
}

function putInCache(req, res) {
  // Only cache first-party 200s; opaque/cross-origin never reaches here anyway.
  if (res && res.ok && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE).then((cache) => cache.put(req, copy));
  }
}

// Network-first: try the network, cache a good response, and fall back to cache
// when offline. A navigation with nothing cached gets the shell; a data request
// (lessons.json) surfaces a real network error so bridge.js runs its own
// retry/degrade path instead of receiving HTML it cannot parse.
function networkFirst(req) {
  return fetch(req).then((res) => { putInCache(req, res); return res; })
    .catch(() => caches.match(req).then((hit) =>
      hit || (req.mode === 'navigation' ? caches.match('./index.html') : Response.error())));
}

// Cache-first: instant, offline-capable, runtime-caches anything new it fetches.
function cacheFirst(req) {
  return caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    putInCache(req, res);
    return res;
  }).catch(() => caches.match('./index.html')));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (BYOK / Ollama)
  event.respondWith(isFreshFirst(url, req) ? networkFirst(req) : cacheFirst(req));
});
