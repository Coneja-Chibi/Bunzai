---
id: reference/cli
title: CLI reference
audience: dev
summary: Every bunraku command and flag, verified against src/cli.ts and src/cli-io.ts, with usage, behavior, JSON output shapes, and exit codes.
tags: [cli, reference]
related: [reference/architecture, reference/ui]
---

# CLI reference

`bunraku` is the command line for the same engine the desktop Studio runs (see [architecture.md](architecture.md)
and [ui.md](ui.md)): one canonical model, adapters discovered from `src/formats/`. `src/cli.ts` is the whole
dispatcher, one `main(argv)` function with an if-chain per command. `src/cli-io.ts` holds the pure IO policy
the `convert` command leans on: flag parsing, path-identity comparison, container agreement, and atomic file
publish. This page documents every command and flag exactly as the code implements them today.

## Invocation

- In the repo: `bun run src/cli.ts <command> [args]`, or the package script `bun run bunraku <command> [args]`.
- `package.json`'s `bin` field maps the `bunraku` command straight to `src/cli.ts`, so an installed or linked
  package exposes it directly.
- `bun run build:cli` compiles a standalone binary to `dist/bunraku` (`bun build --compile src/cli.ts`).
- `bun run dev` is `bunraku ui 8321`.

## Commands

| Command | Does |
| --- | --- |
| `bunraku convert <in> <out> [--to <format>] [--yes \| -y] [--strict]` | Convert a file and print its loss report. |
| `bunraku inspect <file>` | Show what is inside a file: format, kind, key fields. |
| `bunraku validate <file>` | Detect and parse a file against its format and the canonical schema. |
| `bunraku label <file>` | Guess a card's format spec and its likely origin app. |
| `bunraku formats` | List every adapter the registry discovered. |
| `bunraku ui [port] [studioDir]` | Launch the desktop Studio's primary loopback server. |
| `bunraku export <folder> [studioDir]` | Write the library out as a plain, unencrypted studio folder. |
| `bunraku derived --stats [studioDir] [--json]` | Show per-family process hits/misses, saved rows, estimated bytes, and mean derivation cost. |
| `bunraku derived --clear [studioDir]` | Delete only rebuildable derived rows; canonical library data is unaffected. |
| `bunraku version` | Print the version. |
| `bunraku help` | Print the built-in help text. |
| (no arguments) | Same as `bunraku help`. |
| (an unrecognized first argument) | Prints an error naming it and exits 1. |

## Global flags

| Flag | Where | Does |
| --- | --- | --- |
| `-v`, `--version` | Standalone, before any command | Same as `bunraku version` (`cli.ts:135`). |
| `-h`, `--help` | Standalone, before any command | Same as `bunraku help` (`cli.ts:141`). |
| `--json` | `version`, `formats`, `validate`, `convert`, `derived --stats` | Emit JSON to stdout instead of human-readable output. `inspect`, `label`, `ui`, `help`, and `derived --clear` do not read this flag. |
| `--to <format>` | `convert` only | Force the output adapter id, bypassing extension resolution. |
| `--yes`, `-y` | `convert` only | Allow replacing an existing output file. Never overwrites the input. |
| `--strict` | `convert` only | Refuse before writing when fields are dropped or target coverage is undeclared. |

## `bunraku derived --stats|--clear`

These commands open the existing encrypted library and require it to be unlocked. They do not run the
normal session-copy, Trash-purge, or summary-rebuild open maintenance. `--stats` prints one row per
derived family; `--json` emits the same array as JSON. `--clear` removes the derived table's rows and
the in-memory tier, which the application can rebuild as needed. A missing library or locked library
returns an error without creating a new one.

## `bunraku convert <in> <out>`

```
bunraku convert <in> <out> [--to <format>] [--yes | -y] [--strict] [--json]
bunraku convert vera.png vera.charx --to risu
bunraku convert card.json out.charx --to lumiverse --yes
```

Flags may appear anywhere after `convert`, in any order: `parseConvertFlags` (`cli-io.ts:17-45`) scans the
whole tail and pulls `--yes`/`-y`, `--strict`, and `--to <value>` out wherever it finds them, leaving exactly two
positional tokens as `<in>` and `<out>`. A repeated boolean flag or `--to` is an error (`duplicate --yes`,
`duplicate --strict`, or `duplicate --to`), a `--to` with no value or a value starting with `-` is an error (`--to requires a format
id`), and any other token starting with `-` is an error (`unknown flag: <token>`). Exactly two positional
tokens are required; more or fewer print the usage line and exit 1.

