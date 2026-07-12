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
