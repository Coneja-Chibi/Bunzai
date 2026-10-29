/**
 * Pure detector for theme-keys: host CSS or TS that selects on a theme's id (`html[data-theme="theater"]`)
 * instead of a surface pick. A third-party theme can never reach such a look, and built-in themes get no
 * power an extension lacks. `data-theme` may name only `core` plumbing; mark that line `theme-key-ok`
 * (same line or the line above) with the reason.
 *
 * TS logic is covered too: comparing a value to a built-in id (`x === "paper"`, `case "stage":`) gives a built-in theme behavior a
 * third-party theme cannot have. Behavior that must differ per theme belongs on a surface pick or a manifest field; a comparison
 * that is truly about the bundled set (default selection, the setup list) is marked `theme-key-ok: <reason>`.
 */
const KEYED = /data-theme\s*[~|^$*]?=\s*[^a-z]{0,2}(?:theater|encore|stage|girliepop|paper|greenroom|bunzai\.theme\.encore)\b/;
const COMPARED = /[=!]==?\s*["\x27](?:theater|encore|stage|girliepop|paper|greenroom|bunzai\.theme\.encore)["\x27]|["\x27](?:theater|encore|stage|girliepop|paper|greenroom|bunzai\.theme\.encore)["\x27]\s*[=!]==?|\bcase\s+["\x27](?:theater|encore|stage|girliepop|paper|greenroom)["\x27]/;

export interface ThemeKeyHit { line: number; text: string }

/** Every line that keys on a theme id and carries no `theme-key-ok` opt-out. */
export function themeKeyHits(source: string): ThemeKeyHit[] {
  const lines = source.split("\n");
  const hits: ThemeKeyHit[] = [];
  lines.forEach((text, i) => {
    if (!KEYED.test(text) && !COMPARED.test(text)) return;
    if (text.includes("theme-key-ok") || (lines[i - 1] ?? "").includes("theme-key-ok")) return;
    hits.push({ line: i + 1, text: text.trim().slice(0, 100) });
  });
  return hits;
}
