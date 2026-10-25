/**
 * The pure half of `bun run publish:export`: which tracked paths stay private, and which text in the
 * public remainder still points at one of them (a markdown link, a "see ..." note, the name of a private file).
 */

import { escapeRegex } from "../src/core/regex/escape";

const slashes = (s: string): string => s.replace(/\\/g, "/");

/**
 * The entries of publish-private.txt: blank lines and `#` comments dropped, backslashes normalized. A leading `~`
 * marks a generated file: it is left out like the rest, but a mention of it is not a dangling reference.
 */
export function parsePrivateList(text: string): { entries: string[]; generated: string[] } {
  const lines = text.split(/\r?\n/).map((l) => slashes(l.trim())).filter((l) => l !== "" && !l.startsWith("#"));
  return { entries: lines.map((l) => l.replace(/^~/, "")), generated: lines.filter((l) => l.startsWith("~")).map((l) => l.slice(1)) };
}

/** True when a repo-relative path is one of the entries or sits inside a folder entry. */
export function isPrivate(path: string, entries: readonly string[]): boolean {
  const p = slashes(path);
  return entries.some((e) => (e.endsWith("/") ? p.startsWith(e) : p === e));
}

export interface DanglingRef { file: string; line: number; ref: string }

/**
 * One matcher per entry. A folder matches its own path when nothing path-like precedes it (so `src/specs/`
 * and `audit-plans/` are not `specs/` or `plans/`), including after `../`. A file matches by file name,
 * which is how a link, a "see LESSONS.md" and a path all land on it.
 */
function matchers(entries: readonly string[]): RegExp[] {
  return entries.map((e) => {
    if (e.endsWith("/")) return new RegExp(`(?:^|[^A-Za-z0-9_./-]|[.][.]/)${escapeRegex(e)}[A-Za-z0-9_./-]*`, "g");
    const base = e.slice(e.lastIndexOf("/") + 1);
    return new RegExp(`(?:^|[^A-Za-z0-9_-])${escapeRegex(base)}`, "g");
  });
}

/** Every reference to a private entry in the given (already exported) files. */
export function danglingRefs(files: readonly { path: string; text: string }[], entries: readonly string[]): DanglingRef[] {
  const res = matchers(entries);
  const out: DanglingRef[] = [];
  for (const f of files) {
    f.text.split("\n").forEach((text, i) => {
      for (const re of res) {
        re.lastIndex = 0;
        for (const m of text.matchAll(re)) out.push({ file: f.path, line: i + 1, ref: m[0].replace(/^[^A-Za-z0-9.]+/, "") });
      }
    });
  }
  return out;
}
