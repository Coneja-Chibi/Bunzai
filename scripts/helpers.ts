/** Writes or checks HELPERS.md, an index of exported declarations in established shared homes. */
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { HELPER_DIRS, HELPER_FILES, exportedNames, renderHelperPage, renderHelpersIndex, type HelperEntry } from "./helpers-core";

const OUT = "HELPERS.md";
const mode = process.argv[2];

function filesUnder(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) filesUnder(path, out);
    else if (/\.tsx?$/.test(path) && !/\.d\.ts$|\.test\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

const files = [...new Set([...HELPER_FILES.filter(existsSync), ...HELPER_DIRS.flatMap((dir) => filesUnder(dir))])].sort();
const entries: HelperEntry[] = files.flatMap((path) => exportedNames(readFileSync(path, "utf8")).map((name) => ({ path, name })));
const groups = new Map<string, HelperEntry[]>();
for (const entry of entries) {
  const parts = entry.path.split("/");
  const area = parts.length > 2 ? parts[1]! : "shared";
  groups.set(area, [...(groups.get(area) ?? []), entry]);
}
const pages = new Map([...groups].map(([area, group]) => {
  const sourceRoot = group[0]?.path.split("/").slice(0, 2).join("/");
  const title = area === "shared" ? area : sourceRoot ?? `src/${area}`;
  return [`docs/generated/helpers/${area}.md`, renderHelperPage(title, group)];
}));
const index = renderHelpersIndex(groups);
const currentIndex = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
const existingPages = existsSync("docs/generated/helpers") ? readdirSync("docs/generated/helpers").map((name) => `docs/generated/helpers/${name}`) : [];

if (mode === "--check") {
  const stale = index !== currentIndex || [...pages].some(([path, text]) => !existsSync(path) || readFileSync(path, "utf8") !== text)
    || existingPages.some((path) => !pages.has(path));
  if (stale) {
    console.error(`helpers:check: helper index pages are stale; run \`bun run helpers\`.`);
    process.exit(2);
  }
  console.log("helpers:check: helper index pages are current");
} else {
  mkdirSync("docs/generated/helpers", { recursive: true });
  if (index !== currentIndex) writeFileSync(OUT, index);
  for (const [path, text] of pages) if (!existsSync(path) || readFileSync(path, "utf8") !== text) writeFileSync(path, text);
  for (const path of existingPages) if (!pages.has(path)) unlinkSync(path);
  console.log(`helpers: ${OUT} and ${pages.size} helper pages written or current`);
}
