---
id: reference/formats/janitor
title: JanitorAI format
audience: dev
summary: How the export-only JanitorAI adapter writes a chara-only CCv2 PNG whose top-level mirror fields match the field swap in Janitor's avatar importer, plus the ST world info lorebook export for Janitor Scripts.
tags: [format, janitor, character, lorebook, png, export-only]
related: [reference/formats/sillytavern, reference/formats/saucepan, reference/architecture]
---

# JanitorAI format

JanitorAI has no character file of its own and no official card export. Its one importer is hidden in
the avatar upload on `/create_character`: when the uploaded image is a PNG with a `chara` tEXt chunk,
Janitor offers to fill the form from it. Everything below was read from Janitor's production bundle
(`CharacterForm`, `ImageInput`, `ScriptsEditPage`, 2026-10-24). Bundle file names change on every
deploy, so recheck the importer when Janitor changes behavior.

The folder `src/formats/janitor/` default-exports two export-only codecs. Both return `0` from
`detect()`, so a Janitor-bound PNG always imports through the SillyTavern reader, which is what it is;
`toCanonical` delegates to that same reader, so the adapter can read back its own output.

- `janitor`, kind `character`, writes `.png` only.
- `janitor-lorebook`, kind `lorebook`, writes the SillyTavern world info JSON
  (`_shared/host-worldbook.ts`) for the Scripts editor's "Import JSON" button.

The importer mapping below is the co-developer's recorded 2026-10-24 bundle inspection. Current integration tests verify Bunzai's emitted PNG and reports against that mapping; they do not prove a current live import on the external service. Recheck upstream behavior when it changes.

## What Janitor's importer reads

- Only the `chara` keyword. A `ccv3` chunk is ignored, and JSON or charx are not accepted at all
  (the avatar input takes images only, up to 10 MB).
- Format checks run in order: Text-gen-webui, then "TavernAI Character" (all six top-level keys
  `name`, `description`, `personality`, `scenario`, `first_mes`, `mes_example` present), then
  Character.AI shapes, then Character Card V2 (`spec` plus `data`). CCv3 is not recognized.
- On the V1 branch, top-level `description` fills Janitor's **Personality** (the definition) and
  top-level `personality` fills Janitor's public **Description** (the bio). On the pure V2 branch
  `data.description` lands in the bio instead. Either way, a plain SillyTavern card lands swapped or
  with its definition in public view.
- Every recognized field is written even when empty. Alternate greetings, tags, creator notes,
  `character_book`, system prompt and post-history instructions are dropped.

## What the adapter writes

`fromCanonical` builds the normal V2 card through the Tavern codec (`v2CardObject` in
`_shared/card-png.ts`, so a V3 card yields its V2 backfill) and then sets the six top-level mirror
fields the way Janitor's V1 branch reads them:

| Top-level key | Value | Lands in Janitor as |
| --- | --- | --- |
| `name` | `data.name` | Name |
| `description` | `data.description` and `data.personality`, joined by a blank line | Personality (definition) |
| `personality` | `data.creator_notes` | Description (public bio) |
| `scenario` | `data.scenario` | Scenario |
| `first_mes` | `data.first_mes` | First message |
| `mes_example` | `data.mes_example` | Example dialogs |

`data` stays an ordinary V2 card, so the same PNG still opens correctly in SillyTavern and every
other Tavern reader. The card is embedded under `chara` alone (`charaOnlyPng`). The carrier is the
inline PNG portrait or, when none is set, the PNG the card was imported from (the Studio keeps an
imported card's art only there). A card with neither is refused with an error naming `janitor`,
because Janitor requires an avatar.

The serialize report names the dropped fields from `coverage.ts` and adds warnings when the
definition or the first message is empty (both are required by Janitor's form) or the PNG is over
the 10 MB avatar limit.

## Lorebooks

Janitor lorebooks are Scripts of type `lorebook`, separate objects linked to bots. The Scripts editor
imports SillyTavern world info JSON (its tooltip key is `importSillyTavernFile`), so
`janitor-lorebook` is the ST worldbook codec under Janitor's id. Linked lorebooks never travel inside
the PNG; the export dialog says so.

## Source of truth

| Concern | File |
| --- | --- |
| Character adapter | `src/formats/janitor/index.ts` |
| Coverage declaration | `src/formats/janitor/coverage.ts` |
| V2 card object and chara-only PNG | `src/formats/_shared/card-png.ts` |
| Lorebook codec | `src/formats/_shared/host-worldbook.ts` |
| Tests | `src/formats/janitor/janitor.test.ts` |
