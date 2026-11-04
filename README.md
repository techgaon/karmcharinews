# Karmchari News — कर्मचारी न्यूज़ (News in 60 Sec)

Inshorts जैसा मोबाइल-फ़र्स्ट PWA, जिसमें कर्मचारी, विभाग, राज्य और ज़िले की ख़बरें 100 शब्दों में आती हैं। भाषाएँ: **हिन्दी · English · अवधी · भोजपुरी**।
लाइव पता: `https://techgaon.in/karmcharinews/` · फ़र्म: TechGaon AI Services

---

## 1. फ़ाइलें
| फ़ाइल | काम |
|---|---|
| `index.html` | ऐप का ढाँचा |
| `css/app.css` | पूरा डिज़ाइन, कार्ड, 3D स्वाइप, ड्रॉअर, एडमिन |
| `js/config.js` | **सेटिंग:** Firebase, एडमिन ईमेल, एडमिन PIN का hash, AI मॉडल |
| `js/data.js` | 10 डेमो समाचार × 4 भाषाएँ, हर एक ठीक 100 शब्द |
| `js/i18n.js` | UI की 4 भाषाएँ, विभाग, राज्य, UP के 75 ज़िले |
| `js/store.js` | डेटा और लॉगिन (Preview = इसी फ़ोन में, Live = Firebase) |
| `js/ai.js` | Gemini AI से 4 भाषाओं में सारांश + ऑफ़लाइन तरीका |
| `js/app.js` | फ़ीड, स्वाइप, फ़िल्टर, बुकमार्क, WhatsApp/शेयर |
| `js/admin.js` | एडमिन पैनल |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA (इंस्टॉल + ऑफ़लाइन) |
| `capacitor.config.json`, `package.json`, `scripts/`, `.github/workflows/android.yml` | APK / AAB |
| `firestore.rules` | Firebase सुरक्षा नियम |

कोई build ज़रूरी नहीं है, सारी फ़ाइलें सीधे चलती हैं। सभी रास्ते relative हैं (`./`), इसलिए ऐप `/karmcharinews/` सब-फ़ोल्डर में बिना बदलाव के चलता है।

## 2. वेबसाइट पर डालना (techgaon.in/karmcharinews)
1. सर्वर/होस्टिंग पर `karmcharinews` नाम का फ़ोल्डर बनाएँ।
2. उसमें ये अपलोड करें: `index.html`, `manifest.webmanifest`, `sw.js`, और `css`, `js`, `icons` फ़ोल्डर।
3. HTTPS ज़रूरी है (PWA इंस्टॉल, service worker और एडमिन PIN जाँच के लिए)।
4. GitHub Pages पर डालना हो तो इसी तरह `karmcharinews` रिपॉज़िटरी बनाएँ। FoodGaon की तरह custom domain पहले से जुड़ा है, इसलिए यह `techgaon.in/karmcharinews/` पर खुलेगा।

अपने कंप्यूटर पर जाँचने के लिए: `npx http-server . -p 8080` चलाएँ, फिर `http://localhost:8080` खोलें।

## 3. एडमिन
- ऊपर दाईं ओर 🔒 या ड्रॉअर में "Admin Login" → ID **9129203268**, PIN **6247**।
- PIN कोड में सीधे नहीं लिखा है, केवल उसका SHA-256 hash `config.js` में है। PIN बदलने के लिए नया hash बनाएँ: `echo -n "ID:PIN" | sha256sum`।
- ⚠️ ब्राउज़र वाला PIN केवल पैनल खोलता है। Live मोड में असली सुरक्षा Firestore rules से होती है: ख़बर वही Google खाता लिख सकता है जो `adminEmails` में है।

**AI Publisher:** News URL / YouTube लिंक / टेक्स्ट / GO PDF या फ़ोटो डालें → "Generate 100-Word Summary in 4 Languages" दबाएँ → चारों भाषाएँ जाँचें (हर भाषा पर शब्द-गिनती दिखती है, "✂️ Trim" से 100 पर कटती है) → विभाग, राज्य, ज़िला, मीडिया और स्रोत चुनें → Publish। ख़बर तुरंत फ़ीड में सबसे ऊपर दिखेगी।

**AI key:** aistudio.google.com → Get API key (मुफ़्त) → Admin → ⚙️ Settings में डालें। key केवल एडमिन के फ़ोन में रहती है।
key न हो तो **ऑफ़लाइन मोड** चलता है: चिपकाए गए टेक्स्ट से 100 शब्द निकलते हैं और अवधी/भोजपुरी का कच्चा रूप बनता है। अंग्रेज़ी अनुवाद हाथ से भरना होगा।

## 4. Firebase (असली Google लॉगिन + सबके लिए एक फ़ीड)
अभी **Preview मोड** है: लॉगिन सिमुलेशन है और ख़बरें केवल उसी डिवाइस में सेव होती हैं। Live करने के लिए:
1. Firebase console में वेब ऐप जोड़ें। चाहें तो FoodGaon वाला प्रोजेक्ट इस्तेमाल करें, या नया बनाएँ।
2. Authentication → Sign-in method → **Google** चालू करें। Authorized domains में `techgaon.in` जोड़ें।
3. Firestore में `firestore.rules` के तीनों ब्लॉक मौजूदा नियमों में जोड़कर **Publish** दबाएँ।
4. `js/config.js` → `firebase: {...}` में Firebase का web config चिपकाएँ।
5. एडमिन ऐप में "Sign in with Google" से `adminEmails` वाले खाते से लॉगिन करें, फिर PIN से पैनल खोलें।

