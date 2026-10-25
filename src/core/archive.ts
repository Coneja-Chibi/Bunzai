/**
 * Bounded ZIP inflate for untrusted archives. Checks originalSize / size / count / aggregate
 * BEFORE inflation where fflate's filter allows; rechecks actual lengths after.
 * Bun-independent core helper. Format adapters must not reimplement it locally: card containers call unzipCard.
 */
import { unzipSync, type UnzipFileInfo } from "fflate";
import { hasErrorName } from "./guards";
import { IMAGE_MAX_BYTES } from "./media/image-limit";
import { PACK_ZIP_MAX_BYTES, PACK_ZIP_MAX_ENTRIES } from "./media/limits";

/** Which budget tripped, so a caller can say so in its own words instead of "unsafe". */
export type ArchiveLimitKind = "archive-size" | "entry-size" | "aggregate-size" | "entries";

export class ArchiveLimitError extends Error {
  readonly code = "archive_limit" as const;
  /** The budget that tripped and its ceiling (bytes, or a count for "entries"), when known. */
  readonly kind?: ArchiveLimitKind;
  readonly limit?: number;
  /** True when `message` is already a plain-words line for the person, not a diagnostic. */
  readonly plain: boolean;
  constructor(message = "archive exceeds safety limits", kind?: ArchiveLimitKind, limit?: number, plain = false) {
    super(message);
    this.name = "ArchiveLimitError";
    this.plain = plain;
    if (kind) this.kind = kind;
    if (limit !== undefined) this.limit = limit;
  }
}

export interface UnzipBounds {
  /** Max compressed archive length (input bytes). */
  maxArchiveBytes: number;
  /** Max total entries in the archive, including entries skipped by a filter. */
  maxEntries: number;
  /** Max compressed size of one entry (fflate `size`). */
  maxEntryCompressed: number;
  /** Max original (inflated) size of one entry. */
  maxEntryOriginal: number;
  /** Max sum of selected original sizes. */
  maxAggregateOriginal: number;
}

/** Full character card containers (charx, byaf, lumiverse zip). */
export const CARD_ARCHIVE_BOUNDS: UnzipBounds = {
  maxArchiveBytes: 96 * 1024 * 1024,
  maxEntries: 512,
  maxEntryCompressed: 64 * 1024 * 1024,
  maxEntryOriginal: 64 * 1024 * 1024,
  maxAggregateOriginal: 96 * 1024 * 1024,
};

const GIB = 1024 ** 3;

/**
 * Whole-library backup archives (the multi-gigabyte kind). Read through the streaming reader from a
 * temp file, so memory is not the limit; disk and time are. A large real library (tens of thousands
 * of lorebook rows, thousands of images) is a few GiB, so 8 GiB compressed leaves room to grow. The
 * per-entry ceilings sit under the aggregate so one runaway entry fails before the whole budget is
 * spent, and 250,000 entries is far past any real file tree while still bounding the listing.
 */
export const BACKUP_ARCHIVE_BOUNDS: UnzipBounds = {
  maxArchiveBytes: 8 * GIB,
  maxEntries: 250_000,
  maxEntryCompressed: 8 * GIB,
  maxEntryOriginal: 16 * GIB,
  maxAggregateOriginal: 32 * GIB,
};

/** Expression / sprite pack ZIPs. Built from the shared limits, so printing a pack and reading it back agree. */
export const PACK_ARCHIVE_BOUNDS: UnzipBounds = {
  maxArchiveBytes: PACK_ZIP_MAX_BYTES,
  maxEntries: PACK_ZIP_MAX_ENTRIES,
  maxEntryCompressed: IMAGE_MAX_BYTES,
  maxEntryOriginal: IMAGE_MAX_BYTES,
  maxAggregateOriginal: PACK_ZIP_MAX_BYTES,
};

export interface UnzipBoundedOptions {
  bounds?: UnzipBounds;
  /** When set, only this entry name is selected (detection path). */
  only?: string;
  /** Extra selection filter; deny inflation by returning false. */
  filter?: (file: UnzipFileInfo) => boolean;
}

const entryOriginal = (f: UnzipFileInfo): number => {
  const o = f.originalSize;
  if (typeof o === "number" && Number.isFinite(o) && o >= 0) return o;
  // Missing originalSize: treat compressed size as a lower bound and still cap compressed.
  return typeof f.size === "number" && f.size >= 0 ? f.size : 0;
};

/**
 * Unzip with pre-inflate budgets. Throws ArchiveLimitError when the archive entry count,
 * a selected entry, or the selected aggregate would exceed limits.
 */
export function unzipBounded(
  bytes: Uint8Array,
  options: UnzipBoundedOptions = {},
): Record<string, Uint8Array> {
  const bounds = options.bounds ?? CARD_ARCHIVE_BOUNDS;
  if (bytes.byteLength > bounds.maxArchiveBytes) {
    throw new ArchiveLimitError("archive exceeds safety limits", "archive-size", bounds.maxArchiveBytes);
  }

  let entries = 0;
  let aggregate = 0;

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        entries += 1;
        if (entries > bounds.maxEntries) {
          throw new ArchiveLimitError("archive has too many entries", "entries", bounds.maxEntries);
        }

        if (options.only !== undefined && f.name !== options.only) return false;
        if (options.filter && !options.filter(f)) return false;

        const compressed = typeof f.size === "number" ? f.size : 0;
        const original = entryOriginal(f);
        if (compressed > bounds.maxEntryCompressed || original > bounds.maxEntryOriginal) {
          throw new ArchiveLimitError("archive entry exceeds safety limits", "entry-size", bounds.maxEntryOriginal);
        }
        if (aggregate + original > bounds.maxAggregateOriginal) {
          throw new ArchiveLimitError("archive aggregate size exceeds safety limits", "aggregate-size", bounds.maxAggregateOriginal);
        }
        aggregate += original;
        return true;
      },
    });
  } catch (e) {
    if (e instanceof ArchiveLimitError) throw e;
    throw new ArchiveLimitError("archive could not be read safely");
  }

  let actualAgg = 0;
  let count = 0;
  for (const data of Object.values(files)) {
    count += 1;
    actualAgg += data.byteLength;
    if (data.byteLength > bounds.maxEntryOriginal) {
      throw new ArchiveLimitError("archive entry exceeds safety limits");
    }
    if (actualAgg > bounds.maxAggregateOriginal || count > bounds.maxEntries) {
      throw new ArchiveLimitError("archive aggregate size exceeds safety limits");
    }
  }
  return files;
}

/** Unzip a character-card container (.charx, .byaf, Lumiverse zip) under CARD_ARCHIVE_BOUNDS; `only` selects one entry. */
export function unzipCard(bytes: Uint8Array, only?: string): Record<string, Uint8Array> {
  return unzipBounded(bytes, { bounds: CARD_ARCHIVE_BOUNDS, only });
}

export const isArchiveLimitError = (e: unknown): e is ArchiveLimitError =>
  e instanceof ArchiveLimitError || hasErrorName(e, "ArchiveLimitError");
