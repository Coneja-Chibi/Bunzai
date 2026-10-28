# Scene state

What a scene remembers beyond its text, kept so that every way of changing the shown history (a new version of a
reply, choosing a version, cutting, restoring, forking) leaves it where the history says. A piece of state is a
**slot**; what one reply version changed in it is a **delta**, stored on that version; the state is rebuilt from the
versions that are shown. The pure core is `src/core/scene-state/`; the stores keep it (ChatStore rule 17,
`src/stage/store/`). Phase 1 holds one slot, `vars`, the scene's macro variables, and two slot families for the library trackers a scene links. Everything under "Not built yet" is
planned, not behavior.

## Slots

A slot is one file, `src/core/scene-state/slots/<id>.ts`, that exports `defineSlot({ id, scope, diff, default })`.
`defineSlot` refuses an id outside `/^[a-z][a-z0-9.:_-]{0,63}$/` and a `keyed-list` with no `key`. `bun run slots`
writes `src/generated/slots.ts` from the folder (`slots:check` fails when it is stale, as `kinds:check` does for
kinds), and `src/core/scene-state/slots.test.ts` fails when a slot file is missing from the list, an id is repeated,
or the list is not what the folder would write. The only scope is `"scene"`: rebuilt from history. `vars` uses the
`fields` strategy; each variable keeps the time it was first written and the time it was last written, which is
exactly a `MacroVariable`.

### Slot families

