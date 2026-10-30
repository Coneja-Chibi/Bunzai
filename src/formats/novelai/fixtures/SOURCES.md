# NovelAI codec fixtures

## `nai-v3-mal.slice.lorebook.json`

This is a constructed synthetic NovelAI v3-shaped lorebook, not a verbatim slice of the source export.
Its field layout and less common values were scaffolded from `Mal.lorebook.json` in the
`MagicShel/novel-ai` repository (`lore/firefly`). The fictional names, prose, keys, category IDs,
timestamps, and related labels were replaced with a neutral ranger example. The malformed source
label's typo `Characer` is retained as parser input. The fixture preserves
two ordered entries, inline regex and literal keys, per-entry context settings, category/subcontext
settings, and wire residue needed by the codec round-trip tests.

The source repository is credited for structural provenance. The committed fixture is newly
constructed for Bunzai tests and does not claim to reproduce the upstream story content.
