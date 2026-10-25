/**
 * The glossary check's pure rules (docs/reference/glossary.md): every repo path the page names must
 * exist, and every folder directly under src/ must appear on it, so an agent never meets a folder
 * nobody explained. No filesystem here; the shell (glossary.ts) supplies what exists.
 */

/** Top-level repo folders whose paths the glossary may name. */
const ROOTS = ["src", "scripts", "specs", "docs", "sidecar", "templates", "tools", "build"];

/**
 * Repo paths named in backticks on the page: `src/core/`, `docs/02-ARCHITECTURE.md`. Patterns with a
 * placeholder or wildcard (`src/formats/<name>/`, `fake-*.ts`) are left out, and a trailing slash
 * is dropped.
 */
export function pathsNamed(markdown: string): string[] {
  const found = new Set<string>();
  for (const m of markdown.matchAll(/`([^`\s]+)`/g)) {
    const token = m[1]!;
    if (!ROOTS.some((root) => token === root || token.startsWith(`${root}/`))) continue;
    if (/[<>*{}]/.test(token)) continue;
    found.add(token.replace(/\/$/, ""));
  }
  return [...found].sort();
}

/** What is wrong with the page, given which named paths exist and which folders sit under src/. */
export function glossaryProblems(markdown: string, exists: (path: string) => boolean, srcFolders: readonly string[]): string[] {
  const problems: string[] = [];
  for (const path of pathsNamed(markdown)) {
    if (!exists(path)) problems.push(`names \`${path}\`, which does not exist; update the entry or remove it`);
  }
  for (const folder of srcFolders) {
    if (!markdown.includes(`\`src/${folder}/\``)) problems.push(`does not explain \`src/${folder}/\`; add it to "Where things live"`);
  }
  return problems;
}
