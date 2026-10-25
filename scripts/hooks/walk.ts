/**
 * Shared recursive directory walker for the hook scripts. Impure (reads the filesystem), which is
 * why it lives here and not in lib.ts: that file is the pure detector core. Callers decide what they
 * skip and what they accept, so each guard's existing file-selection behavior is unchanged by this
 * fold - only the recursion itself (readdir, skip-dir test, recurse) was duplicated five times.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

export { SOURCE_EXTS, SKIP_DIRS } from "./file-selection";

/**
 * Every descendant file under `dir` for which `accept(path, name)` is true. A directory named in
 * `skipDirs`, or starting with ".", is never descended into. `path` is forward-slash normalized.
 */
export function walk(
  dir: string,
  accept: (path: string, name: string) => boolean,
  skipDirs: ReadonlySet<string>,
  out: string[] = [],
): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // root does not exist here
  }
  for (const entry of entries) {
    const path = join(dir, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name) && !entry.name.startsWith(".")) walk(path, accept, skipDirs, out);
    } else if (accept(path, entry.name)) {
      out.push(path);
    }
  }
  return out;
}
