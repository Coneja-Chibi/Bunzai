/** Validate and persist Library-only cover choices without changing imported lorebook content. */
import type { AppContext } from "../../app-contract";
import catalog from "../../../generated/book-cover-catalog.json";

export interface CoverAsset { slug: string; label: string; category: string; path: string }
export const coverDesigns: CoverAsset[] = catalog.designs;
export const coverBackgrounds: CoverAsset[] = catalog.backgrounds;
export const COVER_PREF = "library.bookCovers";
export interface BookCoverChoice { design: string; background: string; title?: string }

export function parseBookCover(value: unknown): BookCoverChoice | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!coverDesigns.some((d) => d.slug === v["design"]) || !coverBackgrounds.some((b) => b.slug === v["background"])) return null;
  return { design: v["design"] as string, background: v["background"] as string,
    ...(typeof v["title"] === "string" ? { title: v["title"].slice(0, 120) } : {}) };
}

export function defaultBookCover(id: string): BookCoverChoice | null {
  if (!coverDesigns.length || !coverBackgrounds.length) return null;
  const hash = Array.from(id).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  return { design: coverDesigns[hash % coverDesigns.length]!.slug, background: coverBackgrounds[hash % coverBackgrounds.length]!.slug };
}

export function readBookCover(prefs: AppContext["prefs"], id: string, useDefault = false): BookCoverChoice | null {
  const saved = prefs.get(COVER_PREF);
  const value = saved && typeof saved === "object" ? (saved as Record<string, unknown>)[id] : undefined;
  return value === false ? null : parseBookCover(value) ?? (useDefault ? defaultBookCover(id) : null);
}

export function saveBookCover(prefs: AppContext["prefs"], id: string, choice: BookCoverChoice | null): void {
  const saved = prefs.get(COVER_PREF);
  const next: Record<string, BookCoverChoice | false> = {};
  if (saved && typeof saved === "object") for (const [key, value] of Object.entries(saved)) {
    const valid = parseBookCover(value);
    if (valid || value === false) next[key] = valid ?? false;
  }
  const valid = parseBookCover(choice);
  if (valid) next[id] = valid;
  else next[id] = false;
  prefs.set(COVER_PREF, next);
}
