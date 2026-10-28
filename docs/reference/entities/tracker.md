---
id: reference/entities/tracker
title: Tracker entity
audience: dev
summary: The canonical piece for state a scene keeps, such as a character's health or a party's roster: named typed fields, kept as swipe-safe scene state, shown to the model every turn, readable by macros, and updated by the model through one tool. A scene links the trackers it keeps; the backend is built, the editor and the linking screen are not.
tags: [entity, tracker, scene-state, macro, tool-call, canonical]
related: [reference/scene-state, reference/entities/tool, reference/macro-engine, reference/entities/README]
---

# Tracker entity

A `CanonicalTracker` is `CanonicalEntity<"tracker", TrackerBody>`: a `name`, a `description`, a `layout`, a list of
`fields`, a `note` and an optional `template`. A tracker is data and never code. It is not the Props trackers
(`src/core/trackers/`, the Inventory, the Spellbook and the rest), which are first-party modules with their own
rules; a library tracker is made by the person, from fields they name.

## Fields

A field has a `name` (a lowercase letter, then lowercase letters, digits and `_`, up to 64 characters, the providers'
function-name rule), a `description`, and a `type`: `text`, `number`, `boolean` or `choice`. The name rule, the types and
the choices rule are shared with a tool's fields (`src/entities/_shared/field-schema.ts`), so the two kinds cannot drift.
Beyond those:

- a `choice` field has `choices` (at least one, unique), and no other type has them;
- a `number` field may have a `min` and a `max` (`min` at most `max`, either may be left out); no other type has them;
- a field may have a `default`, which must fit its type, its choices and its range.

What a field accepts as a value (its type, its choices, its range) and what a new record or row holds for it (its default,
else the type's own: 0 held inside the range, whichever ends it has, so `min: 5` starts at 5 and `max: -3` at -3; false;
the first choice; empty text) is one small module that holds no core code (`src/entities/_shared/field-value.ts`), used by
the decoder and by the core, and pinned with the decoder by the storage-shape tripwire. A tracker has at least one field,
with unique names. The `note` tells the model how to update the tracker; the `template` is the tracker's line in the
prompt when it has one. A blank tracker is a record with one number field, `value`, that starts at 0.

There are no product limits on any of it: no number of fields, no length of a note, template or description. The decoder
bounds only what a hostile file could use against the app, with the ceilings of `src/entities/_shared/sanity.ts` (10,000
items in a list, 1,000,000 characters in a text, whole numbers up to `Number.MAX_SAFE_INTEGER`). They are about a hundred
times past real use and are not design limits; a file past one is refused as unusually large.

## Layouts

A **record** is one set of fields. A **list** is rows, each keyed by a text `name` (not blank, any length) and holding every
field; `name` is reserved on a list, so no list field is called `name`. A new row starts from the fields' defaults. The model
finds a row whatever the case of the name it gives, and a row keeps the name it was made with (the state folds by the exact
name, so the lookup is by case and the stored key is the first spelling).

## State

A linked tracker keeps its state in a scene-state slot ([scene-state.md](../scene-state.md)): `tracker-record:<pieceId>`
(the `fields` strategy, one delta per field) or `tracker-list:<pieceId>` (the `keyed-list` strategy, one delta per
row). These are slot families, declared once (`src/core/scene-state/slots/tracker-record.ts`, `tracker-list.ts`);
the store only folds them. Every shape check is in `src/core/tracker.ts`, which knows the piece: `trackerValue`
reads the current value from the scene state with defaults filled, and a value that does not fit its field reads as the
field's default. Because a write is a delta on the reply version being written, a regenerate, a swipe, a cut and a fork
all leave the tracker where the shown history says.

## In a scene

A scene links trackers by id in its prompting (`ChatPrompting.trackers`, in order, no duplicates).
`src/studio/library-trackers.ts` reads each one through the tracker kind's strict decoder when a turn loads; a
tracker that is gone or fails the decoder is left out, and so is one whose name another linked tracker already has (a name
means one tracker). No screen links a tracker to a scene yet: the control waits for its wireframe.

