/**
 * The low-level regex-literal primitives every regex builder and matcher composes from: escaping a
 * literal string into pattern source, reversing that escape, splitting an alternation body on its
 * top-level `|`, and compiling a pattern for a stateless re-verify. Pattern DATA only here - nothing
 * in this file executes an authored regex against real input; compileStateless is used by callers
 * that only need a disposable, non-global RegExp object for a one-shot re-check.
 */

/** Escape every regex metacharacter in `s`, so it matches only its literal characters. */
export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Reverse `escapeRegex` for a run with no bare metacharacters, or null if it is not a plain run
 *  (a bare metacharacter, or a trailing backslash with nothing after it). */
export function unescapeLiteral(fragment: string): string | null {
  let out = "";
  for (let i = 0; i < fragment.length; i++) {
    const c = fragment[i];
    if (c === "\\") {
      const next = fragment[i + 1];
      if (next === undefined) return null;
      out += next;
      i++;
      continue;
    }
    out += c;
  }
  return escapeRegex(out) === fragment ? out : null;
}

/** Split an alternation body on top-level `|`, honoring escapes; null on a nested group. */
export function splitAlternation(inner: string): string[] | null {
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "\\") {
      cur += c + (inner[i + 1] ?? "");
      i++;
      continue;
    }
    if (c === "(" || c === ")") return null;
    if (c === "|") {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

/** The JS-engine flag letters kept for a stateless re-verify (i/m/s/u); an ST-only `<group>` marker
 *  and the stateful g/y flags are dropped. A `\p{...}`/`\P{...}` escape forces "u" even when the
 *  author never set it, since the engine rejects that escape outright without it. Null on a pattern
 *  the engine refuses to compile. */
export function compileStateless(find: string, flags: string): RegExp | null {
  const kept = new Set<string>();
  for (const f of flags.replace(/<[^>]*>/g, "")) {
    if (f === "i" || f === "m" || f === "s" || f === "u") kept.add(f);
  }
  if (/\\[pP]\{/.test(find)) kept.add("u");
  try {
    return new RegExp(find, [...kept].join(""));
  } catch {
    return null;
  }
}
