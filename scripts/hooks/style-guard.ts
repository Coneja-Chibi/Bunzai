/**
 * Style guard - fonts come from the theme, panes size by container. The imperative shell around style-guard-core.ts.
 *
 *   --staged : pre-commit. Blocks violations ADDED in the staged diff (a ratchet: old lines never block new work).
 *   --scan   : report of the whole tree, with a count per rule (exit 0).
 *
 * Escape: same-line `style-ok` comment with a reason.
 * Run: bun run scripts/hooks/style-guard.ts --scan|--staged
 */
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { addedLinesByFile } from "./lib";
import { isStyleGuardedFile, STYLE_HELP, styleViolation, type StyleHit } from "./style-guard-core";

const scan = process.argv.includes("--scan");
const hits: (StyleHit & { file: string; text: string })[] = [];

if (scan) {
  const files = execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 1 << 28 }).split("\n").filter((f) => isStyleGuardedFile(f) && existsSync(f));
  for (const file of files) {
    for (const text of readFileSync(file, "utf8").split("\n")) {
      const hit = styleViolation(text, file);
      if (hit) hits.push({ ...hit, file, text: text.trim() });
    }
  }
} else {
  const diff = execFileSync("git", ["diff", "--cached", "-U0", "--no-color"], { encoding: "utf8", maxBuffer: 1 << 28 });
  for (const [file, lines] of addedLinesByFile(diff)) {
    if (!isStyleGuardedFile(file)) continue;
    for (const text of lines) {
      const hit = styleViolation(text, file);
      if (hit) hits.push({ ...hit, file, text: text.trim() });
    }
  }
}

if (hits.length === 0) {
  console.log(`style-guard: clean (${scan ? "scan" : "staged"}).`);
  process.exit(0);
}
for (const rule of ["font", "viewport", "button"] as const) {
  const mine = hits.filter((h) => h.rule === rule);
  if (mine.length === 0) continue;
  console.error(`\nstyle-guard ${rule}: ${mine.length}. ${STYLE_HELP[rule]}`);
  for (const h of mine.slice(0, scan ? 200 : 50)) console.error(`  ${h.file}  ${h.match}  ${h.text.slice(0, 120)}`);
}
process.exit(scan ? 0 : 2);
