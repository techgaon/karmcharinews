/* Karmchari News — main app (feed, swipe physics, drawer, auth UI, share) */
(function(){
const $ = (s, r=document) => r.querySelector(s);
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LANGS = ["hi","en","aw","bh"];
const PILL = {hi:"हिन्दी", en:"EN", aw:"अवधी", bh:"भोजपुरी"};

const S = {
  uiLang: "en", newsLang: "hi", tab: "all",
  f: {vibhag:null, state:null, district:null},
  list: [], idx: 0, cardLang: {}, anim: false
};
window.KN_UILANG = "en";

/* ---------------- boot ---------------- */
async function boot(){
  const deep = (location.hash.match(/n=([\w-]+)/)||[])[1];
  const g = KN_LS.get("kn_guest", {});
  S.uiLang = g.uiLang || "en"; S.newsLang = g.newsLang || "hi"; window.KN_UILANG = S.uiLang;
  bindStatic();
  Store.onUser(u => {
    const p = Store.prefs();
    if(p.uiLang){ S.uiLang = p.uiLang; window.KN_UILANG = p.uiLang; }
    if(p.newsLang) S.newsLang = p.newsLang;
    renderChrome(); refresh(true);
  });
  Store.onNews(() => refresh(false));
  await Store.init();
  if(deep){ const i = S.list.findIndex(n=>n.id===deep); if(i>=0){ S.idx = i; renderFeed(); } }
  setTimeout(()=>$("#hint").classList.add("gone"), 4500);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>feed().querySelectorAll(".card").forEach(fitCard));
}

/* ---------------- list / filters ---------------- */
function matches(n, f){
  if(f.vibhag && n.vibhag !== f.vibhag) return false;
  if(f.state && n.state !== f.state && n.state !== "National") return false;
  if(f.district && !(n.district === f.district || (n.district === "All" && (n.state === "UP" || n.state === "National")))) return false;
  return true;
}
function computeList(){
  const all = Store.news, p = Store.prefs();
  let l = all;
  if(S.tab === "bm") l = all.filter(n => p.bookmarks.includes(n.id));
  else if(S.tab === "go") l = all.filter(n => n.isGO);
  else if(S.tab === "my") l = p.myFeed ? all.filter(n => matches(n, p.myFeed)) : [];
  if(S.tab !== "my" && S.tab !== "bm") l = l.filter(n => matches(n, S.f));
  return l;
}
function refresh(keepPos){
  const curId = S.list[S.idx] && S.list[S.idx].id;
  S.list = computeList();
  const i = keepPos && curId ? S.list.findIndex(n=>n.id===curId) : -1;
  S.idx = i >= 0 ? i : Math.min(S.idx, Math.max(0, S.list.length));
  if(!keepPos && curId){ const j = S.list.findIndex(n=>n.id===curId); if(j>=0) S.idx = j; }
  renderFeed(); renderDrawer();
}

/* ---------------- media art ---------------- */
function artSVG(n){
  const v = KN_vibhag(n.vibhag), id = "g"+n.id.replace(/\W/g,"");
  const word = KN_vName(n.vibhag, "hi", true);
  return `<svg class="art" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${v.c1}"/><stop offset="1" stop-color="${v.c2}"/></linearGradient>
  <radialGradient id="${id}r" cx=".78" cy=".2" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <rect width="400" height="240" fill="url(#${id})"/><rect width="400" height="240" fill="url(#${id}r)"/>
  <g stroke="#fff" stroke-opacity=".12" fill="none">${[0,1,2,3,4,5].map(i=>`<circle cx="280" cy="70" r="${30+i*28}"/>`).join("")}</g>
  <g fill="#fff" fill-opacity=".1">${Array.from({length:14},(_,i)=>`<rect x="${i*30}" y="${190-((i*37)%70)}" width="18" height="${50+((i*37)%70)}" rx="3"/>`).join("")}</g>
  <text x="70" y="226" font-family="Noto Sans Devanagari, sans-serif" font-weight="800" font-size="44" fill="#fff" fill-opacity=".16">${esc(word)}</text>
  <text x="280" y="96" text-anchor="middle" font-size="60">${n.icon||"📰"}</text></svg>`;
}
function mediaHTML(n){
  const yt = AI.ytId(n.youtube || (n.type==="video" ? n.sourceUrl : ""));
  let inner;
  if(n.image) inner = "";
  else if(n.type==="video" && yt) inner = `<img src="https://i.ytimg.com/vi/${yt}/hqdefault.jpg" alt="" loading="lazy">`;
  else inner = artSVG(n);
  if(n.image) inner = artSVG(n) + `<img src="${esc(n.image)}" alt="" loading="lazy" onerror="this.remove()">`;
  const cl = cardLangOf(n);
  const dist = n.district && n.district !== "All" ? (cl==="en" ? n.district : KN_distName(n.district, "hi")) : KN_stateName(n.state, cl);
  const badge = `${esc(KN_vName(n.vibhag, cl, true))} • ${esc(dist)}`;
  return `<div class="media">${inner}
    <div class="badges">${n.pinned?`<span class="b pin">⚡ ${t("pinned")}</span>`:""}${n.isGO?`<span class="b go">📄 GO</span>`:""}${n.ai?`<span class="b ai">${t("ai_badge")}</span>`:""}<span class="b cat">${badge}</span></div>
    ${n.isDemo?`<span class="b demo">${t("demo")}</span>`:""}
    ${n.type==="video"?`<button class="play" data-act="video" aria-label="Play">▶</button>`:""}
  </div>`;
}

/* ---------------- card ---------------- */
function cardLangOf(n){ return S.cardLang[n.id] || S.newsLang; }
function textOf(n, l){
  const L = n.lang || {};
  if(L[l] && L[l].s && !/^\[/.test(L[l].s)) return {l, ...L[l], missing:false};
  const fb = ["hi","en","aw","bh"].find(x => L[x] && L[x].s && !/^\[/.test(L[x].s)) || "hi";
  return {l:fb, ...(L[fb]||{h:"",s:""}), missing:true};
}
function ago(ts){
  const m = Math.max(0, (Date.now() - new Date(ts)) / 60000);
  if(m < 1) return t("just_now"); if(m < 60) return t("min_ago", Math.floor(m));
  if(m < 1440) return t("hr_ago", Math.floor(m/60)); return t("day_ago", Math.floor(m/1440));
}
function cardHTML(n){
  const cl = cardLangOf(n), tx = textOf(n, cl), p = Store.prefs();
  const bm = p.bookmarks.includes(n.id);
  const isVid = n.type === "video";
  const src = esc(n.source || "Karmchari News");
  return `<article class="card" data-id="${esc(n.id)}" lang="${tx.l==="en"?"en":"hi"}">
    ${mediaHTML(n)}
    <div class="strip">
      <div class="logo"><img src="./icons/icon.svg" alt=""><b>Karmchari News</b><span class="tag">${esc(KN_CONFIG.tagline)}</span></div>
      <div class="acts">
        <button class="ab ${bm?"on":""}" data-act="bm" aria-label="Bookmark">${bm?ICON.bmOn:ICON.bm}</button>
        <button class="ab wa" data-act="wa" aria-label="WhatsApp">${ICON.wa}</button>
        <button class="ab" data-act="share" aria-label="Share">${ICON.share}</button>
      </div>
    </div>
    <div class="body">
      <div class="pill">${LANGS.map(l=>`<button data-lang="${l}" class="${l===cl?"on":""}">${PILL[l]}</button>`).join("")}</div>
      <h2>${esc(tx.h)}</h2>
      <p class="sum">${esc(tx.s)}</p>
      ${tx.missing?`<p class="miss">${t("lang_missing")}</p>`:""}
      <div class="meta">${ago(n.ts)} · ${esc(KN_stateName(n.state, S.uiLang))}</div>
    </div>
    <footer class="src" data-act="${isVid?"video":"open"}">
      <span>${t("published_on")} <b>${src}</b></span><span class="go">${isVid?t("watch_full"):t("read_full")}</span>
    </footer>
  </article>`;
}
function endHTML(){
  const empty = !S.list.length;
  return `<article class="card endcard"><div class="endin">
    <div class="big">${empty?"🗞️":"✅"}</div><h2>${empty?t("empty"):t("end_feed")}</h2>
    <p>${empty?t("empty_hint"):t("stories", S.list.length)}</p>
    ${empty?`<button class="btn primary" data-act="openmenu">☰ ${t("discover")}</button>`:`<button class="btn primary" data-act="top">↑ ${t("back_top")}</button>`}
  </div></article>`;
}
const ICON = {
  bm:`<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  bmOn:`<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z" fill="currentColor"/></svg>`,
  wa:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>`,
  share:`<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></g></svg>`,
  g:`<svg viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3A12 12 0 1 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/><path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.5-5.2l-6.2-5.3A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>`
};

/* ---------------- feed render + swipe physics ---------------- */
const feed = () => $("#feed");
function renderFeed(){
  const f = feed(); const n = S.list.length;
  if(S.idx > n) S.idx = n;
  const html = [];
  const at = i => i < n ? cardHTML(S.list[i]) : endHTML();
  if(S.idx > 0) html.push(at(S.idx-1).replace('class="card','class="card prev'));
  html.push(at(S.idx).replace('class="card','class="card cur'));
  if(S.idx < n) html.push(at(S.idx+1).replace('class="card','class="card next'));
  f.innerHTML = html.join("");
  f.querySelectorAll(".card").forEach(fitCard);
  const cur = S.list[S.idx];
  if(cur) history.replaceState(null, "", "#n="+cur.id); else history.replaceState(null, "", location.pathname);
}
function fitCard(c){
  const b = c.querySelector(".body"); if(!b) return;
  let fs = Math.min(17, Math.max(13.5, c.clientHeight / 46));
  b.style.setProperty("--fs", fs+"px");
  let guard = 0;
  while(b.scrollHeight > b.clientHeight + 1 && fs > 10.5 && guard++ < 40){ fs -= .4; b.style.setProperty("--fs", fs+"px"); }
}
function go(dir){
  if(S.anim) return;
  const n = S.list.length, target = S.idx + dir;
  if(target < 0 || target > n){ bounce(dir); return; }
  const f = feed(), cur = f.querySelector(".cur"), nb = f.querySelector(dir>0?".next":".prev");
  if(!cur || !nb){ S.idx = target; renderFeed(); return; }
  S.anim = true;
  f.classList.add("animating");
  if(dir > 0){ cur.style.transform = "translateY(-104%) rotateX(8deg) scale(.96)"; nb.style.transform = "none"; nb.style.filter = "none"; }
  else { nb.style.transform = "none"; cur.style.transform = "translateY(0) scale(.92)"; cur.style.filter = "brightness(.6)"; }
  setTimeout(()=>{ f.classList.remove("animating"); S.idx = target; S.anim = false; renderFeed(); }, 330);
}
function bounce(dir){
  const c = feed().querySelector(".cur"); if(!c) return;
  c.animate([{transform:"none"},{transform:`translateY(${dir>0?-26:26}px)`},{transform:"none"}], {duration:300, easing:"ease-out"});
}
function bindSwipe(){
  const f = feed(); let sx=0, sy=0, st=0, dy=0, dx=0, axis=null, active=false;
  f.addEventListener("pointerdown", e => {
    if(S.anim || e.button>0 || e.target.closest("button,.src,a,input")) return;
    active = true; axis = null; sx = e.clientX; sy = e.clientY; st = performance.now(); dy = dx = 0;
  });
  window.addEventListener("pointermove", e => {
    if(!active) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    if(!axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) axis = Math.abs(dy) >= Math.abs(dx) ? "y" : "x";
    if(axis !== "y") return;
    const h = f.clientHeight, cur = f.querySelector(".cur");
    if(dy < 0){
      const nx = f.querySelector(".next"); const p = Math.min(1, -dy/h);
      cur.style.transform = `translateY(${dy}px) rotateX(${p*8}deg) scale(${1-p*.04})`;
      if(nx){ nx.style.transform = `scale(${.92+p*.08})`; nx.style.filter = `brightness(${.6+p*.4})`; }
      else cur.style.transform = `translateY(${dy*.25}px)`;
    } else {
      const pv = f.querySelector(".prev"); const p = Math.min(1, dy/h);
      if(pv){ pv.style.transform = `translateY(calc(-100% + ${dy}px))`; cur.style.transform = `scale(${1-p*.08})`; cur.style.filter = `brightness(${1-p*.4})`; }
      else cur.style.transform = `translateY(${dy*.25}px)`;
    }
  }, {passive:true});
  const end = () => {
    if(!active) return; active = false;
    const h = f.clientHeight, v = Math.abs(dy) / Math.max(1, performance.now()-st);
    if(axis === "x"){
      if(dx > 70) openDrawer();
      else if(dx < -70){ const n = S.list[S.idx]; if(n) openSource(n); }
      return;
    }
    if(axis !== "y") return;
    const commit = Math.abs(dy) > h*.16 || v > .55;
    if(commit && dy < 0 && S.idx < S.list.length) go(1);
    else if(commit && dy > 0 && S.idx > 0) go(-1);
    else { f.classList.add("animating"); f.querySelectorAll(".card").forEach(c=>{ c.style.transform=""; c.style.filter=""; }); setTimeout(()=>f.classList.remove("animating"), 300); }
  };
  window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
  let wheelLock = 0;
  f.addEventListener("wheel", e => { e.preventDefault(); const now = Date.now(); if(now - wheelLock < 650 || Math.abs(e.deltaY) < 12) return; wheelLock = now; go(e.deltaY > 0 ? 1 : -1); }, {passive:false});
  document.addEventListener("keydown", e => {
    if(e.target.closest("input,textarea,select") || !$("#modal").hidden) return;
    if(["ArrowDown","PageDown","j"," "].includes(e.key)){ e.preventDefault(); go(1); }
    if(["ArrowUp","PageUp","k"].includes(e.key)){ e.preventDefault(); go(-1); }
    if(e.key === "ArrowRight") openDrawer();
    if(e.key === "Escape") { closeDrawer(); closeModal(); }
  });
  f.addEventListener("click", onCardClick);
  window.addEventListener("resize", () => feed().querySelectorAll(".card").forEach(fitCard));
}
function onCardClick(e){
  const lb = e.target.closest("[data-lang]");
  const card = e.target.closest(".card"); const n = card && S.list.find(x=>x.id===card.dataset.id);
  if(lb && n){ S.cardLang[n.id] = lb.dataset.lang; renderFeed(); return; }
  const a = e.target.closest("[data-act]"); if(!a) return;
  const act = a.dataset.act;
  if(act === "top"){ S.idx = 0; renderFeed(); return; }
  if(act === "openmenu"){ openDrawer(); return; }
  if(!n) return;
  if(act === "bm") toggleBookmark(n);
  if(act === "wa") shareWhatsApp(n);
  if(act === "share") shareNative(n);
  if(act === "open") openSource(n);
  if(act === "video") openVideo(n);
}

/* ---------------- actions ---------------- */
function storyUrl(n){ return KN_CONFIG.shareUrl + "#n=" + encodeURIComponent(n.id); }
function shareText(n){ const tx = textOf(n, cardLangOf(n)); return `*${tx.h}*\n\n${tx.s}\n\n📰 Karmchari News — ${KN_CONFIG.tagline}\n${storyUrl(n)}`; }
function shareWhatsApp(n){ window.open("https://wa.me/?text=" + encodeURIComponent(shareText(n)), "_blank", "noopener"); }
async function shareNative(n){
  const tx = textOf(n, cardLangOf(n));
  if(navigator.share){ try{ await navigator.share({title: tx.h, text: shareText(n), url: storyUrl(n)}); return; }catch(e){ if(e.name==="AbortError") return; } }
  openModal(`<h3>${t("share")}</h3><p class="muted">${esc(tx.h)}</p>
    <input class="inp" readonly value="${esc(storyUrl(n))}" id="shareLink">
    <div class="row"><button class="btn primary" id="cpy">${t("copy_link")}</button><button class="btn wa" id="waS">WhatsApp</button></div>
    <button class="btn ghost wide" data-close>${t("close")}</button>`);
  $("#cpy").onclick = () => copy(storyUrl(n)); $("#waS").onclick = () => shareWhatsApp(n);
}
function copy(s){ (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(()=>toast(t("copied")), ()=>{ const i = $("#shareLink"); if(i){ i.select(); document.execCommand("copy"); toast(t("copied")); } }); }
function openSource(n){
  if(n.type === "video") return openVideo(n);
  if(n.sourceUrl) window.open(n.sourceUrl, "_blank", "noopener");
}
function openVideo(n){
  const yt = AI.ytId(n.youtube || n.sourceUrl);
  if(!yt){ if(n.sourceUrl) window.open(n.sourceUrl, "_blank", "noopener"); return; }
  openModal(`<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
    <div class="row"><a class="btn ghost" href="https://youtu.be/${yt}" target="_blank" rel="noopener">YouTube ↗</a><button class="btn primary" data-close>${t("close")}</button></div>`, "wide");
}
async function toggleBookmark(n){
  if(!Store.user){ toast(t("login_needed")); openLogin(); return; }
  const p = Store.prefs(); const has = p.bookmarks.includes(n.id);
  const bookmarks = has ? p.bookmarks.filter(x=>x!==n.id) : [n.id].concat(p.bookmarks);
  await Store.setPrefs({bookmarks}); toast(has ? t("removed") : t("saved"));
  if(S.tab === "bm") refresh(true); else renderFeed();
}

/* ---------------- login ---------------- */
function openLogin(){
  if(Store.live){ Store.signInGoogle().catch(e=>toast(e.message)); return; }
  openModal(`<div class="gl-head">${ICON.g}<h3>${t("sign_in_google")}</h3></div>
    <p class="note">${t("sim_note")}</p>
    <label class="lbl">${t("your_name")}</label><input class="inp" id="simName" placeholder="Chandra Bhanu Pandey" autocomplete="name">
    <label class="lbl">${t("gmail")}</label><input class="inp" id="simMail" type="email" placeholder="name@gmail.com" autocomplete="email">
    <button class="btn gbtn wide" id="simGo">${ICON.g}<span>${t("continue")}</span></button>
    <button class="btn ghost wide" data-close>${t("close")}</button>`);
  $("#simGo").onclick = async () => {
    const nm = $("#simName").value.trim(), em = $("#simMail").value.trim();
    if(!nm || !/^\S+@\S+\.\S+$/.test(em)){ toast("Name + valid email"); return; }
    await Store.signInGoogle(nm, em); closeModal(); toast("✓ " + nm);
  };
}

/* ---------------- chrome: topbar + drawer ---------------- */
function renderChrome(){
  document.documentElement.lang = S.uiLang === "en" ? "en" : "hi";
  document.querySelectorAll("[data-i]").forEach(el => el.textContent = t(el.dataset.i));
  document.querySelectorAll("[data-ph]").forEach(el => el.placeholder = t(el.dataset.ph));
  const tabKey = {all:"all_news", my:"my_feed", bm:"bookmarks", go:"gos"}[S.tab];
  $("#topTitle").innerHTML = `<span class="tt-main">${t(tabKey)}</span>${activeFilterLabel()}`;
  $("#topLang").innerHTML = LANGS.map(l=>`<button data-tl="${l}" class="${l===S.newsLang?"on":""}">${PILL[l]}</button>`).join("");
  renderDrawer();
}
function activeFilterLabel(){
  const f = S.f, parts = [];
  if(S.tab==="my" || S.tab==="bm") return "";
  if(f.vibhag) parts.push(KN_vName(f.vibhag, S.uiLang, true));
  if(f.district) parts.push(KN_distName(f.district, S.uiLang)); else if(f.state) parts.push(KN_stateName(f.state, S.uiLang));
  return parts.length ? `<span class="tt-sub">${esc(parts.join(" · "))}</span>` : "";
}
function renderDrawer(){
  const u = Store.user;
  $("#profileBox").innerHTML = u
    ? `<div class="prof"><div class="av">${u.photo?`<img src="${esc(u.photo)}" alt="">`:esc((u.name||"?")[0])}</div><div class="pi"><b>${esc(u.name)}</b><small>${esc(u.email)}${u.simulated?" · preview":""}</small></div><button class="btn ghost sm" id="btnOut">${t("sign_out")}</button></div>`
    : `<div class="prof guest"><div class="av">👤</div><div class="pi"><b>${t("guest")}</b><small>${t("guest_note")}</small></div></div><button class="btn gbtn wide" id="btnIn">${ICON.g}<span>${t("sign_in_google")}</span></button>`;
  const bi = $("#btnIn"), bo = $("#btnOut");
  if(bi) bi.onclick = openLogin; if(bo) bo.onclick = () => Store.signOut();

  const tabs = [["all","all_news"],["my","my_feed"],["bm","bookmarks"],["go","gos"]];
  $("#feedTabs").innerHTML = tabs.map(([k,key])=>`<button data-tab="${k}" class="${S.tab===k?"on":""}">${t(key)}</button>`).join("");
  $("#vibhagChips").innerHTML = `<button data-v="" class="${!S.f.vibhag?"on":""}">${t("all_vibhag")}</button>` +
    KN_VIBHAG.map(v=>`<button data-v="${v.id}" class="${S.f.vibhag===v.id?"on":""}" style="--c:${v.c1}">${esc(v.n[KN_LI[S.uiLang]])}</button>`).join("");
  $("#stateChips").innerHTML = `<button data-s="" class="${!S.f.state?"on":""}">${t("all_states")}</button>` +
    KN_STATES.map(s=>`<button data-s="${s.id}" class="${S.f.state===s.id?"on":""}">${esc(KN_stateName(s.id, S.uiLang))}</button>`).join("");
  renderDistricts();
  $("#uiLangChips").innerHTML = KN_LANGS.map(l=>`<button data-ui="${l.k}" class="${S.uiLang===l.k?"on":""}">${l.label}</button>`).join("");
  $("#newsLangChips").innerHTML = KN_LANGS.map(l=>`<button data-nl="${l.k}" class="${S.newsLang===l.k?"on":""}">${l.label}</button>`).join("");
}
function renderDistricts(){
  const q = ($("#distSearch").value||"").trim().toLowerCase();
  const box = $("#distList");
  if(S.f.state && S.f.state !== "UP"){ box.innerHTML = `<p class="muted sm">${t("all_districts")} — ${esc(KN_stateName(S.f.state, S.uiLang))}</p>`; return; }
  const list = KN_UP_DISTRICTS.filter(d => !q || d[0].toLowerCase().includes(q) || d[1].includes(q));
  box.innerHTML = (!q?`<button data-d="" class="${!S.f.district?"on":""}">${t("all_districts")}</button>`:"") +
    list.map(d=>`<button data-d="${esc(d[0])}" class="${S.f.district===d[0]?"on":""}">${esc(S.uiLang==="en"?d[0]:d[1])}${S.uiLang==="en"?"":` <small>${esc(d[0])}</small>`}</button>`).join("");
}
function openDrawer(){ $("#drawer").classList.add("open"); $("#scrim").classList.add("on"); $("#drawer").setAttribute("aria-hidden","false"); }
function closeDrawer(){ $("#drawer").classList.remove("open"); $("#scrim").classList.remove("on"); $("#drawer").setAttribute("aria-hidden","true"); }

function bindStatic(){
  $("#btnMenu").onclick = openDrawer; $("#btnClose").onclick = closeDrawer; $("#scrim").onclick = closeDrawer;
  $("#btnLock").onclick = () => window.Admin && Admin.open();
  $("#btnAdmin2").onclick = () => { closeDrawer(); window.Admin && Admin.open(); };
  $("#topLang").onclick = e => { const b = e.target.closest("[data-tl]"); if(!b) return; S.newsLang = b.dataset.tl; S.cardLang = {}; Store.setPrefs({newsLang:S.newsLang}); renderChrome(); renderFeed(); };
  $("#drawer").addEventListener("click", e => {
    const b = e.target.closest("button"); if(!b) return;
    if(b.dataset.tab !== undefined){
      const k = b.dataset.tab;
      if((k==="my"||k==="bm") && !Store.user){ toast(t("login_needed")); openLogin(); return; }
      S.tab = k; S.idx = 0; refresh(false); renderChrome(); closeDrawer(); return;
    }
    if(b.dataset.v !== undefined){ S.f.vibhag = b.dataset.v || null; afterFilter(); }
    else if(b.dataset.s !== undefined){ S.f.state = b.dataset.s || null; if(S.f.state && S.f.state!=="UP") S.f.district = null; afterFilter(); }
    else if(b.dataset.d !== undefined){ S.f.district = b.dataset.d || null; if(S.f.district) S.f.state = "UP"; afterFilter(); }
    else if(b.dataset.ui){ S.uiLang = b.dataset.ui; window.KN_UILANG = S.uiLang; Store.setPrefs({uiLang:S.uiLang}); renderChrome(); renderFeed(); }
    else if(b.dataset.nl){ S.newsLang = b.dataset.nl; S.cardLang = {}; Store.setPrefs({newsLang:S.newsLang}); renderChrome(); renderFeed(); }
  });
  $("#distSearch").addEventListener("input", renderDistricts);
  $("#btnSaveFeed").onclick = async () => {
    if(!Store.user){ toast(t("login_needed")); openLogin(); return; }
    await Store.setPrefs({myFeed: Object.assign({}, S.f)}); toast(t("feed_saved"));
    S.tab = "my"; S.idx = 0; refresh(false); renderChrome(); closeDrawer();
  };
  $("#btnClearF").onclick = () => { S.f = {vibhag:null, state:null, district:null}; $("#distSearch").value = ""; afterFilter(); };
  $("#modal").addEventListener("click", e => { if(e.target.id === "modal" || e.target.closest("[data-close]")) closeModal(); });
  // swipe-left on open drawer closes it
  let dsx = null; const dr = $("#drawer");
  dr.addEventListener("pointerdown", e => dsx = e.clientX);
  dr.addEventListener("pointerup", e => { if(dsx !== null && dsx - e.clientX > 80) closeDrawer(); dsx = null; });
  bindSwipe();
}
function afterFilter(){ if(S.tab==="my"||S.tab==="bm") S.tab = "all"; S.idx = 0; refresh(false); renderChrome(); }

/* ---------------- modal + toast ---------------- */
function openModal(html, cls){ const m = $("#modal"); $("#sheet").className = "sheet " + (cls||""); $("#sheet").innerHTML = html; m.hidden = false; requestAnimationFrame(()=>m.classList.add("on")); }
function closeModal(){ const m = $("#modal"); m.classList.remove("on"); setTimeout(()=>{ m.hidden = true; $("#sheet").innerHTML = ""; }, 200); }
let tt; function toast(s){ const el = $("#toast"); el.textContent = s; el.classList.add("on"); clearTimeout(tt); tt = setTimeout(()=>el.classList.remove("on"), 2200); }

window.App = { S, openModal, closeModal, toast, refresh, renderFeed, esc, textOf, openLogin, goTop(){ S.tab="all"; S.f={vibhag:null,state:null,district:null}; S.idx=0; refresh(false); renderChrome(); } };
document.addEventListener("DOMContentLoaded", boot);
})();
