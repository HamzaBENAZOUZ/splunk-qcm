// Service worker du mode hors ligne : fichiers du site en cache, réseau d'abord (les mises à jour arrivent
// tout de suite quand on est connecté), cache si le réseau ne répond pas. Les données (Supabase) ne passent
// pas par ici : elles sont gardées dans IndexedDB par js/store.js.
const CACHE = "splunk-site-v1";
const FILES = [
  "./", "index.html", "css/style.css", "js/app.js", "js/store.js", "js/i18n.js", "js/offline.js", "js/matrix.js",
  "js/config.js", "assets/favicon.svg",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js",
  "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;800&family=Inter:wght@400;500;600&display=swap",
];
const CACHED_HOSTS = [self.location.host, "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("splunk-site-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || !CACHED_HOSTS.includes(url.host)) return;
  if (url.host === self.location.host && (url.pathname.includes("/private/") || url.pathname.includes("/app/"))) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: url.host === self.location.host });
      if (hit) return hit;
      if (req.mode === "navigate") { const home = await cache.match("index.html"); if (home) return home; }
      throw err;
    }
  })());
});
