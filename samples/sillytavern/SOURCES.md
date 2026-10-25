# SillyTavern samples

## Seraphina.png
- Source: https://raw.githubusercontent.com/SillyTavern/SillyTavern/release/default/content/default_Seraphina.png
- Downloaded: 2026-07-04
- Why: the official SillyTavern default character - a REAL PNG card that exercises the escrowed surface.
  Card `extensions` populate `talkativeness` ("0.5"), `fav`, `world` ("Eldoria"), and `depth_prompt`
  ({prompt, depth:4, role:"system"}). Embedded `character_book` has 4 entries whose per-entry
  `extensions` populate the full ST-extended set incl. `vectorized`, `group_override`,
  `use_group_scoring`, `automation_id`, `display_index`. Reads through vaud's real PNG path.
- Proves live (de-escrow slice): `toCanonical` now lands `talkativeness` -> `settings.talkativeness` (0.5)
  and `world` -> `worldName` ("Eldoria") as first-class editable slots instead of escrow, and an unedited
  round-trip leaves the `extensions` bag byte-identical. NOTE: Seraphina's `depth_prompt.prompt` is `""`
  (ST's default-when-unset), so it correctly maps to NO injection - this card proves talkativeness/world,
  NOT the `depth_prompt` fix. The depth_prompt de-escrow + edit is proven by the in-suite v2 fixture, which
  carries a populated `depth_prompt`.

## v3-full.json (synthetic)
- Hand-authored, invented content (`example.invalid` URLs). Synthetic: yes.
- A clean CCv3 card with an embedded 2-entry character_book (one `@@depth`/`@@role` decorator entry, one selective entry with secondary keys),
  `creator_notes_multilingual`, three assets, and empty `extensions: {}`. A minimal CCv3 shape check, not a de-escrow sample.

## lorebooks/ (synthetic)
- Hand-authored, invented content. Synthetic: yes.
- `test-world.json` - classic ST World Info (object `entries` map): constants, a disabled entry, secondary keys, positions 0-3,
  probability, case-sensitive and whole-word matching.
- `test-scenario.json` - newer ST World Info fields: `group`/`groupOverride`, `sticky`/`cooldown`/`delay`, `role`,
  `vectorized`, `delayUntilRecursion`, `automationId`, position 4 (depth).
