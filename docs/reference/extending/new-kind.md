---
id: reference/extending/new-kind
title: Add a content kind
audience: dev
summary: How to add a new kind of piece (like presets or lorebooks): one folder under src/entities with its schema, decoder and kind.ts descriptor, then bun run kinds. Lists of kinds, labels, decks, decoders, storage folders, New actions, links, names and picture paths all read the generated seam. A completeness test names anything still missing, and a guard test fails on a new hand-written kind list.
tags: [extending, entity, kind, contribution, folders-as-schema]
related: [reference/entities/README, reference/architecture, reference/extending/add-a-format]
---

# Add a content kind

A kind is one folder. `src/entities/<kind>/kind.ts` describes it once (its id, labels, deck color and glyph, whether it
is a Library deck, the blank piece "New" saves, the lines `bunraku inspect` prints), plus, when they apply, the
pieces it links by id (`links`), where its name lives (`namePath`), where it keeps pictures (`media`), whether it is
too heavy to read whole (`heavy`), whether the Library offers "New" for it (`libraryNew`), which scene field
points at it (`sceneField`), which list in a scene's prompting links it (`promptingList`), the Workbench `editor` it opens in, and, for a kind in a family, the deck it joins (`deck`,
with the owning kind's `deckTitle` and `deckBlurb`) and how it reads as its family's base (`asPreset` and
`sendProblem` for a writing setup, `src/core/writing.ts`). Then `bun run kinds`
(`scripts/kind-manifest.ts`) writes two static seams from every kind folder:

- `src/generated/kinds.ts`: `KINDS`, `KIND_IDS`, `kindOf`, `isKindId`, and `AnyKindEntity`, the union of every kind's
  canonical piece. No decoder code, so the browser bundle and the search worker load it cheaply.
- `src/generated/kind-schemas.ts`: every kind's whole-entity decoder (the parse boundary's discriminated union) and the
  kinds whose bodies split into item parts in storage.

Both are checked by `bun run kinds:check` in `verify:ci`; never edit them by hand.

## What reads the seam (so you edit none of it)

| What | Where |
| --- | --- |
| The closed set of studio folders | `src/studio/path-policy.ts` (`STUDIO_ENTITY_KINDS`) |
| The parse boundary | `src/entities/runtime-schema.ts` |
| Storage item parts | `src/entities/piece-parts.ts` |
| Format adapter contracts | `src/core/adapter.ts` (`KindAdapter<K>`; character and preset add their extras) |
| Deck labels, colors, glyphs, Library decks | `src/ui/_shared/decks.ts` |
| Panel, editor head and Press deck colors | `components/panel`, `components/editor-ehead`, `apps/press` (inline from `deckMeta`) |
| Search `kind:` words | `src/core/search/kind-aliases.ts` (plural, short tag, `searchWords`) |
| Import receipts | `src/ui/receipt.ts` (`receiptWord`) |
| Kit deck counts and name lookup | `src/kit/bridge.ts`, `src/kit/tools/rail-open.ts` |
| Library "New" and every other blank-piece door | `src/ui/_shared/new-piece.ts` (`createBlank`, from `blank` and `blankId`; `canCreateBlank` honors `libraryNew`) |
| Links: Press riders, export embedding, import renames, Kit delete warnings, Workbench node ports, archive link caveats | `src/core/links.ts` (from `links` and `sceneField`) |
| A piece's name, read and written | `src/core/piece-name.ts` (from `namePath`) |
| Which paths are pictures, which kinds carry art | `src/entities/_shared/media-reference.ts` (from `media`; Kit's gallery and art tools read `ART_KINDS`) |
| Duplicate, rename and the Press on heavy pieces | `src/ui/apps/press`, `src/ui/apps/library/delete-flow.tsx` (from `heavy`) |
| `bunraku inspect` | `src/cli-inspect.ts` (`describe`) |
| First-run deck titles | `src/ui/setup/steps/first-deck` |
| Format matrix and field docs | `scripts/format-matrix.ts`, `scripts/docs-fields.ts` |

## Steps

1. Make `src/entities/<kind>/` with `schema.ts` (the canonical type `CanonicalEntity<"<kind>", Body>` and an empty-body
   factory) and `runtime-schema.ts` (the strict body decoder wrapped in `defineExhaustiveShape`, and
   `export const entitySchema = z.strictObject(defineExhaustiveShape<CanonicalX>()(entityShape("<kind>", bodySchema, profileSchema)))`).
2. Write `src/entities/<kind>/kind.ts`: `export default defineKind<"<kind>", Body>({ ... })`. The accent must be a
   `--deck-*` token in `src/ui/theme/tokens.css`; the icon a glyph id from `src/generated/ic-glyphs.json`.
3. Optional: `parts.ts` when the body has a long item list that should save item by item (see `kind-parts.ts`), and
   `capabilities/` for Kit (`bun run capabilities`).
4. Run `bun run kinds`.
5. Name the kind's Workbench editor in its `kind.ts` (`editor`: an id, a label and how much of the piece it reads),
   then add the component to `src/ui/apps/workbench/editors.ts` under that id. The completeness test fails on a
   named editor with no component, and on a component no kind names.
6. Write `docs/reference/entities/<kind>.md` and `scripts/scale/fixtures/<kind>.ts`.
7. Run `bun test src/entities/kind-completeness.test.ts`. It lists, per kind, every missing part and the file to
   create. A part a kind deliberately goes without (an editor, Kit capabilities) is named in the test's exemption list
   with the reason.

Behavior that belongs to one kind alone (a preset's readiness line in the Press, a lorebook's scan) stays in the code
that owns that behavior; the hub is for what every kind has. A scene's own fields (its preset with toggles and samplers,
its lorebook choices, its regex rack, its backdrop) keep their own shapes and rules in the scene store; `sceneField`
only says that a scene can point at the kind.

`src/entities/kind-lists.test.ts` keeps it that way: a source line naming two or more kind ids is a hand-written list,
and every file holding one is listed there with its count and the reason it is not a kind list. Read the hub instead of
adding to it.
