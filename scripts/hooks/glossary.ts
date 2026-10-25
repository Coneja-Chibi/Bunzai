/**
 * Checks docs/reference/glossary.md against the repo (glossary-core.ts): named paths exist, and
 * every folder directly under src/ is explained. Exits 2 on a problem, per the hooks' exit contract.
 *
 * Run: bun run glossary:check
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { glossaryProblems } from "./glossary-core";

const PAGE = "docs/reference/glossary.md";

const srcFolders = readdirSync("src", { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
  .map((entry) => entry.name);
const problems = glossaryProblems(readFileSync(PAGE, "utf8"), existsSync, srcFolders);

if (problems.length > 0) {
  console.error(`glossary:check: ${PAGE} has ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(2);
}
console.log(`glossary:check: ${PAGE} is current (${srcFolders.length} src folders explained)`);
