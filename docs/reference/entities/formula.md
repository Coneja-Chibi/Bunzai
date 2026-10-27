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
expression of up to 20,000 characters, such as `{{calc::{{mentions::storm::20}} + {{roll::1d6}}}}`. A formula is
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

A formula runs on its own step budget, `FORMULA_STEPS` (1,000), far below the engine's 1,000,000, so a model calling
one round after round cannot tie up the server. That fits a formula of roughly 100 macro calls; a longer one stops at
the budget, well before the 20,000-character size limit. The word-watching macros search for at most 200 new words
in one run, so asking for new words on every step cannot make a run slow either. The worst cases measured over
a 200-message chat of about 400 KB (loops over the same words, over new words every step, and over the whole recent
history) stop in about 55 ms per call; `formula.test.ts` holds them under 500 ms. Each call takes its own seed from the
turn's seeded randomness, so the same seed rolls the same.

Writing from a formula, as a preset's macros do while a prompt is built, is not offered yet.

## Editing

There is no editor yet: the formula editor waits for its approved wireframe. The Library's "New formula" saves a
blank one, which is refused when run until it has text.
