/**
 * Streaming NDJSON reader for database/{table}.ndjson (spec Behavior step 3). One raw SQLite row
 * per line, column names as keys.
 *
 * Streaming rather than buffering is a requirement, not an optimization: large real backups hold
 * tens of thousands of world book entry rows in one file, and edge case 9 says the
 * join buffer must stream per book rather than load the table.
 *
 * Line ceilings: 4 MiB once ndjsonFormatVersion promises it, 64 MiB
 * on legacy archives that make no promise. A line past the ceiling is a per-row failure, not a
 * table or archive abort, so the reader discards to the next newline and keeps going. That matches
 * the per-row isolation the rest of the format is built on (spec Behavior step 7).
 */
import { isRecord } from "../../core/guards";
import { chunksOf } from "../../core/stream-bytes";

const NEWLINE = 0x0a;

/**
 * Row-size caps. A row is buffered whole and then parsed, so one row costs roughly three times its
 * size in memory at the peak. 8 MiB covers the largest single rows real backups carry (a character
 * with embedded sprites or a long card) and keeps that peak near 24 MiB; an archive that declares
 * ndjsonFormatVersion >= 1 earns it.
 */
export const NDJSON_ROW_BYTES = 8 * 1024 * 1024;
/**
 * Legacy archives declare no format version, so no row-size promise exists. 96 MiB matches the
 * aggregate budget Bunzai already gives one character container (CARD_ARCHIVE_BOUNDS), a peak
 * near 300 MB for the rare row that large.
 */
export const NDJSON_LEGACY_ROW_BYTES = 96 * 1024 * 1024;

export const ndjsonLineCeiling = (ndjsonFormatVersion?: number): number =>
  ndjsonFormatVersion !== undefined && ndjsonFormatVersion >= 1
    ? NDJSON_ROW_BYTES
    : NDJSON_LEGACY_ROW_BYTES;

export interface NdjsonLineFailure {
  /** 1-based line number inside the entry. */
  line: number;
  reason: string;
}

export interface NdjsonReadOptions {
  maxLineBytes: number;
  onFailure?: (failure: NdjsonLineFailure) => void;
}

export interface NdjsonRow {
  line: number;
  row: Record<string, unknown>;
}

const decoder = new TextDecoder();

const concat = (parts: readonly Uint8Array[], total: number): Uint8Array => {
  if (parts.length === 1) return parts[0]!;
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.byteLength;
  }
  return out;
};

/** Blank lines are not rows and not errors. Anything else must decode to a JSON object. */
function parseLine(bytes: Uint8Array, line: number, options: NdjsonReadOptions): NdjsonRow | null {
  const text = decoder.decode(bytes).trim();
  if (text === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    options.onFailure?.({ line, reason: `unparseable JSON (${(error as Error).message})` });
    return null;
  }
  if (!isRecord(parsed)) {
    options.onFailure?.({ line, reason: "line is not a JSON object" });
    return null;
  }
  return { line, row: parsed as Record<string, unknown> };
}

/**
 * Yield one row per line. The generator holds at most one line in memory, plus whatever chunk the
 * source just handed over.
 */
export async function* readNdjson(
  stream: ReadableStream<Uint8Array>,
  options: NdjsonReadOptions,
): AsyncGenerator<NdjsonRow> {
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;
  /** The current line already blew the ceiling: drop bytes until the newline that ends it. */
  let dropping = false;
  let line = 0;

  const reset = (): void => {
    pending = [];
    pendingBytes = 0;
  };

  const overflow = (): void => {
    line += 1;
    options.onFailure?.({
      line,
      reason: `line exceeds the ${options.maxLineBytes} byte ceiling`,
    });
    dropping = false;
    reset();
  };

  for await (let chunk of chunksOf(stream)) {
    for (;;) {
      const at = chunk.indexOf(NEWLINE);
      if (at === -1) {
        if (!dropping) {
          pending.push(chunk);
          pendingBytes += chunk.byteLength;
          if (pendingBytes > options.maxLineBytes) {
            dropping = true;
            reset();
          }
        }
        break;
      }

      const head = chunk.subarray(0, at);
      chunk = chunk.subarray(at + 1);

      if (dropping) {
        overflow();
        continue;
      }
      pending.push(head);
      pendingBytes += head.byteLength;
      if (pendingBytes > options.maxLineBytes) {
        overflow(); // the line ended here, so report it now rather than dropping further
        continue;
      }

      const bytes = concat(pending, pendingBytes);
      reset();
      line += 1;
      const parsed = parseLine(bytes, line, options);
      if (parsed) yield parsed;
    }
  }

  // A final line with no trailing newline is still a line.
  if (dropping) overflow();
  else if (pendingBytes > 0) {
    const bytes = concat(pending, pendingBytes);
    reset();
    line += 1;
    const parsed = parseLine(bytes, line, options);
    if (parsed) yield parsed;
  }
}
