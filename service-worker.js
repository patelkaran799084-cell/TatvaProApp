// Tatva Pro - Service Worker (UPDATED)
// ✅ Fix: phone stuck on old cache
// ✅ Network-first for core files
// ✅ Auto update (skipWaiting + clientsClaim)

const CACHE_NAME = "tatva-pro-v42"; // 🔥 change this every update!

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
      // remove old cache
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));

      await self.clients.claim();
    })()
  );
});

// Fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  const isCore =
    url.pathname.endsWith("/") ||
    CORE_ASSETS.some((a) => url.pathname.endsWith(a.replace("./", "/")));

  // ✅ Network-first for core assets (so updates work)
  if (isCore) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
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