Live संग्रह: `knNews` (ख़बरें), `knConfig/app` (डेमो छुपाना), `knUsers/{uid}` (बुकमार्क, My Feed, भाषा)।

## 5. Auto-Feed (RSS)
एडमिन → 📡 Auto-Feed में Google News RSS की 3 हिंदी खोजें पहले से भरी हैं। ब्राउज़र CORS के कारण इन्हें सीधे नहीं पढ़ सकता। दो रास्ते हैं:
- अपना Cloudflare Worker (मुफ़्त) बनाकर उसका पता "CORS proxy prefix" में डालें, या
- Firebase Cloud Function (Blaze) बनाएँ, जो हर 30 मिनट RSS पढ़कर `knDrafts` में डाले।

आए हुए आइटम Draft queue में जाते हैं → "✨ Use" → AI सारांश → Publish।

## 6. Android APK / AAB
```bash
npm install
npm run cap:add      # पहली बार (android/ फ़ोल्डर बनेगा)
npm run cap:sync     # हर बदलाव के बाद
cd android && ./gradlew assembleDebug    # टेस्ट APK
./gradlew bundleRelease                  # Play Store AAB (release key से साइन करें)
```
या GitHub पर push करें: `.github/workflows/android.yml` अपने-आप डिबग APK और AAB बनाकर Artifacts में रख देगा।
पैकेज नाम `in.techgaon.karmcharinews` है। Play Store से पहले ये काम बाकी हैं: release key, privacy policy, Data safety, असली Firebase लॉगिन (Android में Google लॉगिन के लिए `@capacitor-firebase/authentication` प्लगइन)।

## 7. डेमो ख़बरें
10 कार्ड **नमूना** हैं, असली समाचार नहीं (हर कार्ड पर पीला "DEMO" लिखा है)। लाइव करने से पहले Admin → Manage → "Hide the 10 DEMO cards" चालू करें, या उन्हें हटा दें।

---

## 8. 🤖 AI ऑटो-पब्लिश (बिना एडमिन के ख़बरें अपने-आप छपें)
`bot/autopublish.mjs` हर 30 मिनट GitHub Actions पर अपने-आप चलता है (`.github/workflows/autonews.yml`)। हर बार ये काम होते हैं:
1. `bot/feeds.json` की 14 Google News खोजें पढ़ता है (UP कर्मचारी, पंचायत सचिव, DA, पेंशन, 8वाँ वेतन आयोग, शिक्षक, लेखपाल, होमगार्ड, आशा-आंगनवाड़ी, शासनादेश, तबादले, बाराबंकी, बिहार)।
2. कीवर्ड से छाँटता है। एक ही ख़बर कई अख़बारों में हो तो एक ही रखता है, पहले छपी ख़बर दोबारा नहीं छापता।
3. Gemini लेख खोलकर पढ़ता है। ख़बर कर्मचारियों से जुड़ी न हो, या लेख पढ़/पुष्टि न हो सके, तो **नहीं छापता**।
4. 4 भाषाओं में 100-100 शब्द लिखता है → Firestore `knNews` में डालता है → ख़बर सबके ऐप में तुरंत दिखती है। कार्ड पर "🤖 AI सारांश" निशान होता है और स्रोत का लिंक रहता है।
5. **YouTube:** 5 चैनलों (GyanGanv का सचिव, Govt Employees Times, Govt Staff News, GOVERNMENT STAFF, P N News 51) के नए वीडियो Gemini ख़ुद देखता है। वह अफ़वाह या "DA बढ़ेगा?" जैसे वीडियो छोड़ देता है और केवल पक्की ख़बर को वीडियो-कार्ड बनाता है। कार्ड पर ▶ दबाते ही वीडियो ऐप में चलता है। और चैनल एडमिन → 🤖 AI Auto में जोड़ सकते हैं (`bot/feeds.json` में भी)।
6. हर बार अधिकतम 6 ख़बरें छपती हैं (इनमें अधिकतम 3 वीडियो)। 45 दिन पुरानी AI ख़बरें अपने-आप हट जाती हैं।

**रोकना/चालू करना:** ऐप → 🔒 एडमिन → "🤖 AI Auto" टैब का स्विच। इसके लिए एडमिन Google खाते से साइन इन ज़रूरी है।
**कोई ग़लत ख़बर हटानी हो:** एडमिन → Manage → 🗑।

### एक बार की सेटिंग
1. GitHub पर नई रिपॉज़िटरी बनाएँ, जैसे `techgaon/karmcharinews`। पूरा `karmcharinews` फ़ोल्डर अपलोड करें, जिसमें `.github/workflows/` भी हो।
2. Repo → Settings → Secrets and variables → Actions → **New repository secret** से दो secret जोड़ें:
   - `GEMINI_API_KEY`: aistudio.google.com → Get API key → Create API key → कॉपी करें।
   - `FIREBASE_SA`: Firebase console → ⚙️ Project settings → **Service accounts** → "Generate new private key" → जो JSON फ़ाइल डाउनलोड हो, उसे Notepad में खोलकर पूरा पाठ चिपकाएँ। यह फ़ाइल किसी को न दें और अपलोड न करें।
3. Repo → Actions → "Karmchari News — AI auto-publish" → **Run workflow** दबाकर पहली बार चलाएँ। लॉग में "✓ published" दिखेगा।

बॉट Firebase Admin SDK से लिखता है, इसलिए उस पर Firestore नियम लागू नहीं होते। ऐप वाले पाठक केवल पढ़ सकते हैं।
मुफ़्त सीमा: GitHub Actions (public repo मुफ़्त; private में 2,000 मिनट/महीना, यह बॉट ~1,500 मिनट लेगा) और Gemini की मुफ़्त सीमा।
