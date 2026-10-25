/**
 * File-size guard - keeps any one file from quietly growing into a godfile. The pure rule (overLineCap)
 * lives in lib.ts; this shell counts lines on disk and carries the grandfather ceilings in
 * big-files.json. The pre-commit gate (gate.ts) applies the same rule to the files a commit touches, so
 * a file crossing its cap blocks the commit.
 *
 *   --scan : audit the whole tree, list every file past its cap (the godfile backlog).
 *   --seed : freeze the current offenders into big-files.json at their present length (shrink-only).
 *
 * Run: bun run scripts/hooks/file-lines.ts --scan
 */
import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_LINE_CAP, isLineGuardedFile, overLineCap } from "./lib";
import { walk } from "./walk";
import { LINE_SKIP_DIRS } from "./file-selection";

const CEILINGS_PATH = "scripts/hooks/big-files.json";

/** the grandfather ceilings (path -> frozen max lines); missing/unreadable file means "no ceilings". */
export const loadCeilings = (): Record<string, number> => {
  try {
    return JSON.parse(readFileSync(CEILINGS_PATH, "utf8")) as Record<string, number>;
  } catch {
    return {};
  }
};

/** line count the same way everywhere, so a seeded ceiling and a gate check never disagree. */
export const countLines = (path: string): number => readFileSync(path, "utf8").split("\n").length;

const guardedFiles = (): string[] => [
  ...walk("src", (path) => isLineGuardedFile(path), LINE_SKIP_DIRS),
  ...walk("scripts", (path) => isLineGuardedFile(path), LINE_SKIP_DIRS),
];

if (import.meta.main) {
  const mode = process.argv.includes("--seed") ? "seed" : process.argv.includes("--scan") ? "scan" : "help";

  if (mode === "seed") {
    const frozen: Record<string, number> = {};
    for (const p of guardedFiles()) {
      const n = countLines(p);
      if (n > DEFAULT_LINE_CAP) frozen[p] = n;
    }
    const ordered = Object.fromEntries(Object.entries(frozen).sort((a, b) => b[1] - a[1]));
    writeFileSync(CEILINGS_PATH, `${JSON.stringify(ordered, null, 2)}\n`);
    console.log(`file-lines: froze ${Object.keys(ordered).length} file(s) over ${DEFAULT_LINE_CAP} lines into ${CEILINGS_PATH}`);
    process.exit(0);
  }

  if (mode === "scan") {
    const ceilings = loadCeilings();
    const hits = guardedFiles()
      .map((p) => overLineCap(p, countLines(p), ceilings))
      .filter((v): v is string => v !== null);
    if (hits.length === 0) {
      console.log("file-lines: clean, no file past its cap.");
      process.exit(0);
    }
    console.error(`file-lines: ${hits.length} file(s) past cap\n\n${hits.map((h) => `  - ${h}`).join("\n")}\n`);
    process.exit(1);
  }

  console.log("file-lines: use --scan (audit the tree) or --seed (freeze current offenders).");
}
