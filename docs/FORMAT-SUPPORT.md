# Format support matrix

Auto-generated from live adapters (`bun run scripts/format-matrix.ts`).
Canonical schema version: **1**.
Generated: 2026-10-27.

## How to use

```bash
bun run bunraku formats
bun run bunraku inspect path/to/card.png
bun run bunraku convert in.png out.json --to sillytavern
bun run bunraku validate path/to/card.json
```

Default portable character shape for thin hosts (C.AI Tools dumps, Crushon import, etc.):
**SillyTavern / CCv3** (`sillytavern` adapter).

## Characters (9)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `agnai` | character | .json | Agnai (Agnaistic) character (.json) |
| `backyard` | character | .json | Backyard.ai / Faraday character (legacy json) |
| `byaf` | character | .byaf | Backyard archive (.byaf) |
| `lumiverse` | character | .json, .charx | Lumiverse character (ST + modules) |
| `pygmalion` | character | .json, .png | Pygmalion character (flat JSON / PNG) |
| `risu` | character | .charx | RisuAI .charx (zip: card.json + assets) |
| `rolecall` | character | .json | RoleCall character card (v3, png/json) |
| `sillytavern` | character | .json, .png | SillyTavern character card (v2/v3, png/json) |
| `vaud-json` | character | .json | Bunraku native (.json) |

## Lorebooks (7)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `agnai-lorebook` | lorebook | .json | Agnai memory book (json) |
| `marinara-lorebook` | lorebook | .json | Marinara-Engine lorebook (native .marinara.json export) |
| `novelai-lorebook` | lorebook | .lorebook | NovelAI lorebook (native export .lorebook / json) |
| `risu-lorebook` | lorebook | .json | RisuAI lorebook (native export json) |
| `rolecall-lorebook` | lorebook | .json | RoleCall lorebook (v1 export json) |
| `rolecall-compendium` | lorebook | .json | RoleCall compendium export (compendium.json) |
| `sillytavern-lorebook` | lorebook | .json | SillyTavern world info (worldbook json) |

## Personas (4)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `lumiverse-persona` | persona | .json | Lumiverse persona (account object) |
| `marinara-persona` | persona | .json | Marinara persona (theming and stat bars ride sealed) |
| `rolecall-persona` | persona | .json | RoleCall persona (rcpersona / RC persona-card export) |
| `sillytavern-persona` | persona | .json | SillyTavern personas backup (default persona; the rest ride sealed) |

## Packs (1)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `image-pack` | pack | .zip | Pack (zip of pictures and sounds) |

## Presets (4)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `lumiverse-preset` | preset | .json | Lumiverse preset (wrapper import; exports as an ST flat preset) |
| `marinara-preset` | preset | .json | Marinara-Engine prompt preset (marinara_preset export) |
| `rolecall-preset` | preset | .json | RoleCall preset export (ST grammar + macros/choice groups/readme) |
| `sillytavern-preset` | preset | .json | SillyTavern completion preset (flat json) |

## Script Sheets (1)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `rolecall-script-sheet` | scriptsheet | .json | RoleCall Script Sheet export (one instruction, with the blocks it sends) |

## Regex sets (5)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `lumiverse-regex` | regex | .json | Lumiverse regex scripts (versioned export file) |
| `marinara-regex` | regex | .json | Marinara-Engine regex scripts (API dump array) |
| `risu-regex` | regex | .json | RisuAI regex scripts (.risum module or customscript array) |
| `rolecall-regex` | regex | .json | RoleCall regex script (chat-pipeline find/replace set) |
| `sillytavern-regex` | regex | .json | SillyTavern regex scripts (bare array or card extensions.regex_scripts) |

## Quick replies (1)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `sillytavern-quickreply` | quickreply | .json | SillyTavern quick-reply set |

## Tools (0)

| id | kind | writes | label |
| --- | --- | --- | --- |
| (none yet) | tool | | The studio edits this kind, but no import/export format exists yet. |

## Dice (0)

| id | kind | writes | label |
| --- | --- | --- | --- |
| (none yet) | dice | | The studio edits this kind, but no import/export format exists yet. |

## Formulas (0)

| id | kind | writes | label |
| --- | --- | --- | --- |
| (none yet) | formula | | The studio edits this kind, but no import/export format exists yet. |

## Prompt formats (1)

| id | kind | writes | label |
| --- | --- | --- | --- |
| `sillytavern-promptformat` | promptformat | .json | SillyTavern prompt format (instruct and context templates) |

## Drawings (0)

| id | kind | writes | label |
| --- | --- | --- | --- |
| (none yet) | htmldoc | | The studio edits this kind, but no import/export format exists yet. |

## Notes

- Detection is content-sniff, not only extension. Prefer `bunraku label` when unsure.
- Same-format round-trips aim for lossless where fixtures prove it (see adapter tests + samples/).
- Cross-format convert keeps what the target can express; use export honesty in the studio UI for drop notes.
- Dropped/skipped host-native bags (Character.AI, Crushon): use Default CCv3 via `sillytavern`.

## Samples

| Folder | Purpose |
| --- | --- |
| `samples/sillytavern/` | CCv2/v3 + Seraphina.png |
| `samples/rolecall/` | RC character + lorebook |
| `samples/risu/` | .charx + card json |
| `samples/agnai/` | native Agnai |
| `samples/backyard/` | .byaf archives |
| `samples/pygmalion/` | classic flat |
| `samples/lumiverse/` | ST + Lumi extensions |
| `samples/chub/` | ST + extensions.chub |
| `samples/marinara/` | native lorebook envelope + prompt preset |
| `samples/novelai/` | lorebook |
