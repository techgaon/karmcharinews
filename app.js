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
const resume = KN_LS.get('kn_reading_position', {});
let restoreId = resume.id || null, knownIds = new Set(resume.ids || []), pendingIds = new Set(), previewTimer;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function updateNewsNotice(){
  const count = S.list.slice(0, S.idx).filter(n=>pendingIds.has(n.id)).length;
  const b = $('#newNews'); b.hidden = !count || S.tab === 'bm';
  b.textContent = S.uiLang === 'en' ? `↑ ${count} new ${count===1?'story':'stories'} · Tap to read` : `↑ ${count} नई ख़बरें · पढ़ने के लिए टैप करें`;
}
function headlinePreview(latest=false){
  if(S.anim) return;
  const stop = Math.min(S.idx, S.list.length), items = S.list.slice(0, stop);
  if(!items.length) return;
  const en = S.uiLang === 'en';
  openModal(`<div class="preview-head"><h3>${en?'News previews':'ख़बरों की झलक'}</h3><button class="btn ghost" data-close>${en?'Close':'बंद करें'}</button></div><p class="note">${en?'Swipe through the small cards. Tap a preview to read the full story.':'छोटे कार्ड स्वाइप करें। पूरी ख़बर पढ़ने के लिए उसके preview पर टैप करें।'}</p><div class="headline-previews" aria-label="News thumbnail previews">${items.map((n,i)=>{const tx=textOf(n,cardLangOf(n));return `<button class="headline-preview" data-preview="${i}" aria-label="${esc(tx.h)}"><div class="preview-picture">${mediaHTML(n)}</div><div class="preview-brand"><img src="./icon.svg" alt="">Karmchari News <span>${i+1}/${items.length}</span></div><strong>${esc(tx.h)}</strong><p>${esc(tx.s)}</p><small>${esc(n.source||'Karmchari News')}</small></button>`}).join('')}</div><p class="preview-count" id="previewCount" aria-live="polite"></p><button class="btn primary wide" id="openPreview">${en?'Open selected story':'चुनी हुई ख़बर खोलें'}</button><button class="btn ghost wide" id="readLatest">↑ ${en?'Read latest news':'सबसे नई ख़बर पढ़ें'}</button>${latest?`<button class="btn ghost wide" id="pausePreview">${en?'Pause previews':'रुककर preview देखें'}</button>`:''}`, 'news-preview');
  const openAt = i => { clearTimeout(previewTimer); closeModal(); S.idx=i; if(i===0){pendingIds.clear();S.list.forEach(n=>knownIds.add(n.id));} renderFeed(); };
  const box=$('.headline-previews'), cards=[...$('#sheet').querySelectorAll('[data-preview]')];
  let selected=items.length-1, auto=latest;
  const select = i => { selected=i;cards.forEach((c,j)=>{c.classList.toggle('focused',j===i);c.setAttribute('aria-current',j===i?'true':'false');});$('#previewCount').textContent=`${i+1} / ${items.length}`; };
  const center = i => {const c=cards[i];if(c)box.scrollTo({left:c.offsetLeft-(box.clientWidth-c.offsetWidth)/2,behavior:reducedMotion()?'instant':'smooth'});select(i);};
  cards.forEach(b=>{b.onclick=()=>openAt(Number(b.dataset.preview));b.onmouseenter=()=>select(Number(b.dataset.preview));b.onfocus=()=>select(Number(b.dataset.preview));});
  box.addEventListener('scroll',()=>{const mid=box.scrollLeft+box.clientWidth/2;let best=0;cards.forEach((c,i)=>{if(Math.abs(c.offsetLeft+c.offsetWidth/2-mid)<Math.abs(cards[best].offsetLeft+cards[best].offsetWidth/2-mid))best=i;});select(best);},{passive:true});
  box.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();box.scrollLeft+=e.deltaY;}},{passive:false});
  const pause=()=>{auto=false;clearTimeout(previewTimer);const p=$('#pausePreview');if(p)p.hidden=true;};
  box.addEventListener('pointerdown',pause);
  $('#openPreview').onclick=()=>openAt(selected);
  $('#readLatest').onclick=()=>openAt(0);
  requestAnimationFrame(()=>{const c=cards[selected];if(c)box.scrollLeft=c.offsetLeft-(box.clientWidth-c.offsetWidth)/2;select(selected);});
  if(latest){
    const advance=()=>{if(!auto)return;if(selected>0){center(Math.max(0,selected-Math.max(1,Math.ceil(items.length/6))));previewTimer=setTimeout(advance,800);}else openAt(0);};
    previewTimer=setTimeout(reducedMotion()?()=>openAt(0):advance, reducedMotion()?0:800);
    $('#pausePreview').onclick=pause;
  }
}

