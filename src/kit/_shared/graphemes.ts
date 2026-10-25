/**
 * User-visible text boundaries for Kit. JavaScript slices UTF-16 code units, which can tear emoji,
 * combining marks, flags, and ZWJ sequences. These helpers keep display truncation and backspace on
 * complete grapheme clusters through the platform's Unicode segmenter.
 */

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export interface GraphemeRun {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly cells: number;
}

const WIDE = [
  [0x1100, 0x115f], [0x2329, 0x232a], [0x2e80, 0x303e], [0x3040, 0xa4cf],
  [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f],
  [0xff01, 0xff60], [0xffe0, 0xffe6], [0x20000, 0x3fffd],
] as const;

/** Terminal cells for one grapheme; emoji presentations and East Asian wide forms occupy two. */
export function graphemeCellWidth(text: string): number {
  if (/^\p{Mark}+$/u.test(text) || /^[\u200b-\u200f\ufe00-\ufe0f\u2060-\u206f]+$/u.test(text)) return 0;
  if (/\p{Emoji_Presentation}/u.test(text) || text.includes("\u200d") || text.includes("\ufe0f")) return 2;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (WIDE.some(([from, to]) => cp >= from && cp <= to)) return 2;
  }
  return 1;
}

/** Graphemes with their UTF-16 source offsets and terminal-cell widths. */
export function graphemeRuns(text: string): GraphemeRun[] {
  return Array.from(segmenter.segment(text), ({ segment, index }) => ({
    text: segment,
    start: index,
    end: index + segment.length,
    cells: graphemeCellWidth(segment),
  }));
}

/** Snap a UTF-16 offset to a whole grapheme boundary; ties and insertion land at the trailing edge. */
export function graphemeOffset(text: string, offset: number, edge: "before" | "after" | "nearest" = "nearest"): number {
  const safe = Math.max(0, Math.min(offset, text.length));
  for (const part of graphemeRuns(text)) {
    if (safe === part.start || safe === part.end) return safe;
    if (safe > part.start && safe < part.end) {
      if (edge === "before") return part.start;
      if (edge === "after") return part.end;
      return safe - part.start < part.end - safe ? part.start : part.end;
    }
  }
  return safe;
}

/** Cursor cell column for a UTF-16 offset already snapped to a grapheme boundary. */
export function cellsBefore(text: string, offset: number): number {
  return graphemeRuns(text).reduce((cells, part) => cells + (part.end <= offset ? part.cells : 0), 0);
}

/** UTF-16 cursor offset nearest a terminal cell column, never a position inside a grapheme. */
export function offsetAtCell(text: string, column: number): number {
  const target = Math.max(0, column);
  let cells = 0;
  for (const part of graphemeRuns(text)) {
    const after = cells + part.cells;
    if (target < after) return target - cells < part.cells / 2 ? part.start : part.end;
    cells = after;
  }
  return text.length;
}

/** Previous and next cursor stops for one line. */
export function neighboringOffsets(text: string, offset: number): { before: number; after: number } {
  const safe = graphemeOffset(text, offset);
  const runs = graphemeRuns(text);
  return {
    before: [...runs].reverse().find((part) => part.start < safe)?.start ?? 0,
    after: runs.find((part) => part.start >= safe)?.end ?? text.length,
  };
}

export const splitGraphemes = (text: string): string[] =>
  Array.from(segmenter.segment(text), (part) => part.segment);

export const truncateGraphemes = (text: string, cap: number): string => {
  const parts = splitGraphemes(text);
  return parts.length > cap ? `${parts.slice(0, cap).join("").trimEnd()}…` : text;
};

export const dropLastGrapheme = (text: string): string => {
  const parts = splitGraphemes(text);
  parts.pop();
  return parts.join("");
};

export const tailGraphemes = (text: string, cap: number): string => {
  const parts = splitGraphemes(text);
  return parts.length > cap ? parts.slice(-cap).join("") : text;
};
