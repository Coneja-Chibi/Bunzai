# Risu sample sources

## Synthetic fixtures (hand-authored, no third-party content)

Every file here was written by hand for this repo. The content is invented; nothing was downloaded or
copied from a community card, so there is no upstream license to track.

- `characters/test-risu.card.json` - synthetic CCv3 card (`spec_version` 3.0) shaped like a Risu export, as the
  `card.json` of a `.charx`. Tests wrap it in a zip (`risu.test.ts`) or read it as wire data (`behavior-edit.test.ts`).
  Authored `extensions.risuai` surface it exercises:
  - `customScripts` x8 declarative regex scripts: `edittrans` x4 (non-ASCII find/replace), `editoutput` x3 (macro `out`), `editdisplay` x1.
    Row shape `{comment, in, out, type, ableFlag}`.
  - `triggerscript` x9 state machines: seven `var` conditions with `setvar` effects, plus two macro-built `type:"value"`
    conditions (`^{{greater_equal::...}}`) whose effects are `impersonate` and `command`. These are never executed.
  - `sdData` x7 `[label,value]` image-prompt rows, `newGenData` (empty strings), `viewScreen` "none", `largePortrait` true,
    `lorePlus`/`inlayViewScreen`/`utilityBot`/`lowLevelAccess` false, `bias` [], `vits` {}.
  - Empty-but-present slots that must stay unset: `backgroundHTML`, `virtualscript`, `additionalText`.
  - `data.assets`: two `x-risu-asset` rows (degrade to role "other") and one `icon`.
  - `data.character_book`: 3 entries with the `risu_*` extension keys, one constant entry with the empty key `[""]`, one regex + secondary-key entry.
  - Mixed date units in one card: `creation_date` in milliseconds, `modification_date` in seconds.
- `lorebooks/test-character-book.json` - the `data.character_book` of the card above, as a standalone book.

Synthetic: yes. License: none needed.

## RPack / module.risum fixtures

No redistributable independent ciphertext+plaintext pair is committed yet. Edited RPack export is
therefore **safe-blocked** in product code (`RPACK_EDITED_EXPORT_VERIFIED = false`). When a licensed
fixture lands under `samples/risu/rpack/`, record source, permission, generation method, and SHA-256
here and flip the gate only after hermetic both-direction tests pass.