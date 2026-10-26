/**
 * Unbounded-list guard: long lists go through useVirtualRows. The imperative shell around unbounded-lists-core.ts.
 *
 *   --staged   : pre-commit. Blocks a staged src/ui TSX file whose JSX maps over a collection into rows without
 *                useVirtualRows, unless the hit is in scripts/hooks/unbounded-lists-baseline.json (a ratchet).
 *   --scan     : every hit in the tree not in the baseline (exit 0).
 *   --baseline : rewrite the baseline to the tree's current hits.
 *
 * Escape: a `bounded-ok: <reason>` comment on the map or the line before it.
 * Run: bun run scripts/hooks/unbounded-lists.ts --scan|--staged|--baseline
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { unboundedLists, type UnboundedList } from "./unbounded-lists-core";

const BASELINE = "scripts/hooks/unbounded-lists-baseline.json";
const mode = process.argv.includes("--scan") ? "scan" : process.argv.includes("--baseline") ? "baseline" : "staged";
const isUi = (f: string): boolean => /^src\/ui\/.*\.tsx$/.test(f) && !/\.test\.tsx$|\/fake-|generated/.test(f) && existsSync(f);
const hitsOf = (files: string[]): UnboundedList[] => files.flatMap((f) => unboundedLists(f, readFileSync(f, "utf8")));
const git = (...args: string[]): string[] => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 }).split("\n").filter(isUi);
const baseline = new Set<string>(existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : []);

if (mode !== "staged") {
  const hits = hitsOf(git("ls-files", "--cached", "--others", "--exclude-standard"));
  if (mode === "baseline") {
    writeFileSync(BASELINE, JSON.stringify(hits.map((h) => h.id).sort(), null, 1) + "\n");
    console.log(`lists: baseline written, ${hits.length} known unbounded lists.`);
  } else {
    const fresh = hits.filter((h) => !baseline.has(h.id));
    console.log(`lists: ${hits.length} unbounded lists in the tree, ${fresh.length} not in the baseline.`);
    for (const h of fresh) console.log(`  ${h.file}:${h.line}  ${h.part}`);
  }
  process.exit(0);
}

const fresh = hitsOf(git("diff", "--cached", "--name-only", "--diff-filter=ACMR")).filter((h) => !baseline.has(h.id));
if (fresh.length === 0) { console.log("lists: clean (staged)."); process.exit(0); }
console.error(`\nlists: ${fresh.length} JSX list(s) render every row. Long lists go through useVirtualRows (src/ui/_shared/virtual-list), or add "bounded-ok: <reason>" on the map if it is short by construction (AGENTS.md rule 12).`);
for (const h of fresh) console.error(`  ${h.file}:${h.line}  .map renders <${h.part}>`);
process.exit(2);
