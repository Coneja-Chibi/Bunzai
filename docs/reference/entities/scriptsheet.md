---
id: reference/entities/scriptsheet
title: Script Sheet entity
audience: dev
summary: The canonical piece for a Script Sheet, RoleCall's single-instruction writing setup, kept as a name, one instruction and optional samplers. It is its own kind in the Writing family with presets: a scene uses it in the same slot, it shares the Writing deck, and it reads as the preset it sends.
tags: [entity, scriptsheet, preset, writing, rolecall, canonical]
related: [reference/entities/preset, reference/formats/rolecall, reference/extending/new-kind]
---

# Script Sheet entity

A `CanonicalScriptSheet` is `CanonicalEntity<"scriptsheet", ScriptSheetBody>`: a name, one instruction (`content`),
an optional `description`, and optional `samplers` of the preset's own kind. It is ported from RoleCall's Script
Sheet, where a sheet is a preset row whose settings carry `script_sheet: { version: 1, content }`.

## The writing family

Presets and Script Sheets are separate kinds that read one way: each kind's `kind.ts` gives `asPreset`, the preset
it sends (`src/core/writing.ts`). A promptbook will join the same way.
- **One scene slot.** The scene's Writing choice records the kind and the id (`ChatPreset.kind`, ChatStore rule 19),
  so one picker lists presets and sheets together. Loadouts and a character's starting setup carry the kind too.
- **One reading.** The turn reads a sheet through the family reader (`presetReader` in `studio/scene-turn-load.ts`)
  as its blocks, so assembly, Final Cut, the Booth and the trace treat it as a preset.
- **One deck.** The sheet kind joins the preset kind's Library deck (`deck: "preset"`), shown as "Writing".
- **Export.** A sheet is written by every platform's preset format as the preset it sends (`formatsFor`), except
  RoleCall, whose own Script Sheet format (`formats/rolecall/script-sheet.ts`) writes the sheet itself as RoleCall
  does: `script_sheet` at the top of the preset file beside the blocks it sends. It reads such files back as sheets,
  including the `promptbook` key of files saved before RoleCall's rename.
- **Open as preset.** The Workbench makes a new preset from a saved sheet: its blocks, samplers and words.

## What a sheet sends

`sheetPrompts` in `src/core/preset/script-sheet.ts` lays the instruction out as ordinary blocks, in RoleCall's order:
- the instruction;
- the card's system prompt (`{{charPrompt}}`);
- the context slots: description, personality, scenario, persona, lore, summary, memories and examples;
- the chat history;
- the card's post-history instructions (`{{charInstruction}}`), last.

## The rules

Because that context is seated automatically, the instruction may not insert it itself: a context macro
(`{{description}}`, `{{lore}}`, `{{message_history}}` and their other spellings) is refused, while `{{char}}` and
`{{user}}` are fine. The text must not be blank. The editors check this as you type. A turn with a stored sheet that
breaks it stops with RoleCall's words (the kind's `sendProblem`): "This Script Sheet has invalid instructions. Choose
another Script Sheet or Preset in Prompting." Reading checks only the shape and the 100,000-character cap, so a later
change to the rule never makes a stored sheet unreadable.

## Editing

The kind's one editor is RoleCall's Script Sheet editor (`src/ui/_shared/script-sheet-editor.tsx`), opened from the
Prompting wing and, on the Workbench, with the description and samplers above it
(`src/ui/apps/workbench/script-sheet-bench.tsx`). The Library's "New script sheet" saves a blank sheet, which the
editor will not send until it has an instruction.