A slot file whose `id` ends in `:*` is a **family**: it covers every id that starts with its prefix, so state made by a library piece at run time needs no file of its own and the store never sees library pieces. `slotOf(id)` (`makeSlotOf` in `src/core/scene-state/slot-lookup.ts`, bound to the declared slots in `src/generated/slots.ts`) gives the exact slot if there is one, else the family whose prefix the id has, with a member part of 1 to 120 characters (the family's own `*` is not a member). A family id is one lowercase word, a colon and a star (`FAMILY_ID`); its file is named without the `:*` (`tracker-record.ts`); two families whose prefixes overlap, or one declared twice, fail the generator and the completeness test. Two families exist: `tracker-record:*` (`fields`, one delta per field) and `tracker-list:*` (`keyed-list`, rows keyed by `name`). The slot of a linked tracker is `tracker-record:<pieceId>` or `tracker-list:<pieceId>`; the stores check a delta against the family, and the shape of a tracker's values is checked in `src/core/tracker.ts` ([tracker.md](entities/tracker.md)), which knows the piece.

## Deltas and the three strategies

A delta is `{ slot, path, value?, removed?, at }`: a value at a path inside one slot, or its removal, never an
operation. Because it is a value, cutting a middle message takes back exactly what that message set and nothing
a later message set again. `diff.ts` cuts a change into deltas and `fold.ts` puts deltas back, by the slot's strategy.
`value` keeps the whole value (path `[]`). `fields` keeps one delta per field (path `[name]`). `keyed-list` keeps one
delta per row of a list, found by the row's `key` field (path `[key]`). Only `fields` is used so far; all three are
implemented and tested. A delta for an unknown slot, or with a path its strategy cannot read, is skipped by `fold`
and refused by the stores, never guessed at. A name such as `__proto__` is an ordinary own property.

## Storage

Migration 43 adds five tables and an index, schema only (`branch_variables` stays, unread; nothing moves out of it). `swipe_deltas`
holds one row per delta, keyed by swipe id and sequence, never changed once written: a fork copies messages but keeps
swipe ids, so a take shares its prefix's deltas and no delta row is copied. `message_deltas` holds what a message carries
whichever version shows (a person's edit on a reply), keyed by
message id: it belongs to one take, and a fork, or a cut restored as a new take, copies it with the new message id. A message's
own deltas fold after its shown version's, so a person's edit wins on that message. `branch_base` is what a take starts with, before any message (an import's variables): real data, not a
cache, so a damaged cell refuses; a fork, or a cut restored as a new take, copies it, and the rebuild starts from it when no keyframe is nearer. `branch_state` is each take's tip cache, the
state after its last shown message, with the tip it was built for. `state_keyframes` keeps the full state after every
50th shown message of a take. Both are caches: every change to what a take shows rewrites them (appending a message changes
no state, so it does not), and rows the health check sets aside drop them, so a read builds the state from what is left
until the next change. A cache cell that will not open is skipped and rewritten, never fatal; a delta cell that will not open
refuses, because the deltas are the data. Delta paths and values, keyframes and the
tip cache are sealed like the other chat payloads; slot, removal flag and time stay readable. `turn_checkpoints`
gains a sealed `deltas_json`, the turn's pending deltas. The tables are covered by the row fingerprints, the health
check (cells, orphans, what a move sets aside: a version's rows go only with the last reply that holds its swipe id) and the
snapshot lists. An index on `swipes.swipe_id` keeps those lookups from scanning every version. A version carries as many deltas as its writers make:
there is no per-version cap, since a turn's writes are bounded by their sources (the model's output, the macro engine's output cap). Only
what can come from an import or a person's edit (a take's base, a message's own deltas) is held to a hostile-input ceiling of
1,000,000 serialized bytes for one write (`checkImportedDeltas`: it counts the incoming write, not what the message already carries), refused as unusually large. The memory store keeps the same data in maps, behind the same
contract suite.

## Rebuild

The store owns the rebuild, inside the transaction of the change, so no caller can forget it. A rebuild starts from
the nearest kept keyframe on the path, else from the take's base, else from nothing, folds the deltas of the shown versions after it in order,
rewrites the keyframes it passes, and writes the tip cache. Keyframes at or after the first changed message are
dropped first.

| Change | Rebuilt from |
| --- | --- |
| a reply or a new version is committed (`commitTurn`), a version is added (`addSwipe`) | that message |
| a version is chosen (`selectSwipe`, `selectTranscriptSwipe`) | that message |
| a version is cut or restored (`cutSwipe`, `restoreSwipe`) | that message |
| messages are cut or restored (`cutMessages`, `restoreCut`) | the first message cut or restored; a restore as a new take also builds the new take |
| a take is forked (`fork`) | the new take, from its own path (the source is untouched) |
| a take is deleted or restored | dropped, or rebuilt |
| `recordMessageDeltas` | that message, in that take only |
| a continue is committed | nothing: it stamps no delta |

A turn that fails, stops with nothing or is cancelled has stamped nothing: its deltas wait on the checkpoint and go
with it. `sceneStateBefore(branchId, messageId)` answers the state a new version of that message, or a continue of it, builds from: everything shown before it, and its own message deltas. `sceneDeltas(branchId, fromMessageId, toMessageId?, slotPrefixes?)` is the range read for a reader that wants to see what each message changed: the state before `from` (everything shown before it, without its own deltas, so a person's edit on it is still a change) and each live message from `from` through `to` (the tip when omitted) with its deltas in fold order, its shown version's then its own. Given slot prefixes, only those slots' deltas are loaded (the state before is still whole). It builds the state with the same rebuild and reads the deltas with the same read as the rebuild does, and it changes nothing. A range that ends before it starts is empty; a branch that is absent or deleted, or a message that is absent, cut or on another take, answers null. The tracker changes read ([tracker.md](entities/tracker.md)) is its one caller.

## How a turn uses it

`loadTurn` reads the variables from `sceneState` for a new reply and from `sceneStateBefore` for a new version or a
continue, so a regenerate never counts its own earlier writes twice. Assembly returns the turn's local variable
changes as before; `scene-turn.ts` turns them into `vars` deltas (`vars-bridge.ts`) and saves them on the checkpoint
with the prompt trace. That save is awaited and may wait up to 30 s for the library's write lock; if it fails the turn fails before
anything is sent, as the old variable write did. `commitTurn` stamps the deltas on the version it stores and rebuilds the take. A continue makes no
deltas. A turn's deltas are always saved; nothing is refused for size.
The library's global variables are untouched by this: they are still written before the request goes out and put back
by `putBackEffects` when a turn does not commit. A tool's writes join that pending set while the reply streams: the trackers' `update_trackers` tool ([tracker.md](entities/tracker.md)) adds its deltas through the turn's one door (`src/studio/scene-turn-writes.ts`), which takes tracker slots only, has no size cap, and saves the set on the checkpoint, awaited (a save that did not happen, such as a checkpoint that is gone, is a failure the model is told of, with nothing kept); the tool loop runs it as the one non-read tool (`access: "write"` with `stateScoped: true`, tier `narrator.tracker`). A swipe, regenerate or cut takes those writes back with the version, and a turn that fails or is dropped has stamped nothing. Other readers: the Context wing's variables route reads the `vars`
slot, and a chat import writes its variables as the take's base with `setBranchBase`, with or without messages, so no greeting, cut or
fork changes what the chat started with; the first reply's prompt sees them. A write of a value the
message already builds on adds nothing. The variable history route reads the recorded changes of the newest 400 replies (`HISTORY_SCAN`).

## Not built yet

Planned, in `.claude/plans/scene-state.md`, and absent from the code: more slots (the Spellbook, the summary, the Props
trackers and the Director's rounds), global variables as a derived log, the Compendium's shared lane, writer
classes and permissions, the Story Director updating library trackers, and any UI for hand edits or a state inspector. `recordMessageDeltas` is the
store's door for a write that is not a turn's; nothing calls it yet outside tests, and nothing in the UI does.

## What is tested

`src/core/scene-state/scene-state.test.ts` holds the unit proofs: each strategy's diff, fold with removal markers, a
rebuild from a keyframe equal to one from nothing. The contract suite
(`chat-store.contract-state.ts`) runs for both stores: choosing, cutting and restoring versions, cutting a middle message
and restoring it, a restore as a new take, a fork, a dropped, committed and continued turn, refusals, and a
2,000-message rebuild with a delta on every hundredth message (held to the same 200 ms budget; measured once at about 20 ms on
SQLite and 5 ms in memory on the development machine). `chat-store-state.sqlite.test.ts` adds the file-only facts: shared delta rows, the keyframes a mid-path cut leaves,
sealing, a refused commit, and the dense case, 6,000 deltas over 2,000 messages with 2,000 fields and 40 keyframes, a full
rebuild measured at 110 to 150 ms and held to a 200 ms budget. A busy-library test (`scene-turn-busy.test.ts`) runs a real turn
with the write lock held as its first save goes out. `scene-turn-lore-effects.test.ts` runs the turn:
a prompt's `{{incvar}}` counts once however often it is made again, and a continue, a failure and a Stop leave the
variables alone. `scene-state-guard.test.ts` fails when code outside the SQLite chat store names the tables or calls
the removed `variables` and `changeVariables` methods. `chat-store.contract-scene-deltas.ts` holds the range read to both stores: the state before and the deltas in fold order, a person's edit on the first message of the range, another version shown, a cut message, an empty range, a message of another take, and a copy. The slot families are held by `slots.test.ts` (exact beats family, overlap refused, the generated lookup) and one contract test that runs a tracker's record fields and list rows through versions, a regenerate, a cut and a restore on both stores; the turn-level proofs are `scene-turn-linked-trackers.test.ts`.