The conversion follows these checks before a byte is written (`cli.ts:299-414`):

1. **Guard the output path** (`guardConvertOutput`, `cli-io.ts:112-132`). Refuses to run when `<out>`
   resolves to the same file as `<in>` (compares realpaths when both exist, else resolved parent directory
   plus basename, case-insensitively on Windows). When `<out>` already exists, requires `--yes`/`-y`;
   otherwise fails with `output already exists: <out> (pass --yes to replace)`.
2. **Detect the source adapter** (`registry.detect`). Fails when no adapter recognizes `<in>`, listing every
   known adapter id.
3. **Resolve the target adapter** (`resolveTarget`, `cli.ts:55-66`). `--to <format>` wins outright; a bad id
   fails with `Unknown format "<format>"`. Otherwise the adapter is resolved from `<out>`'s extension via
   `registry.targetsForExtension`: zero matches fails as unresolvable, more than one match fails as ambiguous
   and names the candidate ids (an extension two adapters both write, such as `.json` for both `sillytavern`
   and `vaud-json`, is never guessed).
4. **Run the conversion** (`convertFile`, `src/convert.ts`): import to the canonical entity, export to the
   target, extracting and re-embedding any bundled lorebook (see [architecture.md](architecture.md),
   "Bundles"). An adapter that throws surfaces its message and exits 1.
5. **Check container agreement** (`assertContainerAgreement`, `cli-io.ts:159-207`). The adapter's own
   suggested extension must match the requested one. `.charx`/`.byaf`/`.zip` must be real ZIP-magic bytes;
   `.json`/`.lorebook`/`.txt` must be text that parses as JSON (for `.json`) or decodable UTF-8 bytes; every
   other extension just needs a non-empty payload.
6. **Enforce the loss contract.** Every target must return a serialize report. With `--strict`, the
   command refuses undeclared coverage or any reported dropped path.
7. **Publish atomically** (`publishAtomic`, `cli-io.ts:213-239`). Writes a temp sibling file in the same
   directory, fsyncs it, then renames it over the destination. A failure at any point removes the temp file
   and leaves the prior destination untouched.

After container agreement and before publication, `--strict` refuses the conversion if its structured
serialize report names one or more dropped paths or cannot determine loss because target coverage is
undeclared.

Only the success report honors `--json`; every failure above (guard, detect, resolve, convert,
container-agreement, write) prints the same plain-text line whether or not `--json` was passed.

`--json` success shape:

```json
{ "ok": true, "from": "sillytavern", "to": "risu", "in": "vera.png", "out": "vera.charx", "extension": "charx", "lorebooks": 1, "bytes": 48213, "textChars": 0, "report": { "coverage": "declared", "counts": { "escrowed": 0, "dropped": 2, "escrowShadowed": 0, "warnings": 0 }, "escrowed": [], "dropped": ["body.behavior.triggers", "original.sillytavern.raw"], "escrowShadowed": [], "warnings": [] } }
```

`lorebooks` is a count of bundled lorebooks carried across, not the lorebooks themselves; `bytes`/
`textChars` reflect whichever payload shape the target adapter produced (one of the two is always 0).

The plain-text report prints the from/to adapter ids, paths, resolved extension, bundled lorebook count,
the report counts, every confirmed dropped path, and every warning. Undeclared coverage prints an
unknown dropped count rather than zero; JSON uses `coverage: "unknown"` and `counts.dropped: null`.

@fig convert

## `bunraku inspect <file>`

```
bunraku inspect <file>
```

Detects the source adapter, converts to the canonical entity, validates the complete runtime schema
and confirms that the entity kind matches the adapter contract, then prints the format id, the adapter's
label, the entity kind, and kind-specific fields (`cli-validation.ts`, `cli.ts`):

