// Keeps both apps working offline. Bump VERSION whenever any app file changes.
const VERSION = "vdc-2.0.0";
const FILES = ["./", "./index.html", "./admin.html", "./app.css", "./core.js", "./firebase-config.js",
  "./firebase/firebase-app-compat.js", "./firebase/firebase-auth-compat.js", "./firebase/firebase-firestore-compat.js",
  "./manifest.webmanifest", "./admin.webmanifest",
  "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png",
  "./icon-admin-192.png", "./icon-admin-512.png", "./icon-admin-180.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;   // Firebase traffic goes straight to the network
  const key = req.mode === "navigate" ? (url.pathname.endsWith("admin.html") ? "./admin.html" : "./index.html") : req;
  // Settings file: always try the network first so a new Firebase connection takes effect straight away.
  if (url.pathname.endsWith("firebase-config.js")) {
    e.respondWith(fetch(req).then(res => { if (res.ok) caches.open(VERSION).then(c => c.put(req, res.clone())); return res; }).catch(() => caches.match(req, { ignoreSearch:true })));
    return;
  }
  // Everything else: answer from the cache (works offline), refresh it in the background.
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(req).then(res => { if (res.ok) cache.put(key, res.clone()); return res; }).catch(() => null);
    if (cached) { e.waitUntil(fresh); return cached; }
    return (await fresh) || new Response("Offline", { status: 503 });
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type:"window" }).then(list => list.length ? list[0].focus() : self.clients.openWindow("./index.html")));
});
