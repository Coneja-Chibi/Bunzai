/**
 * What the four Storyboards dossiers share (RoleCall `lib/compendium/dossiers/{types,context-profile,slugs}.ts`): the types of dossier, the AI Context
 * profile (Focused, Compact, Radius, Full) and how it limits a section's lines, the slug every card carries, and the readers that take a field
 * out of an entry's structured data under any of the names RoleCall's writers used. Pure.
 *
 * RoleCall builds each dossier from the book's typed entries AND from the Story Director's `storyboard_events` journal. The journal does not exist
 * here (the Story Director's storyboard rounds are not built), so every dossier is a view of the typed entries alone: plots, characters, locations and organizations.
 * Calendar is not built: its state (the story date, the calendar system) lives only in that journal, and no entry type holds it.
 */
import { isRecord, recOr, type Rec } from "../../guards";
import { asciiSlug } from "../../text";
import { roughTokenCount } from "../../tokens/estimate";
import type { CompendiumEntry } from "../read";

export const DOSSIER_TYPES = ["quests", "cast", "map", "renown"] as const;
export type DossierType = (typeof DOSSIER_TYPES)[number];

export const CONTEXT_MODES = ["focused", "compact", "radius", "full"] as const;
export type ContextMode = (typeof CONTEXT_MODES)[number];
export interface ContextProfile { mode: ContextMode; radius: number }

export const DEFAULT_PROFILE: ContextProfile = { mode: "focused", radius: 5 };
export const RADIUS_CHOICES = [3, 5, 8, 12, 20] as const;

const clampInt = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));
export const clamp = clampInt;

/** The profile as RoleCall normalizes it (context-profile.ts:6-14): an unknown mode is Focused; the radius is 1 to 30, 8 for Radius and 5 otherwise. */
export function normalizeProfile(value: unknown): ContextProfile {
  const rec = recOr(value);
  const mode = CONTEXT_MODES.find((m) => m === rec["mode"]) ?? "focused";
  const radius = typeof rec["radius"] === "number" && Number.isFinite(rec["radius"]) ? clampInt(rec["radius"], 1, 30) : mode === "radius" ? 8 : 5;
  return { mode, radius };
}

/** How many lines a section may carry (context-profile.ts:lineLimit): Compact at most 3, Radius its radius, Full no limit. */
export function lineLimit(profile: ContextProfile, fallback: number): number {
  switch (profile.mode) {
    case "compact": return Math.min(fallback, 3);
    case "radius": return clampInt(profile.radius, 1, 30);
    case "full": return 999;
    default: return fallback;
  }
}

export const profileLabel = (mode: ContextMode): string => ({ focused: "Focused", compact: "Compact", radius: "Radius", full: "Full" })[mode];

export const slug = (value: string | null | undefined): string => asciiSlug(String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, ""), { fallback: "untitled" });

export const tokenEstimate = roughTokenCount;

function path(source: Rec, key: string): unknown {
  let at: unknown = source;
  for (const part of key.split(".")) {
    if (!isRecord(at)) return undefined;
    at = at[part];
  }
  return at;
}

export function readString(source: Rec, keys: readonly string[]): string | null {
  for (const key of keys) {
    const v = path(source, key);
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
export function readNumber(source: Rec, keys: readonly string[]): number | null {
  for (const key of keys) {
    const v = path(source, key);
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}
export const readBool = (source: Rec, keys: readonly string[]): boolean => keys.some((key) => path(source, key) === true);
export function readArray(source: Rec, keys: readonly string[]): unknown[] {
  for (const key of keys) {
    const v = path(source, key);
    if (Array.isArray(v)) return v;
  }
  return [];
}
export const readStrings = (source: Rec, keys: readonly string[]): string[] => readArray(source, keys).flatMap((v) => (typeof v === "string" && v.trim() ? [v.trim()] : []));
export function readRecord(source: Rec, keys: readonly string[]): Rec {
  for (const key of keys) {
    const v = path(source, key);
    if (isRecord(v)) return v;
  }
  return {};
}

/** The entries a dossier reads: live ones of the given types. A retired entry is the person's removal and is never shown or sent. */
export const entriesOfType = (entries: readonly CompendiumEntry[], ...types: string[]): CompendiumEntry[] => entries.filter((e) => e.type !== null && types.includes(e.type) && !e.retired);

export const labelize = (key: string): string => key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase());

/** What every dossier hands the view and the prompt: its cards live in the dossier's own fields, the AI Context text and its size here. */
export interface DossierAiContext { text: string; tokens: number; profile: ContextProfile }
export const aiContext = (lines: readonly string[], profile: ContextProfile): DossierAiContext => {
  const text = lines.join("\n");
  return { text, tokens: tokenEstimate(text), profile };
};
