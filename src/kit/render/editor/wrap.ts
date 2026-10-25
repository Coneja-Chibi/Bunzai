/**
 * Laying a document out in terminal cells, and mapping clicks back to UTF-16 cursor offsets.
 *
 * WHY IT EXISTS. The first editor drew the cursor's line in full and cut every other one to the pane
 * width, so the only paragraph you could read whole was the one you happened to be standing in.
 * Reported as "I have to hover lines to see the whole part" - which was not hovering doing anything,
 * it was the cursor moving.
 *
 * WRAPPING IS THE EASY HALF. The hard half is that a click arrives as a screen row and column, and
 * the buffer thinks in logical lines - so every visual row has to know which line and which character
 * it started at, or clicking lands somewhere near where you aimed and nowhere exactly. Grapheme runs
 * carry both source offsets and terminal-cell widths, so a wide emoji is never counted as two cols
 * merely because JavaScript stores it in two UTF-16 units.
 *
 * BREAKS ON WORDS, falls back to the character when a word is longer than the pane. A hard break
 * mid-word is fine for code and wrong for the prose these blocks hold.
 */
import { cellsBefore, graphemeOffset, graphemeRuns, offsetAtCell } from "../../_shared/graphemes";

/** One row as drawn, and where in the document it starts. */
export interface VisualRow {
  readonly text: string;
  /** Which logical line this row came from. */
  readonly row: number;
  /** UTF-16 offset into that line where this row begins. */
  readonly from: number;
  /** True for the first row of a logical line, which is the one that gets the number. */
  readonly first: boolean;
}

/**
 * Break one line into rows no wider than `width`.
 *
 * An empty line still produces one row: a paragraph break is a place the cursor can be, and a line
 * that produced nothing would be a line you could never put it on.
 */
export function wrapLine(text: string, width: number, row: number): VisualRow[] {
  const room = Math.max(1, width);
  if (text.length === 0) return [{ text: "", row, from: 0, first: true }];
  const out: VisualRow[] = [];
  const runs = graphemeRuns(text);
  let first = 0;
  while (first < runs.length) {
    let end = first;
    let cells = 0;
    let space = -1;
    while (end < runs.length && cells + runs[end]!.cells <= room) {
      if (runs[end]!.text === " " && end > first) space = end;
      cells += runs[end]!.cells;
      end++;
    }
    if (end < runs.length && runs[end]!.text === " " && end > first) space = end;
    // Keep one wide grapheme intact even when the pane is narrower than the glyph.
    if (end === first) end++;
    if (end < runs.length && space > first) end = space;
    const startOffset = runs[first]!.start;
    const endOffset = runs[end - 1]!.end;
    out.push({ text: text.slice(startOffset, endOffset), row, from: startOffset, first: out.length === 0 });
    first = end === space ? end + 1 : end;
  }
  return out;
}

/** The whole document, laid out. */
export function wrapAll(lines: readonly string[], width: number): VisualRow[] {
  return lines.flatMap((text, row) => wrapLine(text, width, row));
}

/** Which visual row holds this position, and where along it. */
export function toVisual(
  rows: readonly VisualRow[],
  row: number,
  col: number,
): { index: number; col: number } {
  let last = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (r.row !== row) continue;
    last = i;
    if (col >= r.from && col <= r.from + r.text.length) {
      return { index: i, col: cellsBefore(r.text, graphemeOffset(r.text, col - r.from)) };
    }
  }
  // Past the end of its last row: clamp there rather than to the top of the document.
  const tail = rows[last];
  return { index: last, col: tail ? cellsBefore(tail.text, tail.text.length) : 0 };
}

/**
 * Where in the document a click landed.
 *
 * PAST THE END OF A ROW IS THE END OF THAT ROW, not the start of the next: clicking the empty space
 * to the right of a short line means "the end of this line" to everybody who has ever used an editor.
 */
export function fromVisual(
  rows: readonly VisualRow[],
  index: number,
  col: number,
): { row: number; col: number } {
  if (rows.length === 0) return { row: 0, col: 0 };
  const at = Math.max(0, Math.min(index, rows.length - 1));
  const r = rows[at]!;
  return { row: r.row, col: r.from + offsetAtCell(r.text, Math.max(0, col)) };
}

/**
 * The slice of visual rows to draw, keeping the cursor on screen.
 *
 * Computed rather than stored, for the same reason the logical window was: an offset held beside the
 * buffer is a second thing that can disagree with it, and the thing it disagrees with is where the
 * cursor is.
 */
export function visualWindow(
  rows: readonly VisualRow[],
  cursorIndex: number,
  height: number,
): { from: number; to: number } {
  const tall = Math.max(1, height);
  if (rows.length <= tall) return { from: 0, to: rows.length };
  const from = Math.max(0, Math.min(cursorIndex - Math.floor(tall / 2), rows.length - tall));
  return { from, to: from + tall };
}
