# Sukoon Audiobooks ("Listen") — Implementation Plan

## Phase 0 findings

| Assumption in the brief | Reality in this repo | Adaptation |
|---|---|---|
| Native Android (Kotlin/Compose), media3/ExoPlayer | **Expo SDK 54 / React Native 0.81 + TypeScript**, expo-router v6 | All player work uses **expo-av** (which wraps ExoPlayer on Android), mirroring the existing Quran engine `lib/audioPlayer.ts` |
| Room local DB | **AsyncStorage** offline-first + `DataSyncService` (last-write-wins sync to Firestore `users/{uid}/{collection}`) | Progress/library/stats stored in AsyncStorage, synced through a new `audiobooks` DataSync domain |
| Backend TBD | **Firebase**: Firestore + anonymous auth + FCM + Functions | Catalog ships as a **bundled seed** (`seed/catalog.json`) with an optional Firestore `audiobooksCatalog` override collection (additive security rule, read-only for clients) |
| media3 DownloadService | No native download service | **expo-file-system** downloads to app-private storage, license-gated |
| MediaSession notification / lock-screen / Android Auto | expo-av alone has **no media-notification API**; the existing Quran player has the same limitation | Background playback works (`staysActiveInBackground`); lock-screen/Android Auto controls require adding `react-native-track-player` or `expo-audio` + media session — **flagged as a decision for the owner** (heavy dependency; brief says ask first) |
| "existing LLM keys" | Gemini via `EXPO_PUBLIC_GEMINI_API_KEY` (`lib/quranVoiceService.ts`) | TTS agent's LLM pass uses `GEMINI_API_KEY` env var |
| Existing analytics | None wired in the app | Lightweight `lib/audiobooks/analytics.ts` event logger (single integration point, documented) |

**Existing Quran audio player** (`lib/audioPlayer.ts`): singleton class over `Audio.Sound`, preload cache, fade in/out, speed 0.5–2.0, repeat modes, status/finish callbacks. The surah screen (`app/quran/[surah].tsx`) drives ayah playlists itself. Azan playback is a separate expo-av user (`lib/azanPlayer.ts`).
**Reuse decision:** do **not** merge audiobooks into that class (ayah-level preloading/fading is Quran-specific). Instead: a sibling `AudiobookPlayer` service reusing its proven patterns, plus a tiny shared **`audioFocus`** coordinator so Quran audio, Azan, and audiobooks never play simultaneously (one-line hooks into the existing players — only edit to existing audio code).

Verified sources (2026-07-12): `archive.org/metadata/meaning_glorious_koran_0810_librivox` (114 ch.) and `holy_koran_1907_librivox` (210 files incl. 64kb variants) both live; `mp3quran.net/api/v3/reciters` live.

## Data model (AsyncStorage + seed JSON; names follow project conventions)

- `Book`: id, title, author, narrator, description, coverUrl, category, language(en|ur|ar), source(librivox|archive|podcast|own|quran), license(public_domain|cc|permission|own), narrationType(human|ai|recitation), isKids, totalDurationSec, status(ready|pending|generating), textSourceUrl, ttsVoice, attribution, chapterSource (how to resolve chapters).
- `Chapter`: id, bookId, index, title, audioUrl, durationSec, fileSizeBytes, status, ttsModel, generatedAt.
- `BookProgress`: bookId, chapterId, chapterIndex, positionMs, updatedAt, completed, secondsListened.
- `LibraryEntry`: bookId, addedAt, downloadedBytes.
- `ListenStats`: per-day secondsListened (`sukoon_listen_daily_YYYY-MM-DD`), streak, badges — same date/streak conventions as `readingProgress.ts` Salah streak.

Chapter resolution strategies (`chapterSource.kind`):
`static` (chapters inline in catalog — TTS/CDN books) · `archive` (archive.org metadata API → mp3 files) · `mp3quran` (reciter moshaf server + zero-padded surah) · `rss` (podcast feed → enclosures; feed found via iTunes search term; stream-from-origin, attribution shown, never downloadable).

## File map

```
seed/catalog.json                     launch catalog (licenses recorded per item)
lib/audiobooks/types.ts               data model
lib/audiobooks/catalog.ts             seed + optional Firestore override, caching
lib/audiobooks/chapterResolver.ts     archive / mp3quran / rss / static resolvers
lib/audiobooks/progress.ts            resume positions, library, completion (+cloud sync)
lib/audiobooks/streaks.ts             pure streak/badge math (unit-tested)
lib/audiobooks/stats.ts               listening-seconds accounting, badge evaluation
lib/audiobooks/downloads.ts           license-gated offline downloads (expo-file-system)
lib/audiobooks/player.ts              AudiobookPlayer singleton (expo-av)
lib/audiobooks/analytics.ts           event logging seam
lib/audioFocus.ts                     cross-feature "only one audio source" coordinator
contexts/AudiobookPlayerContext.tsx   React state bridge for all screens
components/listen/*                   MiniPlayer, BookCover, Shelf, HeroCarousel,
                                      CategoryChips, NarrationBadge, ProgressBar
app/(tabs)/listen.tsx                 Listen home (hero, Jump back in, chips, shelves, kids row)
app/listen/_layout.tsx                stack for detail screens
app/listen/book/[id].tsx              book detail (chapters, play, download, attribution)
app/listen/player.tsx                 full-screen player (scrubber, ±15/30s, speed, sleep timer)
app/listen/category/[cat].tsx         category / kids listing
app/listen/search.tsx                 search
tools/tts_agent/ (repo root)          Python generate-once pipeline (Phase 3)
```

Edits to existing files (kept minimal): tab layout (+Listen tab), root `_layout.tsx` (provider + global MiniPlayer), `lib/audioPlayer.ts` + `lib/azanPlayer.ts` (audio-focus hook, ~3 lines each), `app/insights.tsx` (listening card), locales (new `listen.*` keys), `firestore.rules` (additive read-only catalog rule), `app.json` (version bump).

## Task list

1. **Phase 1** — types, seed catalog, catalog service, chapter resolvers, progress/library/stats/streaks, downloads. ✚ unit-testable pure modules.
2. **Phase 2** — audioFocus + AudiobookPlayer service, context, MiniPlayer, all screens, i18n EN+UR, insights card, tab.
3. **Phase 3** — `tools/tts_agent/`: fetch→clean→LLM chapterize/normalize→pronunciation dict→chunk→TTS (Kokoro default; edge-tts for Urdu; Piper fallback; pluggable)→concat→loudnorm −16 LUFS→intro→64kbps mono MP3→R2 upload→catalog upsert. Idempotent (`--book`, `--resume`, `--regenerate`).
4. **Phase 4** — tests (streaks, progress, catalog normalization, cleaner/pronunciation), `docs/content-ops.md`, changelog + version bump, regression pass (tsc + manual checklist).

## Decisions needing owner input (flagged, not blocking)

1. **Lock-screen/notification controls + Android Auto** → requires `react-native-track-player` (native module, config-plugin, new build). Recommended follow-up; not added silently.
2. **Firestore rule addition** for `audiobooksCatalog` (public read, no client writes) — additive; deploy with `firebase deploy --only firestore:rules` when ready.
3. **Object storage**: no bucket exists in the project; TTS agent targets Cloudflare R2 via S3 SDK (env-configured). Any S3-compatible endpoint works.
4. **Kids PIN gate**: shipped without PIN (content is already curated + license-clean); trivial to add later.
