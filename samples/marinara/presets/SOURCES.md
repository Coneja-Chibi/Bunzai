# Marinara presets

## `marinara-universal-preset-v12.marinara.json`

- **What:** A constructed synthetic `marinara_preset` envelope for codec import, mapping, and
  round-trip tests. It uses the shape and structural coverage of Marinara-Engine’s built-in
  Universal Preset v12 export as a scaffold. It is not an unchanged upstream export or a
  representative copy of that preset’s prompt wording.
- **Structural source:** Marinara-Engine repository,
  `packages/server/src/db/default-preset.json`, at commit `daf8c212`
  ([repository](https://github.com/Pasta-Devs/Marinara-Engine)). The source file was the engine’s
  own shipped artifact.
- **Transformation:** The description, conversation/game prompts, free-text prompt sections,
  choice questions, and descriptive choice values/defaults were replaced with newly written neutral
  test text. The envelope and field shapes, identifiers, section and choice counts/order, group and
  marker links, option IDs and labels, language options, macro syntax, and parameter coverage remain
  useful for exercising the codec. In particular, `You are {{role}}!` remains as a
  macro-preservation case. The fixture does not claim to reproduce the upstream prompt content or
  behavior.
- **Attribution and license context:** The source project is Marinara-Engine (AGPL-3.0). This
  constructed fixture credits the structural source and commit; its replacement prose was written
  for Bunzai tests. Do not describe this fixture as an unmodified or captured upstream sample.
- **Formatting:** Serialized with `JSON.stringify(parsed, null, 2)` (2-space, LF, no BOM, no trailing
  newline), matching the codec output. The byte-identical test compares codec output with this
  committed fixture, not with the upstream artifact.
- **Used by:** `src/formats/marinara/preset.test.ts` for detection, wire-to-canonical mapping,
  unedited fixture round-trip, and field-diff overlay under edits.
