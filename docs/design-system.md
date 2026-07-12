# Sukoon Design System

Extracted from `constants/theme.ts`, `app/(tabs)/_layout.tsx`, and existing screens.
All new UI (including the Listen/audiobooks feature) must consume these tokens via
`useTheme()` — never hardcode colors.

## Stack context

- **Framework:** Expo SDK 54 / React Native 0.81 / TypeScript, file-based routing with `expo-router` v6.
- **Theming:** `contexts/ThemeContext.tsx` provides `{ theme, mode }` (light/dark). Themes defined in `constants/theme.ts` (`lightTheme` / `darkTheme`).
- **Fonts:** System font for UI; `AlQalamQuran` for Arabic; `JameelNooriNastaleeq` for Urdu text.
- **Localization:** in-house `lib/i18n.ts` (`t('key')`), flat keys in `lib/locales/en.json` + `ur.json`, RTL flag for Urdu.

## Color

| Token | Light | Dark | Use |
|---|---|---|---|
| `primary` | `#143D2B` deep Islamic green | `#40916C` emerald | Brand, active states, CTAs |
| `primaryLight` | `#2D6A4F` | `#52B788` | Gradients, secondary emphasis |
| `accent` | `#3A7D5C` | `#52B788` | Highlights |
| `gold` / `goldLight` | `#D4AF37` / `#F6E27A` | `#E8D44D` / `#F6E27A` | Tasteful accents, badges, streaks |
| `background` | `#F8F9FA` | `#0B0B0C` soft black | Screen background |
| `surface` / `surfaceElevated` | `#FEFCF9` / `#FFFFFF` | `#121214` / `#1A1A1D` | Cards |
| `text` / `textSecondary` / `textTertiary` | `#1A1A1A` / `#6B6B6B` / `#9B9B9B` | `#F5F5F5` / `#B8B8C0` / `#8A8A92` | Copy hierarchy |
| `border` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.07)` | Hairlines |
| `success/error/warning/info` | see theme.ts | see theme.ts | Status |

Signature gradients: `headerGradient` (`['#143D2B','#1B4332','#2D6A4F']` light), `goldGradient`, `accentGradient` — rendered with `expo-linear-gradient`. Dark mode is deliberately **zero-blue** soft black/charcoal.

## Typography (`TYPOGRAPHY`)

- Display: 36/28/24, weight 700–800, tight letter-spacing.
- Headline: 22/18/16, weight 600–700.
- Body: 16/14/12, weight 400.
- Label: 14/12/10, weight 600, +0.5 letter-spacing (used for chips, tab labels, badges).
- Arabic: 32/24/20 with generous line-height.

## Spacing & Shape

- `SPACING`: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64.
- `RADIUS`: sm 8, md 12, lg 16, xl 20, 2xl 24, full 9999. Cards typically `RADIUS.lg`–`2xl`; the floating Quran player uses 28.
- `SHADOWS`: sm/md/lg/xl presets + `glow(color)`. Android elevation baked in.

## Components & patterns

- **Bottom tab bar:** absolute, 60pt + safe-area, `theme.tabBarBg`, hairline top border, active icon gets a soft pill background (`rgba(116,198,157,0.15)` dark / `rgba(27,67,50,0.08)` light). Icons are Ionicons, filled when focused / `-outline` otherwise, size 22, label 10pt/600.
- **Cards:** `surfaceElevated` background, `RADIUS.lg+`, hairline border, `SHADOWS.md`.
- **Headers:** LinearGradient `headerGradient` hero headers with white text (see Home / tools screens).
- **Chips:** pill (`RADIUS.full`), label typography, primary-tinted background when selected.
- **Player (Quran):** floating neumorphic card docked at the bottom (`components/quran/AudioPlayer.tsx`) — waveform, big circular play button, prev/next.
- **Entry animation:** staggered fade+slide (see `useStaggeredEntry` in `app/(tabs)/others.tsx`).
- **Icon families:** Ionicons primarily; FontAwesome6 (`kaaba`), MaterialCommunityIcons (`mosque`) where needed.

## Accessibility / RTL

- Minimum touch target 44pt (padding on small icon buttons).
- `accessibilityLabel`/`accessibilityRole` on controls.
- Urdu is RTL (`I18nManager`); use `flexDirection: 'row'` with logical start/end padding, avoid absolute left/right for text rows.

## Listen (audiobooks) feature adaptation

Chaptrs-inspired UX, Sukoon skin: hero carousel uses `headerGradient` cards with gold accents (never orange/purple); narration badges use `gold` (AI) / `primary` (human) / `accent` (recitation) tints; kids shelf uses brighter emerald/gold pairings but stays within this palette. Cover art fallback = gradient card with title + author in display type.
