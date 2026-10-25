/**
 * The D18 boundary lint, as pure functions over a path and its source text. Three rules:
 *
 * 1. A store backend stays dumb. Files in `src/stage/store/<backend>/` may not VALUE-import from
 *    `src/core/`, `src/entities/`, or `src/formats/`. Parsing and validating canonical entities is
 *    the interface module's job, exactly as `StudioStore` parses while `StudioFs` only moves bytes.
 *    Type-only imports are allowed: they erase at build and carry no behavior.
 * 2. Nobody reaches around an interface. A backend may be VALUE-imported only by an interface
 *    module directly under `src/stage/store/`, by files in its own backend folder, by tests, or by
 *    a composition root the shell names explicitly. Growing that list is a visible, reviewed edit.
 * 3. Test stand-ins stay in tests. A file named `fake-*.ts` (a fake computer vault, the fast password
 *    lock) may be VALUE-imported only by tests and other stand-ins, so a weakened stand-in can never
 *    be wired into the app.
 *
 * Provider spokes are the other half of D18 and are deliberately not covered yet: their shape is
 * being designed in the prompt-construction track, and Kit's registry already imports spokes today.
 */

import { norm as normalizePath, stripComments } from "./lib";

export interface ImportRef {
  specifier: string;
  typeOnly: boolean;
}

const STORE_ROOT = "src/stage/store/";
const ENGINE_ROOTS = ["src/core/", "src/entities/", "src/formats/"] as const;

const isTest = (path: string): boolean => /\.test\.tsx?$/.test(path);
/** A test stand-in: `fake-<name>` anywhere under src/, with or without its extension. */
const isFake = (path: string): boolean => /(^|\/)fake-[^/]+$/.test(path);

/** The backend folder a repo path lives in, or null. `src/stage/store/sqlite/x.ts` -> "sqlite". */
function backendOf(path: string): string | null {
  if (!path.startsWith(STORE_ROOT)) return null;
  const rest = path.slice(STORE_ROOT.length);
  const slash = rest.indexOf("/");
  return slash > 0 ? rest.slice(0, slash) : null;
}

/** An interface module sits directly under the store root, not inside a backend folder. */
const isInterfaceModule = (path: string): boolean =>
  path.startsWith(STORE_ROOT) && !path.slice(STORE_ROOT.length).includes("/");

/** True when every binding in an import or export clause is marked `type`. */
function clauseIsTypeOnly(clause: string): boolean {
  const trimmed = clause.trim();
  if (/^type\s/.test(trimmed)) return true;
  if (!trimmed.startsWith("{")) return false; // a default or namespace binding is a value
  const inner = trimmed.slice(1, trimmed.lastIndexOf("}"));
  const bindings = inner.split(",").map((b) => b.trim()).filter(Boolean);
  return bindings.length > 0 && bindings.every((b) => /^type\s/.test(b));
}

/** Every import, re-export, side-effect import, and dynamic import in a source file. */
export function importsOf(source: string): ImportRef[] {
  const clean = stripComments(source);
  const refs: ImportRef[] = [];
  const fromClause = /\b(?:import|export)\s+([^;'"]*?)\s+from\s+["']([^"']+)["']/g;
  for (const m of clean.matchAll(fromClause)) {
    refs.push({ specifier: m[2]!, typeOnly: clauseIsTypeOnly(m[1]!) });
  }
  for (const m of clean.matchAll(/\bimport\s+["']([^"']+)["']/g)) {
    refs.push({ specifier: m[1]!, typeOnly: false });
  }
  for (const m of clean.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    refs.push({ specifier: m[1]!, typeOnly: false });
  }
  return refs;
}

/** Resolve a relative specifier against the importing file. Packages and bare names give null. */
export function resolveRelative(fromPath: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const parts = normalizePath(fromPath).split("/");
  parts.pop(); // drop the file name, keep its directory
  for (const segment of specifier.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join("/");
}

/**
 * Human-readable violations for one file. Empty means the file respects both rules.
 * `compositionRoots` are repo paths allowed to wire a backend in; the shell owns that list.
 */
export function stageBoundaryViolations(
  rawPath: string,
  source: string,
  compositionRoots: readonly string[] = [],
): string[] {
  const path = normalizePath(rawPath);
  const violations: string[] = [];
  if (isTest(path)) return violations;
  const ownBackend = backendOf(path);
  const roots = new Set(compositionRoots.map(normalizePath));

  for (const ref of importsOf(source)) {
    if (ref.typeOnly) continue;
    const target = resolveRelative(path, ref.specifier);
    if (target === null) continue;

    if (ownBackend !== null && ENGINE_ROOTS.some((root) => target.startsWith(root))) {
      violations.push(
        `${path}: store backend "${ownBackend}" value-imports ${target}; parse and validate in the interface module instead (D18 rule 1)`,
      );
    }

    if (isFake(target) && !isFake(path)) {
      violations.push(`${path}: imports the test stand-in ${target}; stand-ins are for tests only (rule 3)`);
    }

    const targetBackend = backendOf(target);
    const reachesAround =
      targetBackend !== null &&
      targetBackend !== ownBackend &&
      !isInterfaceModule(path) &&
      !roots.has(path);
    if (reachesAround) {
      violations.push(
        `${path}: imports store backend "${targetBackend}" directly; go through its interface, or name this file a composition root (D18 rule 2)`,
      );
    }
  }
  return violations;
}
