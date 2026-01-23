// Tatva OS Pro - Service Worker (FINAL)
// ✅ Fix: phone old cache issue
// ✅ Network-first for core files
// ✅ Cache fallback for offline
// ✅ Auto delete old caches

const CACHE_NAME = "tatva-os-pro-v60"; // 🔥 CHANGE THIS NUMBER ON EVERY UPDATE!

// Core files that must always update
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./gdrive.js",
  "./manifest.json",
];

// Install
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

// Activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // delete old caches
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null))
      );

      await self.clients.claim();
    })()
  );
});

// Fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only cache same-origin
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;

  // ✅ Network-first for core assets (so updates come immediately)
  const isCore =
    pathname === "/" ||
    CORE_ASSETS.some((p) => pathname.endsWith(p.replace("./", "")));

  if (isCore) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          // offline fallback
          const cached = await caches.match(req);
          return cached || caches.match("./index.html");
        }
      })()
    );
    return;
  }

  // ✅ Cache-first for other assets
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
