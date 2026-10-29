/**
 * Reading a lorebook entry as a Compendium entry. RoleCall's compendium rides ordinary
 * lorebook rows: `metadata.entry_type` names one of eleven types and `metadata.structured_data` holds the typed fields
 * (`lib/compendium/computed.ts` `structuredOf`/`typeOf`, `route.ts:12-20`). An entry without a known type is classic.
 * `data` is the structured data exactly as stored, unknown fields included: nothing here drops authored data.
 * Bunzai keeps "featured" in `metadata.featured` (the entry has no column) and a retired entry as
 * `metadata.retired` beside `enabled: false` (04b rules R3 and A5).
 */
import type { LorebookEntry } from "../../entities/lorebook/schema";
import { isRecord, optStr, strArray, type Rec } from "../guards";
import { isEntryType, type EntryType } from "./types";

export interface CompendiumEntry {
  id: string;
  title: string;
  enabled: boolean;
  categoryId: string | null;
  /** Position in the book. A lorebook entry has no updated-at, so later means newer where recency matters. */
  order: number;
  /** null for a classic entry. */
  type: EntryType | null;
  data: Rec;
  /** `data.name`, else `data.title` (a summary), else `data.topic` (worldbuilding), else the entry title (RoleCall `computed.ts:30-38`). */
  name: string;
  aliases: string[];
  tagline: string;
  featured: boolean;
  retired: boolean;
  /** The plot name when this is the historian's "[Arc]" overview of a plot (RoleCall `tv_arc_overview`), else null. */
  arc: string | null;
  /** The person's "Preserve" lock: Standardize leaves the entry as written (`metadata.preserve_during_standardize`, RoleCall's key). */
  preserved: boolean;
}

/** `metadata.source` of a plot's arc overview entry (RoleCall `lib/lorebook/tv-writer.ts:176`). */
export const ARC_SOURCE = "tv_arc_overview";

const nonBlank = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v : undefined);

export function readEntry(entry: LorebookEntry, order: number): CompendiumEntry {
  const meta: Rec = isRecord(entry.metadata) ? entry.metadata : {};
  const type = isEntryType(meta["entry_type"]) ? meta["entry_type"] : null;
  const data: Rec = isRecord(meta["structured_data"]) ? meta["structured_data"] : {};
  return {
    id: entry.id, title: entry.title, enabled: entry.enabled, categoryId: entry.categoryId, order, type, data,
    name: nonBlank(data["name"]) ?? nonBlank(data["title"]) ?? nonBlank(data["topic"]) ?? entry.title,
    aliases: strArray(data["aliases"]),
    tagline: optStr(data["tagline"]) ?? "",
    featured: meta["featured"] === true,
    retired: meta["retired"] !== undefined && meta["retired"] !== null && meta["retired"] !== false,
    arc: meta["source"] === ARC_SOURCE ? nonBlank(meta["arc"]) ?? entry.title.replace(/^\[Arc\]\s*/, "") : null,
    preserved: meta["preserve_during_standardize"] === true,
  };
}

/** Every entry of a book, in book order. */
export const readBook = (entries: readonly LorebookEntry[]): CompendiumEntry[] => entries.map((e, i) => readEntry(e, i));
