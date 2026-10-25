/**
 * The import reader: what a plain studio folder holds, as canonical pieces. A canonical
 * file is itself; a file in another platform's format (a SillyTavern export dropped in the preset
 * folder) becomes a canonical piece through its adapter, addressed by a slug of its file name; a file
 * that is neither is damage, reported with its reason and never imported. The folder is only read.
 * The library never runs on a folder: this is how one comes in (src/studio/folder-import.ts).
 */
import type { ParsedCanonicalEntity } from "../entities/runtime-schema";
import type { ForeignReader } from "./foreign";
import { createForeignIndex } from "./foreign-index";
import { nodeStudioFs, type StudioFs } from "./fs-backend";
import { assertSafeStudioId, resolveStudioPath, STUDIO_ENTITY_KINDS } from "./path-policy";
import { judgeFile, usableFiles, type DamagedEntry } from "./store-listing";
import { parseStoredEntity } from "./stored-entity";

export interface FolderPiece {
  entity: ParsedCanonicalEntity;
  /** The file it was read from, relative to its kind folder. */
  file: string;
  /** The adapter's format id when the file was not canonical. */
  foreignFormat?: string;
}

export interface FolderRead {
  pieces: FolderPiece[];
  damaged: DamagedEntry[];
}

/** Every piece in the folder, kind by kind, files in name order. */
export async function readStudioFolder(dir: string, io: StudioFs = nodeStudioFs, foreign?: ForeignReader): Promise<FolderRead> {
  const index = createForeignIndex({
    io,
    ...(foreign ? { read: foreign } : {}),
    // The store owns parsing, so the index asks which ids are canonical rather than guessing.
    canonicalId: (text, kind, id) => {
      try {
        assertSafeStudioId(id);
        return parseStoredEntity(text, kind, id).id;
      } catch {
        return null;
      }
    },
  });
  const pieces: FolderPiece[] = [];
  const damaged: DamagedEntry[] = [];
  for (const kind of STUDIO_ENTITY_KINDS) {
    const kindDir = resolveStudioPath(dir, kind);
    const files = await io.listDir(kindDir);
    if (files === null) continue;
    const usable = usableFiles(files);
    const found = await index.forKind(kind, kindDir, usable);
    const byFile = new Map([...found].map(([id, entry]) => [entry.file, { id, entry }]));
    for (const file of usable) {
      const adapted = byFile.get(file);
      if (adapted) {
        // The id it gets is its slug, so every later reference resolves back to this piece.
        const entity = { ...(adapted.entry.piece.entity as object), id: adapted.id, schemaVersion: "1" } as ParsedCanonicalEntity;
        pieces.push({ entity, file, foreignFormat: adapted.entry.piece.format });
        continue;
      }
      const verdict = await judgeFile(io, kindDir, kind, file);
      if (!verdict) continue;
      if ("piece" in verdict) pieces.push({ entity: verdict.piece, file });
      else damaged.push({ kind, id: file.slice(0, -5), reason: verdict.damaged });
    }
  }
  return { pieces, damaged };
}
