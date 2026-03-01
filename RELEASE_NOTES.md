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
