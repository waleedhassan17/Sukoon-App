# Sukoon v1.4.0 — Release Notes

## Release Name
**v1.4.0 — Prayer Times & New Look** (versionName 1.4.0, versionCode 35 via EAS remote auto-increment, OTA runtime 1.1.0)

---

## 📋 Google Play Console — Release Notes (each under Play's 500-character limit)

### English (en-US)
```
Prayer times you can rely on 🕌

• Azan alerts arrive on time, even if you don't open the app for days
• Accurate prayer times anywhere in the world, even offline
• Redesigned Prayer Times screen with a live countdown
• Fresh new look: new logo, app icon and splash screen
• Clearer Qibla compass and improved Tasbeeh
• Share any Ayah or Hadith as a beautiful image card
• Speak your feelings and get Quranic guidance instantly
• Easier navigation with five tabs
• Bug fixes and improvements
```

### Urdu (ur)
```
نماز کے اوقات جن پر بھروسا کیا جا سکے 🕌

• ایپ کھولے بغیر بھی اذان کی اطلاع وقت پر ملتی رہے گی
• دنیا میں کہیں بھی درست نماز کے اوقات، انٹرنیٹ کے بغیر بھی
• نماز کے اوقات کی نئی اسکرین، اگلی نماز تک الٹی گنتی کے ساتھ
• نیا لوگو، ایپ آئیکن اور اسپلیش اسکرین
• بہتر قبلہ کمپاس اور تسبیح کاؤنٹر
• کسی بھی آیت یا حدیث کو خوبصورت تصویر کی صورت میں شیئر کریں
• بول کر اپنے احساسات بتائیں اور فوراً قرآنی رہنمائی پائیں
• آسان نیویگیشن کے لیے پانچ ٹیبز
• خرابیوں کی درستگی اور بہتر کارکردگی
```

### Internal changelog

**Prayer times & azan reliability**
- Offline engine (`lib/prayerEngine.ts`, `adhan`): times are absolute instants computed on the device — no network, no timezone/DST drift, polar-circle safe. **No user-facing calculation settings:** method + Asr school are derived from the location by a region table (Karachi + Hanafi across South Asia, Umm al-Qura, Dubai, Qatar, Kuwait, Tehran, Turkey (single-shadow Asr), Egyptian, ISNA, Singapore/JAKIM, MWL elsewhere; Shafi'i pockets of Sri Lanka/Kerala keep the standard Asr).
- Verified against an independent reference (Aladhan) for 26 cities, mostly within 0–2 min: `__tests__/prayerGolden.test.ts`; 93-city method matrix in `prayerEngine.test.ts`. The QA pass found and fixed a real bug (Turkey defaulted to Hanafi Asr, +38 min).
- Root cause of "must open the app daily": the background task was defined inside a React effect (`defineTask` must be global-scope), so the OS unregistered it, and the window was only 7 days refilled by foreground JS. Now: task defined at module scope (`lib/prayerBackgroundTask.ts`), up to 30 days on Android / as many whole days as fit under iOS's 64-notification cap, repeating DAILY reminders, diff-by-signature top-up on every launch/foreground (`lib/prayerSchedule.ts`, serialised queue), a "keep your reminders running" safety-net notice before the window ends.
- Android channels are versioned (`*-v2`) and created only if missing; azan-sound-off and Fajr-special-sound toggles now actually work (channel is chosen per notification); `sukoon-friends` channel created.
- Salah Settings → **Reliability** section: permission status, "scheduled through <date>", send-test-azan, exact-alarm and battery-optimisation shortcuts, OEM autostart tip. Tapping an old azan notification no longer replays the azan; Friday's Dhuhr is "Jumu'ah".

**Screens**
- Prayer Times: restyled in the Salah Tracker's visual language so the prayer screens read as one family. Flat gradient header with the gold ornament (`components/prayer/PrayerHeader.tsx`), location and Gregorian · Hijri date line, a stats-style panel (next prayer · begins · live countdown, which rolls to tomorrow's Fajr after Isha; `NextPrayerPanel.tsx`), and Tracker-style cards with the Arabic name, an "Up next" pill and a per-prayer bell (`PrayerRow.tsx`). The Salah Tracker, Friends, Invites and Tracker Settings are unchanged.
- Qibla: one compass (SVG face, Kaaba marker, fixed pointer), "Turn right 42°" guidance, gold "facing the Qibla" state with hysteresis, distance to the Kaaba; starts instantly from the last-known location (GPS now has a timeout), compass stops when the screen is hidden; maths in `lib/qiblahService.ts` cross-checked against an independent vector implementation.
- Tasbeeh: real SVG progress ring, lossless rapid tapping, the open dhikr and in-progress round are saved, visible reset, translated (EN/UR), accessible.
- Shared `ToolHero` (Qibla, Tasbeeh) / `ToolStateCard`.

