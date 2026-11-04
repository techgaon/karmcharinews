/* AI summary engine: Google Gemini (key from Admin → Settings) with an
   offline fallback so the publisher always works for testing. */
(function(){
const N = () => window.KN_CONFIG.summaryWords || 100;
const AI = {
  wc(s){ return (s||"").trim().split(/\s+/).filter(Boolean).length; },
  fit(s, n){ n = n || N(); const w = (s||"").trim().split(/\s+/).filter(Boolean); if(w.length<=n) return w.join(" "); let out = w.slice(0,n).join(" "); if(!/[।.!?]$/.test(out)) out = out.replace(/[,;:—-]+$/,"") + (/[ऀ-ॿ]/.test(out)? "।" : "."); return out; },
  key(){ return (window.KN_LS.get("kn_admin_ai",{}).key)||""; },
  model(){ return (window.KN_LS.get("kn_admin_ai",{}).model)||window.KN_CONFIG.geminiModel; },
  ytId(u){ const m = String(u||"").match(/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([\w-]{11})/); return m? m[1] : ""; },

  prompt(extra){
    return `You are the editor of "Karmchari News", an Inshorts-style app for Indian government employees (Panchayati Raj, education, revenue, police, health/ASHA/Anganwadi, finance/DA/pension).
Read the source given${extra?` (${extra})`:""} and write ONE news card in FOUR languages.
Rules:
- Each summary must be EXACTLY ${N()} words (count words separated by spaces). Neutral, factual, no opinions, no invented facts, numbers or dates. If the source lacks a detail, leave it out.
- Headline: max 14 words, clear and specific.
- "hi" = standard Hindi in Devanagari. "en" = simple English. "aw" = Awadhi in Devanagari (as spoken in Lucknow/Barabanki/Ayodhya, e.g. "अहै", "अउर", "मा", "खातिर", "कहिन"). "bh" = Bhojpuri in Devanagari (e.g. "बा", "आ", "में", "खातिर", "कहलें").
- Also suggest: vibhag (one of panchayat, shiksha, revenue, police, health, finance, all), state (UP, Bihar, MP, Rajasthan, Uttarakhand, National), district (English UP district name or "All"), isGO (true if it is a Government Order/Shasanadesh), sourceName (publisher name if visible).
Return ONLY JSON: {"hi":{"h":"","s":""},"en":{"h":"","s":""},"aw":{"h":"","s":""},"bh":{"h":"","s":""},"vibhag":"","state":"","district":"","isGO":false,"sourceName":""}`;
  },

  async generate(src){
    const key = this.key();
    if(!key) return Object.assign(this.offline(src.text||""), {_offline:true});
    const parts = [];
    let extra = "";
    if(src.youtube){ parts.push({file_data:{file_uri:src.youtube, mime_type:"video/*"}}); extra = "a YouTube video"; }
    if(src.file){ parts.push({inline_data:{mime_type:src.file.mime, data:src.file.b64}}); extra = "an attached Government Order / document"; }
    let txt = this.prompt(extra);
    if(src.url && !src.youtube) txt += `\nSource URL: ${src.url}`;
    if(src.text) txt += `\nSource text:\n${src.text.slice(0, 20000)}`;
    parts.push({text: txt});
    const body = {contents:[{role:"user", parts}], generationConfig:{temperature:0.3, responseMimeType:"application/json"}};
    if(src.url && !src.youtube) body.tools = [{url_context:{}}];
    if(body.tools) delete body.generationConfig.responseMimeType;   // url_context + JSON mode not always allowed together
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model())}:generateContent?key=${encodeURIComponent(key)}`,
      {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)});
    const j = await r.json();
    if(!r.ok) throw new Error((j.error && j.error.message) || ("HTTP "+r.status));
    const raw = (j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("");
    const m = raw.match(/\{[\s\S]*\}/); if(!m) throw new Error("AI did not return JSON");
    const out = JSON.parse(m[0]);
    for(const l of ["hi","en","aw","bh"]){ out[l] = out[l]||{h:"",s:""}; out[l].s = this.fit(out[l].s); }
    return out;
  },

  /* Offline: extractive 100-word summary + rule-based Hindi→Awadhi/Bhojpuri.
     Good for testing the flow; use a Gemini key for real translations. */
  offline(text){
    text = (text||"").replace(/\s+/g," ").trim();
    const isHi = /[ऀ-ॿ]/.test(text);
    const sentences = text.split(/(?<=[।.!?])\s+/).filter(Boolean);
    const h = (sentences[0]||text).split(/\s+/).slice(0,14).join(" ").replace(/[।.]$/,"");
    const s = this.fit(text);
    const empty = {h:"", s:""};
    if(isHi) return {hi:{h, s}, en:Object.assign({}, empty, {h:"[EN] "+h, s:"[Add English translation — offline mode] "}), aw:{h:this.toAwadhi(h), s:this.fit(this.toAwadhi(s))}, bh:{h:this.toBhojpuri(h), s:this.fit(this.toBhojpuri(s))}};
    return {en:{h, s}, hi:{h:"[हिन्दी] "+h, s:"[हिन्दी अनुवाद जोड़ें — ऑफ़लाइन मोड] "}, aw:Object.assign({},empty), bh:Object.assign({},empty)};
  },
  _swap(s, pairs){ for(const [a,b] of pairs) s = s.replace(new RegExp("(^|[\\s,(])"+a+"(?=[\\s,।.!?)]|$)","g"), "$1"+b); return s; },
  toAwadhi(s){ return this._swap(s, [["के लिए","खातिर"],["और","अउर"],["में","मा"],["पर","पै"],["है","अहै"],["हैं","अहैं"],["गया","गा"],["गई","गै"],["गए","गए"],["था","रहा"],["थे","रहे"],["कहा","कहिस"],["जाएगा","जाई"],["जाएगी","जाई"],["जाएँगे","जइहैं"],["होगा","होई"],["होगी","होई"],["नहीं","नाहीं"],["अपना","आपन"],["अपनी","आपन"],["उनके","ओनके"],["इसके","एहके"],["सभी","सब"],["दिया","दिहिस"],["किया","कीन"],["से","से"]]); },
  toBhojpuri(s){ return this._swap(s, [["के लिए","खातिर"],["और","आ"],["है","बा"],["हैं","बाड़ें"],["गया","गइल"],["गई","गइल"],["गए","गइलें"],["था","रहे"],["थे","रहलें"],["कहा","कहलें"],["जाएगा","जाई"],["जाएगी","जाई"],["जाएँगे","जइहें"],["होगा","होई"],["होगी","होई"],["नहीं","ना"],["अपना","आपन"],["अपनी","आपन"],["उनके","उनकर"],["इसके","एकरा"],["सभी","सब"],["दिया","दिहल"],["किया","कइल"],["रहा","रहल"],["रही","रहल"]]); }
};
window.AI = AI;
})();
