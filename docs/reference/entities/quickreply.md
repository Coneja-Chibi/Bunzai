---
id: reference/entities/quickreply
title: Quick-reply set entity
audience: dev
summary: The canonical piece for SillyTavern quick-reply sets, a named page of buttons that send prepared text, kept as label and message per button with every other wire field escrowed, and linked from presets.
tags: [entity, quickreply, canonical, sillytavern]
related: [reference/entities/preset, reference/formats/sillytavern, reference/extending/new-kind]
---

# Quick-reply set entity

A `CanonicalQuickReplySet` is `CanonicalEntity<"quickreply", QuickReplyBody>`: a named set of buttons, each with a
label and the message pressing it sends. The type lives in `src/entities/quickreply/schema.ts`; the kind's descriptor
(labels "Quick reply" and "Quick replies", deck color, its blank "Untitled quick replies" set) is
`src/entities/quickreply/kind.ts`.

It is a kind of its own so a preset can LINK one (`PresetBody.quickReplyRefs`) and the Press can print them together,
the same shape as character to lorebook and preset to regex. The canonical body keeps what a person authors (the
label and the message); every other per-button switch rides `extras` on the reply, and the source file rides
`original` on the envelope, untouched, so export writes it back.

A reply's message is usually a slash-command script. It is data: nothing in Bunzai executes it.

## Fields

The tables are generated from the schema by `scripts/docs-fields.ts` and pasted verbatim from
[docs/generated/fields.quickreply.md](../../generated/fields.quickreply.md); improve the schema doc comment and
regenerate rather than editing a cell.

### `QuickReply`

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `id` | `string` | - | Stable per-row id, minted at import when the wire has none. |
| `label` | `string` | ST | The button's label; ST allows "" (icon-only buttons), so empty is legal here too. |
| `message` | `string` | - | What pressing it sends - usually a slash-command script. Data, never executed here. |
| `title?` | `string` | - | Hover text, when the wire carries one. |
| `hidden?` | `boolean` | ST | Row disabled on the platform (ST `isHidden`); kept so a toggle round-trips. |
| `extras?` | `Record<string, unknown>` | - | Unmodelled wire fields for this row, re-merged on export without semantic loss. |

### `QuickReplyBody`

| Field | Type | Producers | Meaning |
| --- | --- | --- | --- |
| `name` | `string` | ST | What the set is called; ST names sets, and the Library titles from the body like every kind. |
| `replies` | `QuickReply[]` | - |  |
| `extras?` | `Record<string, unknown>` | - | Set-level wire fields the canonical model does not first-class (disableSend, color, ...). |
| `notes?` | `string` | - | The author's own notes, same shape every other entity uses. |

## Where it shows

- **Library:** the Quick replies deck, with a "New quick reply" action that saves an empty set.
- **Workbench:** the quick-reply editor (`src/ui/apps/workbench/QuickReplyEditor.tsx`).
- **Kit:** the create tool (`src/kit/tools/quickreply-create.ts`); there are no Kit capabilities for editing a set,
  which the Workbench owns (listed in `src/entities/kind-completeness.test.ts`).

## Import and export

The `sillytavern-quickreply` codec reads and writes ST's quick-reply set files. See
[formats/sillytavern.md](../formats/sillytavern.md).
