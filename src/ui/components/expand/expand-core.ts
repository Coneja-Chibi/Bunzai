/**
 * The pure rules behind the fullscreen editor box: what a caret is worth saving, when an Escape press
 * belongs to us, and where a trapped Tab lands. Separated from the component because these are the
 * parts that can be wrong in ways a screenshot never shows, and they test without a DOM.
 */

/** The slice of a text control these rules touch; a plain object satisfies it in tests. */
export interface TextTarget {
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  scrollTop: number;
  setSelectionRange(start: number, end: number): void;
}

/** Where the caret sat and how far the editor was scrolled, so a swap can put both back. */
export interface Caret {
  start: number;
  end: number;
  scrollTop: number;
}

/** Read the caret off a live control. A null selection (an unfocused control) means "the end". */
export function readCaret(el: TextTarget): Caret {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  return { start, end, scrollTop: el.scrollTop };
}

/**
 * A caret captured before the swap can outrun the text it belongs to - the value is a prop, and a
 * parent is free to shorten it while the box is open. Clamping keeps the restore from throwing the
 * caret somewhere the text no longer reaches.
 */
export function clampCaret(caret: Caret, length: number): Caret {
  const start = Math.max(0, Math.min(caret.start, length));
  const end = Math.max(start, Math.min(caret.end, length));
  return { start, end, scrollTop: Math.max(0, caret.scrollTop) };
}

/** Put a saved caret back on whichever control now holds the text. */
export function applyCaret(el: TextTarget, caret: Caret): void {
  const safe = clampCaret(caret, el.value.length);
  el.setSelectionRange(safe.start, safe.end);
  el.scrollTop = safe.scrollTop;
}

// isEscapeClose moved to src/ui/_shared/use-escape-key.ts (the one Escape-close rule, dup-audit/ui.md
// item 2). Expand imports the shared modal focus trap directly and keeps only its caret helpers here.
