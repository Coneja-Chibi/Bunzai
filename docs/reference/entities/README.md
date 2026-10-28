---
id: reference/entities/README
title: Entities
audience: dev
summary: Index of the canonical content kinds (character, lorebook, persona, pack, preset, Script Sheet, regex, quick-reply set, tool, dice, formula, tracker, prompt format, drawing), how each is one folder described once in its kind.ts, and links to each one's field reference and the shapes they share.
tags: [entity, index, canonical]
related: [reference/architecture, reference/concepts/canonical-model, reference/formats/README]
---

# Entities

Every canonical shape bunraku converts through. An **entity** is a `CanonicalEntity<Kind, Body>` (see
[../architecture.md](../architecture.md), "The canonical entity"): a stable wrapper around a `Body`, the
superset shape for one `kind`. The kinds are a closed set: exactly the folders under `src/entities/` that hold a
`kind.ts` descriptor, collected by `bun run kinds` into `src/generated/kinds.ts` (identity) and
`src/generated/kind-schemas.ts` (decoders and storage parts). Every list of kinds in the app reads those seams: the
storage folders (`STUDIO_ENTITY_KINDS`), the parse boundary, the adapter contracts, decks, search, receipts, Kit and
"New" actions. Adding one is [../extending/new-kind.md](../extending/new-kind.md). Which kinds have format adapters
is the generated [FORMAT-SUPPORT matrix](../../FORMAT-SUPPORT.md). Every kind stores at `studio/<kind>/<id>.json`
under the studio root (`resolveStudioPath` in `src/studio/path-policy.ts`).

## Generated field tables

Each entity page embeds its field table verbatim from `docs/generated/fields.<kind>.md`, generated from
the live schema JSDoc by `scripts/docs-fields.ts` (`bun run scripts/docs-fields.ts`, checked with
`--check`). Do not hand-edit a table cell on an entity page: improve the doc comment in
`src/entities/<kind>/schema.ts` and regenerate.

## Reference pages

| Entity | Page | Covers |
| --- | --- | --- |
| Character | [character.md](character.md) | the roleplay character: identity, persona and voice, prompts and injections, greetings and examples, media, presentation, settings and behavior, attribution and discovery |
| Lorebook | [lorebook.md](lorebook.md) | world info / character book: the entry set, triggers, position and depth, per-entry and per-book settings |
| Pack | [pack.md](pack.md) | a reusable expression/sprite pack, attachable to more than one character (no format adapter, studio-only) |
| Persona | [persona.md](persona.md) | the user's identity, the counterpart to a character: name, content, sections, chat injection |
| Preset | [preset.md](preset.md) | a chat-completion prompt-manager preset: ordered prompt blocks, samplers, behavior settings (no format adapter, studio-only) |
| Script Sheet | [scriptsheet.md](scriptsheet.md) | one writing instruction, RoleCall's small writing setup; a preset's relative in the Writing family |
| Regex | [regex.md](regex.md) | a named, ordered find/replace rule set: the character-card twin and standalone script files |
| Quick-reply set | [quickreply.md](quickreply.md) | a named page of buttons that send prepared text, linked from presets |
| Dice | [dice.md](dice.md) | something a person rolls: a roll, a table or a pool, made once and linked from tools |
| Formula | [formula.md](formula.md) | a saved macro expression, run read-only on a copy of the scene's macro context; a tool can run one |
| Tool | [tool.md](tool.md) | a tool a model may call while it writes: typed fields and one roll, dice, formula or record action, as data; a scene links the ones it offers |
| Tracker | [tracker.md](tracker.md) | state a scene keeps: named typed fields as a record or a list of rows, swipe-safe, shown to the model every turn, readable by macros, updated by one tool |
| Prompt format | [promptformat.md](promptformat.md) | SillyTavern instruct and context templates for text completion, kept whole (nothing reads it yet) |
| Drawing | [htmldoc.md](htmldoc.md) | a sealed HTML page shown in HTML View, not a Library deck |

## Cross-cutting

| Concept | Reference |
| --- | --- |
| Sprite pack hub shape (`SpritePackValue` / `SpritePackItem`, `src/core/media/pack.ts`): Character's `media.assets` (role `emotion`) and Pack's `pack` / `groups` project through the same shape | [character.md, "Media"](character.md#media), [pack.md, "The sprite pack hub shape"](pack.md#the-sprite-pack-hub-shape) |
| `RegexScript`: Character's `behavior.regexScripts` is the card-embedded twin of Regex's standalone set shape | [character.md, "Settings and behavior"](character.md#settings-and-behavior), [regex.md, "The character-card twin"](regex.md#the-character-card-twin) |
| `knowledgeRefs` / `behaviorRefs`: Character links a standalone Lorebook or Regex entity by canonical id | [character.md, "Composition and variants"](character.md#composition-and-variants), [lorebook.md](lorebook.md), [regex.md](regex.md) |
| Persona is Character's opposite-voice counterpart, sharing the same prompt-injection machinery: first person `{{user}}` versus third person `{{char}}` | [persona.md](persona.md), [character.md](character.md) |
