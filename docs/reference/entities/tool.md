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

Each field has a `name` (a lowercase letter, then lowercase letters, digits and `_`, up to 64 characters, the providers' function-name rule), a `description`, a `type`
(`text`, `number`, `boolean` or `choice`) and whether it is `required`. Only a `choice` field has `choices` (at least
one, unique), and it must have them. A tool's fields have unique names, and there is no product limit on how many (the decoder
only refuses a hostile list; see `src/entities/_shared/sanity.ts`). The decoder's field basics are shared with a tracker's fields. The function schema the model is sent
(`toolParameters`) and the check of its arguments (`readToolCall`) are both made from this one list, so they cannot
disagree. Unknown arguments, missing required ones, wrong types and choices not in the list are refused, and the
refusal is told to the model.

## Actions

- **roll** rolls the dice the model writes into one of the tool's text fields (`field`), through the dice module
  (`src/core/dice.ts`): any dice with at least one die of at least two sides (the sanity ceilings aside), other text refused when its
  arguments are read. The model is told the result, such as `Rolled 1d20+3: [14] +3 = 17` (past 20 dice, the count, lowest, highest and
  total, see [dice.md](dice.md)), and the trace keeps the dice, each die, the modifier and the total.
- **dice** rolls a library dice piece by its id (`id`; [dice.md](dice.md)): a roll, a table or a pool, answered as that
  piece rolls it, such as `Wild magic (rolled 2 of 3): Sparks`. Fixed dice live in a dice piece, made once and linked
  from any tool.
- **formula** runs a library formula by its id (`id`; [formula.md](formula.md)) on a copy of the turn's macro context,
  and answers with what it renders. A formula that would change a variable, has a macro error or is blank is refused,
  and the refusal is told to the model.
- **record** changes nothing and answers "Recorded."; the trace keeps the call's arguments, as it does for every call.

All four are read-only: none changes the scene or the library.

## In a scene

A scene links tools by id in its prompting (`ChatPrompting.tools`, in order, no duplicates). They are offered only when
Narrator Tool Access is on, the connection takes tools and the turn is not a Continue, the same gates as the lorebook
lookup. `src/studio/library-tools.ts` reads each linked tool, and the dice piece or formula its action links, through their kinds'
strict decoders, and leaves out a tool that is gone or unreadable or whose dice piece or formula is. A tool's call name comes from its name (`callName`): lowercase, starting with a letter (`tool_` goes in front
otherwise), at most 60 characters. A name already taken, by the lookup, an earlier tool or the loop's `invalid_tool`
(what a call with a malformed name is answered as), gets a number. Rolls draw from randomness seeded for the turn, so the same seed rolls the same dice.

The Control Booth links them: under Narrator Tool Access each linked tool is a tile with its icon, what it does, its token cost (the editor rail's own count) and a switch that links or unlinks it, with a Per reply line summing them, "Link a tool" over the library and "New tool in the Workbench" ([ui.md](../ui.md)).

## Editing

A tool opens in the Workbench's tool editor (`src/ui/apps/workbench/pieces/tool-editor.tsx`). The header says where the tool is linked, "linked in 2 scenes" or "not linked to a scene", read from the scenes' settings alone by `GET /api/chats/linked?kind=tool&id=...` (`src/studio/piece-links.ts`: the live scenes whose prompting list the kind hub names, `promptingList` in `kind.ts` (for a tool `tools`), holds it, as `[{ chatId, title }]`; a deleted scene is left out, no message is read and there is no cap). Clicking the words lists the scenes by name. The count is information; nothing warns about it. The editor has the shared editor header, when the AI should use it,
the choice of what the tool does (roll the dice it gives in a field, roll a dice piece, run a formula, or just note the call, each showing only its
own picker), and the fields in the field editor a tracker shares: a tool field has a name, what it means, a type with its choices, and whether the AI
must fill it. Renaming the field a roll reads carries the roll with it, from the name the field began with, so a name typed through on the way takes nothing; deleting it leaves the roll with no field picked, which the editor says. Choosing a dice or formula action starts with no piece picked, and switching away and back finds the earlier pick again.

The rail has two tabs. The AI sees gives the call name a provider is handed, what it takes as one plain line per argument, `name (type, needed|optional) meaning`, read off the `toolParameters` the provider gets,
and what the definition (`toolDefinition`, the same object the loop sends) costs in tokens on every reply. Try fills the arguments and calls the
tool through the real `readToolCall` and `runTool`, and shows exactly the answer the AI would get, a refusal included; a dice-piece tool rolls the
piece it links, and a formula tool says it needs a scene and opens the formula, where Try runs it on the whole scene with no window to fit (see the formula page). A draft the strict decoder refuses (a roll whose
field is not text, a linked piece not picked) is not saved and cannot be tried. A yes-or-no argument can be left out, said yes or said no. A save sends a patch of the edits; with nothing edited
nothing is sent. The Library's "New tool" saves a blank record tool.