/* ---------------- boot ---------------- */
async function boot(){
  let deep = (location.hash.match(/n=([\w-]+)/)||[])[1];
  const g = KN_LS.get("kn_guest", {});
  S.uiLang = g.uiLang || "en"; S.newsLang = g.newsLang || "hi"; window.KN_UILANG = S.uiLang;
  bindStatic();
  Store.onUser(u => {
    const p = Store.prefs();
    if(p.uiLang){ S.uiLang = p.uiLang; window.KN_UILANG = p.uiLang; }
    if(p.newsLang) S.newsLang = p.newsLang;
    renderChrome(); refresh(true);
  });
  Store.onNews(() => { refresh(false); if(deep){ const i = S.list.findIndex(n=>n.id===deep); if(i>=0){ S.idx = i; renderFeed(); deep = null; } } });
  document.addEventListener("kn-loaded", () => { loaderDone(); renderFeed(); });
  loaderStart();
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
  if(knownIds.size) S.list.forEach(n=>{if(!knownIds.has(n.id))pendingIds.add(n.id)});
  if(!knownIds.size && S.list.length) knownIds=new Set(S.list.map(n=>n.id));
  if(restoreId){const restored=S.list.findIndex(n=>n.id===restoreId);if(restored>=0){S.idx=restored;restoreId=null;}}
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
  else if(n.type==="video" && yt) inner = artSVG(n) + `<img src="https://i.ytimg.com/vi/${yt}/hqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`;
  else inner = artSVG(n);
  if(n.image) inner = artSVG(n) + `<img src="${esc(n.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`;
  const cl = cardLangOf(n), v = KN_vibhag(n.vibhag);
  const badge = `<span class="b cat" style="--c1:${v.c1};--c2:${v.c2}"><i>${VICON[n.vibhag]||"📰"}</i>${esc(KN_vName(n.vibhag, cl, true))}</span>`;
  return `<div class="media">${inner}<div class="shade"></div>
    <div class="badges">${n.pinned?`<span class="b pin">⚡ ${t("pinned")}</span>`:""}${badge}</div>
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
const VICON = {panchayat:"🏛️", shiksha:"📚", revenue:"📜", police:"👮", health:"🩺", finance:"💰", all:"👥"};
function ago(ts){
  const d = new Date(ts), m = Math.max(0, (Date.now() - d) / 60000);
  if(m < 1) return t("just_now"); if(m < 60) return t("min_ago", Math.floor(m));
  if(m < 1440) return t("hr_ago", Math.floor(m/60));
  return d.toLocaleDateString(S.uiLang==="en" ? "en-IN" : "hi-IN", {day:"numeric", month:"short", year: d.getFullYear()===new Date().getFullYear() ? undefined : "numeric"});
}
/* 📍 place line, e.g. "बाराबंकी के बनीकोडर ब्लॉक की कुशफर ग्राम पंचायत की ख़बर" / "मध्य प्रदेश के दतिया ज़िले की ख़बर" */
const PL = {
  hi: {m:"के", f:"की", gp:"ग्राम पंचायत", bl:"ब्लॉक", dz:"ज़िले", nw:"ख़बर"},
  aw: {m:"के", f:"कै", gp:"ग्राम पंचायत", bl:"ब्लॉक", dz:"जिला", nw:"खबर"},
  bh: {m:"के", f:"के", gp:"ग्राम पंचायत", bl:"ब्लॉक", dz:"जिला", nw:"खबर"}
};
function placeLine(n, l){
  const p = n.place || {}, en = l === "en";
  const up = n.state === "UP" || /uttar pradesh/i.test(p.state_en || "") || /उत्तर प्रदेश/.test(p.state_hi || "");
  const dist = n.district && n.district !== "All" ? n.district : "";
  const d = en ? (p.district_en || dist) : (p.district_hi || (dist ? KN_distName(dist, "hi") : ""));
  const b = en ? p.block_en : p.block_hi, g = en ? p.gp_en : p.gp_hi;
  let S = "";
  if(!up){
    S = en ? (p.state_en || "") : (p.state_hi || "");
    if(!S && n.state && !["UP","National","Other"].includes(n.state)) S = KN_stateName(n.state, en ? "en" : "hi");
  }
  if(en){
    if(up){ if(g && b && d) return `${g} Gram Panchayat, ${b} block, ${d}`; if(b && d) return `${b} block, ${d}`; if(g && d) return `${g} Gram Panchayat, ${d}`; if(d) return `${d} district`; return ""; }
    if(g && d) return `${g} Gram Panchayat, ${d}, ${S}`.replace(/, $/, ""); if(b && d) return `${b} block, ${d}, ${S}`.replace(/, $/, ""); if(d) return `${d} district${S ? ", " + S : ""}`; return S ? `${S}` : "";
  }
  const K = PL[l] || PL.hi;
  if(up){
    if(g && b && d) return `${d} ${K.m} ${b} ${K.bl} ${K.f} ${g} ${K.gp} ${K.f} ${K.nw}`;
    if(b && d) return `${d} ${K.m} ${b} ${K.bl} ${K.f} ${K.nw}`;
    if(g && d) return `${d} ${K.f} ${g} ${K.gp} ${K.f} ${K.nw}`;
    if(d) return `${d} ${K.dz} ${K.f} ${K.nw}`;
    return "";
  }
  const pre = S ? `${S} ${K.m} ` : "";
  if(g && d) return `${pre}${d} ${K.f} ${g} ${K.gp} ${K.f} ${K.nw}`;
  if(b && d) return `${pre}${d} ${K.m} ${b} ${K.bl} ${K.f} ${K.nw}`;
  if(d) return `${pre}${d} ${K.dz} ${K.f} ${K.nw}`;
  if(S) return `${S} ${K.f} ${K.nw}`;
  return "";
}
/* ---- likes ❤️ ---- */
const HEART = `<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.1 1.7-1.9 3.2-3.1 5.3-3.1 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>`;
const likedSet = () => { try{ return new Set(JSON.parse(localStorage.getItem("kn_liked") || "[]")); }catch(e){ return new Set(); } };
const fmtN = c => c >= 1e5 ? (c/1e5).toFixed(1).replace(/\.0$/,"") + "L" : c >= 1000 ? (c/1000).toFixed(1).replace(/\.0$/,"") + "K" : String(c);
function likeBtn(n){
  const on = likedSet().has(n.id), c = Store.likes(n.id);
  return `<button class="ab like ${on?"on":""}" data-act="like" aria-label="Like" aria-pressed="${on}">${HEART}<span class="lc">${c ? fmtN(c) : ""}</span></button>`;
}
function toggleLike(n, btn){
  const set = likedSet(), on = !set.has(n.id);
  on ? set.add(n.id) : set.delete(n.id); localStorage.setItem("kn_liked", JSON.stringify([...set]));
  Store.like(n.id, on ? 1 : -1);
  btn.classList.toggle("on", on); btn.setAttribute("aria-pressed", on);
  const c = Store.likes(n.id); btn.querySelector(".lc").textContent = c ? fmtN(c) : "";
  if(on){
    btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
    for(let i = 0; i < 8; i++){ const p = document.createElement("i"); p.className = "spark"; p.style.setProperty("--a", (i * 45) + "deg"); btn.appendChild(p); setTimeout(()=>p.remove(), 650); }
    const big = document.createElement("div"); big.className = "bigheart"; big.innerHTML = HEART; btn.closest(".card")?.appendChild(big); setTimeout(()=>big.remove(), 900);
    if(navigator.vibrate) navigator.vibrate(15);
  }
}
function cardHTML(n){
  const cl = cardLangOf(n), tx = textOf(n, cl), p = Store.prefs();
  const bm = p.bookmarks.includes(n.id);
  const isVid = n.type === "video";
  const src = esc(n.source || "Karmchari News");
  return `<article class="card" data-id="${esc(n.id)}" lang="${tx.l==="en"?"en":"hi"}">
    ${mediaHTML(n)}
    <div class="strip">
      <div class="logo"><img src="./icon.svg" alt=""><span class="nm"><b>Karmchari</b><b>News</b></span><span class="tag">News in<em>100 words</em></span></div>
      <div class="acts">
        <button class="ab ${bm?"on":""}" data-act="bm" aria-label="Bookmark">${bm?ICON.bmOn:ICON.bm}</button>
        <button class="ab wa" data-act="wa" aria-label="WhatsApp">${ICON.wa}</button>
        <button class="ab" data-act="share" aria-label="Share">${ICON.share}</button>
      </div>
    </div>
    <div class="body">
      <h2>${esc(tx.h)}</h2>
      <p class="sum">${esc(tx.s)}</p>
      ${tx.missing?`<p class="miss">${t("lang_missing")}</p>`:""}
      <div class="meta"><span class="time">🕒 ${ago(KN_time(n))}</span>${(pl => pl ? `<span class="place"><svg class="pin" viewBox="0 0 24 24"><path d="M12 2C7.6 2 4 5.5 4 9.9 4 15.6 12 22 12 22s8-6.4 8-12.1C20 5.5 16.4 2 12 2z" fill="#EA4335"/><circle cx="12" cy="9.8" r="3.2" fill="#B31412"/></svg>${esc(pl)}</span>` : "")(placeLine(n, tx.l))}${likeBtn(n)}</div>
    </div>
    <footer class="src" data-act="${isVid?"video":"open"}">
      <span>Source <b>${src}</b> <span class="source-arrow" aria-hidden="true">↗</span></span><span class="go">${isVid?t("watch_full"):t("read_full")}</span>
    </footer>
  </article>`;
}
/* loading screen: % counter → green tick (only while nothing is on screen yet) */
let LOAD = {p:0, t:null};
function loaderStart(){
  if(LOAD.t) return;
  LOAD.t = setInterval(() => { if(Store.loaded) return; LOAD.p = Math.min(95, LOAD.p + Math.max(1, (95 - LOAD.p) * 0.12)); const el = $("#knLp"); if(el) el.textContent = Math.round(LOAD.p) + "%"; const b = $("#knLb"); if(b) b.style.width = LOAD.p + "%"; }, 120);
}
function loaderDone(){ clearInterval(LOAD.t); LOAD.p = 100; const c = $("#knLoad"); if(c){ c.classList.add("ok"); $("#knLp").textContent = "100%"; $("#knLb").style.width = "100%"; } }
function loaderHTML(){
  const hi = S.uiLang !== "en";
  return `<article class="card endcard"><div class="endin" id="knLoad"><div class="ldr"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="23"/><path d="M15 27l7 7 15-16"/></svg></div>
    <h2>${hi ? "ख़बरें लोड हो रही हैं…" : "Loading news…"}</h2><div class="lbar"><i id="knLb" style="width:${LOAD.p}%"></i></div><p class="lp" id="knLp">${Math.round(LOAD.p)}%</p></div></article>`;
}
function endHTML(){
  const empty = !S.list.length;
  if(empty && !Store.loaded) return loaderHTML();
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
  if(cur){knownIds.add(cur.id);pendingIds.delete(cur.id);}
  updateNewsNotice();
  if(cur && !restoreId) KN_LS.set('kn_reading_position',{id:cur.id,ids:[...knownIds].slice(-600)});
  warmShare();
  const cc = f.querySelector(".card.cur");
  if(cc && S.lastShown !== (cur ? cur.id : "end")){ cc.classList.add("enter"); S.lastShown = cur ? cur.id : "end"; }
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
  if(dir > 0){ cur.style.transform = "translateY(-100%) rotateX(72deg) scale(.96)"; nb.style.transform = "none"; nb.style.filter = "none"; }
  else { nb.style.transform = "none"; cur.style.transform = "translateY(0) scale(.92)"; cur.style.filter = "brightness(.6)"; }
  setTimeout(()=>{ f.classList.remove("animating"); S.idx = target; S.anim = false; renderFeed(); }, reducedMotion()?0:460);
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
      cur.style.transform = `translateY(${dy}px) rotateX(${p*65}deg) scale(${1-p*.04})`;
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
    if(dy>100 && v>1 && S.idx>1){ renderFeed(); headlinePreview(); return; }
    const commit = Math.abs(dy) > h*.16 || v > .55;
    if(commit && dy < 0 && S.idx < S.list.length) go(1);
    else if(commit && dy > 0 && S.idx > 0) go(-1);
    else { f.classList.add("animating"); f.querySelectorAll(".card").forEach(c=>{ c.style.transform=""; c.style.filter=""; }); setTimeout(()=>f.classList.remove("animating"), 300); }
  };
  window.addEventListener("pointerup", end); window.addEventListener("pointercancel", ()=>{active=false;renderFeed();});
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
  if(act === "like") toggleLike(n, a);
  if(act === "open") openSource(n);
  if(act === "video") openVideo(n);
}

/* ---------------- actions ---------------- */
function storyUrl(n){ return KN_CONFIG.shareUrl + "#n=" + encodeURIComponent(n.id); }
function shareCaption(n){
  const en = cardLangOf(n) === "en";
  return (en ? "Every employee news in just 100 words. Read on Karmchari News 👇\n" : "कर्मचारियों की हर ख़बर सिर्फ़ 100 शब्दों में। पढ़ें Karmchari News पर 👇\n") + storyUrl(n);
}
function shareText(n){ const tx = textOf(n, cardLangOf(n)); return `*${tx.h}*\n\n${tx.s}\n\n📰 Karmchari News — ${KN_CONFIG.tagline}\n${storyUrl(n)}`; }
/* ---- Inshorts-style share card (image) ---- */
const SHARE_CACHE = {}, SHARE_PENDING = {};
/* prepare the share card of the story on screen in the background, so the share button is instant */
let warmT = null;
function warmShare(){
  clearTimeout(warmT);
  warmT = setTimeout(() => {
    const n = S.list[S.idx]; if(!n || !navigator.canShare) return;
    const key = n.id + "|" + cardLangOf(n); if(SHARE_CACHE[key] || SHARE_PENDING[key]) return;
    const go = () => { SHARE_PENDING[key] = makeShareImage(n).catch(() => null).finally(() => { delete SHARE_PENDING[key]; }); };
    (window.requestIdleCallback || (f => setTimeout(f, 50)))(go);
  }, 900);
}
function loadImg(src, cors){ return new Promise(res => { if(!src) return res(null); const im = new Image(); if(cors) im.crossOrigin = "anonymous"; let done = false;
  const fin = v => { if(!done){ done = true; res(v); } }; im.onload = () => fin(im); im.onerror = () => fin(null); setTimeout(()=>fin(null), 3500); im.src = src; }); }
function proxied(u, w, h){ return "https://images.weserv.nl/?url=" + encodeURIComponent(u.replace(/^https?:\/\//, "")) + `&w=${w}&h=${h}&fit=cover&a=attention&output=jpg&q=82`; }
function wrapLines(ctx, text, maxW, maxLines){
  const words = String(text).split(/\s+/); const lines = []; let cur = "";
  for(const w of words){ const tst = cur ? cur + " " + w : w; if(ctx.measureText(tst).width > maxW && cur){ lines.push(cur); cur = w; } else cur = tst; }
  if(cur) lines.push(cur);
  if(maxLines && lines.length > maxLines){ const keep = lines.slice(0, maxLines); keep[maxLines-1] = keep[maxLines-1].replace(/\s*\S*$/, "") + " …"; return keep; }
  return lines;
}
function rr(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r); ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath(); }
async function makeShareImage(n){
  const l = cardLangOf(n), key = n.id + "|" + l; if(SHARE_CACHE[key]) return SHARE_CACHE[key];
  const tx = textOf(n, l), en = tx.l === "en";
  const W = 1080, PH = 600, PAD = 56;
  const dev = en ? '"Inter","Noto Sans Devanagari",sans-serif' : '"Noto Sans Devanagari","Inter",sans-serif';
  try{ await document.fonts.ready; await Promise.all([document.fonts.load('800 50px "Noto Sans Devanagari"'), document.fonts.load('400 36px "Noto Sans Devanagari"'), document.fonts.load('800 30px "Inter"')]); }catch(e){}
  const yt = AI.ytId(n.youtube || (n.type==="video" ? n.sourceUrl : ""));
  const raw = n.image || (yt ? `https://i.ytimg.com/vi/${yt}/mqdefault.jpg` : "");
  const [photo, logo] = await Promise.all([raw ? loadImg(proxied(raw, W, PH), true) : null, loadImg("./icon-192.png", false)]);
  // measure text first
  const m = document.createElement("canvas").getContext("2d");
  m.font = `800 50px ${dev}`; const hl = wrapLines(m, tx.h, W - PAD*2, 3);
  m.font = `400 36px ${dev}`; const sl = wrapLines(m, tx.s, W - PAD*2, 12);
  const place = placeLine(n, tx.l);
  const H = PH + 70 + hl.length*66 + 22 + sl.length*56 + 30 + 56 + 40 + 120;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  const v = KN_vibhag(n.vibhag);
  const g = ctx.createLinearGradient(0, 0, W, PH); g.addColorStop(0, v.c1); g.addColorStop(1, v.c2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, PH);
  if(photo) ctx.drawImage(photo, 0, 0, W, PH);
  else { ctx.font = "200px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(VICON[n.vibhag] || "📰", W/2, PH/2); ctx.textAlign = "left"; }
  // vibhag badge
  ctx.textBaseline = "middle"; ctx.font = `800 30px ${dev}`;
  const bt = (VICON[n.vibhag]||"📰") + "  " + KN_vName(n.vibhag, l, true); const bw = ctx.measureText(bt).width + 48;
  const bg = ctx.createLinearGradient(PAD, 0, PAD+bw, 0); bg.addColorStop(0, v.c1); bg.addColorStop(1, v.c2);
  ctx.fillStyle = bg; rr(ctx, PAD-16, 30, bw, 60, 30); ctx.fill(); ctx.fillStyle = "#fff"; ctx.fillText(bt, PAD+8, 61);
  // brand pill bottom-left of photo
  ctx.fillStyle = "#fff"; rr(ctx, PAD-16, PH - 46, 430, 92, 18); ctx.fill();
  if(logo) ctx.drawImage(logo, PAD, PH - 34, 68, 68);
  ctx.fillStyle = "#0b2545"; ctx.font = '800 34px "Inter",sans-serif'; ctx.fillText("Karmchari News", PAD + 84, PH - 12);
  ctx.fillStyle = "#ff7a00"; ctx.font = '700 22px "Inter",sans-serif'; ctx.fillText("News in 100 words", PAD + 84, PH + 22);
  // headline + summary
  let y = PH + 70 + 66; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#111827"; ctx.font = `800 50px ${dev}`;
  for(const ln of hl){ ctx.fillText(ln, PAD, y); y += 66; }
  y += 22 - 66 + 56; ctx.fillStyle = "#4b5563"; ctx.font = `400 36px ${dev}`;
  for(const ln of sl){ ctx.fillText(ln, PAD, y); y += 56; }
  y += 10; ctx.font = `600 28px ${dev}`; ctx.fillStyle = "#0f766e";
  const metaTxt = (place ? "📍 " + place + "   " : "") + "🕒 " + new Date(n.ts || Date.now()).toLocaleDateString(en ? "en-IN" : "hi-IN", {day:"numeric", month:"short", year:"numeric"});
  ctx.fillText(wrapLines(ctx, metaTxt, W - PAD*2, 1)[0], PAD, y + 20);
  // bottom bar
  ctx.fillStyle = "#0b2545"; ctx.fillRect(0, H - 120, W, 120);
  ctx.fillStyle = "#fff"; ctx.font = `600 28px ${dev}`; ctx.textBaseline = "middle";
  ctx.fillText((en ? "Source: " : "स्रोत: ") + (n.source || "Karmchari News"), PAD, H - 78);
  ctx.fillStyle = "#ffb347"; ctx.font = '700 28px "Inter",sans-serif'; ctx.fillText("techgaon.in/karmcharinews", PAD, H - 38);
  const blob = await new Promise(r => { try{ c.toBlob(r, "image/jpeg", 0.88); }catch(e){ r(null); } });
  if(!blob) return null;
  const file = new File([blob], `karmchari-news-${String(n.id).slice(0,12)}.jpg`, {type:"image/jpeg"});
  SHARE_CACHE[key] = file; return file;
}
async function shareCard(n, viaWa){
  let file = null;
  if(navigator.canShare){ const key = n.id + "|" + cardLangOf(n); if(!SHARE_CACHE[key]) toast(cardLangOf(n)==="en" ? "Preparing card…" : "कार्ड तैयार हो रहा है…"); try{ file = await (SHARE_PENDING[key] || makeShareImage(n)); }catch(e){ file = null; } }
  if(file && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file], text: shareCaption(n)}); return; }
    catch(e){
      if(e.name === "AbortError") return;
      if(e.name === "NotAllowedError"){ // user gesture expired while drawing — ask for one more tap
        openModal(`<h3>${t("share")}</h3><img src="${URL.createObjectURL(file)}" style="width:100%;border-radius:12px;margin:8px 0" alt=""><button class="btn primary" id="shNow" style="width:100%">📤 ${t("share")}</button>`);
        $("#shNow").onclick = async () => { try{ await navigator.share({files:[file], text: shareCaption(n)}); }catch(_){} closeModal(); };
        return;
      }
    }
  }
  if(viaWa) window.open("https://wa.me/?text=" + encodeURIComponent(shareText(n)), "_blank", "noopener");
  else shareFallback(n);
}
function shareWhatsApp(n){ shareCard(n, true); }
function shareNative(n){ shareCard(n, false); }
async function shareFallback(n){
  const tx = textOf(n, cardLangOf(n));
  if(navigator.share){ try{ await navigator.share({title: tx.h, text: shareText(n), url: storyUrl(n)}); return; }catch(e){ if(e.name==="AbortError") return; } }
  openModal(`<h3>${t("share")}</h3><p class="muted">${esc(tx.h)}</p>
    <input class="inp" readonly value="${esc(storyUrl(n))}" id="shareLink">
    <div class="row"><button class="btn primary" id="cpy">${t("copy_link")}</button><button class="btn wa" id="waS">WhatsApp</button></div>
    <button class="btn ghost wide" data-close>${t("close")}</button>`);
  $("#cpy").onclick = () => copy(storyUrl(n)); $("#waS").onclick = () => window.open("https://wa.me/?text=" + encodeURIComponent(shareText(n)), "_blank", "noopener");
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
  $("#topTitle").innerHTML = `<span class="tt-main"${S.tab==='all'?' lang="hi"':''}>${S.tab==='all'?'समस्त विभाग':t(tabKey)} <span aria-hidden="true">⌄</span></span>${activeFilterLabel()}`;
  $("#moreMenu").innerHTML = `<div class="mm-h">📰 ${t("news_lang")}</div>` +
    KN_LANGS.map(l=>`<button data-nl="${l.k}" class="${S.newsLang===l.k?"on":""}"><span>${l.label}</span>${S.newsLang===l.k?"✓":""}</button>`).join("") +
    `<div class="mm-h">🌐 ${t("ui_lang")}</div>` +
    KN_LANGS.map(l=>`<button data-ui="${l.k}" class="${S.uiLang===l.k?"on":""}"><span>${l.label}</span>${S.uiLang===l.k?"✓":""}</button>`).join("") +
    `<div class="mm-sep"></div><button data-mm="tour"><span>🎓 ${S.uiLang==="en"?"App tour":"ऐप टूर"}</span></button><button data-mm="admin"><span>🔒 ${t("admin_login")}</span></button>`;
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
  const CHK = `<b class="tick">✓</b>`;
  $("#vibhagChips").innerHTML = `<button data-v="" class="vc allv ${!S.f.vibhag?"on":""}" style="--c1:#0b2545;--c2:#13315c"><i>🗂️</i><span>${t("all_vibhag")}</span>${CHK}</button>` +
    KN_VIBHAG.map(v=>`<button data-v="${v.id}" class="vc ${S.f.vibhag===v.id?"on":""}" style="--c1:${v.c1};--c2:${v.c2}"><i>${VICON[v.id]||"📰"}</i><span>${esc(KN_vName(v.id, S.uiLang, true))}</span>${CHK}</button>`).join("");
  const SC = {UP:["UP","#f97316","#fb923c"], Bihar:["BR","#16a34a","#4ade80"], MP:["MP","#7c3aed","#a78bfa"], Rajasthan:["RJ","#db2777","#f472b6"], Uttarakhand:["UK","#0891b2","#22d3ee"], National:["🇮🇳","#1e3a8a","#3b82f6"], Other:["🗺️","#475569","#94a3b8"]};
  $("#stateChips").innerHTML = `<button data-s="" class="sc ${!S.f.state?"on":""}" style="--c1:#0b2545;--c2:#13315c"><i>🌐</i><span>${t("all_states")}</span>${CHK}</button>` +
    KN_STATES.map(st=>{ const c = SC[st.id] || ["•","#475569","#94a3b8"]; return `<button data-s="${st.id}" class="sc ${S.f.state===st.id?"on":""}" style="--c1:${c[1]};--c2:${c[2]}"><i>${c[0]}</i><span>${esc(KN_stateName(st.id, S.uiLang))}</span>${CHK}</button>`; }).join("");
  const sel = (id, txt) => { const el = $(id); if(el){ el.textContent = txt || ""; el.hidden = !txt; } };
  sel("#selV", S.f.vibhag ? KN_vName(S.f.vibhag, S.uiLang, true) : "");
  sel("#selS", S.f.state ? KN_stateName(S.f.state, S.uiLang) : "");
  sel("#selD", S.f.district ? KN_distName(S.f.district, S.uiLang) : "");
  renderDistricts();
  $("#uiLangChips").innerHTML = KN_LANGS.map(l=>`<button data-ui="${l.k}" class="${S.uiLang===l.k?"on":""}">${l.label}</button>`).join("");
  $("#newsLangChips").innerHTML = KN_LANGS.map(l=>`<button data-nl="${l.k}" class="${S.newsLang===l.k?"on":""}">${l.label}</button>`).join("");
}
function renderDistricts(){
  const q = ($("#distSearch").value||"").trim().toLowerCase();
  const box = $("#distList");
  const sb = $("#distSearchBox"); if(sb) sb.hidden = !!(S.f.state && S.f.state !== "UP");
  if(S.f.state && S.f.state !== "UP"){ box.innerHTML = `<p class="dnote">📍 ${t("all_districts")} — ${esc(KN_stateName(S.f.state, S.uiLang))}</p>`; return; }
  const list = KN_UP_DISTRICTS.filter(d => !q || d[0].toLowerCase().includes(q) || d[1].includes(q));
  box.innerHTML = (!q?`<button data-d="" class="${!S.f.district?"on":""}">📍 ${t("all_districts")}</button>`:"") +
    list.map(d=>`<button data-d="${esc(d[0])}" class="${S.f.district===d[0]?"on":""}">${esc(S.uiLang==="en"?d[0]:d[1])}${S.uiLang==="en"?"":` <small>${esc(d[0])}</small>`}</button>`).join("") +
    (q && !list.length ? `<p class="muted sm">—</p>` : "");
}
function openDrawer(){ $("#drawer").classList.add("open"); $("#scrim").classList.add("on"); $("#drawer").setAttribute("aria-hidden","false"); $('#topTitle').setAttribute('aria-expanded','true'); }
function closeDrawer(){ $("#drawer").classList.remove("open"); $("#scrim").classList.remove("on"); $("#drawer").setAttribute("aria-hidden","true"); $('#topTitle').setAttribute('aria-expanded','false'); }

