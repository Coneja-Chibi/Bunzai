/**
 * Writing one piece's canonical JSON when the whole piece cannot be held at once (a pack of many pictures):
 * the piece comes in with every picture as its sentinel (`ContentStore.readHeld`), and the file is written
 * with each picture streamed in as base64, one at a time. The text is what `JSON.stringify(entity, null, 2)`
 * of the whole piece would be, byte for byte, so the folder imports the same either way.
 */
import { closeSync, openSync, writeSync } from "node:fs";
import { mediaBlobReference } from "../entities/piece-parts-blob";
import type { ContentStore } from "../stage/contracts/content-store";
import { StudioReadError } from "./errors";

/**
 * The most one stored picture may weigh when it is written out whole into a folder export. Not policy: the export is
 * the person's own copy and must not refuse a picture the library holds (imports once admitted far more than the
 * image limit), but `readAsset` loads the picture whole and needs a bound. Lift it with a streamed asset read.
 */
const HELD_PICTURE_READ_MAX_BYTES = 256 * 1024 * 1024;
/** Whole 3-byte groups (a caller's own `slice` must be one too), so each slice encodes with no padding until the last. */
const SLICE = 3 * 1024 * 1024;

export async function writeHeldPiece(
  path: string,
  entity: unknown,
  readAsset: ContentStore["readAsset"],
  label: string,
  slice = SLICE,
): Promise<void> {
  const prefix = `heldblob-${crypto.randomUUID()}`;
  const pictures: { sha: string; mime?: string }[] = [];
  const tokenise = (value: unknown): unknown => {
    if (typeof value === "string") {
      const ref = mediaBlobReference(value);
      if (!ref) return value;
      pictures.push(ref);
      return `${prefix}-${pictures.length - 1}`;
    }
    if (Array.isArray(value)) return value.map(tokenise);
    if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, tokenise(child)]));
    return value;
  };
  const text = `${JSON.stringify(tokenise(entity), null, 2)}\n`;
  const parts = text.split(new RegExp(`"${prefix}-(\\d+)"`));
  // Even slots are text; odd slots are picture numbers. Fewer markers than pictures means authored text collided.
  if ((parts.length - 1) / 2 !== pictures.length) throw new StudioReadError(`${label} could not be written safely`, "schema-mismatch");
  const fd = openSync(path, "wx");
  try {
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) { writeSync(fd, parts[i]!); continue; }
      const picture = pictures[Number(parts[i])]!;
      const read = await readAsset(picture.sha, HELD_PICTURE_READ_MAX_BYTES);
      if (read.status !== "ok") throw new StudioReadError(`${label} is missing a picture`, "part-unreadable");
      writeSync(fd, picture.mime ? `"data:${picture.mime};base64,` : `"`);
      for (let at = 0; at < read.bytes.length; at += slice) {
        writeSync(fd, Buffer.from(read.bytes.buffer, read.bytes.byteOffset + at, Math.min(slice, read.bytes.length - at)).toString("base64"));
      }
      writeSync(fd, `"`);
    }
  } finally {
    closeSync(fd);
  }
}
