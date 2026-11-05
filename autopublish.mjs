// Karmchari News — AI Auto-Publisher
// Runs on GitHub Actions every 30 min (see .github/workflows/autonews.yml):
//   Google News RSS → employee-news filter → Gemini (reads/verifies the article,
//   writes 100 words in Hindi, English, Awadhi, Bhojpuri) → Firestore knNews (live feed).
// Env: GEMINI_API_KEY, FIREBASE_SA (service-account JSON), optional MAX_PER_RUN, DRY_RUN=1, MOCK=1
import crypto from "node:crypto";
import fs from "node:fs";

const CFG = JSON.parse(fs.readFileSync(new URL("./feeds.json", import.meta.url)));
const MAX = +(process.env.MAX_PER_RUN || CFG.maxPerRun || 6);
const DRY = process.env.DRY_RUN === "1";
const MOCK = process.env.MOCK === "1";
const MODEL = process.env.GEMINI_MODEL || CFG.model || "gemini-3.8-flash";
const WORDS = 100;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* ---------------- database (Firestore via Admin SDK, or in-memory for MOCK) ---------------- */
async function openDb() {
  if (MOCK) {
    const mem = { knNews: new Map(), knSeen: new Map(), knConfig: new Map([["app", { autoPublish: true }]]) };
    return {
      async get(col, id) { return mem[col].get(id) || null; },
      async set(col, id, data) { mem[col].set(id, data); },
      async del(col, id) { mem[col].delete(id); },
      async recent(col, n) { return [...mem[col].entries()].map(([id, d]) => ({ id, ...d })).slice(-n); },
      async autoOlderThan() { return []; },
      _mem: mem
    };
  }
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  if (!process.env.FIREBASE_SA) throw new Error("FIREBASE_SA secret missing");
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SA)) });
  const db = getFirestore();
  return {
    async get(col, id) { const d = await db.collection(col).doc(id).get(); return d.exists ? d.data() : null; },
    async set(col, id, data) { if (!DRY) await db.collection(col).doc(id).set(data); },
    async del(col, id) { if (!DRY) await db.collection(col).doc(id).delete(); },
    async recent(col, n) { const s = await db.collection(col).orderBy("ts", "desc").limit(n).get(); return s.docs.map(d => ({ id: d.id, ...d.data() })); },
    async autoOlderThan(iso) { const s = await db.collection("knNews").where("ts", "<", iso).limit(100).get(); return s.docs.filter(d => d.data().auto === true).map(d => d.id); }
  };
}

/* ---------------- RSS ---------------- */
const unxml = s => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? unxml(m[1]) : ""; };
async function readFeed(f) {
  const xml = MOCK ? fs.readFileSync(new URL("./mock/rss.xml", import.meta.url), "utf8")
    : await fetch(f.url, { headers: { "User-Agent": "Mozilla/5.0 KarmchariNewsBot" } }).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); });
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const x = m[1]; let title = tag(x, "title"); const source = tag(x, "source");
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
    return { title, link: tag(x, "link"), date: tag(x, "pubDate"), source, hint: f };
  }).filter(i => i.title && i.link);
}

