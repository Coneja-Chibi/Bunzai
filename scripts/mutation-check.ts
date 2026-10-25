/**
 * Runs the mutation check (mutation-core.ts over the list in mutations.ts): each guard in the risky
 * folders is broken on purpose, one at a time, and its tests run; a break no test notices is a guard
 * nothing protects. On demand, not in verify:ci, because it runs the tests once per mutant.
 *
 * It edits real source files, so every original is saved to .mutation-check/ before an edit and put
 * back after it, on Ctrl+C, and at the start of the next run if a run was killed partway.
 *
 * Run: bun run mutation:check [filter]   (filter: run only mutants whose name contains it)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyEdits, failsCheck, throwMutants, verdictOf, type Mutant, type Verdict } from "./mutation-core";
import { NAMED, SWEEPS } from "./mutations";
import { toErrorMessage } from "../src/error-message";

const SAVE_DIR = ".mutation-check";
/** One mutant's test run may take this long before it counts as a hang (which is noticed, not missed). */
const RUN_LIMIT_MS = 180_000;

const saved = (file: string) => join(SAVE_DIR, encodeURIComponent(file));

/** Puts back every file a killed or finished run saved. Returns the files restored. */
function restoreAll(): string[] {
  if (!existsSync(SAVE_DIR)) return [];
  const restored: string[] = [];
  for (const name of readdirSync(SAVE_DIR)) {
    const file = decodeURIComponent(name);
    writeFileSync(file, readFileSync(join(SAVE_DIR, name)));
    restored.push(file);
  }
  rmSync(SAVE_DIR, { recursive: true, force: true });
  return restored;
}

function runTests(tests: string[]): { failed: boolean; timedOut: boolean } {
  const r = Bun.spawnSync(["bun", "test", ...tests.map((t) => `./${t}`), "--timeout", "30000"], {
    stdout: "ignore",
    stderr: "ignore",
    timeout: RUN_LIMIT_MS,
  });
  const timedOut = r.exitedDueToTimeout === true;
  return { failed: timedOut || r.exitCode !== 0, timedOut };
}

const leftover = restoreAll();
if (leftover.length > 0) console.log(`mutation-check: restored files a killed run left changed: ${leftover.join(", ")}`);
process.on("SIGINT", () => {
  restoreAll();
  console.log("\nmutation-check: stopped; every file is back as it was");
  process.exit(130);
});

const filter = process.argv[2];
const mutants: Mutant[] = [...NAMED, ...SWEEPS.flatMap((s) => throwMutants(s, readFileSync(s.file, "utf8")))].filter(
  (m) => !filter || m.name.includes(filter),
);
if (mutants.length === 0) {
  console.log("mutation-check: no mutants match");
  process.exit(1);
}

// The unbroken code must pass first, or every mutant would look caught.
const allTests = [...new Set(mutants.flatMap((m) => m.tests))].sort();
const baseline = runTests(allTests);
if (baseline.failed) {
  console.error(`mutation-check: the tests fail before anything is broken (${allTests.join(", ")}); fix them first`);
  process.exit(1);
}

const results: { name: string; verdict: Verdict; ms: number; why?: string }[] = [];
for (const m of mutants) {
  const files = [...new Set(m.edits.map((e) => e.file))];
  mkdirSync(SAVE_DIR, { recursive: true });
  const originals = new Map(files.map((f) => [f, readFileSync(f)] as const));
  for (const [f, bytes] of originals) writeFileSync(saved(f), bytes);
  const started = performance.now();
  try {
    for (const f of files) {
      const edits = m.edits.filter((e) => e.file === f);
      writeFileSync(f, applyEdits(originals.get(f)!.toString("utf8"), edits, `${m.name} (${f})`));
    }
    const run = runTests(m.tests);
    const verdict = verdictOf(run.failed, run.timedOut, m.expectSurvives);
    results.push({ name: m.name, verdict, ms: performance.now() - started, ...(m.expectSurvives ? { why: m.expectSurvives } : {}) });
  } catch (error) {
    restoreAll();
    console.error(`mutation-check: ${toErrorMessage(error)}`);
    process.exit(1);
  }
  restoreAll();
  const last = results[results.length - 1]!;
  console.log(`${last.verdict.padEnd(19)} ${(last.ms / 1000).toFixed(1).padStart(6)} s  ${last.name}`);
}

const failing = results.filter((r) => failsCheck(r.verdict));
const expected = results.filter((r) => r.verdict === "expected-survivor");
console.log(
  `\nmutation-check: ${results.length} mutants, ${results.length - failing.length - expected.length} noticed by a test, ` +
    `${expected.length} expected survivors, ${failing.length} problem(s)`,
);
for (const r of expected) console.log(`  expected survivor: ${r.name} (${r.why})`);
for (const r of failing) {
  console.log(
    r.verdict === "survived"
      ? `  NOT PROTECTED: ${r.name}`
      : `  STALE EXPECTATION: ${r.name} is now caught; remove its expectSurvives note`,
  );
}
process.exit(failing.length > 0 ? 2 : 0);