- **The prompt.** One system block headed `### Trackers`, right after the Props trackers' block, holds each linked
  tracker's text, every turn, whether or not Narrator Tool Access is on. A tracker's text is its `template` run
  through the macro engine read-only on the turn's macro context (so it reads state and writes none), or, with no
  template, the default rendering: a record as `Name: field=value, ...`, a list as `Name:` and one line per row
  (`Name: (none)` when empty). A value, a row name or a text the model wrote is shown on one line (line breaks become
  spaces), through one function (`lineOf`) that the default rendering and the `tracker` macro both use, so it cannot start a line, forge a
  heading or look like another tracker even when a template reads it. Nothing is cut. The block is a fixed
  part of the request, measured by the prompt budget like the card: a tight window drops history, never tracker text. With
  no tracker linked, or none with text, there is no block. A swipe or regenerate shows the state before the reply it
  replaces; a Continue shows the state as it stands, with the writes the reply it extends already made.
- **Templates.** Every tracker's value and default text are computed first, and then each template runs against them, so a
  template that reads another tracker (`{{tracker::Other::hp}}`, or `{{tracker::Other}}`, which inside a template is the
  other's default rendering) sees it whatever the order the trackers are linked in. Templates run in the turn's macro pass
  with its report: a template's macro errors and uses show in the Context wing's macro report like any other, and its output
  has the engine's own caps (the output ceiling, the step budget) and no cut of ours.
- **Macros.** `{{tracker::Name}}` is the tracker's text, `{{tracker::Name::field}}` a record's field, and
  `{{tracker::Name::row::field}}` a list row's field, in any macro text ([macro-engine.md](../macro-engine.md)). A
  tracker that is not linked, or an unknown field or row, is a macro error that names it. After the model's update tool
  has changed a tracker, the views the macros read follow, templates included, so a formula or macro run later in the same
  reply reads the new value.

## The update tool

When Narrator Tool Access is on, the connection takes tools and the turn is not a Continue, a scene with linked
trackers offers the model one tool, `update_trackers` (numbered if a name is taken, like a library tool). It takes
`updates`, each `{ tracker, row?, remove?, set? }`: `tracker` is one of the linked trackers' names; `set` holds field
values; `row` names a list row and is required for lists and refused for records; `remove` deletes a list row and cannot
come with `set`. The tool's description is one fixed sentence and then one line per tracker with every field (its type,
range or choices, and what it means) and the tracker's `note`, such as `Health (record): hp (number 0-100: Hit points.),
mood (calm|tense: How she feels.). Lower hp when Vera is hurt.` It is never cut, so every tracker and every field reaches
the model. For a typical three-tracker scene the description and parameters come to about 280 tokens (about 200 without the
field meanings); the alternative of giving each tracker's fields in the `set` schema (an `anyOf` keyed by tracker) measured
about 430, so the lines stay.

Items apply in order, each on the value the ones before it left, and the batch is all or nothing: if any item is
refused (an unknown field, a wrong type, a choice not in the list, a missing row), nothing is written and the model
is told every item's error. A number outside its range is clamped, not refused. Only the call's shape is checked when
it is read; each item's fields, types, choices and rows are checked when it runs, still with nothing written on an error; the call the model is shown again in the next round is its own, as it sent it. On
success the deltas join the turn's pending set and are saved on its checkpoint, so `commitTurn` stamps them on the reply
and a failed or dropped turn loses them; the model is answered with only what the call changed, per tracker (the record fields that changed, or the rows set and removed), so the answer follows the change and not the size of the tracker. The door
accepts tracker slots only and has no size cap (a write is as large as the model's own output); a save that did not
happen, such as a checkpoint that is gone, is a failure the model is told of, with nothing kept. The tool's trace keeps
the call's arguments and the number of changes, not the answer the model was given. Its definition rides in the request
beside the messages, and the prompt budget measures it like the tracker block (the forecast reserves it the same way, and
when the fixed parts tip a request over, the failure says so instead of blaming only the card and the message). The tool
loop shortens a very large tool answer (12,000 characters, an older RoleCall port number) but not this tool's, whose answer
already follows the change; a spent tool time budget refuses other tools but not this one, which is cheap and keeps the
narration and the state in step. This tool is handed no deadline: a call is applied once, linear in its items, and runs
whole.

The tool loop runs only read tools, with one exception: a tool declared `access: "write"` and `stateScoped: true`,
whose only effect is pending scene-state deltas on the reply being written. `update_trackers` is that tool
(`SCENE_ACTION_TIERS["narrator.tracker"]`), the only tool that sets the flag and the only one handed the write door; any
other non-read tool is still refused.

## Editing

There is no editor yet: the tracker editor and the scene's linking control wait for their approved wireframes. The
Library's "New tracker" saves the blank record. The Story Director does not update library trackers.
