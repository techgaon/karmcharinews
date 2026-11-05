/* Karmchari News — Admin Control Center
   Unlock: Admin ID 9129203268 + PIN 6247 (checked against a SHA-256 hash in config.js). */
(function(){
const $ = (s, r=document) => r.querySelector(s);
const esc = s => App.esc(s);
const LS = KN_LS;
const L4 = [["hi","हिन्दी"],["en","English"],["aw","अवधी"],["bh","भोजपुरी"]];
const OUTLETS = ["Amar Ujala","Dainik Jagran","Hindustan","Aaj Tak","The Hindu","Times of India","Navbharat Times","Official GO","YouTube","Karmchari News"];
const DEFAULT_RSS = [
  "https://news.google.com/rss/search?q=%E0%A4%95%E0%A4%B0%E0%A5%8D%E0%A4%AE%E0%A4%9A%E0%A4%BE%E0%A4%B0%E0%A5%80+%E0%A4%89%E0%A4%A4%E0%A5%8D%E0%A4%A4%E0%A4%B0+%E0%A4%AA%E0%A5%8D%E0%A4%B0%E0%A4%A6%E0%A5%87%E0%A4%B6&hl=hi&gl=IN&ceid=IN:hi",
  "https://news.google.com/rss/search?q=%E0%A4%AA%E0%A4%82%E0%A4%9A%E0%A4%BE%E0%A4%AF%E0%A4%A4%E0%A5%80+%E0%A4%B0%E0%A4%BE%E0%A4%9C+%E0%A4%B8%E0%A4%9A%E0%A4%BF%E0%A4%B5&hl=hi&gl=IN&ceid=IN:hi",
  "https://news.google.com/rss/search?q=%E0%A4%AE%E0%A4%B9%E0%A4%82%E0%A4%97%E0%A4%BE%E0%A4%88+%E0%A4%AD%E0%A4%A4%E0%A5%8D%E0%A4%A4%E0%A4%BE+%E0%A4%95%E0%A4%B0%E0%A5%8D%E0%A4%AE%E0%A4%9A%E0%A4%BE%E0%A4%B0%E0%A5%80&hl=hi&gl=IN&ceid=IN:hi"
];

let tab = "rss", form = null, fails = 0, lockUntil = 0;

function blank(){
  return {id:"", mode:"url", input:"", file:null, vibhag:"panchayat", state:"UP", district:"All", type:"image",
    image:"", youtube:"", source:"", sourceUrl:"", isGO:false, pinned:false, icon:"📰",
    lang:{hi:{h:"",s:""}, en:{h:"",s:""}, aw:{h:"",s:""}, bh:{h:"",s:""}}};
}
async function sha256(s){
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
const unlocked = () => sessionStorage.getItem("kn_admin") === "1";

/* ---------------- login ---------------- */
function openLogin(){
  App.openModal(`<h3>🔒 Admin Login</h3>
    <p class="muted sm">Karmchari News Control Center</p>
    <label class="lbl">Admin Mobile / Login ID</label>
    <input class="inp" id="aId" inputmode="numeric" maxlength="10" placeholder="10-digit mobile" autocomplete="username">
    <label class="lbl">Secret Admin PIN</label>
    <div class="pinpad">${[0,1,2,3].map(i=>`<input class="inp pinbox" data-p="${i}" inputmode="numeric" maxlength="1" type="password" autocomplete="off">`).join("")}</div>
    <p class="muted sm" id="aErr" style="color:#b91c1c"></p>
    <button class="btn primary wide" id="aGo">Unlock Admin Dashboard</button>
    <button class="btn ghost wide" data-close>Cancel</button>`);
  const pins = [...document.querySelectorAll(".pinbox")];
  pins.forEach((p,i)=>{
    p.addEventListener("input", ()=>{ p.value = p.value.replace(/\D/g,""); if(p.value && pins[i+1]) pins[i+1].focus(); if(i===3 && p.value) tryLogin(); });
    p.addEventListener("keydown", e=>{ if(e.key==="Backspace" && !p.value && pins[i-1]) pins[i-1].focus(); });
  });
  $("#aId").addEventListener("input", e=>{ e.target.value = e.target.value.replace(/\D/g,""); if(e.target.value.length===10) pins[0].focus(); });
  $("#aGo").onclick = tryLogin;
  setTimeout(()=>$("#aId").focus(), 250);
}
async function tryLogin(){
  const err = $("#aErr");
  if(Date.now() < lockUntil){ err.textContent = "Too many attempts. Wait " + Math.ceil((lockUntil-Date.now())/1000) + " s."; return; }
  const id = $("#aId").value.trim(), pin = [...document.querySelectorAll(".pinbox")].map(p=>p.value).join("");
  if(id.length !== 10 || pin.length !== 4){ err.textContent = "Enter the 10-digit ID and 4-digit PIN."; return; }
  if(await sha256(id+":"+pin) === KN_CONFIG.adminHash){
    sessionStorage.setItem("kn_admin","1"); fails = 0; App.closeModal(); setTimeout(openPanel, 230);
  } else {
    fails++; if(fails >= 5){ lockUntil = Date.now() + 60000; fails = 0; }
    err.textContent = "Wrong ID or PIN."; document.querySelectorAll(".pinbox").forEach(p=>p.value=""); document.querySelector(".pinbox").focus();
  }
}

/* ---------------- panel ---------------- */
function openPanel(){
  if(!form) form = blank();
  App.openModal(`<div class="adm">
    <div class="adm-top"><span style="font-size:20px">🛡️</span><b>Karmchari News — Admin</b>
      <button class="btn sm ghost" id="admLogout">Lock</button><button class="ic" data-close style="color:#fff">✕</button></div>
    <div class="adm-tabs" id="admTabs">
      ${[["rss","🤖 AI Auto"],["stats","📊 Visitors"],["manage","🗂️ Manage"],["publish","✨ Manual"],["settings","⚙️ Settings"]].map(([k,l])=>`<button data-at="${k}" class="${tab===k?"on":""}">${l}</button>`).join("")}
    </div>
    <div class="adm-body" id="admBody"></div></div>`, "full");
  $("#admTabs").onclick = e => { const b = e.target.closest("[data-at]"); if(!b) return; tab = b.dataset.at; document.querySelectorAll("#admTabs button").forEach(x=>x.classList.toggle("on", x===b)); renderTab(); };
  $("#admLogout").onclick = () => { sessionStorage.removeItem("kn_admin"); App.closeModal(); App.toast("Admin locked"); };
  renderTab();
}
function renderTab(){ ({publish:renderPublish, manage:renderManage, rss:renderRss, settings:renderSettings, stats:renderStats})[tab](); }

/* ---------- Publish ---------- */
function opt(list, val){ return list.map(([v,l])=>`<option value="${esc(v)}" ${v===val?"selected":""}>${esc(l)}</option>`).join(""); }
function renderPublish(){
  const f = form, aiOn = !!AI.key();
  const liveWarn = Store.live && !Store.isAdminEmail() ? `<p class="note">Live mode: to publish for everyone, also sign in with an admin Google account (${esc(KN_CONFIG.adminEmails.join(", "))}).</p>` : "";
  $("#admBody").innerHTML = `${liveWarn}
  ${f.id?`<p class="note">✏️ Editing: <b>${esc(f.lang.hi.h||f.lang.en.h)}</b> <button class="btn sm ghost" id="newBtn">+ New instead</button></p>`:""}
  <h3>1 · Source</h3>
  <div class="seg" id="modeSeg">${[["url","🔗 News URL"],["youtube","▶️ YouTube"],["text","📝 Raw text"],["file","📄 GO PDF / Image"]].map(([k,l])=>`<button data-m="${k}" class="${f.mode===k?"on":""}">${l}</button>`).join("")}</div>
  <div id="srcBox"></div>
  <button class="btn saffron wide" id="genBtn">✨ Generate 100-Word Summary in 4 Languages</button>
  <p class="muted sm">${aiOn?`AI: Google Gemini (${esc(AI.model())})`:`⚠️ No AI key yet → offline mode (extracts 100 words from pasted text; translations to be filled by hand). Add a free Gemini key in ⚙️ Settings for full 4-language AI.`}</p>
  <div class="ai-progress" id="aiProg"></div>

  <h3 style="margin-top:18px">2 · Headline & 100-word summaries</h3>
  ${L4.map(([l,name])=>`<div class="lang-ed"><div class="lh"><span>${name}</span><span class="wc" id="wc_${l}"></span></div>
    <label class="lbl">Headline</label><input class="inp" data-h="${l}" value="${esc(f.lang[l].h)}">
    <label class="lbl">Summary (exactly ${KN_CONFIG.summaryWords} words)</label><textarea class="inp" rows="6" data-s="${l}">${esc(f.lang[l].s)}</textarea>
    <button class="btn sm ghost" data-trim="${l}">✂️ Trim to ${KN_CONFIG.summaryWords}</button></div>`).join("")}

  <h3 style="margin-top:18px">3 · Category & Geo tagging</h3>
  <label class="lbl">Vibhag</label><select class="inp" id="fV">${opt(KN_VIBHAG.map(v=>[v.id, v.n[1]+" — "+v.n[0]]), f.vibhag)}</select>
  <div class="row"><div><label class="lbl">State</label><select class="inp" id="fS">${opt(KN_STATES.map(s=>[s.id, s.n[1]+" / "+s.n[0]]), f.state)}</select></div>
  <div><label class="lbl">District</label><select class="inp" id="fD">${opt([["All","All Districts / सभी ज़िले"]].concat(KN_UP_DISTRICTS.map(d=>[d[0], d[1]+" / "+d[0]])), f.district)}</select></div></div>
  <label class="lbl">Media type</label>
  <div class="seg" id="typeSeg"><button data-t="image" class="${f.type==="image"?"on":""}">🖼️ Article Image</button><button data-t="video" class="${f.type==="video"?"on":""}">▶️ YouTube Video</button></div>
  <div id="mediaBox"></div>
  <label class="lbl">Card icon (shown on auto artwork)</label>
  <div class="seg" id="iconSeg">${["📰","🏛️","📚","📜","👮","🩺","💰","🧾","📄","🏡","🎬","⚡"].map(i=>`<button data-ic="${i}" class="${f.icon===i?"on":""}">${i}</button>`).join("")}</div>

  <h3 style="margin-top:18px">4 · Source attribution</h3>
  <label class="lbl">Source name</label><input class="inp" id="fSrc" list="outlets" value="${esc(f.source)}" placeholder="Amar Ujala / Official GO / YouTube…"><datalist id="outlets">${OUTLETS.map(o=>`<option value="${o}">`).join("")}</datalist>
  <label class="lbl">Original source URL</label><input class="inp" id="fUrl" value="${esc(f.sourceUrl)}" placeholder="https://…">
  <label class="switch"><span>📄 This is a Shasanadesh (GO)</span><input type="checkbox" id="fGO" ${f.isGO?"checked":""}></label>
  <label class="switch"><span>⚡ Pin as Breaking / Top GO (top of feed)</span><input type="checkbox" id="fPin" ${f.pinned?"checked":""}></label>
  <button class="btn primary wide" id="pubBtn" style="margin-top:16px;padding:14px">🚀 ${f.id?"Update story":"Publish to feed"}</button>`;
  renderSrcBox(); renderMediaBox(); updateWC();
  const nb = $("#newBtn"); if(nb) nb.onclick = () => { form = blank(); renderPublish(); };
  $("#modeSeg").onclick = e => { const b = e.target.closest("[data-m]"); if(!b) return; syncForm(); f.mode = b.dataset.m; if(f.mode==="youtube") f.type="video"; renderPublish(); };
  $("#typeSeg").onclick = e => { const b = e.target.closest("[data-t]"); if(!b) return; syncForm(); f.type = b.dataset.t; renderPublish(); };
  $("#iconSeg").onclick = e => { const b = e.target.closest("[data-ic]"); if(!b) return; f.icon = b.dataset.ic; document.querySelectorAll("#iconSeg button").forEach(x=>x.classList.toggle("on", x===b)); };
  $("#admBody").addEventListener("input", e => { if(e.target.dataset.s || e.target.dataset.h) updateWC(); });
  document.querySelectorAll("[data-trim]").forEach(b => b.onclick = () => { const ta = document.querySelector(`[data-s="${b.dataset.trim}"]`); ta.value = AI.fit(ta.value); updateWC(); });
  $("#genBtn").onclick = generate;
  $("#pubBtn").onclick = publish;
}
function renderSrcBox(){
  const f = form, box = $("#srcBox");
  if(f.mode === "file"){
    box.innerHTML = `<label class="drop ${f.file?"has":""}" id="dropL">${f.file?`✅ ${esc(f.file.name)} (${Math.round(f.file.size/1024)} KB)`:"📄 Tap to upload GO — PDF or photo (max 15 MB)"}<input type="file" id="fFile" accept="application/pdf,image/*" hidden></label>
      <label class="lbl">Extra notes / text from the GO (optional)</label><textarea class="inp" id="fIn" rows="3" placeholder="GO number, date, key points…">${esc(f.input)}</textarea>`;
    $("#fFile").onchange = async e => {
      const file = e.target.files[0]; if(!file) return;
      if(file.size > 15*1024*1024){ App.toast("File too large (max 15 MB)"); return; }
      const b64 = await new Promise(r=>{ const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(file); });
      f.file = {name:file.name, size:file.size, mime:file.type||"application/pdf", b64};
      if(file.type.startsWith("image/") && !f.image){ f.image = await compress(file); }
      f.isGO = true; if(!f.source) f.source = "Official GO";
      syncForm(); renderPublish();
    };
  } else {
    const ph = {url:"Paste news article URL (Amar Ujala, Jagran, Aaj Tak…)", youtube:"Paste YouTube video link", text:"Paste raw news text here (Hindi or English)…"}[f.mode];
    box.innerHTML = f.mode === "text" ? `<textarea class="inp" id="fIn" rows="6" placeholder="${ph}">${esc(f.input)}</textarea>`
      : `<input class="inp" id="fIn" value="${esc(f.input)}" placeholder="${ph}">
         <label class="lbl">Optional: paste article text too (helps offline mode & paywalled sites)</label><textarea class="inp" id="fExtra" rows="3">${esc(f.extra||"")}</textarea>`;
  }
}
function renderMediaBox(){
  const f = form, box = $("#mediaBox");
  if(f.type === "video"){
    box.innerHTML = `<label class="lbl">YouTube link</label><input class="inp" id="fYt" value="${esc(f.youtube || (f.mode==="youtube"?f.input:""))}" placeholder="https://youtu.be/…">`;
  } else {
    box.innerHTML = `<label class="lbl">News image</label>
      <div class="row"><label class="btn ghost">📷 Camera / Gallery<input type="file" id="fImg" accept="image/*" hidden></label>${f.image?`<button class="btn danger" id="rmImg">Remove</button>`:""}</div>
      ${f.image?`<img src="${esc(f.image)}" style="width:100%;border-radius:12px;margin-top:8px;max-height:180px;object-fit:cover">`:""}
      <label class="lbl">…or image URL</label><input class="inp" id="fImgUrl" value="${f.image&&!f.image.startsWith("data:")?esc(f.image):""}" placeholder="https://…jpg  (blank = auto artwork)">`;
    $("#fImg").onchange = async e => { const file = e.target.files[0]; if(!file) return; syncForm(); f.image = await compress(file); renderPublish(); };
    const rm = $("#rmImg"); if(rm) rm.onclick = () => { syncForm(); f.image = ""; renderPublish(); };
  }
}
function syncForm(){
  const f = form, v = id => { const el = $(id); return el ? el.value : undefined; };
  if($("#fIn")) f.input = v("#fIn");
  if($("#fExtra")) f.extra = v("#fExtra");
  if($("#fV")) f.vibhag = v("#fV"); if($("#fS")) f.state = v("#fS"); if($("#fD")) f.district = v("#fD");
  if($("#fSrc")) f.source = v("#fSrc").trim(); if($("#fUrl")) f.sourceUrl = v("#fUrl").trim();
  if($("#fGO")) f.isGO = $("#fGO").checked; if($("#fPin")) f.pinned = $("#fPin").checked;
  if($("#fYt")) f.youtube = v("#fYt").trim();
  if($("#fImgUrl") && v("#fImgUrl").trim()) f.image = v("#fImgUrl").trim();
  L4.forEach(([l])=>{ const h = document.querySelector(`[data-h="${l}"]`), s = document.querySelector(`[data-s="${l}"]`); if(h) f.lang[l].h = h.value.trim(); if(s) f.lang[l].s = s.value.trim(); });
}
function updateWC(){
  L4.forEach(([l])=>{ const s = document.querySelector(`[data-s="${l}"]`), b = $("#wc_"+l); if(!s||!b) return; const n = AI.wc(s.value); b.textContent = n + " / " + KN_CONFIG.summaryWords + " words"; b.classList.toggle("bad", n !== KN_CONFIG.summaryWords); });
}
async function generate(){
  syncForm();
  const f = form, prog = $("#aiProg"), btn = $("#genBtn");
  const src = {};
  if(f.mode === "url"){ if(!/^https?:\/\//.test(f.input) && !f.extra) return App.toast("Paste a news URL"); src.url = f.input; src.text = f.extra; if(!f.sourceUrl) f.sourceUrl = f.input; if(!f.source) f.source = guessOutlet(f.input); }
  if(f.mode === "youtube"){ if(!AI.ytId(f.input)) return App.toast("Paste a valid YouTube link"); src.youtube = "https://www.youtube.com/watch?v=" + AI.ytId(f.input); src.text = f.extra; f.type = "video"; f.youtube = f.input; if(!f.sourceUrl) f.sourceUrl = f.input; if(!f.source) f.source = "YouTube"; f.icon = "🎬"; }
  if(f.mode === "text"){ if(AI.wc(f.input) < 15) return App.toast("Paste at least a few lines of text"); src.text = f.input; }
  if(f.mode === "file"){ if(!f.file && !f.input) return App.toast("Upload the GO file first"); if(f.file) src.file = f.file; src.text = f.input; }
  if(!AI.key() && !src.text){ App.toast("Offline mode needs pasted text — or add a Gemini key in Settings"); return; }
  const steps = ["📥 Reading source", "🧠 Understanding the story", "✍️ Writing Hindi + English", "🗣️ Writing Awadhi + Bhojpuri", "🔢 Fitting exactly 100 words"];
  prog.innerHTML = steps.map(s=>`<div>${s}</div>`).join("");
  const rows = [...prog.children]; let k = 0;
  const tick = setInterval(()=>{ if(k < rows.length-1){ rows[k].className = "done"; rows[k].textContent += " ✓"; k++; rows[k].className = "run"; } }, 1300);
  rows[0].className = "run"; btn.disabled = true;
  try{
    const out = await AI.generate(src);
    L4.forEach(([l])=>{ if(out[l]) f.lang[l] = {h:(out[l].h||"").trim(), s:(out[l].s||"").trim()}; });
    if(out.vibhag && KN_VIBHAG.find(v=>v.id===out.vibhag)) f.vibhag = out.vibhag;
    if(out.state && KN_STATES.find(s=>s.id===out.state)) f.state = out.state;
    if(out.district && (out.district==="All" || KN_UP_DISTRICTS.find(d=>d[0]===out.district))) f.district = out.district;
    if(out.isGO) f.isGO = true; if(out.sourceName && !f.source) f.source = out.sourceName;
    f.icon = f.type==="video" ? "🎬" : ({panchayat:"🏛️",shiksha:"📚",revenue:"📜",police:"👮",health:"🩺",finance:"💰",all:"📰"})[f.vibhag];
    clearInterval(tick); rows.forEach(r=>{ r.className="done"; if(!r.textContent.endsWith("✓")) r.textContent += " ✓"; });
    App.toast(out._offline ? "Offline draft ready — please complete the translations" : "✨ 4-language summary ready — review & publish");
    const keep = prog.innerHTML; renderPublish(); $("#aiProg").innerHTML = keep;
  }catch(e){
    clearInterval(tick); rows[k].className = ""; rows[k].textContent += " ✗";
    prog.insertAdjacentHTML("beforeend", `<div style="background:#fee2e2;color:#991b1b">AI error: ${esc(e.message)}</div>`);
  }finally{ btn.disabled = false; }
}
function guessOutlet(u){
  const m = {"amarujala":"Amar Ujala","jagran":"Dainik Jagran","livehindustan":"Hindustan","aajtak":"Aaj Tak","thehindu":"The Hindu","timesofindia":"Times of India","navbharattimes":"Navbharat Times","bhaskar":"Dainik Bhaskar","ndtv":"NDTV","youtube":"YouTube","youtu.be":"YouTube"};
  for(const k in m) if(String(u).includes(k)) return m[k];
  try{ return new URL(u).hostname.replace(/^www\./,""); }catch(e){ return ""; }
}
async function publish(){
  syncForm();
  const f = form, N = KN_CONFIG.summaryWords;
  if(!f.lang.hi.h || !f.lang.hi.s) return App.toast("Hindi headline and summary are required");
  const bad = L4.filter(([l])=>f.lang[l].s && AI.wc(f.lang[l].s) > N).map(x=>x[1]);
  if(bad.length) return App.toast("Over " + N + " words: " + bad.join(", ") + " — use ✂️ Trim");
  if(Store.live && !Store.isAdminEmail()){ App.toast("Sign in with the admin Google account to publish live"); return; }
  if(f.type === "video" && !AI.ytId(f.youtube) && !AI.ytId(f.sourceUrl)) return App.toast("Add the YouTube link");
  const lang = {}; L4.forEach(([l])=>{ if(f.lang[l].s && !/^\[/.test(f.lang[l].s)) lang[l] = {h: f.lang[l].h || f.lang.hi.h, s: f.lang[l].s}; });
  const old = f.id && Store.news.find(n=>n.id===f.id);
  const n = {id: f.id || ("n" + Date.now().toString(36)), vibhag:f.vibhag, state:f.state, district:f.district, type:f.type,
    image: f.type==="image" ? f.image : "", youtube: f.type==="video" ? (f.youtube || f.sourceUrl) : "", icon:f.icon,
    source: f.source || "Karmchari News", sourceUrl: f.sourceUrl, isGO:f.isGO, pinned:f.pinned, isDemo: !!(old && old.isDemo),
    ts: old ? old.ts : new Date().toISOString(), lang};
  try{ await Store.saveNews(n); }catch(e){ return App.toast("Save failed: " + e.message); }
  App.toast(f.id ? "✅ Story updated" : "✅ Published — now at the top of the feed");
  form = blank(); App.closeModal(); setTimeout(()=>{ App.goTop(); if(!n.pinned){ const i = App.S.list.findIndex(x=>x.id===n.id); if(i>=0){ App.S.idx = i; App.renderFeed(); } } }, 250);
}
function compress(file){
  return new Promise(res=>{
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width, h = img.height, max = 960; if(w > max){ h = h*max/w; w = max; }
      const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h);
      let q = .82, d = c.toDataURL("image/jpeg", q); while(d.length > 270000 && q > .4){ q -= .08; d = c.toDataURL("image/jpeg", q); }
      URL.revokeObjectURL(url); res(d);
    };
    img.onerror = () => res(""); img.src = url;
  });
}

/* ---------- Manage ---------- */
function renderManage(){
  const list = Store.news;
  $("#admBody").innerHTML = `<label class="switch"><span>Hide the 10 DEMO cards from the feed</span><input type="checkbox" id="hideDemo" ${Store.cfg.hideDemo?"checked":""}></label>
    <p class="muted sm">${list.length} stories in feed. ✏️ edit · ⚡ pin as Breaking · 🗑 delete (tap twice).</p>
    ${list.map(n=>{ const tx = App.textOf(n,"hi"); return `<div class="list-item" data-id="${esc(n.id)}">
      <div class="li-t">${n.pinned?"⚡ ":""}${n.ai?"🤖 ":""}${n.isGO?"📄 ":""}${esc(tx.h)}<small>${esc(KN_vName(n.vibhag,"en",true))} · ${esc(n.district==="All"?n.state:n.district)} · ${esc(n.source||"")}${n.isDemo?" · DEMO":""} · ${new Date(n.ts).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</small></div>
      <div class="li-acts"><button class="btn sm ghost" data-e="edit">✏️</button><button class="btn sm ${n.pinned?"saffron":"ghost"}" data-e="pin">⚡</button><button class="btn sm danger" data-e="del">🗑</button></div></div>`; }).join("")}`;
  $("#hideDemo").onchange = e => { (Store.live ? Store.saveCfgLive({hideDemo:e.target.checked}) : Promise.resolve(Store.setCfg({hideDemo:e.target.checked}))).then(renderManage); };
  $("#admBody").onclick = async e => {
    const b = e.target.closest("[data-e]"); if(!b) return;
    const id = b.closest("[data-id]").dataset.id, n = Store.news.find(x=>x.id===id); if(!n) return;
    if(b.dataset.e === "edit"){ form = Object.assign(blank(), JSON.parse(JSON.stringify(n)), {mode:"text", input:""}); L4.forEach(([l])=>{ form.lang[l] = form.lang[l] || {h:"",s:""}; }); tab = "publish"; openPanel(); }
    if(b.dataset.e === "pin"){ await Store.saveNews(Object.assign({}, n, {pinned: !n.pinned})); App.toast(n.pinned ? "Unpinned" : "⚡ Pinned to top"); renderManage(); }
    if(b.dataset.e === "del"){
      if(b.dataset.sure){ await Store.deleteNews(id); App.toast("Deleted"); renderManage(); }
      else { b.dataset.sure = "1"; b.textContent = "Sure?"; setTimeout(()=>{ if(b.isConnected){ delete b.dataset.sure; b.textContent = "🗑"; } }, 3000); }
    }
  };
}

/* ---------- Auto-Feed / RSS ---------- */
function rssCfg(){ return Object.assign({on:false, feeds:DEFAULT_RSS, proxy:"", every:30}, LS.get("kn_rss", {})); }
function renderRss(){
  const c = rssCfg(), drafts = LS.get("kn_drafts", []);
  const autoOn = Store.cfg.autoPublish !== false, autoCount = Store.news.filter(n=>n.auto).length;
  $("#admBody").innerHTML = `<h3>🤖 AI Auto-Publish (server)</h3>
  <label class="switch"><span><b>${autoOn?"🟢 ON":"⏸️ PAUSED"}</b> — every 30 min the AI bot reads Google News, keeps only employee news it could verify, writes 100 words in 4 languages and publishes it. ${autoCount} AI stories in feed now.<br><small class="muted">Runs on GitHub Actions (bot/ folder). Pausing needs the admin Google account signed in.</small></span><input type="checkbox" id="autoOn" ${autoOn?"checked":""}></label>
  <label class="lbl">▶️ Extra YouTube channels for the AI (one per line: @handle or channel ID UC…)</label>
  <textarea class="inp" id="ytCh" rows="3" placeholder="@GYANGANV">${esc((Store.cfg.youtubeChannels||[]).join("\n"))}</textarea>
  <p class="muted sm">Built in: GyanGanv का सचिव, Govt Employees Times, Govt Staff News, GOVERNMENT STAFF, P N News 51. The AI watches new videos, skips rumours/"DA बढ़ेगा?" type videos, and publishes only confirmed news as video cards.</p>
  <button class="btn primary wide" id="ytSave">Save YouTube channels</button>
  <h3 style="margin-top:16px">Manual RSS drafts (optional)</h3>
  <label class="switch"><span>📡 Auto-fetch from Google News RSS / portal feeds<br><small class="muted">Runs every ${c.every} min while the admin panel/app is open; new items land in the Draft queue below for 1-tap AI publish.</small></span><input type="checkbox" id="rssOn" ${c.on?"checked":""}></label>
  <label class="lbl">Feed URLs (one per line)</label><textarea class="inp" id="rssFeeds" rows="5">${esc(c.feeds.join("\n"))}</textarea>
  <label class="lbl">CORS proxy prefix (needed in browser, e.g. your own Cloudflare Worker) — optional</label><input class="inp" id="rssProxy" value="${esc(c.proxy)}" placeholder="https://your-worker.workers.dev/?url=">
  <p class="note">Browsers block reading Google News directly (CORS). For fully automatic 24×7 fetching, deploy the small server function described in README → "Auto-Feed server". The toggle and queue here are ready for it.</p>
  <div class="row"><button class="btn primary" id="rssSave">Save</button><button class="btn saffron" id="rssNow">Fetch now</button></div>
  <p class="muted sm" id="rssMsg"></p>
  <h3 style="margin-top:16px">Draft queue (${drafts.length})</h3>
  ${drafts.map((d,i)=>`<div class="list-item"><div class="li-t">${esc(d.title)}<small>${esc(d.source||"")} · ${esc(d.date||"")}</small></div><div class="li-acts"><button class="btn sm saffron" data-use="${i}">✨ Use</button><button class="btn sm danger" data-drop="${i}">✕</button></div></div>`).join("") || `<p class="muted sm">No drafts yet.</p>`}`;
  const save = () => { const n = {on:$("#rssOn").checked, feeds:$("#rssFeeds").value.split("\n").map(s=>s.trim()).filter(Boolean), proxy:$("#rssProxy").value.trim(), every:c.every}; LS.set("kn_rss", n); Store.setCfg({rssOn:n.on}); schedule(); return n; };
  $("#rssSave").onclick = () => { save(); App.toast("Saved"); };
  $("#rssOn").onchange = save;
  $("#ytSave").onclick = async () => {
    if(Store.live && !Store.isAdminEmail()){ App.toast("Sign in with the admin Google account first"); return; }
    const list = $("#ytCh").value.split("\n").map(x=>x.trim()).filter(x=>/^@[\w.-]{3,}$|^UC[\w-]{22}$/.test(x));
    try{ await Store.saveCfgLive({youtubeChannels: list}); App.toast(list.length + " channel(s) saved"); renderRss(); }catch(err){ App.toast("Failed: " + err.message); }
  };
  $("#autoOn").onchange = async e => {
    if(Store.live && !Store.isAdminEmail()){ App.toast("Sign in with the admin Google account first"); e.target.checked = !e.target.checked; return; }
    try{ await Store.saveCfgLive({autoPublish: e.target.checked}); App.toast(e.target.checked ? "AI auto-publish ON" : "AI auto-publish PAUSED"); renderRss(); }
    catch(err){ App.toast("Failed: " + err.message); e.target.checked = !e.target.checked; }
  };
  $("#rssNow").onclick = async () => { save(); $("#rssMsg").textContent = "Fetching…"; const r = await fetchRss(); $("#rssMsg").textContent = r; renderRss(); };
  $("#admBody").querySelectorAll("[data-use]").forEach(b => b.onclick = () => {
    const d = LS.get("kn_drafts", [])[+b.dataset.use];
    form = blank(); form.mode = "url"; form.input = d.link; form.extra = d.title + ". " + (d.desc||""); form.sourceUrl = d.link; form.source = d.source || "";
    tab = "publish"; openPanel();
  });
  $("#admBody").querySelectorAll("[data-drop]").forEach(b => b.onclick = () => { const l = LS.get("kn_drafts", []); l.splice(+b.dataset.drop, 1); LS.set("kn_drafts", l); renderRss(); });
}
async function fetchRss(){
  const c = rssCfg(); let got = 0, errs = 0;
  const drafts = LS.get("kn_drafts", []), seen = new Set(drafts.map(d=>d.link).concat(Store.news.map(n=>n.sourceUrl)));
  for(const u of c.feeds){
    try{
      const r = await fetch((c.proxy ? c.proxy + encodeURIComponent(u) : u)); if(!r.ok) throw 0;
      const xml = new DOMParser().parseFromString(await r.text(), "text/xml");
      xml.querySelectorAll("item").forEach(it => {
        const link = it.querySelector("link")?.textContent || ""; if(!link || seen.has(link)) return; seen.add(link);
        const tmp = document.createElement("div"); tmp.innerHTML = it.querySelector("description")?.textContent || "";
        drafts.unshift({title: it.querySelector("title")?.textContent || "", link, desc: tmp.textContent.slice(0,600), source: it.querySelector("source")?.textContent || "", date: it.querySelector("pubDate")?.textContent || ""}); got++;
      });
    }catch(e){ errs++; }
  }
  LS.set("kn_drafts", drafts.slice(0, 60));
  return errs === c.feeds.length ? "Could not read the feeds from the browser (CORS). Add a proxy prefix or use the server function." : `${got} new item(s) added to the Draft queue.`;
}
let timer = null;
function schedule(){ clearInterval(timer); const c = rssCfg(); if(c.on && unlocked()) timer = setInterval(fetchRss, c.every*60000); }

/* ---------- Visitors (only admin can read knStats) ---------- */
async function renderStats(){
  const box = $("#admBody");
  if(!Store.live){ box.innerHTML = `<p class="note">Visitor counter works only in LIVE mode.</p>`; return; }
  box.innerHTML = `<p class="muted">⏳ Loading visitors…</p>`;
  let rows;
  try{ rows = await Store.visitStats(30); }
  catch(e){ box.innerHTML = `<p class="note">🔒 Visitor numbers are visible only when you are signed in with the admin Google account (${esc(KN_CONFIG.adminEmails[0])}).<br><small>${esc(e.message||"")}</small></p>`; return; }
  const tot = rows[0], days = rows.slice(1), today = days[0], yest = days[1];
  const sum = (a, k) => a.reduce((x, r) => x + r[k], 0), w7 = days.slice(0, 7), max = Math.max(1, ...days.slice(0, 14).map(r => r.v));
  const fmt = n => n.toLocaleString("en-IN"), dl = id => { const d = new Date(id.slice(1) + "T00:00:00"); return d.toLocaleDateString("hi-IN", {day:"numeric", month:"short"}); };
  box.innerHTML = `<div class="vstat">
    <div class="vs big"><small>आज (Today)</small><b>${fmt(today.u)}</b><span>visitors · ${fmt(today.v)} visits</span></div>
    <div class="vs"><small>कल</small><b>${fmt(yest.u)}</b><span>${fmt(yest.v)} visits</span></div>
    <div class="vs"><small>पिछले 7 दिन</small><b>${fmt(sum(w7, "u"))}</b><span>${fmt(sum(w7, "v"))} visits</span></div>
    <div class="vs"><small>पिछले 30 दिन</small><b>${fmt(sum(days, "u"))}</b><span>${fmt(sum(days, "v"))} visits</span></div>
    <div class="vs"><small>कुल (All time)</small><b>${fmt(tot.u)}</b><span>${fmt(tot.v)} visits</span></div>
  </div>
  <h3 style="margin-top:16px">पिछले 14 दिन</h3>
  <div class="vbars">${days.slice(0, 14).reverse().map(r => `<div class="vb"><i style="height:${Math.round(r.v / max * 100)}%"><em>${r.v || ""}</em></i><small>${dl(r.id)}</small></div>`).join("")}</div>
  <p class="muted sm">Visitor = एक मोबाइल/ब्राउज़र दिन में एक बार गिना जाता है। Visits = ऐप कितनी बार खोला गया। आपकी अपनी admin visits नहीं गिनी जातीं (admin लॉगिन के बाद)। यह गिनती सिर्फ़ इस admin पैनल में दिखती है।</p>
  <button class="btn ghost wide" id="vsR">🔄 Refresh</button>`;
  $("#vsR").onclick = renderStats;
}

/* ---------- Settings ---------- */
function renderSettings(){
  const a = LS.get("kn_admin_ai", {});
  $("#admBody").innerHTML = `<h3>AI engine</h3>
  <p class="muted sm">Get a free key at <b>aistudio.google.com → Get API key</b>. It is stored only on this device, never in the app code.</p>
  <label class="lbl">Google Gemini API key</label><input class="inp" id="gKey" type="password" value="${esc(a.key||"")}" placeholder="AIza…">
  <label class="lbl">Model</label><input class="inp" id="gModel" value="${esc(a.model||KN_CONFIG.geminiModel)}">
  <div class="row"><button class="btn primary" id="gSave">Save</button><button class="btn ghost" id="gTest">Test AI</button></div>
  <p class="muted sm" id="gMsg"></p>
  <h3 style="margin-top:18px">Mode</h3>
  <p class="note">${Store.live ? "🟢 LIVE: Firebase connected — Google login is real and published news is shared with every reader." : "🟡 PREVIEW: Firebase not configured — Google login is simulated and published news is saved on this device only. Fill js/config.js → firebase to go live (README)."}</p>
  <h3 style="margin-top:18px">Data</h3>
  <button class="btn ghost wide" id="exp">⬇️ Export all stories (JSON backup)</button>
  <label class="btn ghost wide">⬆️ Import stories (JSON)<input type="file" id="imp" accept="application/json" hidden></label>`;
  $("#gSave").onclick = () => { LS.set("kn_admin_ai", {key:$("#gKey").value.trim(), model:$("#gModel").value.trim()}); App.toast("Saved"); };
  $("#gTest").onclick = async () => {
    LS.set("kn_admin_ai", {key:$("#gKey").value.trim(), model:$("#gModel").value.trim()});
    $("#gMsg").textContent = "Testing…";
    try{ const o = await AI.generate({text:"बाराबंकी में ग्राम पंचायत सचिवों की बैठक हुई जिसमें ई-ग्राम स्वराज पर भुगतान समय से करने और कार्ययोजना अपलोड करने के निर्देश दिए गए। अधिकारियों ने कहा कि लंबित भुगतान इसी सप्ताह पूरे हों।"}); $("#gMsg").textContent = o._offline ? "No key — offline mode" : "✅ Working: " + o.hi.h; }
    catch(e){ $("#gMsg").textContent = "❌ " + e.message; }
  };
  $("#exp").onclick = () => { const b = new Blob([JSON.stringify(Store.news.filter(n=>!n.isDemo), null, 1)], {type:"application/json"}); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "karmchari-news-backup.json"; a.click(); };
  $("#imp").onchange = async e => { try{ const l = JSON.parse(await e.target.files[0].text()); for(const n of l) await Store.saveNews(n); App.toast(l.length + " stories imported"); }catch(err){ App.toast("Import failed"); } };
}

window.Admin = { open(){ unlocked() ? openPanel() : openLogin(); } };
document.addEventListener("DOMContentLoaded", schedule);
})();
