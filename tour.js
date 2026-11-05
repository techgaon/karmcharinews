/* Karmchari News — first-run animated app tour (spotlight + tips). Re-open: ⋮ menu → "ऐप टूर" */
(function(){
const KEY = "kn_tour_done";
const $ = s => document.querySelector(s);
function curCard(){
  const cards = [...document.querySelectorAll("#feed .card:not(.endcard)")];
  return cards.find(c => { const r = c.getBoundingClientRect(); return r.top > -40 && r.top < innerHeight / 2; }) || cards[0];
}
const inCard = sel => () => { const c = curCard(); return c && c.querySelector(sel); };
const STEPS = [
  { t:"👋 कर्मचारी न्यूज़ में स्वागत है!", d:"हर सरकारी कर्मचारी की ख़बर सिर्फ़ 100 शब्दों में — आइए 30 सेकंड में ऐप देख लें।", e:"Welcome! A 30-second tour of the app." },
  { el: () => $("#feed"), t:"👆 ऊपर स्वाइप करें", d:"अगली ख़बर के लिए कार्ड को ऊपर खिसकाएँ, पिछली के लिए नीचे।", e:"Swipe up for the next story, down for the previous one.", hand:true },
  { el: () => $("#btnMenu"), t:"☰ अपनी पसंद की ख़बरें", d:"यहाँ से विभाग, राज्य और ज़िला चुनें — जैसे सिर्फ़ पंचायती राज या सिर्फ़ बाराबंकी की ख़बरें। “My Feed” में सेव भी कर सकते हैं।", e:"Filter by department, state and district." },
  { el: () => $("#btnMore"), t:"⋮ भाषा बदलें", d:"ख़बर हिंदी, English, अवधी या भोजपुरी में पढ़ें — ऐप की भाषा भी यहीं से बदलें।", e:"Change news & app language here." },
  { el: inCard('[data-act="bm"]'), t:"🔖 बाद में पढ़ें", d:"ज़रूरी ख़बर बुकमार्क करें — मेनू के “Bookmarks” में मिल जाएगी।", e:"Bookmark a story to read later." },
  { el: inCard('[data-act="wa"]'), t:"📤 WhatsApp पर भेजें", d:"ख़बर फ़ोटो वाले सुंदर कार्ड के रूप में साथियों के ग्रुप में भेजें। बगल वाला बटन बाकी ऐप्स में शेयर करता है।", e:"Share the story as an image card on WhatsApp or any app." },
  { el: inCard('.place'), t:"📍 कहाँ की ख़बर", d:"यह बताता है कि ख़बर किस ज़िले, ब्लॉक या ग्राम पंचायत की है।", e:"Shows which district / block / gram panchayat the news is from." },
  { el: inCard('[data-act="like"]'), t:"❤️ पसंद आई? लाइक करें", d:"दिल दबाएँ — कितने लोगों को ख़बर पसंद आई, गिनती यहीं दिखेगी।", e:"Like the story; the count shows here." },
  { el: inCard('footer.src'), t:"📰 पूरी ख़बर पढ़ें", d:"मूल अख़बार या पोर्टल पर पूरी ख़बर पढ़ने के लिए यहाँ दबाएँ। वीडियो ख़बर पर पूरा वीडियो खुलेगा।", e:"Open the full article on the original source." },
  { t:"🎉 बस, इतना ही!", d:"अब ख़बरें पढ़िए। यह टूर दोबारा देखना हो तो ⋮ मेनू में “ऐप टूर” दबाएँ।", e:"All set! Replay this tour anytime from the ⋮ menu.", last:true }
];
let i = 0, root, hole, tip, hand;
function build(){
  root = document.createElement("div"); root.id = "tour";
  root.innerHTML = `<div class="t-hole"></div><div class="t-hand">👆</div><div class="t-tip" role="dialog" aria-live="polite"></div>`;
  document.body.appendChild(root);
  hole = root.querySelector(".t-hole"); tip = root.querySelector(".t-tip"); hand = root.querySelector(".t-hand");
  root.addEventListener("click", e => {
    const b = e.target.closest("[data-t]"); if(!b) return;
    if(b.dataset.t === "next") go(i + 1); else if(b.dataset.t === "back") go(i - 1); else end();
  });
  addEventListener("resize", place);
}
function place(){
  const s = STEPS[i], el = s.el && s.el();
  const vw = innerWidth, vh = innerHeight;
  if(el){
    const r = el.getBoundingClientRect(), pad = s.hand ? -8 : 6;
    const x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad), w = Math.min(vw - 8, r.width + pad * 2), h = Math.min(vh - 8, r.height + pad * 2);
    Object.assign(hole.style, {left:x + "px", top:y + "px", width:w + "px", height:h + "px", borderRadius: (Math.min(w, h) < 70 ? 999 : 16) + "px", opacity:1});
    hole.classList.toggle("ring", !s.hand);
    const below = y + h + 190 < vh || y < vh / 2;
    tip.style.top = s.hand ? (vh * 0.52) + "px" : (below ? (y + h + 14) : Math.max(8, y - 14 - tip.offsetHeight)) + "px";
    tip.classList.toggle("up", !s.hand && below); tip.classList.toggle("down", !s.hand && !below);
    tip.style.setProperty("--ax", Math.min(vw - 40, Math.max(28, x + w / 2 - 14)) + "px");
  } else {
    Object.assign(hole.style, {left:vw / 2 + "px", top:vh / 2 + "px", width:"0px", height:"0px", opacity:1});
    hole.classList.remove("ring"); tip.classList.remove("up", "down");
    tip.style.top = Math.max(20, vh / 2 - tip.offsetHeight / 2) + "px";
  }
  hand.style.display = s.hand ? "block" : "none";
}
function go(n){
  if(n < 0) return; if(n >= STEPS.length) return end();
  const s = STEPS[n]; if(s.el && !s.el()) return go(n > i ? n + 1 : n - 1);   // element not on this card (e.g. no place) → skip
  i = n;
  const dots = STEPS.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("");
  tip.classList.remove("show"); void tip.offsetWidth;
  tip.innerHTML = `<b>${s.t}</b><p>${s.d}</p>${window.KN_UILANG === "en" ? `<p class="en">${s.e}</p>` : ""}
    <div class="t-foot"><div class="t-dots">${dots}</div>
    ${s.last ? `<button class="t-btn go" data-t="end">शुरू करें ✓</button>` : `${i ? `<button class="t-btn ghost" data-t="back">←</button>` : `<button class="t-btn ghost" data-t="end">छोड़ें</button>`}<button class="t-btn go" data-t="next">${i ? "आगे →" : "टूर देखें →"}</button>`}</div>`;
  place(); tip.classList.add("show");
  if(s.last) confetti();
}
function confetti(){
  for(let k = 0; k < 28; k++){ const p = document.createElement("i"); p.className = "t-conf";
    p.style.left = (Math.random() * 100) + "%"; p.style.background = ["#ff7a00","#138808","#e11d48","#1d4ed8","#fbbf24"][k % 5];
    p.style.animationDelay = (Math.random() * .4) + "s"; p.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
    root.appendChild(p); setTimeout(() => p.remove(), 2200); }
}
function end(){ try{ localStorage.setItem(KEY, "1"); }catch(e){} root.classList.add("bye"); setTimeout(() => { root.remove(); root = null; }, 300); }
function start(){
  if(root) return; build(); i = 0;
  requestAnimationFrame(() => { root.classList.add("on"); go(0); });
}
window.KNTour = { start };
// first visit: wait for the first card, then start
function auto(){
  try{ if(localStorage.getItem(KEY) || /n=/.test(location.hash)) return; }catch(e){ return; }
  let tries = 0; const t = setInterval(() => { if(document.querySelector("#feed .card:not(.endcard)") || ++tries > 40){ clearInterval(t); if(tries <= 40) setTimeout(start, 900); } }, 250);
}
if(document.readyState === "complete") auto(); else addEventListener("load", auto);
})();
