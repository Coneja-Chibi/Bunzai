/**
 * Small string helpers every layer shares, so a count reads the same on every surface and a slug is
 * the same slug wherever it is made (AGENTS.md rule 12).
 */

/** "1 book", "3 books": a count with its noun, singular for exactly one. The count is shown with the
 *  reader's digit grouping ("1,204 messages"), which every surface now agrees on. */
export const plural = (n: number, one: string, many = `${one}s`): string => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export interface SlugOptions {
  /** Separator that replaces every run of characters outside a-z0-9. */
  sep?: "-" | "_";
  /** Longest slug returned; a cut never leaves a trailing separator. */
  cap?: number;
  /** Returned when nothing is left (a name of punctuation or a script this alphabet cannot spell). */
  fallback?: string;
}

/** Lowercase ASCII slug: runs of anything outside a-z0-9 collapse to one separator, none at either end. */
export function asciiSlug(text: string, { sep = "-", cap, fallback = "" }: SlugOptions = {}): string {
  const edge = new RegExp(`^${sep}+|${sep}+$`, "g");
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, sep).replace(edge, "");
  const cut = cap === undefined ? slug : slug.slice(0, cap).replace(edge, "");
  return cut || fallback;
}
