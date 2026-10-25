# Chub samples

| File | Provenance |
| --- | --- |
| `rich.extensions.card.json` | Hand-authored Vaude fixture (2026-07-09). ST CCv3 with a filled `data.extensions.chub` bag (id, full_path, background_image, custom_css, preset, related_lorebooks, expressions stubs, Stages refs). Not a live Chub hub download. |


Codec path: SillyTavern adapter (`src/formats/sillytavern/`) carries the bag under `original.sillytavern.raw`. Native UI: `platforms/chub.ts`.

## Lorebooks (synthetic)

Hand-authored, invented content, no download source. Synthetic: yes.

| File | Exercises |
| --- | --- |
| `lorebooks/test-lorebook.book.json` | 6 entries in the Chub book shape: array `entries`, `position` as `after_char`/`before_char`, `selectiveLogic`, a disabled entry, a constant entry, case-sensitive and probability entries, an `extensions.chub` bag (`example.invalid`-style placeholder ids) |
| `lorebooks/test-large.book.json` | 40 generated entries, numeric-string `position`, empty book `extensions` |
