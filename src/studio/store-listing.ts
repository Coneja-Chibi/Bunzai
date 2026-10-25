/**
 * What the Studio's listing says about one piece, and about one file that is not a piece. Shared by
 * the plain-folder store and the library, so a piece reads the same whichever holds it, and a file
 * that is neither canonical nor foreign is reported with the same reason either way.
 */
import { join } from "node:path";
import type { PieceSummary, RegexShelfFacts } from "../stage/contracts/content-store";
import type { ParsedCanonicalEntity } from "../entities/runtime-schema";
import type { StudioFs } from "./fs-backend";
import { StudioReadError, type StudioDamageReason } from "./errors";
import { assertSafeStudioId, type StudioEntityKind } from "./path-policy";
import { hasPortrait } from "./portrait";
import type { LoreFacts, PersonaFacts } from "./piece-facts";
import { looksCanonical, parseStoredEntity } from "./stored-entity";
import { studioStampOf } from "./studio-stamp";
import { entityName, pieceAccent, sourceOf, tagsField } from "./summary";

/**
 * The body-derived shelf and close-up facts a summary-derived listing carries: what the Library's lore/regex/persona meta loops
 * and `peekPiece` used to fetch a whole body for. Absent means "not stamped on this row yet" (a
 * piece just created, saved, or restored, whose response predates the next listing) rather than "this
 * piece has none": a caller that needs a fact it does not find here falls back to one `getEntity`.
 */
export interface PieceFacts {
  tagline?: string;
  description?: string;
  tokens?: number;
  filled?: string;
  samplers?: { temperature?: number; topP?: number; topK?: number };
  blocks?: number;
  samplerSet?: "kobold" | "textgen" | "novelai";
  formatParts?: ("instruct" | "context")[];
  regex?: RegexShelfFacts;
  lore?: LoreFacts & { enabled: boolean };
  persona?: PersonaFacts;
}

export interface EntitySummary {
  id: string;
  kind: string;
  name: string;
  importedAt?: string;
  hasPortrait?: boolean;
  accent?: string;
  sourceFormat?: string;
  sourceVariant?: string;
  /** the piece's own content tags, so the Library's search finds a piece by what it is tagged */
  tags?: string[];
  /**
   * True when this piece is a file in another platform format, read through its adapter rather than
   * stored canonically. Read-only: its source file is never written to.
   */
  foreign?: boolean;
  /**
   * The library's version of this piece: it starts at 1 and rises with every change. A chat names
   * the version it started from. Absent on a plain folder, which keeps no versions.
   */
  version?: number;
  writeId?: number;
  revision?: string;
  /** Body-derived shelf/peek facts, straight off the summary (step 3.3); see `PieceFacts`. */
  facts?: PieceFacts;
}

/** The listing entry for a canonical piece. */
export function summaryOfPiece(kind: string, id: string, entity: ParsedCanonicalEntity, version?: number): EntitySummary {
  const stamp = studioStampOf(entity);
  const source = sourceOf(entity);
  const importedAt = stamp["importedAt"];
  return {
    id,
    kind,
    name: entityName(entity),
    ...(typeof importedAt === "string" ? { importedAt } : {}),
    hasPortrait: hasPortrait(entity),
    accent: pieceAccent(entity),
    sourceFormat: source.format,
    sourceVariant: source.variant,
    ...tagsField(entity),
    ...(version !== undefined ? { version } : {}),
  };
}

/**
 * The listing entry for a summary-derived row (plan R5 step 3.3): `content.summaries()`'s
 * `PieceSummary` already carries everything `summaryOfPiece` would have computed from a body (it was
 * computed by the same functions, at write time), so this never opens or parses a body itself.
 */
export function summaryOfListing(row: PieceSummary): EntitySummary {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    ...(row.importedAt ? { importedAt: row.importedAt } : {}),
    // summaryContentOf (summary-content.ts) drops a false hasPortrait to save space in the sealed
    // cell; normalized back here so the wire matches summaryOfPiece's always-present boolean.
    hasPortrait: row.hasPortrait ?? false,
    ...(row.accent ? { accent: row.accent } : {}),
    ...(row.sourceFormat ? { sourceFormat: row.sourceFormat } : {}),
    ...(row.sourceVariant ? { sourceVariant: row.sourceVariant } : {}),
    ...(row.tags ? { tags: row.tags } : {}),
    version: row.version,
    writeId: row.writeId,
    revision: row.revision,
    facts: {
      ...(row.tagline ? { tagline: row.tagline } : {}),
      ...(row.description ? { description: row.description } : {}),
      tokens: row.tokens,
      ...(row.filled ? { filled: row.filled } : {}),
      ...(row.samplers ? { samplers: row.samplers } : {}),
      ...(row.blocks !== undefined ? { blocks: row.blocks } : {}),
      ...(row.samplerSet ? { samplerSet: row.samplerSet } : {}),
      ...(row.formatParts ? { formatParts: row.formatParts } : {}),
      ...(row.regex ? { regex: row.regex } : {}),
      ...(row.lore ? { lore: row.lore } : {}),
      ...(row.persona ? { persona: row.persona } : {}),
    },
  };
}

export type FileVerdict = { piece: ParsedCanonicalEntity } | { damaged: StudioDamageReason };

/**
 * One file in a kind folder that is not a foreign piece: a canonical piece, damage with its reason,
 * or null when it vanished after the folder was listed. The name is checked first, because whether a
 * bad name is the ONLY thing wrong decides what to tell somebody: a canonical file called
 * `ludovic-&-levi.json` is somebody's work that loads the moment it is renamed, and a SillyTavern
 * fragment called `Loggo's Preset.json` does not.
 */
export async function judgeFile(io: StudioFs, kindDir: string, kind: StudioEntityKind, file: string): Promise<FileVerdict | null> {
  const id = file.slice(0, -5);
  const text = await io.readText(join(kindDir, file));
  try {
    assertSafeStudioId(id);
  } catch {
    const ours = text !== null && looksCanonical(text, kind);
    return { damaged: ours ? "unusable-filename" : "schema-mismatch" };
  }
  // Gone between the listing and the read: another writer removed it, so there is nothing to report.
  if (text === null) return null;
  try {
    return { piece: parseStoredEntity(text, kind, id) };
  } catch (error) {
    return { damaged: error instanceof StudioReadError && error.reason ? error.reason : "unreadable-json" };
  }
}

export interface DamagedEntry {
  kind: string;
  id: string;
  reason: StudioDamageReason;
}

export interface StudioInventory {
  entities: EntitySummary[];
  damaged: DamagedEntry[];
}

export type CompareSaveResult =
  | { status: "saved"; summary: EntitySummary; revision: string }
  | { status: "stale" | "missing" };

export type CompareCreateResult =
  | { status: "saved"; summary: EntitySummary }
  | { status: "exists" };

/**
 * The files in a kind folder worth looking at.
 *
 * A DOTFILE IS AN ARTIFACT, not somebody's file: atomic replacement leaves .tmp orphans behind, and
 * reporting one as a badly named piece is noise standing exactly where the useful report goes.
 * Sorted, because the id a foreign file gets depends on the order they are walked in.
 */
export const usableFiles = (files: readonly string[]): string[] =>
  files.filter((n) => n.endsWith(".json") && !n.startsWith(".")).sort();
