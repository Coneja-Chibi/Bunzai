/**
 * theme-keys: no host CSS or TS selector may name a theme id. Every built-in look is a surface pick, palette,
 * type or shape value any theme package can set (see theme-keys-core.ts). Files in the allowlist are
 * not yet migrated; a listed file with no hit is a stale entry and fails too, so the list ends empty.
 */
import { readFileSync } from "node:fs";
import { walk } from "./walk";
import { SKIP_DIRS } from "./file-selection";
import { themeKeyHits } from "./theme-keys-core";
import { THEME_KEYS_ALLOWLIST } from "./theme-keys-allowlist";

const EXTS = /\.(css|ts|tsx|html)$/;
const OWN_THEMES = /^src\/extensions\/(themes|examples)\//;
const files = walk("src", (path) => EXTS.test(path) && !/\.test\.tsx?$/.test(path) && !OWN_THEMES.test(path), SKIP_DIRS);

const allowed = new Set<string>(THEME_KEYS_ALLOWLIST);
const problems: string[] = [];
const seen = new Set<string>();
for (const path of files) {
  const hits = themeKeyHits(readFileSync(path, "utf8"));
  if (hits.length === 0) continue;
  seen.add(path);
  if (allowed.has(path)) continue;
  for (const hit of hits) problems.push(`${path}:${hit.line}  ${hit.text}`);
}
for (const path of allowed) if (!seen.has(path)) problems.push(`${path}  stale allowlist entry (no theme-id selector left): remove it from scripts/hooks/theme-keys-allowlist.ts`);

if (problems.length) {
  console.error(`theme-keys: host code must select on surface picks, not theme ids (core plumbing: mark the line theme-key-ok):\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exitCode = 1;
} else console.log(`theme-keys: clean (${allowed.size} allowlisted)`);
