/**
 * Repository-wide code doctrine scanner: authored TS/TSX must open with a documentation block
 * and must not use emoji pictographs. Product copy and documentation are intentionally out of scope.
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { containsEmoji, hasOpeningDocblock } from "./doctrine-core";
import { SKIP_DIRS, SOURCE_EXTS, walk } from "./walk";

const ROOTS = ["src", "scripts", "templates"];
const files = (): string[] => ROOTS.flatMap((root) => walk(root, (_path, name) => SOURCE_EXTS.has(extname(name)), SKIP_DIRS));

function headerHits(): string[] {
  return files()
    .filter((path) => SOURCE_EXTS.has(extname(path)))
    .filter((path) => !hasOpeningDocblock(readFileSync(path, "utf8")))
    .map((path) => `${path}: missing opening /** ... */ file-purpose block`);
}

function emojiHits(): string[] {
  const hits: string[] = [];
  for (const path of files()) {
    let fenced = false;
    readFileSync(path, "utf8").split("\n").forEach((line, index) => {
      if (containsEmoji(line) && !line.includes("emoji-ok")) {
        hits.push(`${path}:${index + 1}  ${line.trim().slice(0, 80)}`);
      }
    });
  }
  return hits;
}

const mode = process.argv[2];
const hits = mode === "--headers" ? headerHits() : mode === "--emoji" ? emojiHits() : null;
if (hits === null) {
  console.error("doctrines: pass --headers or --emoji");
  process.exit(1);
}
if (hits.length > 0) {
  console.error(`doctrines: ${hits.length} violation(s):`);
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log(`doctrines ${mode}: clean.`);
