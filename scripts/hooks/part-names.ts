/**
 * part-names: every `data-part` in src/ui is a stable dotted name keyed on ids, and every scenes wing, tab and pop-out file carries one
 * (see part-names-core.ts). Fails the build when a new wing ships unnamed, so a theme can always hide or restyle it by name.
 */
import { readFileSync } from "node:fs";
import { walk, SKIP_DIRS } from "./walk";
import { carriesPart, mustCarryPart, partProblems } from "./part-names-core";

const files = walk("src/ui", (path) => /\.tsx$/.test(path) && !/\.test\.tsx$/.test(path), SKIP_DIRS);
const problems: string[] = [];
for (const path of files) {
  const source = readFileSync(path, "utf8");
  for (const p of partProblems(source)) problems.push(`${path}:${p.line}  ${p.text}  (${p.why})`);
  if (mustCarryPart(path) && !carriesPart(source)) problems.push(`${path}  carries no data-part: name its root so a theme can hide or restyle it`);
}
if (problems.length) {
  console.error(`part-names: parts are stable dotted names keyed on ids:\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exitCode = 1;
} else console.log(`part-names: clean (${files.length} files)`);
