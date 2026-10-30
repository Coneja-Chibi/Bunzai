/**
 * `bunzai export <folder> [studio]`: the library written out as a plain studio folder
 * (src/studio/folder-export.ts). It opens the studio's existing library the way the app
 * does and never makes one: a studio with no library yet has nothing to export. Opening it is the
 * app's open, so the Trash is emptied of pieces past their window first. A locked library is
 * refused, because this command cannot ask for its password or words yet. It reads the library as it
 * is while it runs; with the app open, a piece edited mid-export may go out either way.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { LIBRARY_FILE } from "./studio/fs-backend";
import { ExportRefusedError, exportLibraryToFolder } from "./studio/folder-export";
import { libraryFor } from "./studio/library-content";

/** `options` is for tests: a fake computer vault instead of the real keychain. */
export async function runExport(
  destination: string | undefined,
  studioDir: string,
  options: import("./ui/library-root").OpenOptions = {},
): Promise<number> {
  if (!destination) {
    console.error("  usage: bunzai export <folder> [studio]");
    return 2;
  }
  if (!existsSync(join(studioDir, LIBRARY_FILE))) {
    console.error(`  There is no library in ${studioDir} yet, so there is nothing to export.`);
    return 1;
  }
  const { openLibrary } = await import("./ui/library-root");
  const opened = await openLibrary(studioDir, options);
  try {
    const stores = libraryFor(studioDir);
    if (opened.state === "locked" || !stores) {
      console.error("  Your library is locked (it needs its password or recovery words), and this command cannot ask for them yet. Nothing was exported.");
      return 1;
    }
    const result = await exportLibraryToFolder(destination, stores, { studioDir });
    console.log(`\n  Exported ${result.pieces} pieces and ${result.documents} Studio documents to ${result.folder}`);
    for (const d of result.damaged) console.log(`  Left out ${d.kind} "${d.id}": the library holds it damaged (${d.reason}).`);
    if (result.droppedFromCollections > 0) console.log(`  Left out ${result.droppedFromCollections} collection entries that named deleted pieces.`);
    console.log("  This folder is not encrypted: anyone who can open it can read everything in it.");
    console.log("  The Trash and each piece's earlier versions stay in your library.\n");
    return 0;
  } catch (error) {
    if (!(error instanceof ExportRefusedError)) throw error;
    console.error(`  Nothing was exported: ${error.message}.`);
    return 1;
  } finally {
    await opened.close();
  }
}