**New logo & splash**
- The heart-and-flowers mark replaces the gold crescent everywhere: app icon, Android adaptive icon plus a new Android 13+ themed (monochrome) icon, native splash, Settings → About, the share-card footer and the favicon. The notification icon is now a proper white silhouette; the old one was opaque, so Android drew it as a white square.
- One master (`assets/brand/sukoon-logo.png`) feeds every size through `tools/brand-assets.py`. It downscales only and never recolours, and places the art on the logo's own green `#1F3621` (now the splash and adaptive-icon background), so the logo looks exactly as designed. The script also prints fidelity checks (colour shift, safe zone, splash circle).
- Splash: the mark is larger (150 dp, `imageWidth` = `MARK_SIZE`). It beats once with a soft pulse ring, then the wordmark and tagline settle in, in the logo's cream (~1.6 s). Reduce Motion just holds and fades.

**Emotion detection**
- API call has a single hard deadline (headers + body; ≤ 20 s total, 1 retry) — previously a stalled body hung the screen forever. After 6 s the screen offers *Show offline guidance* / *Cancel*; an offline result is labelled with the reason and a Retry. Offline fallback matches whole words and understands Urdu / Roman Urdu. Ayah ranges ("5-6") no longer break save/share.
- The in-input mic now detects emotions automatically once speech finishes (silence, end of speech or tapping stop); editing the text cancels it. Recognition language follows the app language. Endpoint overridable with `EXPO_PUBLIC_EMOTION_API_URL`.

**Image sharing (Ayah & Hadith)**
- Every Ayah / Hadith share is now a designed PNG card (1080 px wide), never plain text: leaf ornament, Arabic (AlQalamQuran), translation (serif italic or Nastaleeq), uppercase reference pill, narrator line and grade for Hadith, subtle Sukoon mark.
- Share sheet with a live preview (exactly what gets sent): Emerald / Midnight / Ivory, Post 4:5 / Story 9:16, English / اردو; choices are remembered. Defaults to the translation the reader is showing.
- Auto-fit type (`lib/shareCard.ts`, calibrated on the real fonts): short verses are set large, long ones shrink at most 20%, then the card grows — Quran text is never truncated.
- Wired into the Quran reader (card + page mode), Hadith reader, Saved (verses + hadith), Emotion result (keeps verse ranges like 5-6), and a new Share button on Home's Daily Ayah. Old text builder `lib/shareFormat.ts` removed.
- New native modules: `react-native-view-shot` 4.0.3 + `expo-sharing` ~14.0.8 (SDK 54 pins). **OTA runtime bumped `1.0.0` → `1.1.0`** in `app.json`, `android/.../strings.xml` and `ios/.../Expo.plist` (the native folders are gitignored but uploaded to EAS) so this JS can never reach a binary without the modules. Lazy-loaded, so web / Expo Go show an "update needed" note instead of crashing.

**Navigation & content**
- Five bottom tabs (Listen removed); Listen opens from Home Quick Access and the Books tab; mini-player no longer overlaps Home's mic button.
- Original narrations only: fail-closed filter in `CatalogService` (hides AI books from the seed, Firestore and on-device caches); 16 AI books and ~34 MB of bundled audio removed; one-time cleanup of previously downloaded AI files.
- `useSafeBack` on all 32 back buttons — no more "GO_BACK was not handled by any navigator", falls back to a sensible parent and ignores double taps.

**Housekeeping**
- `app.json`: removed the invalid `android.useNextNotificationsApi`; `npm run start:go` (Expo Go) / `npm run start:dev` (dev build).
- 564 tests in 21 suites (`npm test`), including an en/ur translation-integrity guard.