| Kind | Extra fields printed |
| --- | --- |
| `character` | name (`identity.name`), greeting (first 60 chars of `greetings.firstMessage`), alts (`greetings.alternateGreetings` count), tags (`discovery.tags`) |
| `lorebook` | name, type (`lorebookType`), entries (count), budget (`tokenBudget` and `budgetMode`) |
| `persona` | name, brief (first 60 chars), content (character count), sections (the keys of `sections`) |
| `regex` | name, rules (count) |
| `preset` | name, prompts (count), groups (count), choices (count) |

Does not honor `--json`; always prints the human-readable form. `<file>` is read as `args[1]`
(`cli.ts:234`), the literal second token, so a flag placed before the path is read as the path instead.
The canonical inspect formatter has a media-pack branch, but no live format adapter currently imports a
pack, so that branch is not reachable from this command.

## `bunraku validate <file>`

```
bunraku validate <file> [--json]
```

Detects the adapter, converts through `toCanonical`, then parses the result through the exhaustive
canonical runtime schema and confirms that the returned kind matches the adapter contract before
reporting pass/fail (`cli-validation.ts`). No adapter recognizing `<file>`, an adapter parse error, an
invalid canonical result, or a kind mismatch is a failure (`INVALID`); otherwise it is `OK` and prints
the format id, kind, and name. Exit code is 0 on `OK`, 1 on any `INVALID` case.

`<file>` is resolved as the first argument that is neither `validate` nor `--json` (`cli.ts:178`), so
`--json` may appear before or after the path.

`--json` shapes, one of three:

```json
{ "ok": true, "path": "vera.png", "format": "sillytavern", "kind": "character", "name": "Vera" }
{ "ok": false, "path": "vera.png", "error": "unrecognized" }
{ "ok": false, "path": "vera.png", "format": "sillytavern", "error": "<the thrown message>" }
```

## `bunraku label <file>`

```
bunraku label <file>
```

Guesses a card's spec and likely origin app without fully parsing it into the canonical model
(`labelCard`/`sniffContainer`, `src/entities/character/provenance.ts`). The source object it labels is the
best one available: the detected adapter's escrowed raw card when one exists, else a direct `JSON.parse` of
the decoded text, else `undefined` (`sourceCardOf`, `cli.ts:73-90`), so `label` can still report
`unknown`/`(none)` on a file no adapter recognizes.

Prints:

| Field | Value |
| --- | --- |
| `format` | The card spec: `chara_card_v3` \| `chara_card_v2` \| `chara_card_v1` \| `agnai` \| `backyard` \| `unknown`. Not an adapter id (contrast `inspect`'s `format`, which is `src.id`). |
| `container` | The physical wrapper: `png` \| `charx` \| `json` \| `unknown`. |
| `origin` | The likely authoring app plus confidence to two decimals, or `(unknown)`. |
| `signals` | Every fingerprint that fired, comma-joined, or `(none)`. |

Does not honor `--json`. `<file>` is `args[1]` (`cli.ts:279`), same positional caveat as `inspect`.

## `bunraku formats`

```
bunraku formats [--json]
```

Loads every adapter the loader discovers under `src/formats/*/index.ts` (`loadFormats`) and lists each
one's id, kind, label, and output extensions (`cli.ts:146-175`). The plain-text form also prints the doc
path for the generated coverage matrix (`docs/FORMAT-SUPPORT.md`, regenerated with `bun run matrix`) and a
reminder that a new format is a folder drop-in (copy `src/formats/_template`).

`--json` shape:

```json
{ "schema": "1", "adapters": [ { "id": "sillytavern", "kind": "character", "label": "SillyTavern character card (v2/v3, png/json)", "outputExtensions": ["json"] } ] }
```

## `bunraku ui [port] [studioDir]`

```
bunraku ui
bunraku ui 8321
bunraku ui 8321 "C:\Users\me\Documents\Bunraku Studio"
```

Starts the Studio's primary loopback server (`startUi`, see [ui.md](ui.md)) and blocks forever:
`Bun.serve`
keeps the process alive and `main` awaits a promise that never resolves, so the process ends only on
interrupt (`cli.ts:219-231`).

`port` is `Number(args[1]) || 8321` (`cli.ts:222`): a missing, non-numeric, or literal `0` value all fall
back to `8321`, since `0` is falsy. `studioDir` is `args[2]`, defaulting to `<home>/Documents/Bunraku Studio`;
it can only be set by also passing a `port` first, since it reads the third positional token regardless of
the second. Does not honor `--json`.

## `bunraku export <folder> [studioDir]`

```
bunraku export "C:\Users\me\Desktop\studio backup"
bunraku export ./backup "C:\Users\me\Documents\Bunraku Studio"
```

Writes the studio's encrypted library out as a plain studio folder (`src/cli-export.ts`, which calls
`exportLibraryToFolder` in `src/studio/folder-export.ts`): every live piece as `<kind>/<id>.json` and the
Studio's own documents (`settings.json`, `collections.json`, `engines.json`, `graveyard.json`) at the top,
the exact layout the folder import reads. The Trash and each piece's earlier versions stay in the library.
`studioDir` defaults like `ui`'s.