function bindStatic(){
  $('#newNews').onclick=()=>headlinePreview(true);
  $("#btnMenu").onclick = openDrawer; $("#btnClose").onclick = closeDrawer; $("#scrim").onclick = closeDrawer;
  $("#topTitle").onclick = openDrawer;
  $("#btnAdmin2").onclick = () => { closeDrawer(); window.Admin && Admin.open(); };
  const mm = $("#moreMenu");
  $("#btnMore").onclick = e => { e.stopPropagation(); mm.hidden = !mm.hidden; if(!mm.hidden) mm.classList.remove("pop"), void mm.offsetWidth, mm.classList.add("pop"); };
  document.addEventListener("click", e => { if(!mm.hidden && !e.target.closest("#moreMenu,#btnMore")) mm.hidden = true; });
  mm.onclick = e => {
    const b = e.target.closest("button"); if(!b) return;
    if(b.dataset.nl){ S.newsLang = b.dataset.nl; S.cardLang = {}; Store.setPrefs({newsLang:S.newsLang}); }
    else if(b.dataset.ui){ S.uiLang = b.dataset.ui; window.KN_UILANG = S.uiLang; Store.setPrefs({uiLang:S.uiLang}); }
    else if(b.dataset.mm === "tour"){ mm.hidden = true; window.KNTour && KNTour.start(); return; }
    else if(b.dataset.mm === "admin"){ mm.hidden = true; window.Admin && Admin.open(); return; }
    mm.hidden = true; S.lastShown = null; renderChrome(); renderFeed();
  };
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
function closeModal(){ clearTimeout(previewTimer); const m = $("#modal"); m.classList.remove("on"); setTimeout(()=>{ m.hidden = true; $("#sheet").innerHTML = ""; }, 200); }
let tt; function toast(s){ const el = $("#toast"); el.textContent = s; el.classList.add("on"); clearTimeout(tt); tt = setTimeout(()=>el.classList.remove("on"), 2200); }

window.App = { S, openModal, closeModal, toast, refresh, renderFeed, esc, textOf, openLogin, goTop(){ S.tab="all"; S.f={vibhag:null,state:null,district:null}; S.idx=0; refresh(false); renderChrome(); } };
document.addEventListener("DOMContentLoaded", boot);
})();
