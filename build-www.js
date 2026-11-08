// Copies the web app into ./www for Capacitor (APK/AAB). No bundler needed.
const fs = require("fs"), path = require("path");
const out = path.resolve(__dirname, "www");
if(path.dirname(out)!==path.resolve(__dirname)) throw new Error('Invalid web output directory');
fs.mkdirSync(out, {recursive:true});
for (const f of ["index.html","manifest.webmanifest","sw.js","app.css","config.js","data.js","i18n.js","store.js","ai.js","app.js","admin.js","tour.js","icon.svg","icon-192.png","icon-512.png","icon-maskable-512.png"]) {
  fs.copyFileSync(path.join(__dirname, f), path.join(out, f));
}
console.log("www/ ready");
