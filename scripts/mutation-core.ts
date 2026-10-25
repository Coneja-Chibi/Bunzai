/**
 * The mutation check's pure half: turning a list of guards into mutants (small, deliberate breaks of
 * the code) and applying them to source text. A mutant a test run does not notice is a guard no test
 * protects. No filesystem or processes here; the shell is mutation-check.ts, the list mutations.ts.
 */

export interface Edit {
  /** Exact text to find; it must occur exactly once in the file. */
  find: string;
  replace: string;
}

/** A hand-named break: one or more edits, possibly across files, applied together. */
export interface NamedMutation {
  name: string;
  edits: { file: string; find: string; replace: string }[];
  tests: string[];
  /** Set when surviving is expected (two guards that back each other up); the reason is required. */
  expectSurvives?: string;
}

/** Every one-line throw guard in a file is removed in turn. */
export interface ThrowSweep {
  file: string;
  tests: string[];
  /** Guards whose removal is known to go unnoticed, by their trimmed line text, with the reason. */
  survivorsAllowed?: Record<string, string>;
}

export interface Mutant {
  name: string;
  edits: { file: string; find: string; replace: string }[];
  tests: string[];
  expectSurvives?: string;
}

/** A line that throws on its own line: `throw new X(...);` or `if (...) throw new X(...);`, balanced. */
function isOneLineThrow(line: string): boolean {
  const t = line.trim();
  if (!/^(if \(.*\) )?throw new \w+\(/.test(t) || !t.endsWith(";")) return false;
  let depth = 0;
  for (const ch of t) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

/**
 * One mutant per one-line throw guard in `source`. Each removes one line, kept unique by using the
 * line with its neighbours as the text to find, so identical guards in two places stay distinct.
 */
export function throwMutants(sweep: ThrowSweep, source: string): Mutant[] {
  const lines = source.split("\n");
  const mutants: Mutant[] = [];
  lines.forEach((line, i) => {
    if (!isOneLineThrow(line)) return;
    const find = [lines[i - 1] ?? "", line, lines[i + 1] ?? ""].join("\n");
    const replace = [lines[i - 1] ?? "", "", lines[i + 1] ?? ""].join("\n");
    const key = line.trim();
    const allowed = sweep.survivorsAllowed?.[key];
    mutants.push({
      name: `${sweep.file}:${i + 1} remove \`${key.length > 90 ? `${key.slice(0, 87)}...` : key}\``,
      edits: [{ file: sweep.file, find, replace }],
      tests: sweep.tests,
      ...(allowed ? { expectSurvives: allowed } : {}),
    });
  });
  return mutants;
}

/** Applies edits to one file's text. Throws when a find is missing or ambiguous, so a stale list is loud. */
export function applyEdits(source: string, edits: readonly Edit[], label: string): string {
  let text = source;
  for (const edit of edits) {
    const first = text.indexOf(edit.find);
    if (first < 0) throw new Error(`${label}: the text to change is not in the file (the list is stale)`);
    if (text.indexOf(edit.find, first + 1) >= 0) throw new Error(`${label}: the text to change occurs more than once`);
    text = text.slice(0, first) + edit.replace + text.slice(first + edit.find.length);
  }
  return text;
}

export type Verdict = "caught" | "survived" | "timeout" | "expected-survivor" | "unexpectedly-caught";

/** A result's meaning: a survivor that was not expected fails the check, and so does a stale expectation. */
export function verdictOf(testsFailed: boolean, timedOut: boolean, expectSurvives: string | undefined): Verdict {
  if (timedOut) return "timeout";
  if (expectSurvives !== undefined) return testsFailed ? "unexpectedly-caught" : "expected-survivor";
  return testsFailed ? "caught" : "survived";
}

export const failsCheck = (v: Verdict): boolean => v === "survived" || v === "unexpectedly-caught";
