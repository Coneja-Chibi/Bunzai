/**
 * The folder export: the library written out as a plain studio folder, the one shape the
 * folder import reads (folder-import.ts). Every live piece becomes `<kind>/<id>.json`, its canonical
 * JSON exactly as the library holds it, and the Studio's own documents go to the top under the names
 * the import reads them by. Import, edit, export, import again gives back the same pieces.
 *
 * Fail closed on the destination: it must not exist or be an empty folder, and it may not be the
 * studio folder or anywhere inside it (a plain folder there would look like a library to import).
 * The export is built in a sibling folder and renamed into place only when every file is written,
 * so an interrupted export never looks finished, and nothing is ever overwritten.
 *
 * The folder is NOT encrypted: whoever can read it reads everything in it. Trash and version history
 * stay in the library; only the live pieces and the Studio's documents go out.
 */
import { existsSync, mkdirSync, readdirSync, realpathSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { foldId, isColdReadLimit, type ContentStore } from "../stage/contracts/content-store";
import { writeHeldPiece } from "./folder-export-held";
import type { StateStore } from "../stage/contracts/state-store";
import { StudioReadError } from "./errors";
import { parseCollections } from "./collections-shape";
import { STATE_FILES } from "./folder-import";
import { resolveStudioPath, STUDIO_ENTITY_KINDS } from "./path-policy";
import type { DamagedEntry } from "./store-listing";

export interface ExportResult {
  /** Where the folder was written. */
  folder: string;
  /** Pieces written. */
  pieces: number;
  /** The Studio's own documents written (settings, collections, engine roots, graveyard). */
  documents: number;
  /** Pieces the library holds damaged: reported, never written. */
  damaged: DamagedEntry[];
  /** Collection entries that named deleted pieces: left out, so no new piece can inherit them. */
  droppedFromCollections: number;
}

/** The export refused before writing anything, and says why. */
export class ExportRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportRefusedError";
  }
}

/**
 * The real path, as the disk resolves it: the nearest existing folder through realpath (so links,
 * junctions, short names, and spellings resolve), then the rest, with the trailing dots and spaces
 * Windows drops, in one case on Windows and macOS.
 */
function realPath(p: string): string {
  let head = resolve(p);
  const tail: string[] = [];
  while (!existsSync(head) && dirname(head) !== head) {
    tail.unshift(basename(head));
    head = dirname(head);
  }
  const win = process.platform === "win32";
  const full = join(realpathSync.native(head), ...tail.map((part) => (win ? part.replace(/[. ]+$/, "") : part)));
  return process.platform === "linux" ? full : full.toLowerCase();
}

const within = (child: string, parent: string): boolean => {
  const rel = relative(realPath(parent), realPath(child));
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`);
};

const refuse = (message: string): never => {
  throw new ExportRefusedError(message);
};

export async function exportLibraryToFolder(
  destination: string,
  stores: { content: ContentStore; state: StateStore },
  opts: { studioDir: string },
): Promise<ExportResult> {
  const folder = resolve(destination);
  if (within(folder, opts.studioDir)) refuse("choose a folder outside the studio folder: a plain folder there would look like a library to import");
  if (!existsSync(dirname(folder))) refuse(`${dirname(folder)} does not exist; choose a folder inside one that does`);
  if (existsSync(folder) && (!statSync(folder).isDirectory() || readdirSync(folder).length > 0)) {
    refuse(`${folder} is not an empty folder; an export never writes over anything, so choose an empty or new folder`);
  }

  const building = join(dirname(folder), `.${basename(folder)}.exporting-${crypto.randomUUID()}`);
  mkdirSync(building);
  const result: ExportResult = { folder, pieces: 0, documents: 0, damaged: [], droppedFromCollections: 0 };
  try {
    const { content, state } = stores;
    const live = new Set<string>();
    for (const kind of STUDIO_ENTITY_KINDS) {
      const held = await content.inventory(kind);
      result.damaged.push(...held.damaged);
      for (const summary of held.entities) {
        let stored;
        let held = false;
        try {
          stored = await content.read(kind, summary.id);
        } catch (error) {
          if (isColdReadLimit(error)) {
            // Over the whole-piece budget (a pack of many pictures): read it with its pictures as references
            // and stream them into the file one at a time, so it is exported, never skipped or fatal.
            try { stored = await content.readHeld(kind, summary.id); held = true; }
            catch (heldError) {
              if (!(heldError instanceof StudioReadError)) throw heldError;
              result.damaged.push({ kind, id: summary.id, reason: heldError.reason ?? "unreadable-json" });
              continue;
            }
          } else {
            if (!(error instanceof StudioReadError)) throw error;
            result.damaged.push({ kind, id: summary.id, reason: error.reason ?? "unreadable-json" });
            continue;
          }
        }
        if (!stored) continue; // deleted while the export ran
        const path = resolveStudioPath(building, kind, summary.id);
        mkdirSync(dirname(path), { recursive: true });
        try {
          if (held) {
            try { await writeHeldPiece(path, stored.entity, (sha, max) => content.readAsset(sha, max), `${kind} "${summary.id}"`); }
            catch (heldError) {
              if (!(heldError instanceof StudioReadError)) throw heldError;
              rmSync(path, { force: true });
              result.damaged.push({ kind, id: summary.id, reason: heldError.reason ?? "part-unreadable" });
              continue;
            }
          } else writeFileSync(path, `${JSON.stringify(stored.entity, null, 2)}\n`, { flag: "wx" });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          refuse(`${kind} "${summary.id}" and another ${kind} have ids this disk treats as one file name; rename one and export again`);
        }
        live.add(`${kind}/${foldId(summary.id)}`);
        result.pieces++;
      }
    }
    for (const [file, stateKey] of Object.entries(STATE_FILES)) {
      let text = await state.read(stateKey);
      if (text === null) continue;
      // A deleted piece's id is retired in this library but not in the one this folder becomes, so
      // a collection naming it could adopt a new piece later: only live members go out.
      if (stateKey === "collections") text = liveCollections(text, live, result);
      writeFileSync(join(building, file), text, { flag: "wx" });
      result.documents++;
    }
    try {
      if (existsSync(folder)) rmdirSync(folder); // still empty, or this throws
      renameSync(building, folder);
    } catch {
      refuse(`something was written into ${folder} while exporting; nothing was changed there`);
    }
  } catch (error) {
    rmSync(building, { recursive: true, force: true });
    throw error;
  }
  return result;
}

/** The collections document with members that name pieces not in the export dropped (and counted). */
function liveCollections(text: string, live: ReadonlySet<string>, result: ExportResult): string {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return text; // unreadable: carried as it is, and the import reads it as no collections
  }
  const file = parseCollections(raw);
  const collections = file.collections.map((c) => {
    const members = c.members.filter((m) => live.has(`${m.kind}/${foldId(m.id)}`));
    result.droppedFromCollections += c.members.length - members.length;
    return { ...c, members };
  });
  return result.droppedFromCollections > 0 ? JSON.stringify({ collections }) : text;
}
