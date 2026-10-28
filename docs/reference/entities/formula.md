---
id: reference/entities/formula
title: Formula entity
audience: dev
summary: The canonical piece for a saved macro expression, such as a word count over the chat plus a roll, made once and run anywhere. A tool can run one; it runs on a copy of the turn's macro context and is refused when it would change anything.
tags: [entity, formula, macro, tool, canonical]
related: [reference/macro-engine, reference/entities/tool, reference/entities/dice]
---

# Formula entity

A `CanonicalFormula` is `CanonicalEntity<"formula", FormulaBody>`: a `name`, a `description`, and `text`, one macro
expression (bounded only by the hostile-input text ceiling, 1,000,000 characters), such as `{{calc::{{mentions::storm::20}} + {{roll::1d6}}}}`. A formula is
macro text and nothing else: what it can do is what the macro engine gives it ([macro-engine.md](../macro-engine.md)),
including Bunraku's own `{{mentions}}`, `{{lastmention}}`, `{{tally}}` and `{{odds}}`. The decoder checks only the
shape and the size; an unknown macro or a bad argument is reported when the formula runs.

## Where formulas run

A tool runs a formula through its `formula` action ([tool.md](tool.md)), and the model is told what the formula
renders. It reads the macro context the turn built its prompt from: the card, the persona, the history before the
message being answered, and the variables as the prompt left them. The context is handed to the tools once the
prompt is built (`ToolsContext.macros`); a call before then is refused.

## Safety

`runFormulaReadOnly` (`src/core/formula.ts`) runs the formula on a `structuredClone` of the macro context, so no
variable, counter or template it touches reaches the scene. If the run would have changed a variable (`setvar`,
`incvar`, `pushvar`, `setglobalvar`, `state.set`, `once`, `ask_in_reply` and the like), the call is refused in
words naming the macros, rather than the write being dropped in silence. That includes `{{pick}}`, which remembers its
choice in a variable, so a formula cannot use it. A message that holds macro text is read as part of the chat and
cannot write through a formula either; a message holding a write macro makes a formula that reads message text (such
as `{{lastmessage}}`) fail. A blank formula and a macro error are refused, so a half run is never the answer.

A formula has no step number of its own. The tool loop owns a time budget for all of one reply's tool calls
(`TOOL_BUDGET_MS_DEFAULT`, 5 seconds, overridden by the setting `scenes.toolBudgetMs`, which Settings > You > Studio > Time budgets shows in seconds): every tool run is handed what is left as a deadline, a call made after the budget is spent is
answered with an error and not run (a state-scoped write, the trackers' update, is cheap and keeps the narration and the
state in step, so it still runs, whole and with no deadline), and the macro engine checks the deadline's clock
every 64 nodes (`DEADLINE_CHECK_EVERY`, internal tuning), after every handler, and inside every loop of the word-watching
macros that scales with its input (the index build, phrase matching, a tally's words). A run that passes it stops with the error
the model reads ("the time budget for this run is spent; stopped") and the formula answers with that error, never as if it
had finished. The engine reads no ambient time (ADR-012), so the loop's clock is handed in. The engine's own caps still hold.
A formula's run copies everything it could write and shares the chat's messages, which it only reads, so the word index the
chat-watch macros keep for that message list is built once and reused by every later call over the same chat. The index is
positional (each word with its message and place in it): a single word is a read, and a phrase starts from its rarest word's
places and checks the rest only there, so what it costs follows how often that word occurs, not the size of the chat. What the
tests hold (`chat-watch.test.ts`): 10,000 different single lookups and 1,000 phrase lookups over a 200-message chat of about
400 KB finish under 5 s; 3,000 different phrases on the common first word "the" over 1,500 messages finish under 2 s; a
tally of thousands of phrases stops at a spent deadline with the error in the report. Measured once on the development
machine, not pinned: the first case took about 80 to 280 ms. Each call takes its
own seed from the turn's seeded randomness, so the same seed rolls the same.

Writing from a formula, as a preset's macros do while a prompt is built, is not offered yet.

## Editing

A formula opens in the Workbench's formula editor (`src/ui/apps/workbench/pieces/formula-editor.tsx`): what it is for, the formula text in the app's
code editor with macro chips under it (the chat-watching macros, `odds`, `tracker`, and "All macros..." for the engine's whole reference), and the
Try it rail. Try runs the text as it stands, saved or not, on a copy of the scene you pick, through `POST /api/chats/formula-try`: the route
reads the scene as it stands (`src/studio/scene-forecast.ts`: the same assembler a send runs, with the whole take as history and nothing being answered), then runs the text through `runFormulaReadOnly` on that
macro context, inside the tool time budget. It needs no connection and no window the scene fits in. Try builds the whole scene with no window to fit, so entries a real send would trim to fit can still feed the macro context the formula reads. It answers the result, or the words for why it stopped (a variable it would change, a macro
error, the budget), with how long it took; It writes nothing and asks no model. A save sends a
patch of the edits; with nothing edited nothing is sent. The Library's "New formula" saves a blank one, which is refused when run until it
has text.
