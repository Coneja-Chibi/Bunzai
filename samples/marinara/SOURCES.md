# Marinara samples

Marinara reads CCv3 cards with its features in the extensions field; its public artifacts include
presets and regex packs. This directory currently contains constructed fixtures, not captured
exports from public users.

## Current samples

- `presets/`: a synthetic preset fixture derived from the structure of Marinara-Engine’s built-in
  Universal Preset v12. Its prompt prose was replaced; see [`presets/SOURCES.md`](presets/SOURCES.md).
- `lorebooks/arcadia-world-lore.marinara.json`: constructed to match Marinara’s lorebook schemas
  and export envelope; provenance and exercised fields are documented below.
- Regex: the Marinara Essentials pack is in `src/formats/_fixtures/regex/` for tests. A public
  sample copy can be added here once provenance is recorded.

## Still wanted

- `presets/`: a community-authored public Marinara preset (such as the Spaghetti Recipe, if its
  source and sharing terms can be verified), with the exact URL, collection date, and license terms.
- `characters/`: a CCv3 card carrying Marinara extension data, with the exact URL, date, and license
  terms.

## `lorebooks/arcadia-world-lore.marinara.json`

- **Source:** CONSTRUCTED, not a captured export. Hand-built to match the engine schemas exactly:
  `packages/shared/src/schemas/lorebook.schema.ts` (book, entry, folder fields) and the export
  envelope in `packages/server/src/routes/lorebooks.routes.ts`
  (`{ type: "marinara_lorebook", version: 1, exportedAt, data: { lorebook, entries, folders } }`,
  `ExportEnvelope` in `packages/shared/src/types/export.ts`). Field types are the DESERIALIZED
  storage-row shape (`services/storage/lorebooks.storage.ts` parses the SQLite "true"/"false"
  strings and JSON columns back to real booleans/arrays/objects before the row reaches the envelope).
- **Engine commit:** Marinara-Engine `daf8c212`
  ([repository](https://github.com/Pasta-Devs/Marinara-Engine)).
- **License context:** The file is constructed here to match the engine's schemas; the engine itself
  is AGPL-3.0.
- **Theme:** The engine's own `create_lorebook` example, Arcadia World Lore / Silver Court
  (`packages/server/src/db/seed-mari.ts` create_lorebook example).
- **Exercises:** regex keys (per-entry `useRegex`), secondary keys with `and_all`, a `constant`
  entry, `position` 2 with `depth` + non-default `role`, `sticky`/`cooldown`/`delay`, character +
  character-tag filters, `additionalMatchingSources` (including the unmapped `character_name`),
  `activationConditions`, a `schedule`, `relationships`, and a NESTED folder pair
  (`folder-spies.parentFolderId = folder-court`) alongside root-level entries.

Record the source URL, date, and license for every captured public file added.
