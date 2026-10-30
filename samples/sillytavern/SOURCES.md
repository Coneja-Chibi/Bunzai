# SillyTavern samples

## `characters/synthetic-character.png`

- **Source of structure:** SillyTavern's official default card at
  `https://raw.githubusercontent.com/SillyTavern/SillyTavern/release/default/content/default_Seraphina.png`.
  The upstream README credits the Seraphina character and lorebook to `@OtisAlejandro`.
- **Transformation:** The previous sample's portrait and free prose were removed. This replacement
  uses a valid 1x1 synthetic PNG carrier and newly written character/lorebook text. The V2 card
  structure, mirrored card metadata, `chara`/`ccv3` text chunks, `extensions` shape, and four-entry
  embedded `character_book` layout are retained for codec tests. This is a constructed fixture, not
  the original image/card, and its synthetic content is not attributed to the upstream creator.
- **Coverage:** Top-level and V2 `data` fields, `talkativeness`, `world`, empty `depth_prompt` with
  its depth/role defaults, unedited extension escrow, and the four entry extension fields
  `vectorized`, `group_override`, `use_group_scoring`, `automation_id`, and `display_index`.
  The entries keep a uniform `insertion_order` while `display_index` runs 0-3, so the two axes remain
  independently testable.
- **Rights context:** Attribution is retained for the source of the structural scaffold. The
  upstream source materials reviewed did not give the artwork an asset-specific redistribution
  license; the unverified portrait and original prose are absent from this working-tree fixture.
  Historical repository versions may still contain the former sample.

## `characters/v3-full.json` (synthetic)

- Hand-authored, invented content (`example.invalid` URLs). Synthetic: yes.
- A clean CCv3 card with an embedded 2-entry character book (one decorator entry, one selective
  entry with secondary keys), multilingual creator notes, three assets, and empty `extensions: {}`.

## `lorebooks/` (synthetic)

- Hand-authored, invented content. Synthetic: yes.
- `test-world.json` covers classic ST World Info: constants, a disabled entry, secondary keys,
  positions 0-3, probability, case-sensitive and whole-word matching.
- `test-scenario.json` covers newer fields: `group`/`groupOverride`, `sticky`/`cooldown`/`delay`,
  `role`, `vectorized`, `delayUntilRecursion`, `automationId`, and depth position 4.
