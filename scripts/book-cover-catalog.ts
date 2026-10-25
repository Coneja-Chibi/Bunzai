/** Derive the cover catalog from drop-in asset folders; no hand-maintained design registry. */
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dir, "..");
const catalog: Record<string, { slug: string; label: string; category: string; path: string }[]> = {};
for (const kind of ["designs", "backgrounds"]) {
  const folder = resolve(root, "docs/media/book-covers", kind);
  catalog[kind] = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const meta = await Bun.file(resolve(folder, entry.name, "asset.json")).json();
    const path = `docs/media/book-covers/${kind}/${entry.name}/layer.png`;
    if (!/^[a-z][a-z0-9-]*$/.test(entry.name) || meta.slug !== entry.name || typeof meta.label !== "string" || typeof meta.category !== "string" || !await Bun.file(resolve(root, path)).exists()) throw new Error(`Invalid cover asset: ${entry.name}`);
    catalog[kind]!.push({ slug: entry.name, label: meta.label, category: meta.category, path });
  }
  catalog[kind]!.sort((a, b) => a.slug.localeCompare(b.slug));
}
const content = JSON.stringify(catalog, null, 2) + "\n";
const file = Bun.file(resolve(root, "src/generated/book-cover-catalog.json"));
if (process.argv.includes("--check")) {
  if (!await file.exists() || await file.text() !== content) throw new Error("Book cover catalog needs regeneration");
} else await Bun.write(file, content);
