/* ================= Karmchari News — CONFIG =================
   Fill FIREBASE below to switch from "preview mode" (data saved on this
   device only) to "live mode" (real Google login + one shared news feed
   for every user via Firestore). See README.md → "Firebase setup".      */
window.KN_CONFIG = {
  appName: "Karmchari News",
  tagline: "News in 100 words",
  shareUrl: "https://techgaon.in/karmcharinews/",

  // LIVE: FoodGaon Firebase project (petpyaar-a3ea6). Empty apiKey = preview mode.
  firebase: {
    apiKey: "AIzaSyCTemhSPOGUWqESTBu3ebzfQZGJv2XyMWg",
    authDomain: "petpyaar-a3ea6.firebaseapp.com",
    projectId: "petpyaar-a3ea6",
    storageBucket: "petpyaar-a3ea6.firebasestorage.app",
    messagingSenderId: "938080790202",
    appId: "1:938080790202:web:0da609eac45f9d54bf0483"
  },

  // In live mode, only these Google accounts may write news to Firestore
  // (also enforced in firestore.rules). Admin PIN unlocks the panel UI.
  adminEmails: ["surajbhanpandey853@gmail.com"],

  // Admin ID 9129203268 + PIN 6247 — stored only as a SHA-256 hash of "ID:PIN".
  adminHash: "c3871e6fb2d138e582b82ab72a19d47dc771d797b273d805e76e33596a9d358d",

  // AI summaries: Google Gemini (free tier key from aistudio.google.com).
  // The key is entered in Admin → Settings and kept only on the admin's device.
  geminiModel: "gemini-3.8-flash",
  summaryWords: 100
};

/* news time = when the source published it (pubDate), else when we published it */
window.KN_time = n => { const p = Date.parse(n && n.pubDate); const t = Date.parse(n && n.ts) || Date.now(); return p && p <= Date.now() + 6e5 ? p : t; };
/* India date YYYY-MM-DD, offset in days */
window.KN_istDay = (off = 0) => new Date(Date.now() + 5.5 * 3600e3 + off * 864e5).toISOString().slice(0, 10);
