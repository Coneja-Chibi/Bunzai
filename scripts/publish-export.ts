/**
 * Writes a clean copy of the tracked tree, minus the paths in publish-private.txt, into a new folder, then
 * fails if any file left in the copy still points at a private path. It only writes a folder: no git repo,
 * no push.
 * Run: bun run publish:export -- <outDir>
 */
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { danglingRefs, isPrivate, parsePrivateList } from "./publish-export-core";

const LIST = "publish-private.txt";
/** The tool's own files name the private paths on purpose. */
const SELF = new Set([LIST, "scripts/publish-export.ts", "scripts/publish-export-core.ts", "scripts/publish-export-core.test.ts"]);
const TEXT = /\.(md|txt|ts|tsx|js|mjs|json|html|css|yml|yaml|go|sh|toml|svg)$/i;

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: bun run publish:export -- <outDir>");
  process.exit(1);
}
if (existsSync(outDir) && readdirSync(outDir).length > 0) {
  console.error(`publish:export: ${outDir} is not empty; give it a new or empty folder.`);
  process.exit(1);
}

const { entries, generated } = parsePrivateList(readFileSync(LIST, "utf8"));
const tracked = execSync("git ls-files -z", { encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter((p) => p !== "" && existsSync(p));
const kept = tracked.filter((p) => !isPrivate(p, entries));
for (const p of kept) {
  mkdirSync(join(outDir, dirname(p)), { recursive: true });
  copyFileSync(p, join(outDir, p));
}
console.log(`publish:export: wrote ${kept.length} files to ${outDir} (${tracked.length - kept.length} private files left out)`);

const files = kept.filter((p) => TEXT.test(p) && !SELF.has(p)).map((path) => ({ path, text: readFileSync(join(outDir, path), "utf8") }));
const refs = danglingRefs(files, entries.filter((e) => !generated.includes(e)));
if (refs.length > 0) {
  console.error(`publish:export: ${refs.length} reference(s) to private paths in the export:`);
  for (const r of refs) console.error(`  ${r.file}:${r.line}  ${r.ref}`);
  process.exit(2);
}
console.log("publish:export: no references to private paths");
