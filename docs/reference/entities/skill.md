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
  longer match (a skill with no triggers or a scan depth of 0 stays open).

Each verdict carries one plain sentence of why ("Mentioned: sword.", "Not opened."), returned on the assembly result as
`skills`.

## Open and closed

Which skills are open is scene state: the slot `skills` (`src/core/scene-state/slots/skills.ts`, a `fields` slot, one
field per skill id holding `true` while open, closing removes it; writers `turn` and `person`). So a swipe, regenerate,
cut or fork shows exactly the open set of what is shown, with no rule of its own ([scene-state.md](../scene-state.md)).

A scene that links picked skills gives the writing model two tools while Narrator Tool Access is on
(`studio/library-skills.ts`), made like the trackers' update tool:

- `open_skill` lists every picked skill in its own description, as a name and what it is for, so only that list costs
  anything until a skill opens. Its one argument is the skill's name. It answers with the skill's instructions, the
  turn's macros read read-only and what no macro answers stripped, and opens the skill (once) through the turn's one
  tool door, so it is in the Skills block from the next reply.
- `close_skill` closes an open one ("Closed ..."; a skill that is not open says so and writes nothing).

Both are `stateScoped` writes at the tier `narrator.skill`: their only effect is the open skills' deltas pending on the
reply being written, which a regenerate, swipe or cut takes back. An unknown name is refused with the list of names, and a
write that could not be saved is the model's error with nothing kept. With Tool Access off, or a connection that takes no
tools, a picked skill cannot open. A picked skill whose close rule holds on a turn is closed by that turn, with its
variable deltas (`studio/scene-turn.ts`); a continue closes nothing.

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
in the Workbench; the scene's Skills panel, linking from it and the person closing a skill there (the slot takes a
person's write, but no route makes one yet); a skill's own spot in the chat (a skill placed apart from the marker); and Kit making or editing a skill (it has no
capabilities for the kind yet). Kit can list, read, duplicate, export and delete skills through its generic piece tools.


Every field, with its meaning, is in the generated [fields.skill.md](../../generated/fields.skill.md).
