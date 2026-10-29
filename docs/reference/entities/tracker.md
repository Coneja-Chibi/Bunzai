---
id: reference/entities/tracker
title: Tracker entity
audience: dev
summary: The canonical piece for state a scene keeps, such as a character's health or a party's roster: named typed fields, kept as swipe-safe scene state, shown to the model every turn, readable by macros, and updated by the model through one tool. A scene links the trackers it keeps. Fields may carry icons and take a number's top from another field, a tracker has a change style, and a read answers what each reply changed; the backend, the Workbench editor, the Messenger's Trackers panel (linking, values and the person's own edits) and the change visuals under each reply are built.
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
- a `number` field may instead take its top from another field: `maxField` names a number field of the same tracker, and that field's current value is this one's top (`hp` out of `hp_max`). It cannot come with `max`, and no other type has it. The decoder refuses a `maxField` that names no field, a field that is not a number, itself, or a chain of tops that leads back round to it;
- a field may have an `icon`, a well-formed icon id (`lucide:name` or `mdi:name`, the shape the glyph generator reads, `src/entities/_shared/icon-id.ts`). The decoder does not check it against the glyph table (`src/generated/ic-glyphs.json`): entities do not import the UI's table, and a piece may name a glyph that this build lacks. Drawing only the ids the build knows, and nothing for the rest, is the UI's job. Absent means no icon. A tool's fields have no icons;
- a field may have a `default`, which must fit its type, its choices and its range.

What a field accepts as a value (its type, its choices, its range) and what a new record or row holds for it (its default,
else the type's own: 0 held inside the range, whichever ends it has, so `min: 5` starts at 5 and `max: -3` at -3; false;
the first choice; empty text) is one small module that holds no core code (`src/entities/_shared/field-value.ts`), used by
the decoder and by the core, and pinned with the decoder by the storage-shape tripwire. A tracker has at least one field,
with unique names. The `note` tells the model how to update the tracker; the `template` is the tracker's line in the
prompt when it has one. A blank tracker is a record with one number field, `value`, that starts at 0.

A value above a top taken from another field is brought down to it, never refused. A model's update and a default are held to the top as it stands at that moment, the top settled first, so `set: { hp_max: 30, hp: 25 }` works in one call whatever order it names them, and an item of a call sees the top an earlier item set. A list holds each row to its own top. What is stored equals what is read: a write that moves a top stores the clamped dependents in the same batch (`set: { hp_max: 10 }` with `hp` at 25 writes `hp_max=10` and `hp=10`, and the model is told both), so raising the top again does not bring the old value back. When an item names a top, each dependent it did not name is written clamped, from the value the model was shown, wherever that differs from what is stored, so a value a person's edit or an import left over its top is stored clamped too (`hp` stored at 25 over an `hp_max` of 10 reads 10, and `set: { hp_max: 40 }` writes `hp_max=40` and `hp=10`). An update is judged against what is stored, so a write of the stored value is no change: no delta, and the answer reports only what was written (`Hero: no change` for a batch that wrote nothing). The read still holds a value to its top as a safety net for edits and imports. A top below the field's own `min` leaves the `min`: a value is never below it. A number default is brought inside its range the same way.

The tracker itself may have an `icon` (for a list, each row's), and `changes`, how a reply's changes to it are drawn under the reply: `chips` (the default when absent), `card`, `toast` or `hidden`. The Messenger reads all three: its Trackers panel draws the icons, and each reply draws its changes from [the changes read](#what-a-reply-changed) in the tracker's own style.

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

A scene links trackers by id in its prompting (`ChatPrompting.trackers`, in order, no duplicates). Its `ChatPrompting.trackerChanges` switch turns the change visuals on replies off for the scene: on unless the scene says otherwise, so only `false` is kept and `true` or null clears it. The switch is stored with the scene's prompting; the Messenger reads it to draw the change visuals under each reply (see [ui.md](../ui.md)), and the changes read below does not look at it.
`src/studio/library-trackers.ts` reads each one through the tracker kind's strict decoder when a turn loads; a
tracker that is gone or fails the decoder is left out, and so is one whose name another linked tracker already has (a name
means one tracker). The Messenger's Trackers panel links and unlinks them (a check per library tracker, written through `setScenePrompting`), draws each one's value at the take's tip and lets the person edit it ([ui.md](../ui.md)). The read is `GET /api/chats/library-trackers` (`studio/scene-trackers.ts`: one read for every linked tracker, with the reply that last changed each). The person's edit is `POST /api/chats/tracker-edit` (`studio/tracker-edit.ts`): the tool's own update shape through `applyTrackerUpdates` (the same clamps and top rule, a number out of range is held inside it, never refused), written as message-level deltas on the take's tip message so it wins on that message and survives swiping and regenerating it; it is refused whole for a tracker the scene does not link or a turn would leave out (a same name as another linked tracker), a reply being written in the scene, or a take that moved on since it was read (the version is the write's own guard, so the check and the write are one step).

- **The prompt.** One system block headed `### Trackers`, right after the Props trackers' block (or where the preset's
  `linkedTrackers` marker stands, [preset.md](preset.md)), holds each linked
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
about 430, so the lines stay. Local and custom connections get the tool like any other; a model that refuses tools fails the turn in one plain sentence ([tool](tool.md), "In a scene").

Items apply in order, each on the value the ones before it left, and the batch is all or nothing: if any item is
refused (an unknown field, a wrong type, a choice not in the list, a missing row), nothing is written and the model
is told every item's error. A number outside its range is clamped, not refused, and one past a top taken from another field is clamped to that field's value as the earlier items and its own call left it (the description names it: `hp (number 0 to hp_max)`, or `hp (number up to hp_max)` with no `min`). Only the call's shape is checked when
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

## What a reply changed

`GET /api/chats/tracker-changes?branchId=&from=&to=` (`src/ui/server-chats-tracker-changes.ts`, over `trackerChangesBetween` in `src/studio/tracker-changes.ts`) answers, for a take and a range of its live messages (`from` through `to`, the tip when `to` is left out or empty), what each message changed in the library trackers on the version it shows: `{ messages: [{ messageId, trackers: [{ trackerId, name, style, icon?, fieldIcons?, bars?, changes }] }] }`. `bars` is there when a changed number has a top (its own `max`, or the value of the field its `maxField` names as the message left it): for each such field it holds `{ min, top }`, the bottom (`min`, 0 when the field sets none) and the top the number had when the message left it. A change is `{ field, before, after }` for a record's field, or `{ row, before, after, added?, removed? }` for a list's row (the whole row without its name, `null` for the side that is not there). Values are exact, never cut. The tracker's `style` and its icons come with the answer so the page does not fetch the pieces.

It is one forward pass. `ChatStore.sceneDeltas(branchId, from, to?)` gives the state before the first message (everything shown before it, without its own deltas) and each live message's deltas, its shown version's then its own ([scene-state.md](../scene-state.md)); the state is folded forward through them, and each message's change is the net difference in each tracker slot it touched, read the way a turn reads it (defaults filled, a number inside its top). So a person's edit shows as a change on its message, choosing another version of a reply shows that version's changes, and a cut message drops out. A message that changed no tracker is left out, and so is a write that left a value as it was. Only tracker slots count. Only a piece that cannot be read (deleted, or not in the library any more) is reported by its id, with the values as stored. A piece whose layout was changed after the writes still reports its name, style and icons, with the values as stored. Past change lines are read through the current piece, so a rename, a changed default or a changed top applies to history too. Only the tracker slots' deltas are loaded (the store read takes slot prefixes). A branch or a message that is not there is a 404, a `to` that is not a well-formed id is a 400, and an empty range is an empty list. The route reads the library's pieces and writes nothing.

## Editing

A tracker opens in the Workbench's tracker editor (`src/ui/apps/workbench/pieces/tracker-editor.tsx`). The header says where the tracker is linked, "linked in 2 scenes" or "not linked to a scene", read from the scenes' settings alone by `GET /api/chats/linked?kind=tracker&id=...` (`src/studio/piece-links.ts`: the live scenes whose prompting list the kind hub names, `promptingList` in `kind.ts` (for a tracker `trackers`), holds it, as `[{ chatId, title }]`; a deleted scene is left out, no message is read and there is no cap). Clicking the words lists the scenes by name. The count is information; nothing warns about it. Under the shared editor header sit the
Identity & settings and the fields. The settings are what it tracks, how the AI should update it (this text becomes the tracker's line in the update
tool), the shape (one record or a list of rows), an icon, how a reply shows its changes (chips, a card, a toast or hidden), and the optional prompt
line written in macros with chips to add them; clearing the prompt line removes it, so the plain line is used. The fields are edited in the field
editor a tool shares (`src/ui/_shared/field-editor.tsx`): the list on the left (add, reorder, delete), one field's page beside it (name, what it
means, type, icon, and by type a number's From, To and Starts at, a choice's chips and start, a yes-or-no or text start). A number's To is a fixed
number, another number field of the tracker (never itself, and never one that would loop back to it) or none; the icon is a short row of favourites,
None, or any glyph the build ships from a searchable list.

The rail shows what the AI gets. Prompt is the `### Trackers` block as prompt assembly renders it at the tracker's starting values (a list with one
sample row), with the plain line it falls back to and its cost in tokens per reply; Update tool is the tracker's own line from `updateTrackersTool`.
A rename is followed a keystroke at a time from the name the field began with: the fields whose top named it, and the prompt line's `{{tracker::Name::field}}` macros that read it, move to the last name typed, and a name typed through on the way (a sibling's) takes none of the sibling's links or macros. Renaming the tracker likewise rewrites the macros that name it. A delete frees the tops that named the field, and a type change drops what only the old type could hold (a field that is no longer a number frees the fields that followed it). A draft the strict decoder
refuses is not saved: autosave waits and the editor says in plain words which field is wrong. A prompt line whose macros the engine reports a problem with (other than naming another tracker that exists in the library, which may be linked in the scene; a name that matches no library tracker is held back too) is held back the same way. A save sends a patch of the edits (the piece's head with its edited body), on the revision opened,
and with nothing edited nothing is sent. The scene's linking control is the Trackers panel's, and the change visuals under each reply follow the tracker's "Show changes on replies as" (see [ui.md](../ui.md)). The Library's "New
tracker" saves the blank record. The Story Director does not update library trackers.