- It opens the existing library the way the app does and never makes one: with no `library.db` in the studio
  folder it prints that there is nothing to export and exits 1.
- A library that needs its password to open is refused (exit 1): the command cannot ask for it yet.
- The destination must be new or an empty folder, outside the studio folder. Anything else is refused and
  nothing is written (exit 1). The folder is built beside the destination and renamed into place only when
  complete, so an interrupted export never looks finished.
- The output says the folder is not encrypted, lists any piece the library holds damaged (left out), and
  counts collection entries left out because they named deleted pieces.
- Opening the library is the app's open, so the Trash is emptied of pieces past 3 days first. With the app
  running, a piece edited during the export may go out in either version.
- A missing `<folder>` prints usage and exits 2. Does not honor `--json`.

## `bunraku version`

```
bunraku version
bunraku -v
bunraku --version
```

All three are equivalent; the `-v`/`--version` forms are checked before any other command match, ahead of
the no-arguments and `help` fallback (`cli.ts:135-139`). Plain form prints just the version string.
`--json` shape: `{ "version": "0.1.0", "schema": "1" }`.

## `bunraku help`

```
bunraku help
bunraku -h
bunraku --help
bunraku
```

All four print the same built-in `HELP` banner: usage line, the command table, the flag list, one example
block, and a status line naming the schema version and the format-matrix doc path (`cli.ts:97-126`). No
arguments falls through to the same branch as `help` (`cli.ts:141`). Does not honor `--json`.

## Quirks

- `--json` is honored by `version`, `formats`, `validate`, `convert`, and `derived --stats`;
  `inspect`, `label`, `ui`, `help`, and `derived --clear` remain human-readable only.
- Convert's `--json` only covers the success report; every failure branch (guard, detect, resolve,
  convertFile, container-agreement, write) prints plain text regardless of the flag.
- `-y` is a working alias of `--yes` that the `HELP` text does not mention (`cli-io.ts:23`).
- Export without a destination and derived without a supported action exit 2 and print usage to stderr.
  Export and derived also print operational refusals to stderr and exit 1; their success output uses stdout.
  The conversion and inspection commands generally use stdout for both success and failure.
- Positional resolution differs by command. `validate` accepts the path in any position relative to
  `--json` (`cli.ts:178`); `inspect` and `label` take `args[1]` literally, so a flag placed before the path
  is read as the path.
- `label`'s `format` column is the card's spec (from `labelCard`); `inspect`'s `format` column is the
  adapter id (`src.id`). Same column name, different value, on two different commands.

## Source of truth

| Concern | File |
| --- | --- |
| Command dispatch, every command body, the `HELP` banner | `src/cli.ts` |
| Canonical runtime validation and adapter-kind agreement | `src/cli-validation.ts` |
| Convert flag parse, path-identity guard, container-agreement check, atomic publish | `src/cli-io.ts` |
| Registry (detection, extension-to-adapter resolution) | `src/core/registry.ts` |
| Canonical wrapper, schema version | `src/core/canonical.ts` |
| Folder discovery (`loadFormats`) | `src/core/loader.ts` |
| Bundle extract/re-embed on convert | `src/convert.ts` |
| Card provenance labeler (`labelCard`, `sniffContainer`) | `src/entities/character/provenance.ts` |
| Studio server started by `bunraku ui` | `src/ui/server.ts` (see [ui.md](ui.md)) |
| Invocation surfaces (`bin`, scripts) | `package.json` |
