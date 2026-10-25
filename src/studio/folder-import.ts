/**
 * The folder import: a plain Hoplight studio folder into the library's ContentStore. The
 * folder is only ever read, never changed. Every canonical piece is created in the library under its
 * own id (both kept when a live piece already holds it), every file in another platform's format is
 * converted through its adapter first, and anything that is neither, or that does not pass the
 * canonical schema, is reported and left out. The Studio's own documents at the folder's top
 * (settings, collections, engine roots, Kit's block graveyard) come in as they are, into the library's
 * StateStore; each store parses its own on read, as it always has.
 */
import { readdirSync, statfsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ContentStore } from "../stage/contracts/content-store";
import type { StateKey, StateStore } from "../stage/contracts/state-store";
import { StudioValidationError } from "./errors";
import type { ForeignReader } from "./foreign";
import { readStudioFolder } from "./folder-reader";
import { LIBRARY_FILE, nodeStudioFs } from "./fs-backend";
import type { DamagedEntry } from "./store-listing";
import { stampForStudio, studioStampOf } from "./studio-stamp";

export interface ImportResult {
  /** Pieces now in the library. */
  pieces: number;
  /** Pieces kept beside one that already held their id, under a keep-both id. */
  renamed: { kind: string; from: string; to: string }[];
  /** Files that are not pieces the Studio can read, with the reason: never imported. */
  damaged: DamagedEntry[];
  /** Every other file in the folder that did not come in (pictures, exports, damage): left as it was. */
  leftInFolder: number;
}

/** The Studio's own documents, by the name each has in a plain folder (the export writes the same). */
export const STATE_FILES: Record<string, StateKey> = {
  "settings.json": "settings",
  "collections.json": "collections",
  "engines.json": "engines",
  "graveyard.json": "graveyard",
  "variables.json": "variables",
  "meter.json": "meter",
  "guides.json": "guides",
  "loadouts.json": "loadouts",
};

/** The import stopped before anything was imported, and says why. The folder was not changed. */
export class ImportStoppedError extends Error {
  constructor(
    message: string,
    /** `no-room`: too little free space, which the load-in shows as its own screen. */
    readonly code: "no-room" | "not-clean",
  ) {
    super(message);
    this.name = "ImportStoppedError";
  }
}

/** Every file under `dir` but dotfiles and the library's own, and the bytes of the `.json` ones. */
function survey(dir: string, out = { files: 0, jsonBytes: 0 }): { files: number; jsonBytes: number } {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name.startsWith(LIBRARY_FILE)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) survey(path, out);
    else if (entry.isFile()) {
      out.files++;
      if (entry.name.toLowerCase().endsWith(".json")) out.jsonBytes += statSync(path).size;
    }
  }
  return out;
}

export async function importFolderIntoLibrary(
  folder: string,
  stores: { content: ContentStore; state: StateStore },
  opts: {
    foreign?: ForeignReader;
    /** After each piece: how many are done, of how many, and the file just imported. */
    onProgress?: (done: number, total: number, file: string) => void;
    freeSpace?: (dir: string) => number;
  } = {},
): Promise<ImportResult> {
  const free = (opts.freeSpace ?? ((dir: string) => { const s = statfsSync(dir); return s.bavail * s.bsize; }))(folder);
  const found = survey(folder);
  const needed = found.jsonBytes * 2;
  // The library is built beside the folder, then rebuilt once: about twice the folder's size.
  if (free < needed) throw new ImportStoppedError(`not enough free space to import your library: it needs about ${Math.ceil(needed / 1e6)} MB free`, "no-room");

  const read = await readStudioFolder(folder, nodeStudioFs, opts.foreign);
  const { content, state } = stores;
  const result: ImportResult = { pieces: 0, renamed: [], damaged: [...read.damaged], leftInFolder: 0 };
  let stateDocs = 0;
  for (const [file, key] of Object.entries(STATE_FILES)) {
    const text = await nodeStudioFs.readText(join(folder, file));
    if (text === null) continue;
    await state.write(key, text);
    stateDocs++;
  }
  const now = new Date().toISOString();
  for (const [i, piece] of read.pieces.entries()) {
    const kind = piece.entity.kind;
    // A piece that already carries the Studio's stamp keeps when it first arrived.
    const stamped = stampForStudio(piece.entity, studioStampOf(piece.entity), now).entity;
    try {
      const made = await content.create(stamped);
      if (made.status === "exists") {
        const kept = await content.save(stamped);
        result.renamed.push({ kind, from: piece.entity.id, to: kept.id });
      }
      result.pieces++;
    } catch (error) {
      // A converted piece that does not pass the canonical schema is damage, not a stopped import.
      if (!(error instanceof StudioValidationError)) throw error;
      result.damaged.push({ kind, id: piece.file.slice(0, -5), reason: "schema-mismatch" });
    }
    opts.onProgress?.(i + 1, read.pieces.length, `${kind}/${piece.file}`);
  }
  result.leftInFolder = Math.max(0, found.files - result.pieces - stateDocs);
  return result;
}
