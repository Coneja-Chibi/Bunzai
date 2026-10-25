# ADR-013: The scene's wings and tabs get slots in the one slot registry

**Status:** proposed, 2026-10-12 (awaiting review)
**Context owners:** `src/extensions/slot-registry.ts`, `src/ui/_shared/theme-slot.tsx`, `src/ui/apps/scenes/`
**Supersedes nothing. Extends:** the slot list in the theme-package contract

## Context

A theme package may place static images and plain text in named slots (`ui.slots`). The list was 11 ids, all
on app pages and the scene's backdrop and composer. The scene's wings (Control Booth, Cast, Prompting,
World, Final Cut, Props, AI, Stage, Context) are where a scene is set up, and a theme could restyle them
through parts but could not add content to any of them. That is a gap in the model, not a defect, and a hand-rolled
substitute is the wrong fix.

## Decision

- `slot-registry.ts` stays the one list and `parseSlots` the one parser. It gains 29 ids:
  `scene.wing.<wing>` for each of the nine wings (drawn at the top of the wing's panel, above its tabs) and
  `scene.wing.<wing>.<tab>` for each tab a wing opens (drawn at the top of that tab's body).
- Each id has exactly one literal `<ThemeSlot id="...">` render point under `src/ui`, and
  `theme-slot.test.tsx` fails when an id has none or a wing or tab has no id.
- Slots keep their existing limits and meaning: data only (an image of a package asset or plain text),
  1 to 4 items per slot and 24 per package, drawn by the host as `slot.<id>`, nothing when empty. Nothing
  here lets a package run code or read scene data; interactive content still waits for the extension runtime.
- A wing or tab keeps its slot id when the component under it is renamed, the way a part name stays.

## Consequences

- A theme can brand or annotate any wing without touching its controls. A slot is not the protected layer
  and holds no behavior, so it cannot press or read anything in a wing.
- The package item cap (24) is unchanged, so the larger id list does not let a package draw more.
- Adding a wing or tab means adding its ids to the registry and one render point, which the test enforces.
