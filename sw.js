/* Karmchari News service worker — offline app shell, network-first for news data */
const V = "kn-v5";
const SHELL = ["./","./index.html","./app.css","./config.js","./data.js","./i18n.js","./store.js","./ai.js","./app.js","./admin.js","./manifest.webmanifest","./icon.svg","./icon-192.png","./icon-512.png"];
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

/* like ❤️ */
.ab.like{position:relative;width:auto;min-width:36px;padding:0 9px;border-radius:999px;gap:3px;display:flex;align-items:center;justify-content:center;color:#e11d48;background:#fff1f2;overflow:visible}
.ab.like svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:2;transition:transform .2s}
.ab.like.on svg{fill:#e11d48;stroke:#e11d48}
.ab.like .lc{font-family:var(--lat);font-size:11.5px;font-weight:800;line-height:1}
.ab.like .lc:empty{display:none}
.ab.like.on{background:#ffe4e6}
.ab.like:not(.on) svg{animation:beat 2.4s ease-in-out infinite}
@keyframes beat{0%,60%,100%{transform:scale(1)}70%{transform:scale(1.18)}80%{transform:scale(.96)}90%{transform:scale(1.1)}}
.ab.like.pop svg{animation:likepop .55s cubic-bezier(.2,1.6,.4,1)}
@keyframes likepop{0%{transform:scale(.3)}50%{transform:scale(1.45)}100%{transform:scale(1)}}
.ab.like .spark{position:absolute;left:50%;top:50%;width:5px;height:5px;margin:-2.5px;border-radius:50%;background:#fb7185;pointer-events:none;
  animation:spark .6s ease-out forwards;transform:rotate(var(--a)) translateY(0)}
.ab.like .spark:nth-child(odd){background:#fbbf24}
@keyframes spark{to{transform:rotate(var(--a)) translateY(-24px) scale(.2);opacity:0}}
.bigheart{position:absolute;left:50%;top:28%;width:110px;height:110px;margin-left:-55px;pointer-events:none;z-index:6;animation:bigheart .9s ease-out forwards}
.bigheart svg{width:100%;height:100%;fill:#fff;filter:drop-shadow(0 6px 18px rgba(225,29,72,.6))}
@keyframes bigheart{0%{transform:scale(0);opacity:0}25%{transform:scale(1.15);opacity:1}45%{transform:scale(.95)}75%{transform:scale(1);opacity:1}100%{transform:scale(1.3) translateY(-30px);opacity:0}}
.acts{gap:3px}
@media (max-width:380px){.ab.like{padding:0 7px;min-width:33px}}
.meta .ab.like{margin-left:auto;height:32px;flex:none}
