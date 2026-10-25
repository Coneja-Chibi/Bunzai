/**
 * The Edit history list's facts (approved wireframe rc-port/scene-history.html). Pure: no React. A
 * version keeps every text it replaced, oldest first (ChatStore rule 5); the list reads them newest first,
 * with the text now on top. Restore names `index` into the stored list.
 */

export interface HistoryRow {
  label: string;
  /** Index into the stored list (oldest first); null for the text now, which has nothing to restore. */
  index: number | null;
  preview: string;
  words: number;
}

const PREVIEW_CHARS = 140;

export function wordCount(text: string): number {
  const t = text.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
}

/** One tidy run of text: whitespace collapsed, cut at a word with an ellipsis. */
export function previewOf(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= PREVIEW_CHARS) return flat;
  const cut = flat.slice(0, PREVIEW_CHARS);
  const space = cut.lastIndexOf(" ");
  return `${(space > PREVIEW_CHARS / 2 ? cut.slice(0, space) : cut).trimEnd()}...`;
}

const labelFor = (fromNewest: number, total: number): string => {
  if (fromNewest === 0) return "Before the last edit";
  if (fromNewest === total - 1) return "Original";
  return fromNewest === 1 ? "Before that" : "Earlier";
};

export function historyRows(current: string, texts: readonly string[]): HistoryRow[] {
  const rows: HistoryRow[] = [{ label: "Now", index: null, preview: previewOf(current), words: wordCount(current) }];
  for (let i = texts.length - 1; i >= 0; i--) {
    const text = texts[i]!;
    rows.push({ label: labelFor(texts.length - 1 - i, texts.length), index: i, preview: previewOf(text), words: wordCount(text) });
  }
  return rows;
}

/** What Undo last edit puts back: the newest earlier text. */
export const undoTarget = (texts: readonly string[]): string | null => texts.at(-1) ?? null;
