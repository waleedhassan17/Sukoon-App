# Listen (Audiobooks) — Content Operations

How to add books, run the TTS agent, and stay legally clean.
Related: `docs/audiobooks-implementation-plan.md`, `tools/tts_agent/README.md` (repo root).

## The three content types

### 1. Ready audio (stream from origin — store nothing)

Audio that already exists legally on the open web. Add a catalog entry in
`seed/catalog.json` with `status: "ready"` and the right `chapterSource`:

- **LibriVox / archive.org audio** — `{ "kind": "archive", "identifier": "<item id>" }`.
  The app pulls the item's metadata API, prefers `_64kb.mp3` derivatives, and
  streams `https://archive.org/download/{identifier}/{file}`. License: LibriVox
  recordings are public domain — still record `textSourceUrl` as proof.
- **Quran recitation** — `{ "kind": "mp3quran", "reciterId": N, "moshafId": N }`.
  Find ids at `https://www.mp3quran.net/api/v3/reciters?language=eng`.
  `narrationType: "recitation"`.
- **Podcasts** — `{ "kind": "rss", "itunesCollectionId": N }` (find via
  `https://itunes.apple.com/search?media=podcast&term=…`). Rules baked into the
  app: stream **only** from the original enclosure URLs, show the `attribution`
  line, never downloadable, never behind any future paywall. License field:
  `permission` (the public feed is the permission surface); remove immediately
  on any creator request.

### 2. TTS-generated (generate once, store forever)

Public-domain texts converted by `tools/tts_agent` (repo root):

1. Add the book to **both** `seed/catalog.json` (with `status: "pending"`,
   `chapterSource: {"kind":"static"}`, `chapters: []`, `narrationType: "ai"`)
   and `tools/tts_agent/books.json` (same id + text source).
2. `python agent.py --book <id> --dry-run` — sanity-check the chapter split.
3. `python agent.py --book <id>` — generates, uploads to R2, flips the seed
   entry to `status: "ready"` with real chapters/durations, and (if configured)
   upserts Firestore `audiobooksCatalog/<id>` so shipped apps update instantly.
4. Commit the updated `seed/catalog.json`.

Voice upgrades: pick a better voice, run with `--regenerate` — every user gets
the improved audio with no app update (chapter URLs are stable).

### 2a. Full-catalog generation → storage → Firestore (the production flow)

Audio bytes **cannot live in Firestore** (1 MB/document limit) — Firestore
carries the catalog metadata; MP3s live in object storage. One-time setup:

1. **Storage** — create a Cloudflare R2 bucket (free 10 GB, zero egress; the
   whole catalog ≈ 3 GB at 64 kbps) and put `R2_ENDPOINT`, `R2_BUCKET`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `PUBLIC_BASE_URL` in
   `tools/tts_agent/.env`. (Firebase Storage also works via its S3-compatible
   endpoint but requires the Blaze plan.)
2. **Firestore publish** — `python3 tools/tts_agent/publish_firestore.py`
   publishes every ready seed book to `audiobooksCatalog/{bookId}` using the
   developer's existing `firebase login` session (no service-account file
   needed). First publish + rules deploy done 2026-07-12; re-run after every
   agent batch.
3. **Rules** — `firebase deploy --only firestore:rules` (read-only
   `audiobooksCatalog`; deployed 2026-07-12).

Then run `bash tools/tts_agent/run_remaining.sh` (or with
`nohup … & disown` for overnight runs). It is **fully resumable**: chapters
already in `out/` or in the bucket are reused, never re-TTSed — so audio can
be generated offline first and uploaded later just by re-running the script
after adding credentials. Each finished book is upserted into
`audiobooksCatalog/{bookId}`; live apps pick it up within the catalog cache
TTL (≤12 h) or on pull-to-refresh — no app release needed.

### 2b. Bundled in-app audio (ships with the Play Store install)

A small set of compact, high-value titles ships **inside the app binary** so
they play offline from first launch with no download step:

1. Generate with the agent locally: `python agent.py --book <id> --engine edge --no-upload`.
2. Copy the MP3s to `assets/audiobooks/<bookId>/` in the app.
3. Add each chapter to the require-map in `lib/audiobooks/bundledAudio.ts`
   and set the catalog chapters' `audioUrl` to `bundled://<bookId>/<index>`.

**Size budget is the hard constraint:** 64 kbps mono ≈ 0.5 MB per audio-minute,
and the base APK is already ~129 MB (Play's AAB base limit is 200 MB). Only the
40-hadith collections are bundled (~35 MB total). Long books (Alchemy of
Happiness ≈ 5h ≈ 140 MB) must go to the CDN — bundling them is not possible
within Play Store limits.

### 3. Sukoon Originals

Scripts live in `tools/tts_agent/scripts/*.md` and carry
`STATUS: REVIEW REQUIRED` on line 1. **The agent refuses to synthesize a
script until a qualified human reviews it** (hadith references, theology,
age-appropriateness for kids) and changes the line to `STATUS: APPROVED`.

## Legal checklist (every single item)

- [ ] License is one of: public_domain / cc / own / explicit written permission.
- [ ] `textSourceUrl` (or feed/item URL) recorded in the catalog as proof.
- [ ] Translation date checked — a public-domain *original* can have a
      **copyrighted modern translation** (e.g. Gibb's Ibn Battuta). Use only
      pre-1930 translations unless licensed. This is why "Maxims of Ali" is not
      in the launch catalog: no verified PD translation was found.
- [ ] Never rip content from Chaptrs, Audible, YouTube or any commercial app.
- [ ] Never TTS-convert a copyrighted book or translation.
- [ ] Podcast items: attribution string set; stream-from-origin; not downloadable.
- [ ] Kids items (`isKids: true`): human-reviewed, no ads/tracking of any kind.

**Takedown contact:** publish a contact email in the store listing; on any
rights-holder request remove the catalog entry (Firestore + next seed release)
— streams stop immediately since podcasts/archive content is never re-hosted.

## Data safety (Play Console notes)

The Listen feature stores listening positions, library, daily listening seconds
and badges **on-device**, mirrored to the user's own Firestore document
(`users/{uid}/audiobooks/*`) via the existing anonymous-auth sync — same
category as the existing Salah tracker sync; no new data types collected.
`lib/audiobooks/analytics.ts` keeps a small local-only event buffer; nothing is
sent to third parties. If a real analytics SDK is wired later, update the Data
Safety form before release.

## Operational notes

- Catalog overrides ship through Firestore `audiobooksCatalog` (read-only for
  clients — deploy `firestore.rules` before first use:
  `firebase deploy --only firestore:rules`).
- The bundled seed catalog is the offline fallback; keep it current with every
  agent run so fresh installs work without Firestore.
- Storage layout: `audiobooks/{bookId}/{index:03d}.mp3`, immutable cache
  headers; ~28 MB per audio-hour at 64 kbps mono.