/* ---------------- YouTube (channel RSS, no API key needed) ---------------- */
async function channelId(x) {
  if (/^UC[\w-]{22}$/.test(x)) return x;
  const h = x.startsWith("@") ? x : "@" + x;
  const html = await fetch("https://www.youtube.com/" + h, { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" } }).then(r => r.text());
  const m = html.match(/"externalId":"(UC[\w-]{22})"/) || html.match(/channel_id=(UC[\w-]{22})/) || html.match(/"channelId":"(UC[\w-]{22})"/);
  if (!m) throw new Error("channel id not found for " + h);
  return m[1];
}
async function ytFromPage(ch) {   // fallback when YouTube's RSS feed is blocked: read the channel's /videos page
  const id = await channelId(ch.id);
  const html = await fetch(`https://www.youtube.com/channel/${id}/videos?hl=en&gl=IN`, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", "Cookie": "CONSENT=YES+1" }, signal: AbortSignal.timeout(15000) }).then(r => { if (!r.ok) throw new Error("page HTTP " + r.status); return r.text(); });
  const out = [], seen = new Set();
  for (const m of html.matchAll(/"videoId":"([\w-]{11})"[\s\S]{0,1500}?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"\}[\s\S]{0,800}?"publishedTimeText":\{"simpleText":"([^"]+)"/g)) {
    if (seen.has(m[1])) continue; seen.add(m[1]);
    const ago = m[3], n = +(ago.match(/\d+/) || [0])[0];
    const mins = /minute/.test(ago) ? n : /hour/.test(ago) ? n * 60 : /day/.test(ago) ? n * 1440 : /week/.test(ago) ? n * 10080 : 1e9;
    out.push({ title: JSON.parse('"' + m[2] + '"'), link: "https://www.youtube.com/watch?v=" + m[1], date: new Date(Date.now() - mins * 60000).toUTCString(), source: "YouTube — " + ch.name, video: true, channel: ch.name });
    if (out.length >= 15) break;
  }
  if (!out.length) throw new Error("no videos found on page");
  return out;
}
async function ytFromApi(ch) {   // YouTube Data API v3 (secret YOUTUBE_API_KEY) — ~2 quota units per channel
  const key = process.env.YOUTUBE_API_KEY, api = "https://www.googleapis.com/youtube/v3/";
  let id = ch.id;
  if (!/^UC[\w-]{22}$/.test(id)) {
    const j = await fetch(`${api}channels?part=id&forHandle=${encodeURIComponent(id.startsWith("@") ? id : "@" + id)}&key=${key}`).then(r => r.json());
    id = j.items?.[0]?.id; if (!id) throw new Error("api: channel not found " + ch.id);
  }
  const j = await fetch(`${api}playlistItems?part=snippet&maxResults=15&playlistId=UU${id.slice(2)}&key=${key}`).then(r => r.json());
  if (j.error) throw new Error("api: " + j.error.message);
  return (j.items || []).map(x => ({ title: x.snippet.title, link: "https://www.youtube.com/watch?v=" + x.snippet.resourceId.videoId, date: x.snippet.publishedAt,
    source: "YouTube — " + (ch.name || x.snippet.channelTitle), video: true, channel: ch.name || x.snippet.channelTitle }));
}
async function readYouTube(ch) {
  if (!MOCK && process.env.YOUTUBE_API_KEY) return await ytFromApi(ch);
  let xml;
  try {
    xml = MOCK ? fs.readFileSync(new URL("./mock/yt.xml", import.meta.url), "utf8")
      : await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=" + await channelId(ch.id), { headers: { "User-Agent": UA } }).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); });
  } catch (e) { log("  youtube rss", ch.name || ch.id, e.message, "→ trying channel page"); return await ytFromPage(ch); }
  const chName = tag(xml, "title") || ch.name;
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => {
    const x = m[1], vid = tag(x, "yt:videoId");
    return { title: tag(x, "title"), link: "https://www.youtube.com/watch?v=" + vid, date: tag(x, "published"), source: "YouTube — " + (ch.name || chName), video: true, channel: ch.name || chName };
  }).filter(i => i.title && i.link.length > 35);
}

/* ---------------- images (photo from the source article / video thumbnail) ---------------- */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
async function realUrl(link) {   // Google News RSS link -> publisher article URL
  if (!/news\.google\.com\/rss\/articles\//.test(link)) return link;
  try {
    const id = link.split("/articles/")[1].split("?")[0];
    const html = await fetch("https://news.google.com/articles/" + id, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) }).then(r => r.text());
    const sg = (html.match(/data-n-a-sg="([^"]+)"/) || [])[1], ts = (html.match(/data-n-a-ts="([^"]+)"/) || [])[1];
    if (!sg || !ts) return "";
    const inner = JSON.stringify(["garturlreq", [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, Number(ts), sg]);
    const txt = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": UA }, body: "f.req=" + encodeURIComponent(JSON.stringify([[["Fbv4je", inner]]])), signal: AbortSignal.timeout(12000) }).then(r => r.text());
    const url = JSON.parse(JSON.parse(txt.split("\n\n")[1])[0][2])[1];
    return /^https?:\/\//.test(url) ? url : "";
  } catch (e) { return ""; }
}
async function ogImage(url) {   // og:image / twitter:image of the article page
  try {
    const r0 = await fetch(url, { headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "hi-IN,hi;q=0.9,en;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
    if (!r0.ok) { log("   og: HTTP", r0.status, new URL(url).hostname); return ""; }
    const html = (await r0.text()).slice(0, 400000);
    const m = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    if (!m) { log("   og: no og:image tag on", new URL(url).hostname); return ""; }
    let img = m[1].replace(/&amp;/g, "&");
    if (img.startsWith("//")) img = "https:" + img; else if (img.startsWith("/")) img = new URL(img, url).href;
    if (!/^https:\/\//.test(img) || /logo|default|placeholder|favicon|icon[-_.]|\/icons?\/|sprite|\.svg(\?|$)/i.test(img)) return "";
    return img;
  } catch (e) { log("   og:", e.message); return ""; }
}
async function bingImage(title) {   // Bing News thumbnail for the same headline (served by Bing)
  try {
    const r0 = await fetch("https://www.bing.com/news/search?format=rss&mkt=en-IN&q=" + encodeURIComponent(title.slice(0, 120)), { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
    const xml = r0.ok ? await r0.text() : "";
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
    log("   bing:", r0.status, items.length, "items,", (xml.match(/News:Image/gi) || []).length / 2, "images");
    for (const m of items) {
      const x = m[1], t = tag(x, "title"), im = (x.match(/<News:Image>([^<]+)<\/News:Image>/i) || [])[1];
      if (im && similar(t, title) > 0.35) return unxml(im).replace(/^http:/, "https:").replace(/&pid=News.*$/, "&pid=News&w=800&h=450&c=14");
    }
  } catch (e) { log("   bing:", e.message); }
  return "";
}
const isArticle = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) && !/google\.|vertexaisearch/.test(x.hostname) && x.pathname.replace(/\/+$/, "").length > 12; } catch (e) { return false; } };
async function bingLink(title) {
  try {
    const xml = await fetch("https://www.bing.com/news/search?format=rss&mkt=en-IN&q=" + encodeURIComponent(title.slice(0, 120)), { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) }).then(r => r.ok ? r.text() : "");
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      if (similar(tag(m[1], "title"), title) < 0.5) continue;
      let l = tag(m[1], "link"); const q = l.match(/[?&]url=([^&]+)/); if (q) l = decodeURIComponent(q[1]);
      if (isArticle(l)) { log("   article: link found via Bing"); return l; }
    }
  } catch (e) {}
  return "";
}
async function prefetch(it) {   // resolve the real article URL and read its text ourselves, so Gemini needs no browsing tool
  if (it.video) return;
  let u = await realUrl(it.link);
  if (!isArticle(u)) u = await bingLink(it.title);   // fallback: find the same headline on Bing News
  if (!isArticle(u)) { log("   article: could not resolve Google News link"); return; }
  it.realUrl = u;
  try {
    const r = await fetch(u, { headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "hi-IN,hi;q=0.9,en;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!r.ok) { log("   article: HTTP", r.status, new URL(u).hostname); return; }
    const html = (await r.text()).slice(0, 600000);
    const og = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    if (og) { let img = og[1].replace(/&amp;/g, "&"); if (img.startsWith("//")) img = "https:" + img; else if (img.startsWith("/")) img = new URL(img, u).href;
      if (/^https:\/\//.test(img) && !/logo|default|placeholder|favicon|icon[-_.]|\/icons?\/|sprite|\.svg(\?|$)/i.test(img)) it.ogImage = img; }
    const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ");
    const paras = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => unxml(m[1])).filter(t => t.length > 40 && !/cookie|subscribe|download app|©/i.test(t));
    const text = paras.join("\n").slice(0, 9000);
    if (text.length > 400) it.text = text;
    log("   article:", new URL(u).hostname, it.text ? it.text.length + " chars" : "no text", it.ogImage ? "+ photo" : "");
  } catch (e) { log("   article:", e.message); }
}
async function findImage(it, o) {
  if (it.video) { const v = (it.link.split("v=")[1] || "").slice(0, 11); return v ? `https://i.ytimg.com/vi/${v}/hqdefault.jpg` : ""; }
  if (it.ogImage) { log("  image: found (article)"); return it.ogImage; }
  let url = it.realUrl || (isArticle(o.articleUrl) ? o.articleUrl : "");
  if (!url) { const r = await realUrl(it.link); if (isArticle(r)) url = r; }
  if (url) it.realUrl = url;
  let img = url ? await ogImage(url) : "", from = "article";
  if (!img) { img = await bingImage(it.title); from = "bing"; }
  log("  image:", img ? "found (" + from + ")" : "none");
  return img;
}

/* ---------------- filters ---------------- */
const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(w => w.length > 1);
function similar(a, b) { const A = new Set(norm(a)), B = new Set(norm(b)); if (!A.size || !B.size) return 0; let i = 0; A.forEach(w => B.has(w) && i++); return i / Math.min(A.size, B.size); }
const DSTOP = new Set("the of and to in for on a an is are was were has have will be by with from at as that this its their it said also government employees employee state".split(" "));
const keyw = s => new Set(norm(s || "").filter(w => !DSTOP.has(w)));
function ovl(a, b) { const A = keyw(a), B = keyw(b); if (!A.size || !B.size) return 0; let i = 0; A.forEach(w => B.has(w) && i++); return i / Math.min(A.size, B.size); }
/* same event already covered? (two papers, two different headlines) */
function isDup(a, b) {
  const ea = a.lang?.en || a.en, eb = b.lang?.en || b.en; if (!ea?.h || !eb?.h) return false;
  if (a.vibhag !== b.vibhag) return false;
  const ta = Date.parse(a.ts) || Date.now(), tb = Date.parse(b.ts) || Date.now(); if (Math.abs(ta - tb) > 72 * 3600e3) return false;
  return ovl(ea.h, eb.h) >= 0.45 || ovl(ea.h + " " + ea.s, eb.h + " " + eb.s) >= 0.33;
}
const idOf = t => "a" + crypto.createHash("sha1").update(norm(t).join(" ")).digest("hex").slice(0, 16);
const kwHit = (t, k) => /^[a-z0-9 ]{1,4}$/i.test(k) ? new RegExp(`(^|[^a-z])${k}([^a-z]|$)`, "i").test(t) : t.toLowerCase().includes(k.toLowerCase());
const relevantByWords = t => CFG.keywords.some(k => kwHit(t, k)) && !CFG.blockWords.some(k => kwHit(t, k));
const wc = s => String(s || "").trim().split(/\s+/).filter(Boolean).length;
function fit(s) { const w = String(s || "").trim().split(/\s+/).filter(Boolean); if (w.length <= WORDS) return w.join(" "); let o = w.slice(0, WORDS).join(" "); if (!/[।.!?]$/.test(o)) o = o.replace(/[,;:—-]+$/, "") + (/[ऀ-ॿ]/.test(o) ? "।" : "."); return o; }

/* ---------------- Gemini ---------------- */
function prompt(it) {
  return `You are the news editor of "Karmchari News", an Inshorts-style app for Indian government employees (Panchayati Raj, teachers/education, revenue/Lekhpal, police/Home Guard, health/ASHA/Anganwadi, finance/DA/pay/pension, all employees).
Article: "${it.title}" — published by ${it.source || "unknown"} on ${it.date || "unknown date"}.
Link: ${it.realUrl || it.link}${it.text ? `
ARTICLE TEXT (fetched from the publisher; this is the article — read it, it counts as reading the article):
"""
${it.text}
"""` : ""}
Steps:
1. Open the link (or search the web for this exact headline from this publisher) and READ the actual article.
2. Decide "relevant": true ONLY if the story directly matters to government employees/pensioners/workers in India (pay, DA, pension, transfers, recruitment of govt staff, service rules, GOs, departmental orders, strikes/demands, training, duties). Crime, politics, sports, celebrity, generic schemes for public = false.
3. "verified": true ONLY if you could read the article or confirm its facts from reliable sources. Never guess.
4. If relevant and verified, write ONE card in FOUR languages. Each summary EXACTLY ${WORDS} words, neutral, factual, your own words (do not copy sentences), no invented numbers, dates or names. Write every number in Western digits (0-9) and use EXACTLY the same numbers in all four languages; a number in a headline must also appear in that language's summary. Headline max 14 words.
   "hi" standard Hindi (Devanagari). "en" simple English. "aw" Awadhi in Devanagari (अहै, अउर, मा, खातिर, कहिन). "bh" Bhojpuri in Devanagari (बा, आ, में, खातिर, कहलें).
5. Tags: vibhag one of panchayat|shiksha|revenue|police|health|finance|all ; state one of UP|Bihar|MP|Rajasthan|Uttarakhand|National|Other (Other = any other Indian state) ; district = English name of a UP district if the story is about one district, else "All" ; isGO true if it is about a Government Order/Shasanadesh ; sourceName = publisher ; articleUrl = the exact publisher web address of the article you read (not a Google link).
6. place: give the state name (Hindi + English) for every state-level or local story (leave empty for all-India/central stories). ONLY when the story is about a specific local place, also give district, block (vikas khand) and gram panchayat names in Hindi (Devanagari) and English. If the article names a gram panchayat but not its block, find its block from reliable sources (lgdirectory.gov.in, the district's official website, or several matching news reports); if you are not certain, leave block empty. Never guess. Leave district/block/gram panchayat empty for state-level stories, and every place field empty for all-India stories.
Reply with ONLY this JSON (no markdown):
{"relevant":true,"verified":true,"reason":"","hi":{"h":"","s":""},"en":{"h":"","s":""},"aw":{"h":"","s":""},"bh":{"h":"","s":""},"vibhag":"","state":"","district":"","isGO":false,"sourceName":"","articleUrl":"","place":{"state_hi":"","state_en":"","district_hi":"","district_en":"","block_hi":"","block_en":"","gp_hi":"","gp_en":""}}`;
}
function promptVideo(it) {
  return prompt(it).replace(/Steps:\n1\.[^\n]*\n/, `Steps:
1. WATCH the attached YouTube video "${it.title}" from the channel "${it.channel}". Many such channels post rumours or clickbait ("DA बढ़ेगा?", "बड़ी खुशखबरी"). Set "verified": true ONLY if the video reports a concrete, confirmed fact (an issued order, an official announcement, a published notification) AND the video shows or clearly quotes the official document (order/notification number, date and issuing office) or you can confirm it from reliable sources. Predictions, rumours, "may/might/expected" stories → verified=false.
`).replace("Article:", "Video:");
}
async function gemini(it) {
  if (MOCK) return JSON.parse(fs.readFileSync(new URL("./mock/gemini.json", import.meta.url), "utf8"))[it.title] || { relevant: false, verified: false, reason: "mock: unknown" };
  const key = process.env.GEMINI_API_KEY; if (!key) throw new Error("GEMINI_API_KEY secret missing");
  const parts = it.video ? [{ file_data: { file_uri: it.link } }, { text: promptVideo(it) }] : [{ text: prompt(it) }];
  // try: chosen model with web tools → same model with fewer tools → newest "latest" aliases
  const models = [...new Set([MODEL, ...(CFG.fallbackModels || ["gemini-flash-latest", "gemini-flash-lite-latest"])])];
  // Google Search grounding has its own (often zero) free quota, so it is used only if CFG.useSearch is true
  const toolSets = it.video ? (CFG.useSearch ? [[{ google_search: {} }], []] : [[]]) : it.text ? [[]] : (CFG.useSearch ? [[{ url_context: {} }, { google_search: {} }], [{ url_context: {} }]] : [[{ url_context: {} }]]);
  let lastErr = "";
  for (const model of models) for (const tools of toolSets) for (let attempt = 1; attempt <= 3; attempt++) {
    const body = { contents: [{ role: "user", parts }], generationConfig: { temperature: 0.2 } };
    if (tools.length) body.tools = tools;
    if (it.video) body.generationConfig.mediaResolution = "MEDIA_RESOLUTION_LOW";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }).catch(e => ({ ok: false, status: 504, json: async () => ({ error: { message: "timeout: " + e.message } }) }));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      lastErr = `${model} [${tools.map(t => Object.keys(t)[0]).join("+") || "no tools"}] HTTP ${r.status}: ${(j.error?.message || "").slice(0, 220)}`;
      log("  ", lastErr);
      if (r.status === 503 || r.status === 500 || r.status === 504) { await new Promise(s => setTimeout(s, 12000 * attempt)); continue; }   // overloaded → wait and retry same model
      break;   // 429 / 4xx → try next tool set / model
    }
    const raw = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
    const m = raw.match(/\{[\s\S]*\}/); if (!m) { lastErr = model + ": no JSON in reply"; break; }
    if (model !== MODEL || tools.length < toolSets[0].length) log("   (used " + model + " " + (tools.map(t => Object.keys(t)[0]).join("+") || "no tools") + ")");
    return JSON.parse(m[0]);
  }
  const e = new Error(lastErr || "Gemini failed"); e.quota = /HTTP 429/.test(lastErr); throw e;
}
/* ---------------- fact check: numbers must match in every language ---------------- */
const DEV = "०१२३४५६७८९";
const nums = t => (String(t || "").replace(/[०-९]/g, d => DEV.indexOf(d)).match(/\d+(?:\.\d+)?/g) || []).filter(n => !/^(19|20)\d\d$/.test(n));
function numbersProblem(o) {
  const hiS = new Set(nums(o.hi.s)), hiAll = new Set(nums(o.hi.h + " " + o.hi.s)), enAll = new Set(nums(o.en.h + " " + o.en.s));
  for (const l of ["hi", "en", "aw", "bh"]) { const body = new Set(nums(o[l].s)); for (const n of nums(o[l].h)) if (!body.has(n)) return `${l} headline number ${n} not in its summary`; }
  for (const n of enAll) if (!hiAll.has(n)) return `number ${n} in English but not in Hindi`;
  for (const n of hiAll) if (!enAll.has(n)) return `number ${n} in Hindi but not in English`;
  for (const l of ["aw", "bh"]) for (const n of nums(o[l].h + " " + o[l].s)) if (!hiAll.has(n)) return `number ${n} in ${l} but not in Hindi`;
  return "";
}
function validate(o) {
  const V = ["panchayat", "shiksha", "revenue", "police", "health", "finance", "all"], S = ["UP", "Bihar", "MP", "Rajasthan", "Uttarakhand", "National", "Other"];
  if (!o.relevant) return "not employee news: " + (o.reason || "");
  if (!o.verified) return "could not verify article: " + (o.reason || "");
  for (const l of ["hi", "en", "aw", "bh"]) {
    if (!o[l] || !o[l].h || !o[l].s) return "missing " + l;
    o[l].s = fit(o[l].s); o[l].h = o[l].h.trim();
    const n = wc(o[l].s); if (n < 80) return `${l} too short (${n} words)`;
    if (l !== "en" && !/[ऀ-ॿ]/.test(o[l].s)) return l + " not in Devanagari";
  }
  const np = numbersProblem(o); if (np) return "numbers do not match across languages: " + np;
  if (!V.includes(o.vibhag)) o.vibhag = "all";
  if (!S.includes(o.state)) o.state = "Other";
  if (!o.district || !CFG.upDistricts.includes(o.district)) o.district = "All";
  const P = o.place && typeof o.place === "object" ? o.place : {}, clean = {};
  for (const k of ["state", "district", "block", "gp"]) {
    const hi = String(P[k + "_hi"] || "").trim(), en = String(P[k + "_en"] || "").trim();
    if (hi && hi.length <= 40 && /[\u0900-\u097F]/.test(hi) && !/[a-z]/i.test(hi)) clean[k + "_hi"] = hi;
    if (en && en.length <= 40 && /^[A-Za-z .()'-]+$/.test(en)) clean[k + "_en"] = en;
  }
  o.place = clean;
  return "";
}
const ICON = { panchayat: "🏛️", shiksha: "📚", revenue: "📜", police: "👮", health: "🩺", finance: "💰", all: "📰" };

/* ---------------- main ---------------- */
const T0 = Date.now();
async function main() {
  const db = await openDb();
  const app = (await db.get("knConfig", "app")) || {};
  if (app.autoPublish === false) { log("Auto-publish is PAUSED from the admin panel. Exit."); return; }

  // 1. collect
  let items = [];
  for (const f of CFG.feeds) { try { const l = await readFeed(f); items.push(...l); log("feed", f.name, l.length); } catch (e) { log("feed FAIL", f.name, e.message); } }
  const ytList = CFG.youtube.concat((app.youtubeChannels || []).filter(Boolean).map(id => ({ id: id.trim(), name: "" })));
  const seenCh = new Set();
  for (const ch of ytList) { if (seenCh.has(ch.id)) continue; seenCh.add(ch.id); try { const l = await readYouTube(ch); items.push(...l); log("youtube", ch.name || ch.id, l.length); } catch (e) { log("youtube FAIL", ch.id, e.message); } }
  const maxAge = Date.now() - CFG.maxAgeHours * 3600e3;
  items = items.filter(i => !i.date || isNaN(Date.parse(i.date)) || Date.parse(i.date) > maxAge);
  items.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));

  // 2. filter + dedupe (same story from many papers → keep one)
  const recent = await db.recent("knNews", 150);
  const recentTitles = recent.map(n => n.origTitle || (n.lang && n.lang.hi && n.lang.hi.h) || "");
  const picked = [];
  for (const it of items) {
    if (!relevantByWords(it.title)) continue;
    it.id = idOf(it.title);
    if (picked.some(p => p.id === it.id || similar(p.title, it.title) > 0.6)) continue;
    if (recentTitles.some(t => similar(t, it.title) > 0.6)) continue;
    if (await db.get("knSeen", it.id) || await db.get("knNews", it.id)) continue;
    picked.push(it);
    if (picked.length >= MAX * 3) break;
  }
  log(`candidates: ${picked.length} (from ${items.length} items)`);

  // 3. AI → publish
  let published = 0, skipped = 0, videos = 0, quotaFails = 0;
  const MAXV = CFG.maxVideosPerRun || 3;
  for (const it of picked) {
    if (published >= MAX) break;
    if (it.video && videos >= MAXV) continue;
    if (it.video) videos++;
    if (Date.now() - T0 > (CFG.runBudgetMin || 15) * 60000) { log("time budget used — stopping, next run continues"); break; }
    log("→", it.title.slice(0, 90));
    await prefetch(it);
    if (!it.video && !it.text && !CFG.allowUrlContext) { log("  skip for now: article text not readable (saves Gemini quota)"); continue; }
    let o;
    try { o = await gemini(it); quotaFails = 0; } catch (e) { log("  AI error:", e.message); if (e.quota && ++quotaFails >= 2) { log("Gemini quota exhausted — stopping this run, will try again next run."); break; } continue; }
    const why = validate(o);
    await db.set("knSeen", it.id, { ts: new Date().toISOString(), title: it.title, result: why || "published" });
    if (why) { skipped++; log("  skip:", why); continue; }
    const twin = recent.find(r => isDup({ vibhag: o.vibhag, en: o.en, ts: new Date().toISOString() }, r));
    if (twin) { skipped++; log("  skip: same news already published —", (twin.lang?.hi?.h || "").slice(0, 60)); continue; }
    const doc = {
      id: it.id, vibhag: o.vibhag, state: o.state, district: o.district, type: it.video ? "video" : "image", image: await findImage(it, o), youtube: it.video ? it.link : "",
      icon: it.video ? "🎬" : o.isGO ? "📄" : ICON[o.vibhag], source: it.video ? it.source : (o.sourceName || it.source || "News"), sourceUrl: it.realUrl || it.link,
      isGO: !!o.isGO, pinned: false, isDemo: false, ai: true, auto: true, origTitle: it.title,
      ts: new Date().toISOString(), pubDate: it.date || "",
      place: o.place || {},
      lang: { hi: o.hi, en: o.en, aw: o.aw, bh: o.bh }
    };
    await db.set("knNews", it.id, doc); published++; recent.unshift(doc);
    log(`  ✓ published [${o.vibhag}/${o.state}/${o.district}] ${o.hi.h}`, DRY ? "(dry run)" : "");
    await new Promise(s => setTimeout(s, MOCK ? 0 : 4000));
  }

  // 4a. re-check recent AI stories already in the feed
  if (!MOCK) for (const n of await db.recent("knNews", 60)) {
    if (!n.auto || !n.lang?.hi || !n.lang?.en) continue;
    const np = numbersProblem({ hi: n.lang.hi, en: n.lang.en, aw: n.lang.aw || { h: "", s: "" }, bh: n.lang.bh || { h: "", s: "" } });
    if (np) { await db.del("knNews", n.id); log("  removed old story (numbers mismatch):", n.lang.hi.h, "—", np); continue; }
    if (n.image && /logo|favicon|icon[-_.]|\/icons?\//i.test(n.image)) { const c = { ...n }; delete c.id; c.image = ""; await db.set("knNews", n.id, c); log("  cleared logo image:", n.lang.hi.h); }
  }
  // 4a-2. remove duplicate stories (keep the one with photo/place, else the newer)
  if (!MOCK) {
    const list = (await db.recent("knNews", 60)).filter(n => n.auto && n.lang?.en);
    const gone = new Set(), score = n => (n.image ? 2 : 0) + (n.place && (n.place.district_hi || n.place.state_hi) ? 1 : 0);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j]; if (gone.has(a.id) || gone.has(b.id) || !isDup(a, b)) continue;
      const drop = score(b) > score(a) ? a : b; // list is newest-first, so ties drop the older one
      gone.add(drop.id); await db.del("knNews", drop.id); log("  removed duplicate:", drop.lang.hi?.h);
    }
  }
  // 4b. housekeeping: remove auto stories older than N days
  const old = await db.autoOlderThan(new Date(Date.now() - CFG.keepDays * 864e5).toISOString());
  for (const id of old) await db.del("knNews", id);
  log(`done: published ${published}, skipped ${skipped}, cleaned ${old.length}`);
  if (MOCK) return db;
}
const res = await main().catch(e => { console.error("FATAL", e); process.exit(1); });
export default res;
