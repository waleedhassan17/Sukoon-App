# Listen (Audiobooks) — Pending Tasks

State as of 2026-07-15: **19 of 23 catalog books live** (107.9 h of audio on
R2, published to Firestore `audiobooksCatalog`). These are the remaining work
items — assign this file as a task to complete them.

## Task 1 — Generate the 3 Sukoon Originals (blocked on human review)

The scripts exist as gated drafts in `tools/tts_agent/scripts/` (repo root
`Sukoon/tools/`, not in this git repo):

- `stories-of-the-prophets-for-kids.md` → book `sukoon-stories-prophets-kids`
- `40-hadith-for-little-muslims.md` → book `sukoon-40-hadith-little-muslims`
- `productivity-from-the-sunnah.md` → book `sukoon-productivity-sunnah`

Steps when assigned:
1. The scripts are **outline drafts** — write the full narration text for each
   (kids stories: gentle retellings; hadith lessons: one hadith + simple
   explanation + tiny practice, references verified against the named
   collections; productivity: expand each chapter from the outlined hadith).
2. Present the finished scripts to the owner for review — audio must NOT be
   generated until the owner confirms. Then flip line 1 of each file from
   `STATUS: REVIEW REQUIRED` to `STATUS: APPROVED`.
3. Run `bash tools/tts_agent/run_remaining.sh` — the three books are already
   configured in `books.json` (voices set); it generates → uploads to R2 →
   marks ready → publishes to Firestore automatically.
4. Commit the updated `seed/catalog.json` per book and push to GitHub.

## Task 2 — Riyad us-Saliheen selections (blocked on a legal source)

Catalog entry `riyad-us-saliheen-selections` stays `pending`. The open
hadith-api does not carry it and English translations are modern/copyrighted.
When assigned: search for a verifiable public-domain or licensed English
translation; if found, add a fetcher entry in `tools/tts_agent/books.json`
(record `textSourceUrl` + license proof), regenerate, publish. If none exists,
propose replacing the entry with a different PD hadith collection.

## Task 3 — Housekeeping / follow-ups (do opportunistically)

- Put `tools/tts_agent/` + `firestore.rules` under version control (either
  `gh auth login` + new repo, or move into this repo under `tools/`). The
  agent's `.env` (R2 + Gemini secrets) must stay untracked — add to
  `.gitignore` first.
- **Never re-run the agent** for `travels-of-ibn-battuta`,
  `short-history-saracens`, `kashf-al-mahjub` without re-pruning: their
  sources contain OCR-garbage/index pages that were manually pruned
  (Ibn Battuta ch 4-6, 21, 54-62; Saracens ch 112; Kashf ch 84-90 — pruned
  from catalog and deleted from R2). A `--regenerate` run would re-add them.
- Lock-screen/media-notification controls + Android Auto still need
  `react-native-track-player` (owner decision — see
  `docs/audiobooks-implementation-plan.md`).
- Optional: enable billing on the Gemini key (currently zero free-tier quota)
  and re-run the agent's title pass for nicer chapter titles on the
  heuristic-titled books (e.g. Saracens "Chapter Xxxii — Part 10").
