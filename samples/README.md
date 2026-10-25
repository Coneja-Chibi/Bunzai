# Real-sample corpus (round-trip test fixtures)

Sample files, one or more per format, used to prove that each codec exposes EVERY authored field as
first-class editable schema (not escrow) and round-trips losslessly. Community-sourced files are only kept when their
license allows redistribution; the community lorebooks and cards that were not clearly licensed were replaced by
hand-authored synthetic fixtures with invented content (marked "Synthetic: yes" in each folder's `SOURCES.md`).

Rule (see docs/02-ARCHITECTURE.md): a format is "done" only when every authored field
in its sample survives to an editable canonical slot. Scripts/behavior count as authored content.

## Layout

`samples/<platform>/<content-type>/<name>.<ext>` (characters/, lorebooks/, ...) plus a `SOURCES.md` per folder recording the exact download URL + date +
what makes the sample useful (which rich fields it exercises). Keep samples small where possible; large or
licensing-sensitive files are referenced by URL in SOURCES.md and downloaded on demand, not committed.

## Lorebook corpus sources

Downloaded for import/round-trip testing. 1–2 samples per host family.

## Codec status (as of fixture work)

| Path | Standalone codec | Notes |
|------|------------------|--------|
| `sillytavern/lorebooks/*.json` (object `entries` map) | `sillytavern-lorebook` | Full RT |
| `chub/lorebooks/*.book.json` (array entries) | ST @ 0.85 / Agnai @ 0.7 | CCv3 character_book; ST re-exports keyed worldbook; Agnai re-exports MemoryBook |
| `agnai/lorebooks/*` (same as Chub books) | Agnai @ 0.7 | Not native MemoryBook on disk; soft-import works |
| `novelai/lorebooks/*` | `novelai-lorebook` | Full RT (`.lorebook` / json) |
| `risu/lorebooks/test-character-book.json` | Risu @ 0.75 | Synthetic card book; re-exports native `{type:risu,data}` envelope |
| `rolecall/lorebooks/*` | `rolecall-lorebook` | Full RT |

Native Agnai MemoryBook (`kind:"memory"`, `keywords`/`entry`) and native Risu envelope still preferred when available.

## SillyTavern (World Info JSON)

| File | Source |
|------|--------|
| `sillytavern/lorebooks/test-world.json` | Synthetic, hand-authored (see `sillytavern/SOURCES.md`) |
| `sillytavern/lorebooks/test-scenario.json` | Synthetic, hand-authored (see `sillytavern/SOURCES.md`) |

Native ST World Info shape: `{ entries: { "0": { uid, key, content, … } } }`.

## Chub (standalone lorebooks)

Hand-authored synthetic books (see `chub/SOURCES.md`).

| File | Source |
|------|--------|
| `chub/lorebooks/test-lorebook.book.json` | Synthetic, hand-authored |
| `chub/lorebooks/test-large.book.json` | Synthetic, hand-authored |

Shape: `{ name, entries, scan_depth, token_budget, recursive_scanning, … }` (character-book / ST-adjacent).

## Agnai (Memory Book)

Agnai imports Chub JSON as memory books; the files below are copies of the synthetic Chub books.

| File | Source |
|------|--------|
| `agnai/lorebooks/test-lorebook-as-memory-book.json` | Same as the Chub test book |
| `agnai/lorebooks/test-large-as-memory-book.json` | Same as the Chub large test book |

## NovelAI

| File | Source |
|------|--------|
| `novelai/lorebooks/test-lorebook.lorebook` | Synthetic, hand-authored (see `novelai/SOURCES.md`) |
| `novelai/lorebooks/nai-v6-crystal-dragon.lorebook.json` | See `novelai/SOURCES.md` |

## RisuAI

| File | Source |
|------|--------|
| `risu/lorebooks/test-character-book.json` | Synthetic; the `data.character_book` of `risu/characters/test-risu.card.json` |

No standalone Risu lorebook export is committed; the card-embedded book is the fixture.

## RoleCall

| File | Source |
|------|--------|
| `rolecall/lorebooks/aetheria-lorebook.v1.json` | See `rolecall/SOURCES.md` |
