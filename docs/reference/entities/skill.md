---
id: reference/entities/skill
title: Skill entity
audience: dev
summary: The canonical piece for instructions the model gets only when they matter, such as how to run a sword fight. A skill is a prompt that fires like a lore entry, on the lorebook's own trigger fields and matcher, or always, or while the model has it open. A scene links skills; the ones on in a turn ride as one Skills block at the preset's skills marker, never dropped by the budget.
tags: [entity, skill, prompt, lore, trigger, canonical]
related: [reference/entities/lorebook, reference/entities/preset, reference/entities/tracker, reference/entities/tool]
---

# Skill entity

A `CanonicalSkill` is `CanonicalEntity<"skill", SkillBody>`: a `name`, a one-line `description` (what it is for: the line
the model reads when it may pick the skill), and `text`, the instructions, whose macros render as in any prompt text.
The plan is `.claude/plans/skill-agent-kinds.md` section 2.

## When it is on

`when` is one of three (`src/core/skill.ts`, `skillVerdict`):

- `always`: in the prompt every turn while a scene links it.
- `mentioned`: when its triggers match. The triggers are a lorebook entry's own fields, decoded by the lorebook's own
  trigger decoder (`triggers`, `secondaryTriggers`, `selectiveLogic`, `caseSensitive`, `matchWholeWords`, `scanDepth`;
  see [lorebook.md](lorebook.md)), and matched by the lore engine's own `matchTrigger` and `selectiveLogicMatches` over
  the newest `scanDepth` messages, the one being answered included, newest first as a lore entry's scan text is. A regex
  trigger goes through the engine's vetted regex. No triggers, or a scan depth of 0, never match. A trigger's `frequency` and
  `probability`, which a lore entry's triggers may carry, are kept but not used by a skill.
- `picked`: while the model has it open. With `closeWhenUnmentioned`, an open skill closes on a turn its triggers no
  longer match (a skill with no triggers or a scan depth of 0 stays open). Opening and closing (the `open_skill` and `close_skill` tools, and the scene-state slot that keeps which
  skills are open) are the next step of the skill build and are not built yet, so a picked skill is never open today.

Each verdict carries one plain sentence of why ("Mentioned: sword.", "Not opened."), returned on the assembly result as
`skills`.

## In a scene and in the prompt

A scene links skills by id in its prompting (`ChatPrompting.skills`, in order, no duplicates, the same rule as tools and
trackers: `src/stage/store/prompting-rules.ts`). A turn reads them through its one library reader
(`studio/library-skills.ts`, `readLibrary`): each is checked by the skill decoder, and a gone or unreadable one is left
out, as is one whose name another linked skill already has.

The skills that are on ride as one system message, `### Skills` and then each skill's name as a `##` heading over its
rendered text (its macros run and what no macro answers is stripped, as in the preset's blocks), in the scene's order (`src/core/assembly/skills.ts`); a skill whose text renders blank adds nothing. It
goes where the preset's `skills` feature marker stands, with that block's role ([preset.md](preset.md)), and without one
after the leading system messages, after the trackers' and storyboards' blocks. The budget reserves it as it reserves
the library trackers' block: history gives way to it and it is never dropped (Chi, 2026-10-29). The Tokens sheet labels
it "Skills".

## Not built yet

The Workbench editor (wireframe `design/wireframes/premiere/skill-pieces.html`, approved), so a skill opens read-only
in the Workbench; the scene's Skills panel and linking from it; the picked skills' list, `open_skill` and `close_skill`;
a skill's own spot in the chat (a skill placed apart from the marker); and Kit making or editing a skill (it has no
capabilities for the kind yet). Kit can list, read, duplicate, export and delete skills through its generic piece tools.


Every field, with its meaning, is in the generated [fields.skill.md](../../generated/fields.skill.md).
