/** Shared impure edge for discovering and importing Kit's default-export drop-ins. */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export interface DropInEntry {
  readonly file: string;
  readonly value: unknown;
}

/** Read matching source files in stable path order, optionally walking nested drop-in folders. */
export async function loadDropInEntries(
  root: string,
  accepts: (path: string) => boolean,
  recursive = false,
): Promise<DropInEntry[]> {
  const files: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory() && recursive) await visit(path);
      else if (entry.isFile() && accepts(path)) files.push(path);
    }
  };
  await visit(root);
  const modules: DropInEntry[] = [];
  for (const path of files.sort((a, b) => a.localeCompare(b))) {
    const mod = await import(pathToFileURL(path).href) as { default?: unknown };
    modules.push({ file: path, value: mod.default });
  }
  return modules;
}

/** Load just the default values when callers do not need source paths for diagnostics. */
export async function loadDropIns(
  root: string,
  accepts: (path: string) => boolean,
  recursive = false,
): Promise<unknown[]> {
  return (await loadDropInEntries(root, accepts, recursive)).map(({ value }) => value);
}
