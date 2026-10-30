---
id: guide/platforms/README
title: Platforms
audience: user
summary: A short map of every platform Bunzai reads and writes today, what each one hands over, and which guide page to open first.
tags: [platforms, index, import, export, convert]
related: [guide/importing, guide/converting, guide/exporting, reference/formats/README]
---

# Platforms

These guides cover the main platform formats Bunzai supports. Each one gets its own page in this section, and every page has the same shape: what Bunzai reads from that platform, what a piece keeps on a same-app round trip, what drops when you convert it to a different app, how it looks on the Workbench, and a common-questions list at the end. Use the table below to find the page for your platform, then read that page for the full, honest story on your files.

@fig coverage

## The platforms

| Platform | Handles | Page |
| --- | --- | --- |
| Agnai | Characters, Lorebooks | [agnai.md](agnai.md) |
| Backyard | Characters | [backyard.md](backyard.md) |
| Chub | Characters, Lorebooks | [chub.md](chub.md) |
| Lumiverse | Characters, Personas, Regex sets | [lumiverse.md](lumiverse.md) |
| Marinara | Personas, Regex sets | [marinara.md](marinara.md) |
| NovelAI | Lorebooks | [novelai.md](novelai.md) |
| Pygmalion | Characters | [pygmalion.md](pygmalion.md) |
| RisuAI | Characters, Lorebooks, Regex sets | [risu.md](risu.md) |
| RoleCall | Characters, Lorebooks, Personas, Regex sets | [rolecall.md](rolecall.md) |
| SillyTavern | Characters, Lorebooks, Personas, Regex sets | [sillytavern.md](sillytavern.md) |

Handles lists the decks a platform's own files land on, Characters, Lorebooks, Personas, or Regex sets. An omitted kind is outside this table's coverage; it does not establish what the upstream platform can export. Check the generated format reference for current Bunzai adapters.

Two entries need a note. Backyard reads two different character shapes, the older flat JSON export and the modern `.byaf` archive, and both are covered on its one page. Marinara's own character cards are SillyTavern-shaped underneath, so they come and go through [the SillyTavern page](sillytavern.md) instead; Marinara's page covers only what is genuinely its own, regex scripts and personas.

## If your platform isn't listed

Bunzai detects supported files by their contents. If your app exports Character Card v2 or v3 JSON, see [the SillyTavern guide](sillytavern.md). Other exports may need a different adapter or may be unsupported; inspect the file before choosing a target.

For the exhaustive, generated list, every adapter Bunzai has today, run `bun run bunzai formats`, or read [the format reference](../../reference/formats/README.md), the technical version of this page. It is built straight from the live adapter registry, so it never drifts from what the app can actually do.

## Common questions

- **Why do some platforms list fewer kinds?** This table describes the adapters covered by these guides. It is not a complete inventory of upstream features.
- **Will I lose anything moving between two platforms?** Sometimes, and it is always spelled out. Each platform page has its own "what changes when you convert" table with the exact fields that stay and the ones that drop. [The converting guide](../converting.md) covers the general rule.
- **My app isn't listed. Now what?** Inspect the file or try importing it. Bunzai recognizes supported file shapes rather than relying on the app's name, and reports files it cannot read.

![Dropping a file into the Library](../../media/shot-import-drop.png)
