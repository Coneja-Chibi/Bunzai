---
id: reference/formats/saucepan
title: Saucepan format
audience: dev
summary: How the export-only Saucepan adapter writes a chara-only CCv2 PNG for the Companion Importer, reports every field over Saucepan's limits, and exports lorebooks as ST world info for the Lorebook Importer.
tags: [format, saucepan, character, lorebook, png, export-only]
related: [reference/formats/sillytavern, reference/formats/janitor, reference/architecture]
---

# Saucepan format

Saucepan (saucepan.ai) imports characters through its Companion Importer at
`/labs/companion-importer`, which states that it supports "the SillyTavern PNG format (v1 and v2)".
Everything below was read from Saucepan's production bundle (2026-10-24). Saucepan has an owner-only
Backup JSON, but its shape is not yet confirmed against a real backup file, so there is no Saucepan
reader.

The folder `src/formats/saucepan/` default-exports two export-only codecs. Both return `0` from
`detect()`; the character codec's `toCanonical` delegates to the SillyTavern reader, which is what its
PNG is.

- `saucepan`, kind `character`, writes `.png` only.
- `saucepan-lorebook`, kind `lorebook`, writes the SillyTavern world info JSON
  (`_shared/host-worldbook.ts`) for the Lorebook Importer at `/labs/lorebook-importer`.

The importer mapping below is the co-developer's recorded 2026-10-24 bundle inspection. Current integration tests verify Bunzai's emitted PNG and reports against that mapping; they do not prove a current live import on the external service. Recheck upstream behavior when it changes.

## What Saucepan's importer reads

- PNG only, `chara` keyword only. `"data" in json` selects the V2 path, otherwise V1. No `ccv3`, JSON
  or charx.
- Default mapping (the user can remap before saving): `description`, `personality` and `scenario`
  merge into **Information** (`card`); `creator_notes` becomes the public **Description**;
  `first_mes` and `alternate_greetings` become Scenarios 1..N; `mes_example` becomes example dialogue;
  `name` and `tags` carry over. System prompt, post-history instructions, `character_book` and
  `extensions` are dropped.
- The result is a private draft. Oversized fields are clipped with a toast, not rejected.

## What the adapter writes

The normal V2 card from the Tavern codec (`v2CardObject`, so a V3 card yields its V2 backfill),
embedded under `chara` alone (`charaOnlyPng`), carried by the inline PNG portrait or else the PNG
the card was imported from. No field is rearranged, because Saucepan's defaults already read a V2
card the way its author meant it. A card with no PNG art at all is refused.

`saucepanWarnings` adds a report warning for each field the importer would clip, counted in code
points as Saucepan counts them: Information over 120,000, Description over 20,000, example dialogue
over 40,000, any scenario over 30,000, or more than 50 greetings in total.

The importer's default map is a fixed table keyed by card field name with no entry for
`system_prompt` or `post_history_instructions`, so it discards them. Its mapping step offers a
"Select mapping..." choice for every discarded field, and Formatting Instructions accepts them. When
either prompt is non-empty, the report says so and warns if the two together pass Formatting
Instructions' 10,000 limit.

## Lorebooks

Saucepan lorebooks are chapters of `{title, text}` with no keyword activation. The Lorebook Importer
takes any JSON and offers SillyTavern presets that map each entry's comment or keys to the chapter
title and its content to the text. `saucepan-lorebook` writes ST world info for those presets; trigger
keys survive only as text.

## Source of truth

| Concern | File |
| --- | --- |
| Character adapter and limit warnings | `src/formats/saucepan/index.ts` |
| Coverage declaration | `src/formats/saucepan/coverage.ts` |
| V2 card object and chara-only PNG | `src/formats/_shared/card-png.ts` |
| Lorebook codec | `src/formats/_shared/host-worldbook.ts` |
| Tests | `src/formats/saucepan/saucepan.test.ts` |
