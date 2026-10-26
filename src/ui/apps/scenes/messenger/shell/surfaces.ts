/**
 * Where each Messenger program opens and the two studio prefs the shell keeps (approved wireframe messenger-discord/panels.html section 0, shell.html). One table maps a program id to
 * one of four surface kinds: Side (a live tool beside the chat), Wide (an editor beside the chat), Popout (a quick picker over it) and Layer (a workshop over the whole app). A Prop's
 * panel program has no row and opens Side. Every way of opening a program (the header switcher, the sidebar rows, the user panel, a numbered request from the page) goes through
 * `surfaceOf`, so a program never opens in two shapes. The prefs are plain id lists: the panels pinned in the header, and the characters the person left (hidden from the rail, never deleted).
 */
import type { AppContext } from "../../../../app-contract";

export type SurfaceKind = "side" | "wide" | "popout" | "layer";

const KIND: Readonly<Record<string, SurfaceKind>> = {
  quickplay: "side", characters: "wide", persona: "wide", participants: "side",
  lorebook: "side", compendium: "layer",
  prompts: "layer", guides: "layer", regex: "layer", "post-production": "layer", display: "layer",
  "author-note": "side", "writing-tools": "side", props: "side",
  model: "popout", sampler: "wide",
  "image-gallery": "side", "mood-music": "side", spotify: "side", wardrobe: "side",
  inspector: "wide", memory: "side",
};

export const surfaceOf = (programId: string): SurfaceKind => KIND[programId] ?? "side";
/** The wing heading each program sits under in the header's All panels menu (panels.html section 1). */
export const WING_LABEL: Readonly<Record<string, string>> = { booth: "Scene", cast: "Scene", world: "World", prompting: "Prompting", finalcut: "Final Cut", props: "Features", stage: "Stage", context: "Context", ai: "AI" };
export const KIND_LABEL: Readonly<Record<SurfaceKind, string>> = { side: "Side", wide: "Wide", popout: "Popout", layer: "Layer" };
/** Layers cover the whole app and hold the keyboard; the other kinds leave the chat in reach. */
export const isModalKind = (kind: SurfaceKind): boolean => kind === "layer";
export const isDockedKind = (kind: SurfaceKind): boolean => kind === "side" || kind === "wide";

export const PINNED_KEY = "messenger.pinnedPanels";
export const HIDDEN_KEY = "messenger.hiddenCharacters";
/** The header icons a person who never pinned anything sees (shell.html: Scene Note and Memory; the member list toggle is its own button). */
export const DEFAULT_PINS: readonly string[] = ["author-note", "memory"];

type Prefs = AppContext["prefs"];

/** A saved id list, or null when the pref is unset or not a list; entries that are not strings are dropped. */
function idList(raw: unknown): string[] | null {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : null;
}

export const readPins = (prefs: Prefs): string[] => idList(prefs.get(PINNED_KEY)) ?? [...DEFAULT_PINS];
export const readHidden = (prefs: Prefs): string[] => idList(prefs.get(HIDDEN_KEY)) ?? [];

/** Pins `id` or unpins it; returns the list now saved. */
export function togglePin(prefs: Prefs, id: string): string[] {
  const now = readPins(prefs);
  const next = now.includes(id) ? now.filter((p) => p !== id) : [...now, id];
  prefs.set(PINNED_KEY, next);
  return next;
}

/** Leave: adds the character to the hidden list; returns the list now saved. Nothing else is touched. */
export function hideCharacter(prefs: Prefs, characterId: string): string[] {
  const now = readHidden(prefs);
  const next = now.includes(characterId) ? now : [...now, characterId];
  prefs.set(HIDDEN_KEY, next);
  return next;
}
