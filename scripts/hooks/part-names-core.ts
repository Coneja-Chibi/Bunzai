/**
 * Part-name rules (the theme-parts contract in docs/reference/extending/make-a-theme.md): every `data-part` in the UI is a stable dotted
 * name, `<surface>.<part>`, written as a literal or as a literal prefix plus an id the code keys on (`props.tracker.${view.module}`), never
 * a bare expression and never a label a person can retype or a translation can change. Every wing and tab file under the scenes app, and
 * the pop-out host and panel, must carry at least one. Pure; part-names.ts runs it over src/ui.
 */

export interface PartProblem { line: number; text: string; why: string }

const LITERAL = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const PREFIX = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9.-]*)*\.$/;
/** The last name in an interpolation: an id, or one of the few id-like keys a registry is keyed by. */
const ID_LIKE = /^(?:id|[a-z]\w*Id|type|kind|module|group)$/;
const CHAIN = /^[A-Za-z_]\w*(?:\??\.[A-Za-z_]\w*)*$/;

/** The raw text of every `data-part=` value and the line it sits on. */
function values(source: string): { raw: string; line: number }[] {
  const found: { raw: string; line: number }[] = [];
  for (const m of source.matchAll(/data-part=/g)) {
    const at = m.index! + m[0].length;
    const open = source[at];
    let end = -1;
    if (open === '"') end = source.indexOf('"', at + 1) + 1;
    else if (open === "{") {
      let depth = 0;
      for (let i = at; i < source.length && end < 0; i++) {
        if (source[i] === "{") depth++;
        else if (source[i] === "}" && --depth === 0) end = i + 1;
      }
    }
    if (end > 0) found.push({ raw: source.slice(at, end), line: source.slice(0, at).split("\n").length });
  }
  return found;
}

/** A choice between two literals, or a prop the file declares as a literal-fed `"data-part"`: the only bare forms, since the page can still read every name. */
function bareProblem(expr: string, source: string): string | null {
  const choice = /^[^"'`{}?]+\?\s*"([^"]*)"\s*:\s*"([^"]*)"$/.exec(expr);
  if (choice) return LITERAL.test(choice[1]!) && LITERAL.test(choice[2]!) ? null : "both names of a choice must be dotted lowercase names";
  if (/^[A-Za-z_]\w*$/.test(expr) && source.includes(`"data-part": ${expr}`)) return null;
  return "a bare expression hides the name from themes and the parts page: write a literal";
}

function problemOf(raw: string, source: string): string | null {
  if (raw.startsWith('"')) {
    const name = raw.slice(1, -1);
    return LITERAL.test(name) ? null : `"${name}" is not a dotted lowercase name like surface.part`;
  }
  const inner = raw.slice(1, -1).trim();
  if (!inner.startsWith("`")) return bareProblem(inner, source);
  const body = inner.slice(1, -1);
  const prefix = body.slice(0, body.indexOf("${"));
  if (!body.includes("${") || !PREFIX.test(prefix)) return "a template needs a dotted literal prefix ending in a dot, then an id";
  for (const expr of body.matchAll(/\$\{([^}]*)\}/g)) {
    const e = expr[1]!.trim();
    if (!CHAIN.test(e) || !ID_LIKE.test(e.split(/\??\./).pop()!)) return `\${${e}} is not an id: key a part on an id, never a label or a computed string`;
  }
  return null;
}

/** Every malformed `data-part` in one source file. */
export function partProblems(source: string): PartProblem[] {
  return values(source).flatMap(({ raw, line }) => {
    const why = problemOf(raw, source);
    return why ? [{ line, text: raw.slice(0, 80), why }] : [];
  });
}

/** Files that draw a themable wing, tab or pop-out and so must name something. */
export const mustCarryPart = (path: string): boolean =>
  !/\.test\.tsx?$/.test(path) && (/^src\/ui\/apps\/scenes\/(?:.*\/)?[^/]*-(?:wing|tab)\.tsx$/.test(path) || /^src\/ui\/apps\/scenes\/popout\/popout-(?:host|panel)\.tsx$/.test(path));

/** True when the file carries at least one well-formed part. */
export const carriesPart = (source: string): boolean => values(source).some(({ raw }) => problemOf(raw, source) === null);
