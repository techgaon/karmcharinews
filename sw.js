/* Karmchari News service worker — offline app shell, network-first for news data */
const V = "kn-v2";
const SHELL = ["./","./index.html","./css/app.css","./js/config.js","./js/data.js","./js/i18n.js","./js/store.js","./js/ai.js","./js/app.js","./js/admin.js","./manifest.webmanifest","./icons/icon.svg","./icons/icon-192.png","./icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if(e.request.method !== "GET") return;
  if(u.origin === location.origin){
    // app files: network first (fresh deploys), cache fallback (offline)
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("./index.html"))));
  } else if(/fonts\.(googleapis|gstatic)\.com|i\.ytimg\.com/.test(u.host)){
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(V).then(x => x.put(e.request, c)); return res; })));
  }
});
