/**
 * Style guard detectors (pure): a UI line that names a font instead of using the theme's font tokens, sizes a pane by the
 * viewport instead of its container (AGENTS.md rule 11), or styles the button element outside the button family
 * (AGENTS.md rule 13). The 2026-10 visual audit found screens mixing six typefaces because 18 files named fonts directly,
 * and 168 rules re-skinning buttons by element. Escape: a same-line `style-ok` comment with a reason.
 */

/** Studio UI files the guard covers; the theme sheet and the theme token bridge legitimately name fonts. */
export function isStyleGuardedFile(path: string): boolean {
  return /^src\/ui\/.*\.(css|ts|tsx)$/.test(path)
    && !/^src\/ui\/theme\//.test(path)
    && !/^src\/ui\/shell\/theme-tokens\.ts$/.test(path)
    && !/\.test\.tsx?$/.test(path);
}

/** Files that legitimately style the button element: the family itself and the theme surface variants. */
export const mayStyleButtons = (path: string): boolean => /^src\/ui\/(components\/button|_shared\/variants)\//.test(path);

const NAMED_FONT = /["'](Fraunces|Cinzel|Inter|Archivo[^"']*|Atkinson Hyperlegible|IBM Plex Mono|Courier Prime|Playfair Display|JetBrains Mono|Space Grotesk|Georgia|Arial|Helvetica)["']|var\(--bk-font-[a-z-]+\)|var\(--rc-font-inter\)/;
const VIEWPORT_WIDTH = /@media[^{]*\((?:max|min)-width/;
const BUTTON_SELECTOR = /(^|[\s>+~,(])button\b(?![-\w"'])[^{};]*\{/;

export type StyleHit = { rule: "font" | "viewport" | "button"; match: string };

/** The first style violation on one source line, or null; `file` scopes the button rule. */
export function styleViolation(line: string, file = ""): StyleHit | null {
  if (/style-ok/.test(line)) return null;
  const font = NAMED_FONT.exec(line);
  if (font) return { rule: "font", match: font[0] };
  const viewport = VIEWPORT_WIDTH.exec(line);
  if (viewport) return { rule: "viewport", match: viewport[0] };
  const button = mayStyleButtons(file) ? null : BUTTON_SELECTOR.exec(line);
  if (button) return { rule: "button", match: button[0].trim() };
  return null;
}

export const STYLE_HELP: Record<StyleHit["rule"], string> = {
  font: "Use the theme's font tokens: var(--font-fancy) for display titles, var(--font-body) for text, var(--font-mono) for code.",
  viewport: "Size panes by their container (AGENTS.md rule 11): container-type on the pane plus an @container query.",
  button: "Do not style the button element (AGENTS.md rule 13): the button family owns its look; restyle a part through its data-part, data-control or data-slot hooks.",
};
