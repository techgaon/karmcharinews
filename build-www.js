// Copies the web app into ./www for Capacitor (APK/AAB). No bundler needed.
const fs = require("fs"), path = require("path");
const out = path.join(__dirname, "..", "www");
fs.rmSync(out, {recursive:true, force:true}); fs.mkdirSync(out);
for (const f of ["index.html","manifest.webmanifest","sw.js","css","js","icons"]) {
  fs.cpSync(path.join(__dirname, "..", f), path.join(out, f), {recursive:true});
}
console.log("www/ ready");
