# ☪️ Sukoon — Islamic Spiritual Wellness App

**Sukoon** (سکون) means "peace" or "tranquility" in Arabic/Urdu. This is a premium Islamic spiritual wellness app built with React Native (Expo), featuring a beautiful emerald & gold design system.

---

## ✨ Features

### 📖 Complete Quran Reader
- All 114 Surahs with Arabic text, English & Urdu translations
- Verse-by-verse audio playback (Mishary Alafasy recitation)
- Tafseer (Maududi commentary) toggle per ayah
- Adjustable Arabic font size
- Reading progress tracking with streaks
- Bookmark any verse for later

### 🤲 Emotion-Based Guidance
- Express how you're feeling in natural language
- AI-powered emotion detection (keyword-based)
- Curated Quranic verses matched to your emotions
- Supports 16+ emotional states (anxiety, gratitude, hope, sadness, etc.)

### 🕌 Prayer Times
- Accurate prayer times based on your GPS location
- Powered by Aladhan API
- Next prayer countdown highlight
- Six daily prayers: Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha

### 🧭 Qiblah Finder
- Real-time compass using device magnetometer
- GPS-based Qiblah angle calculation
- Visual alignment indicator
- Degree display for precision

### 📿 Tasbeeh Counter
- Beautiful circular counter with progress ring
- 5 preset dhikr options (SubhanAllah, Alhamdulillah, Allahu Akbar, etc.)
- Haptic feedback on each count
- Session tracking and completion detection

### 📊 Spiritual Dashboard
- Reading streak tracker
- Total ayahs read counter
- Saved verses count
- Recent activity log

### 🌙 Dark Mode
- Full dark theme with adjusted color palette
- Toggle in settings or from home screen

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native (Expo SDK 52) |
| Navigation | Expo Router v4 (file-based) |
| Language | TypeScript |
| Audio | expo-av |
| Sensors | expo-sensors (magnetometer) |
| Location | expo-location |
| Haptics | expo-haptics |
| Storage | AsyncStorage |
| Icons | lucide-react-native |
| Animations | React Native Animated API |
| Gradients | expo-linear-gradient |

---

## 📂 Project Structure

```
sukoon-app/
├── app/                          # Screens (Expo Router file-based routing)
│   ├── _layout.tsx               # Root layout with providers
│   ├── emotion-result.tsx        # Emotion analysis results
│   ├── (tabs)/                   # Tab navigator
│   │   ├── _layout.tsx           # Tab bar configuration
│   │   ├── index.tsx             # Home screen
│   │   ├── quran.tsx             # Surah list
│   │   ├── saved.tsx             # Saved verses
│   │   ├── others.tsx            # More tools
│   │   └── settings.tsx          # App settings
│   ├── quran/
│   │   └── [surah].tsx           # Dynamic surah reader
│   └── tools/
│       ├── tasbeeh.tsx           # Digital tasbeeh counter
│       ├── qiblah.tsx            # Qiblah compass
│       ├── prayer.tsx            # Prayer times
│       └── dashboard.tsx         # Spiritual insights
├── constants/
│   └── theme.ts                  # Design system (colors, typography, spacing)
├── contexts/
│   ├── ThemeContext.tsx           # Dark/light mode context
│   └── SavedVersesContext.tsx     # Bookmark management context
├── lib/
│   ├── quranService.ts           # Quran API service (alquran.cloud)
│   ├── emotionService.ts         # Emotion detection & verse matching
│   ├── audioPlayer.ts            # Audio playback manager
│   ├── readingProgress.ts        # Reading streak & progress tracker
│   └── prayerTimes.ts            # Prayer times API (aladhan.com)
└── assets/
    ├── images/                   # App icons & splash screen
    └── fonts/                    # Custom fonts (add your own)
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator, or Expo Go app on your phone

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd sukoon-app

# Install dependencies
npm install

# Start the development server
npx expo start
```

### Running on Device
- **Expo Go**: Scan the QR code with Expo Go app
- **iOS Simulator**: Press `i` in the terminal
- **Android Emulator**: Press `a` in the terminal

---

## 🔌 API Integrations

All APIs used are **free and open-source** — no API keys required:

| API | Purpose | Base URL |
|-----|---------|----------|
| Al Quran Cloud | Quran text, translations, audio | `https://api.alquran.cloud/v1` |
| Aladhan | Prayer times calculation | `https://api.aladhan.com/v1` |

---

## 🎨 Design System

The app uses a carefully crafted design system:

- **Primary**: Deep Emerald (`#0D3B2E`) 
- **Secondary**: Teal (`#115E59`)
- **Accent**: Bright Teal (`#14B8A6`)
- **Gold**: Tasteful gold accents (`#D4AF37`)
- **Typography**: Hierarchical scale from Display to Label sizes
- **Arabic**: Special typography scale for Quranic text
- **Shadows**: 4-tier elevation system (sm, md, lg, xl)

---

## 📱 Screenshots

> Replace placeholder assets in `assets/images/` with your custom app icon and splash screen to personalize the app.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🤲 Dua

> *"Our Lord, give us good in this world and good in the Hereafter, and protect us from the torment of the Fire."*  
> — Quran 2:201

Built with ❤️ and ☪️ for the Ummah.
# Sukoon-App
