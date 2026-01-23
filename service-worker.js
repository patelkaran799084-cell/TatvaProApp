// Tatva OS Pro - Service Worker (FINAL)
const CACHE_NAME = "tatva-os-pro-v60";
const CORE_ASSETS = ["./","./index.html","./style.css","./app.js","./gdrive.js","./manifest.json"];
self.addEventListener("install",(e)=>{self.skipWaiting();e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(CORE_ASSETS)));});
self.addEventListener("activate",(e)=>{e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.map(k=>k!==CACHE_NAME?caches.delete(k):null));await self.clients.claim();})());});
self.addEventListener("fetch",(e)=>{const req=e.request; if(req.method!=="GET") return; const url=new URL(req.url); if(url.origin!==self.location.origin) return;
const isCore = url.pathname==="/" || CORE_ASSETS.some(p=>url.pathname.endsWith(p.replace("./","")));
if(isCore){e.respondWith((async()=>{try{const fresh=await fetch(req); const c=await caches.open(CACHE_NAME); c.put(req,fresh.clone()); return fresh;}catch(err){const cached=await caches.match(req); return cached||caches.match("./index.html");}})()); return;}
e.respondWith(caches.match(req).then(c=>c||fetch(req)));});
