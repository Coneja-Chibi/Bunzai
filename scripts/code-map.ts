/**
 * Writes docs/generated/CODE-MAP.md, a one-line purpose for every source file (code-map-core.ts),
 * so an agent can find where something lives with one search instead of guessing by file name.
 *
 * Modes:
 *   (default)  read the working tree and write the map
 *   --staged   read git's staged snapshot instead, write the map, and stage it (the commit hook's
 *              mode: it never reads unstaged edits, so it needs no stash)
 *   --check    exit 2 when the map on disk differs from a fresh one built from the staged snapshot
 *              (on a clean checkout, as in CI, that is the commit itself; locally it ignores
 *              untracked and unstaged files, which the commit hook will map when they are staged)
 *
 * Run: bun run codemap [--staged|--check]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { MAP_ROOTS, onMap, purposeOf, renderCodeMap, type MapEntry } from "./code-map-core";

const OUT = "docs/generated/CODE-MAP.md";
const mode = process.argv[2];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path, out);
    else if (onMap(path)) out.push(path);
  }
  return out;
}

function fromWorkingTree(): MapEntry[] {
  return MAP_ROOTS.flatMap((root) => walk(root)).map((path) => ({ path, purpose: purposeOf(readFileSync(path, "utf8")) }));
}

/** Every mapped path in git's index, with the staged contents, read through one `git cat-file`. */
function fromStagedSnapshot(): MapEntry[] {
  const listed = Bun.spawnSync(["git", "ls-files", "-s", "-z", "--", ...MAP_ROOTS], { stdout: "pipe", stderr: "inherit" });
  if ((listed.exitCode ?? 1) !== 0) throw new Error("code map: could not list the staged files");
  const staged = new TextDecoder()
    .decode(listed.stdout)
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const [meta, path] = line.split("\t") as [string, string];
      return { blob: meta.split(" ")[1]!, path };
    })
    .filter((f) => onMap(f.path));
  const batch = Bun.spawnSync(["git", "cat-file", "--batch"], {
    stdin: new TextEncoder().encode(staged.map((f) => f.blob).join("\n") + "\n"),
    stdout: "pipe",
    stderr: "inherit",
  });
  if ((batch.exitCode ?? 1) !== 0) throw new Error("code map: could not read the staged files");
  const out = Buffer.from(batch.stdout);
  const entries: MapEntry[] = [];
  let at = 0;
  for (const f of staged) {
    const header = out.subarray(at, out.indexOf(10, at)).toString("utf8");
    const size = Number(header.split(" ")[2]);
    const start = out.indexOf(10, at) + 1;
    entries.push({ path: f.path, purpose: purposeOf(out.subarray(start, start + size).toString("utf8")) });
    at = start + size + 1;
  }
  return entries;
}

const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
if (mode === "--check") {
  if (renderCodeMap(fromStagedSnapshot()) !== current) {
    console.error(`codemap:check: ${OUT} is stale; stage your changes and run \`bun run codemap --staged\` (a commit does it for you).`);
    process.exit(2);
  }
  console.log(`codemap:check: ${OUT} is current`);
} else {
  const next = renderCodeMap(mode === "--staged" ? fromStagedSnapshot() : fromWorkingTree());
  if (next !== current) writeFileSync(OUT, next);
  if (mode === "--staged") {
    const add = Bun.spawnSync(["git", "add", OUT], { stdout: "inherit", stderr: "inherit" });
    if ((add.exitCode ?? 1) !== 0) throw new Error("code map: could not stage the map");
  }
  console.log(`codemap: ${OUT} ${next === current ? "already current" : "written"}`);
}
