---
id: reference/entities/tool
title: Tool entity
audience: dev
summary: The canonical piece for a tool a model may call while it writes, kept as data with no code. A scene links the tools it offers, and each call runs one first-party action, a roll, a linked dice piece, a linked formula or a record, through the scene's existing tool loop.
tags: [entity, tool, tool-call, dice, canonical]
related: [reference/entities/dice, reference/entities/formula, reference/extending/new-kind, reference/entities/README]
---

# Tool entity

A `CanonicalTool` is `CanonicalEntity<"tool", ToolBody>`: a `name`, a `description` the model reads, a list of
`fields` the model fills in, and one `action`. A tool is data and never code: what a call does is one of a fixed set
of first-party actions in `src/core/tools.ts`.

## Fields

Each field has a `name` (a lowercase letter, then lowercase letters, digits and `_`), a `description`, a `type`
(`text`, `number`, `boolean` or `choice`) and whether it is `required`. Only a `choice` field has `choices`, 1 to 20
of them, and it must have them. A tool has at most 12 fields, with unique names. The function schema the model is sent
(`toolParameters`) and the check of its arguments (`readToolCall`) are both made from this one list, so they cannot
disagree. Unknown arguments, missing required ones, wrong types and choices not in the list are refused, and the
refusal is told to the model.

## Actions

- **roll** rolls the dice the model writes into one of the tool's text fields (`field`), through the dice module
  (`src/core/dice.ts`): 1 to 100 dice of 2 to 1,000 sides, other dice refused when its arguments are read. The model
  is told the result, such as `Rolled 1d20+3: [14] +3 = 17`, and the trace keeps the dice, each die, the modifier and the
  total.
- **dice** rolls a library dice piece by its id (`id`; [dice.md](dice.md)): a roll, a table or a pool, answered as that
  piece rolls it, such as `Wild magic (rolled 2 of 3): Sparks`. Fixed dice live in a dice piece, made once and linked
  from any tool.
- **formula** runs a library formula by its id (`id`; [formula.md](formula.md)) on a copy of the turn's macro context,
  and answers with what it renders. A formula that would change a variable, has a macro error or is blank is refused,
  and the refusal is told to the model.
- **record** changes nothing and answers "Recorded."; the trace keeps the call's arguments, as it does for every call.

All four are read-only: none changes the scene or the library.

## In a scene

A scene links tools by id in its prompting (`ChatPrompting.tools`, at most 20, in order). They are offered only when
Narrator Tool Access is on, the connection takes tools and the turn is not a Continue, the same gates as the lorebook
lookup. `src/studio/library-tools.ts` reads each linked tool, and the dice piece or formula its action links, through their kinds'
strict decoders, and leaves out a tool that is gone or unreadable or whose dice piece or formula is. A tool's call name comes from its name (`callName`): lowercase, starting with a letter (`tool_` goes in front
otherwise), at most 60 characters. A name already taken, by the lookup, an earlier tool or the loop's `invalid_tool`
(what a call with a malformed name is answered as), gets a number. Rolls draw from randomness seeded for the turn, so the same seed rolls the same dice.

No screen links a tool to a scene yet: the scene's prompting holds the list, and the linking control waits for its
wireframe with the editor.

## Editing

There is no editor yet: the tool editor waits for its approved wireframe. The Library's "New tool" saves a blank
record tool.
