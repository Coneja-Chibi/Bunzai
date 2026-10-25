/**
 * The rules Kit's transcript markdown obeys, restated for a surface that has a DOM.
 *
 * THE PARSER IS NOT HERE, AND THAT IS THE POINT. src/kit/render/markdown.ts already turns a reply
 * into blocks and spans, it is pure, and it has its own tests. Copying it would be the duplicated
 * authority kit-vars.ts was written to avoid: two parsers, one of them quietly wrong, and nothing
 * that fails when they drift. Links from model output go through safeOutwardHref in
 * src/ui/_shared/render-policy.ts, the one href policy (outward schemes only, never `#` or `/path`).
 *
 * What IS pinned here is Kit's own cap on how much of a fenced patch gets drawn, so a window and a
 * terminal cut a huge diff at the same line.
 */

/**
 * How many diff rows a fenced patch may draw before the rest becomes a count.
 *
 * Kit's number, from src/kit/render/primitives/markdown-text.tsx. A model asked to "show me the
 * change" can emit a three thousand line patch, and a transcript that renders all of it is a
 * transcript you cannot scroll back through. Eighty is enough to read a hunk and see its shape.
 */
export const DIFF_LINE_CAP = 80;

/**
 * The ink a diff row takes, as a Kit palette variable.
 *
 * Kit's assignment exactly (markdown-text.tsx `diffColor`): additions alive-green, removals red,
 * hunk headers and file markers violet, everything else the body floor. The colours are the diff -
 * a patch drawn in one colour is just indented text.
 */
export function diffInk(kind: "meta" | "add" | "remove" | "context"): string {
  if (kind === "add") return "var(--kit-alive)";
  if (kind === "remove") return "var(--kit-red)";
  if (kind === "meta") return "var(--kit-violet)";
  return "var(--kit-soft)";
}