**Before shipping / follow-ups**
- Image sharing needs the new native build: test on a dev build / release APK (WhatsApp chat + Status, Instagram Story, Save to Photos). iOS: run `pod install` before an iOS build. Updates published for runtime `1.0.0` keep serving the current store build only.
- New logo, splash and notification icon only show up in a new native build. EAS builds from the gitignored `android/` folder, so on the build machine run `python3 tools/brand-assets.py` and then `npx expo prebuild --platform android --no-install`, and keep only the `res/` changes: prebuild rewrites the versionCode comment in `android/app/build.gradle` and reorders `AndroidManifest.xml`, so restore those two files. Don't publish this JS as an OTA to a binary with the old native splash (the colours would clash at handoff).
- Build a fresh APK/AAB — the APK in the repo (v1.2.4) predates all of this. `versionCode` is managed remotely by EAS (`appVersionSource: remote`, last production build was 34), so the values in `app.json` (19) and `android/app/build.gradle` (17) are ignored. versionName is read from `android/app/build.gradle`, so bump it there as well as in `app.json`.
- Optional admin step: delete the AI docs from Firestore `audiobooksCatalog` (hidden by the client either way).
- Rotate the Gemini key that is in plain text in `claude.md`; set `EXPO_PUBLIC_GEMINI_API_KEY` in the EAS dashboard for cloud builds.
- Migrate `expo-background-fetch` (deprecated) to `expo-background-task`; consider `npx expo install --fix` (10 SDK-54 patch bumps); Play policy: `USE_EXACT_ALARM` is restricted to alarm/calendar apps.
- Known trade-off: with no Asr setting, Hanafi users in standard-Asr regions (e.g. the UK) see the earlier Asr.

---

# Sukoon v1.3.0 — Release Notes

## Release Name
**Sukoon v1.3.0 — سکون** *(Listen)*

---

## 📋 Google Play Console — Release Notes (draft)

### English (en-US)
```
NEW: Listen — an Islamic audiobook library 🎧

• Audiobooks: Qur'an translations, Sirah, Hadith, spirituality, history & kids stories
• Full player with sleep timer, playback speed and 15s/30s skips
• Mini-player follows you across the whole app
• Download chapters for offline listening (where the license permits)
• Continue exactly where you left off — synced across your devices
• Listening streaks and badges in Spiritual Progress
• Every book is clearly labelled: human narration, AI narration or recitation
• Full English + Urdu support

May Allah accept this effort.
```

### Internal changelog
- New Listen tab (audiobooks): home shelves, categories, search, book detail,
  full player, global mini-player, kids section.
- Playback: expo-av chapter-playlist engine with resume (saved every 10s +
  on pause, cloud-synced), 0.75x–2x speed, sleep timer (minutes or
  end-of-chapter), auto-advance, offline downloads.
- Audio focus: Quran recitation, Azan and audiobooks can never play over each
  other (lib/audioFocus.ts).
- Catalog: bundled seed (legally-free launch titles with recorded licenses) +
  optional Firestore `audiobooksCatalog` overrides; additive security rule.
- TTS agent (tools/tts_agent, repo root): generate-once pipeline — Kokoro
  default, edge-tts for Urdu, Piper fallback; pronunciation dictionary;
  −16 LUFS; 64kbps mono MP3; idempotent R2 uploads; catalog upserts.
- Tests: 38 app unit tests (streaks, progress, catalog, resolvers) +
  20 agent tests (cleaner, pronunciation, chunker). `npm test`.
- versionCode 19. Known follow-up: lock-screen/media-notification controls
  need react-native-track-player (owner decision — see
  docs/audiobooks-implementation-plan.md).

---

# Sukoon v1.0.0 — Release Notes

## Release Name
**Sukoon v1.0.0 — سکون** *(First Light)*

---

## 📋 Google Play Console — Release Notes

### English (en-US)
```
Sukoon — Your Islamic Companion for spiritual peace 🕌

✨ Key Features:
• Full Quran with Arabic text, Urdu & English translations
• Multi-source Tafseer — Ibn Kathir, Jalalayn, Bayan al-Quran & more
• Audio recitation with smooth playback controls
• Qiblah compass with live direction finder
• Accurate prayer times based on your location
• Salah tracker with daily/weekly progress
• Digital Tasbeeh counter
• Smart notifications for prayer reminders
• Beautiful dark theme for comfortable reading

🎯 Built with love for the Ummah. May Allah accept this effort.
```

