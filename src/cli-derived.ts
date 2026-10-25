/** `bunraku derived --stats|--clear`: inspect or discard only rebuildable derived rows. */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { clearDerivedRows, derivedStats } from "./core/derive/derive";
import { LIBRARY_FILE } from "./studio/fs-backend";

export async function runDerived(action: string | undefined, studioDir: string, json: boolean): Promise<number> {
  if (action !== "--stats" && action !== "--clear") {
    console.error("  usage: bunraku derived --stats|--clear [studio]");
    return 2;
  }
  if (!existsSync(join(studioDir, LIBRARY_FILE))) {
    console.error(`  There is no encrypted library in ${studioDir}.`);
    return 1;
  }
  const { openLibrary } = await import("./ui/library-root");
  const opened = await openLibrary(studioDir, { skipOpenMaintenance: true });
  try {
    if (opened.state === "locked") {
      console.error("  Your library is locked; derived storage needs the library key.");
      return 1;
    }
    if (action === "--clear") {
      const rows = clearDerivedRows();
      console.log(`  Cleared ${rows} derived rows. They will be rebuilt as needed.`);
      return 0;
    }
    const rows = derivedStats();
    if (json) console.log(JSON.stringify(rows));
    else if (rows.length === 0) console.log("  No derived cache families have been recorded.");
    else for (const row of rows) console.log(`  ${row.family}: ${row.hits} hits, ${row.misses} misses, ${row.persistedRows} saved rows, ${row.bytes} bytes, ${row.meanCostMs.toFixed(2)} ms mean`);
    return 0;
  } finally {
    opened.close();
  }
}
