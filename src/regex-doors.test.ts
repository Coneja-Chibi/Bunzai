/**
 * The regex door list (AGENTS rule 3, ADR-009): the core engine's `applyRules(` may be called only from the sandbox worker's request
 * check (src/sandbox/regex/request.ts) and from the Kit regex tools, which test the agent's own draft rule on its own sample. A
 * scene's display and prompt regex, the turn loop and the assembler reach imported rules only through the worker, so none of them
 * is listed. Same shape as src/stream-doors.test.ts.
 */
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { stripComments } from "../scripts/hooks/lib";

const ALLOWED: Record<string, { count: number; reason: string }> = {
  "src/sandbox/regex/request.ts": { count: 2, reason: "the sandbox worker's answer: the one place an imported rule runs" },
  "src/kit/tools/regex-from-drawing.ts": { count: 1, reason: "the agent's own drawn draft, run on its own sample" },
  "src/kit/tools/regex-lab.ts": { count: 3, reason: "the agent's own draft rule, run on its own sample" },
};

const scanned = (path: string): boolean =>
  /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !path.startsWith("src/core/regex/") && !/(^|\/)(fake-[^/]*|[^/]*-rig)\.tsx?$/.test(path) && !/(^|\/)(node_modules|_fixtures|generated)\//.test(path);

const counts = (): Map<string, number> => {
  const found = new Map<string, number>();
  for (const file of readdirSync("src", { recursive: true }).map((p) => `src/${String(p).replace(/\\/g, "/")}`).filter(scanned)) {
    const n = stripComments(readFileSync(file, "utf8")).match(/\bapplyRules\(/g)?.length ?? 0;
    if (n > 0) found.set(file, n);
  }
  return found;
};

test("no source file runs a regex rule in this process unless it is on the list", () => {
  const found = counts();
  expect([...found].filter(([file]) => !(file in ALLOWED)).map(([file, n]) => `${file} (${n})`)).toEqual([]);
});

test("every listed door still has exactly its listed calls", () => {
  const found = counts();
  expect(Object.entries(ALLOWED).filter(([file, e]) => found.get(file) !== e.count).map(([file]) => file)).toEqual([]);
});
