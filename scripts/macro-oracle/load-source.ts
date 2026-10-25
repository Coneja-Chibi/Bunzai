/** Load a macro-oracle source module by a root checkout and a repo-relative entry path. */
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export async function loadSourceModule<T>(root: string, relativePath: string): Promise<T> {
  const entry = pathToFileURL(join(root, relativePath)).href;
  return (await import(entry)) as T;
}
