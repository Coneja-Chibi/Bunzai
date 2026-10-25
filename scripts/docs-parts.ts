/**
 * Writes docs/generated/theme-parts.md, the stable `data-part` names a theme's styles can target, read from the
 * component sources so no list is kept by hand.
 *
 * Run:   bun run docs:parts
 * Check: bun run docs:parts:check   (fail if the committed page differs)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { SLOT_IDS } from "../src/ui/_shared/theme-slot-core";
import { partsIn, renderParts, staleReason, type PartHit } from "./docs-parts-core";

const OUT = "docs/generated/theme-parts.md";

function walk(dir: string, hits: PartHit[] = []): PartHit[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path, hits);
    else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) hits.push(...partsIn(readFileSync(path, "utf8"), path));
  }
  return hits;
}

/** Each slot id draws its own wrapper, named `slot.<id>` (theme-slot.tsx builds the attribute from the id, so the scan cannot see it). */
const slotHits: PartHit[] = SLOT_IDS.map((id) => ({ part: `slot.${id}`, tag: "div", file: "src/ui/_shared/theme-slot.tsx" }));
const hits = [...walk("src/ui"), ...slotHits];
if (process.argv.includes("--check")) {
  const reason = staleReason(existsSync(OUT) ? readFileSync(OUT, "utf8") : null, hits);
  if (reason) {
    console.error(`docs-parts:check: ${reason}; run \`bun run docs:parts\` and commit.`);
    process.exit(2);
  }
  console.log("docs-parts:check: the theme parts page is current");
} else {
  writeFileSync(OUT, renderParts(hits), "utf8");
  console.log(`wrote ${OUT}`);
}