### Urdu (ur)
```
سکون — آپ کا اسلامی ساتھی 🕌

✨ خصوصیات:
• مکمل قرآن مجید عربی متن، اردو و انگریزی ترجمے کے ساتھ
• تفسیر — ابن کثیر، جلالین، بیان القرآن اور مزید
• تلاوت آڈیو
• قبلہ کمپاس
• نماز کے اوقات
• نماز ٹریکر
• ڈیجیٹل تسبیح
• نماز کی یاددہانی
```

---

## 🏗️ Build Information

| Property | Value |
|---|---|
| **App Name** | Sukoon |
| **Package** | `com.sukoon.app` |
| **Version Name** | 1.0.0 |
| **Version Code** | 1 |
| **Min SDK** | 24 (Android 7.0) |
| **Target SDK** | 35 (Android 15) |
| **Architecture** | armeabi-v7a, arm64-v8a |
| **Signing** | v2 APK Signature Scheme |
| **Hermes** | Enabled |
| **Proguard/R8** | Enabled (minify + shrink) |
| **Console Logs** | Stripped in production |

### Output Files
- **AAB (Play Store):** `sukoon-v1.0.0-release.aab` — 48 MB
- **APK (Direct):** `sukoon-v1.0.0-release.apk` — 57 MB

---

## 📱 How to Upload to Play Store

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app **Sukoon** (`com.sukoon.app`)
3. Go to **Release** → **Production** (or Internal Testing first)
4. Click **Create new release**
5. Upload `sukoon-v1.0.0-release.aab`
6. Add the release name: `v1.0.0 — First Light`
7. Paste the release notes from above
8. **Review and roll out**

---

## 🔑 Keystore Information

> ⚠️ **CRITICAL: Back up your keystore! If lost, you cannot update your app on Play Store.**

| Property | Value |
|---|---|
| **Keystore File** | `android/app/sukoon-release.keystore` |
| **Keystore Type** | PKCS12 |
| **Key Alias** | `sukoon-key` |
| **Validity** | 10,000 days (~27 years) |
| **Algorithm** | RSA 2048-bit |

### Backup Commands:
```bash
# Copy keystore to a safe location
cp android/app/sukoon-release.keystore ~/sukoon-keystore-backup/

# Verify keystore contents
keytool -list -v -keystore android/app/sukoon-release.keystore -storepass sukoon2025release
```

> 💡 **Recommendation:** Change the keystore password before publishing, and store credentials in a password manager or CI/CD secrets — never in source code.

---

## ✅ Production Readiness Checklist

- [x] Release keystore generated (`sukoon-release.keystore`)
- [x] Signing config in `build.gradle` (release uses dedicated keystore)
- [x] ProGuard/R8 enabled with comprehensive rules
- [x] Console logs stripped via `babel-plugin-transform-remove-console`
- [x] Native Android logs stripped via ProGuard `assumenosideeffects`
- [x] Network security hardened (cleartext only for `api.quran-tafseer.com`)
- [x] Debug variant keeps cleartext for dev (separate `AndroidManifest.xml`)
- [x] ARM-only architectures for smaller binary (armeabi-v7a + arm64-v8a)
- [x] PNG crunching enabled for image compression
- [x] Hermes JS engine enabled
- [x] Resource shrinking enabled
- [x] App.json `newArchEnabled` contradiction fixed
- [x] Navigation bar matches dark theme
- [x] Keystore excluded from git (`.gitignore`)
- [x] Signed AAB built for Play Store
- [x] Signed APK built for direct testing
- [x] APK signature verified (v2 scheme)

---

## 🔄 Future Release Workflow

```bash
# 1. Update version in app.json:
#    "version": "1.1.0"
#    "android": { "versionCode": 2 }

# 2. Build AAB for Play Store
cd android
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk
./gradlew bundleRelease

# 3. Build APK for testing
./gradlew assembleRelease

# 4. Find outputs
ls -lh app/build/outputs/bundle/release/app-release.aab
ls -lh app/build/outputs/apk/release/app-release.apk

# 5. Install on device for testing
adb install -r app/build/outputs/apk/release/app-release.apk

# 6. Tag the release
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
```
