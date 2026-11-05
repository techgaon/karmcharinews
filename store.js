/* Storage + auth adapter.
   PREVIEW mode (no Firebase config): everything in localStorage on this device,
   Google sign-in is simulated.  LIVE mode: Firebase Auth (Google) + Firestore. */
(function(){
const C = window.KN_CONFIG;
const LIVE = !!(C.firebase && C.firebase.apiKey);
const LS = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v==null? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){ console.warn("storage full?", e); } }
};

const Store = {
  live: LIVE, user: null, news: [], cfg: {hideDemo:false, rssOn:false, rssFeeds:[]},
  _newsCbs: [], _userCbs: [], _db: null, _auth: null,

  async init(){
    this.cfg = Object.assign(this.cfg, LS.get("kn_cfg", {}));
    if(LIVE){
      try { await this._initFirebase(); this.countVisit(); return; }
      catch(e){ console.error("Firebase failed, falling back to preview", e); this.live = false; }
    }
    this.user = LS.get("kn_user", null);
    this._emitUser();
    this._emitNews();
  },

  /* ---------- news ---------- */
  _localNews(){ return LS.get("kn_news", []); },
  _merge(list){
    // demo cards: hidden by admin switch, or automatically once the live feed has real stories
    const seed = (this.cfg.hideDemo || (this.live && list.length >= 3)) ? [] : (window.KN_SEED||[]);
    const over = LS.get("kn_seed_over", {});          // admin edits/deletes of demo cards (preview)
    const seeds = seed.filter(s=>!(over[s.id]&&over[s.id].deleted)).map(s=> over[s.id]? Object.assign({}, s, over[s.id]) : s);
    const all = list.concat(seeds.filter(s=>!list.find(n=>n.id===s.id)));
    all.sort((a,b)=> (b.pinned?1:0)-(a.pinned?1:0) || KN_time(b)-KN_time(a));
    return all;
  },
  onNews(cb){ this._newsCbs.push(cb); if(this.news.length) cb(this.news); },
  _emitNews(list){
    this.news = this._merge(list || (this.live ? this._liveList||[] : this._localNews()));
    this._newsCbs.forEach(cb=>cb(this.news));
  },
  async saveNews(n){
    n.ts = n.ts || new Date().toISOString();
    if(n.pinned) this.news.filter(x=>x.pinned && x.id!==n.id).forEach(x=>this._setPin(x,false));
    if(n.isDemo && String(n.id).startsWith("d")){ const o = LS.get("kn_seed_over",{}); o[n.id] = n; LS.set("kn_seed_over", o); }
    else if(this.live){ await this._db.collection("knNews").doc(n.id).set(JSON.parse(JSON.stringify(n))); }
    else { const l = this._localNews().filter(x=>x.id!==n.id); l.unshift(n); LS.set("kn_news", l); }
    if(!this.live || n.isDemo) this._emitNews();
  },
  async _setPin(n, v){ const c = Object.assign({}, n, {pinned:v}); await this.saveNews(c); },
  async deleteNews(id){
    const n = this.news.find(x=>x.id===id);
    if(n && n.isDemo){ const o = LS.get("kn_seed_over",{}); o[id] = {deleted:true}; LS.set("kn_seed_over", o); }
    else if(this.live){ await this._db.collection("knNews").doc(id).delete(); }
    else LS.set("kn_news", this._localNews().filter(x=>x.id!==id));
    this._emitNews();
  },
  setCfg(p){ Object.assign(this.cfg, p); LS.set("kn_cfg", this.cfg); this._emitNews(); },

  /* ---------- users ---------- */
  onUser(cb){ this._userCbs.push(cb); cb(this.user); },
  _emitUser(){ this._userCbs.forEach(cb=>cb(this.user)); },
  async signInGoogle(simName, simEmail){
    if(this.live){
      const prov = new firebase.auth.GoogleAuthProvider();
      await this._auth.signInWithPopup(prov);
      return;
    }
    const email = (simEmail||"").trim().toLowerCase();
    this.user = { uid: "sim_" + (email || Date.now()), name: simName || "Reader", email, photo: "", simulated: true };
    LS.set("kn_user", this.user); this._emitUser();
  },
  async signOut(){
    if(this.live) await this._auth.signOut();
    this.user = null; LS.set("kn_user", null); this._emitUser();
  },
  prefs(){
    const base = {bookmarks:[], myFeed:null, newsLang:null, uiLang:null};
    if(!this.user) return Object.assign(base, LS.get("kn_guest", {}));
    return Object.assign(base, LS.get("kn_u_"+this.user.uid, {}));
  },
  async setPrefs(p){
    const cur = Object.assign(this.prefs(), p);
    if(!this.user){ LS.set("kn_guest", {newsLang:cur.newsLang, uiLang:cur.uiLang}); return; }
    LS.set("kn_u_"+this.user.uid, cur);
    if(this.live){ try{ await this._db.collection("knUsers").doc(this.user.uid).set(cur, {merge:true}); }catch(e){ console.warn(e); } }
  },

  /* ---------- visitor counter (admin-only view) ---------- */
  countVisit(){
    try{
      if(sessionStorage.getItem("kn_vc") || sessionStorage.getItem("kn_admin")) return; sessionStorage.setItem("kn_vc", "1");
      const day = KN_istDay(), first = localStorage.getItem("kn_vday") !== day; localStorage.setItem("kn_vday", day);
      const inc = firebase.firestore.FieldValue.increment, data = {v: inc(1), u: inc(first ? 1 : 0)};
      const col = this._db.collection("knStats");
      col.doc("d" + day).set(data, {merge:true}).catch(()=>{}); col.doc("total").set(data, {merge:true}).catch(()=>{});
    }catch(e){}
  },
  async visitStats(days){
    const col = this._db.collection("knStats"), ids = ["total"];
    for(let i = 0; i < days; i++) ids.push("d" + KN_istDay(-i));
    const snaps = await Promise.all(ids.map(id => col.doc(id).get()));
    return snaps.map((s, i) => ({id: ids[i], v: s.exists ? (s.data().v||0) : 0, u: s.exists ? (s.data().u||0) : 0}));
  },

  /* ---------- Firebase (live) ---------- */
  async _initFirebase(){
    const v = "10.12.2", base = "https://www.gstatic.com/firebasejs/"+v+"/";
    for(const f of ["firebase-app-compat.js","firebase-auth-compat.js","firebase-firestore-compat.js"]) await loadScript(base+f);
    firebase.initializeApp(C.firebase);
    this._auth = firebase.auth(); this._db = firebase.firestore();
    this._db.collection("knConfig").doc("app").onSnapshot(d=>{ if(d.exists){ Object.assign(this.cfg, d.data()); this._emitNews(); } }, ()=>{});
    this._db.collection("knNews").orderBy("ts","desc").limit(300).onSnapshot(s=>{
      this._liveList = s.docs.map(d=>Object.assign({id:d.id}, d.data())); this._emitNews(this._liveList);
    }, e=>console.warn("news read", e));
    await new Promise(res=>{
      this._auth.onAuthStateChanged(async u=>{
        if(u){
          this.user = {uid:u.uid, name:u.displayName||"Reader", email:(u.email||"").toLowerCase(), photo:u.photoURL||""};
          try{ const d = await this._db.collection("knUsers").doc(u.uid).get(); if(d.exists) LS.set("kn_u_"+u.uid, Object.assign(LS.get("kn_u_"+u.uid,{}), d.data())); }catch(e){}
        } else this.user = null;
        this._emitUser(); res();
      });
    });
  },
  async saveCfgLive(p){ if(this.live) await this._db.collection("knConfig").doc("app").set(p, {merge:true}); this.setCfg(p); },
  isAdminEmail(){ return !!(this.user && C.adminEmails.map(e=>e.toLowerCase()).includes(this.user.email)); }
};
function loadScript(src){ return new Promise((res, rej)=>{ const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
window.KN_LS = LS;
window.Store = Store;
})();
