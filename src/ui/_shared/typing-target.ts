/**
 * Is somebody typing into this? The one answer for every shortcut, undo chord and Escape consumer.
 *
 * FAIL CLOSED. Every `<input>` counts, including checkboxes and buttons, because the cost of being
 * wrong in that direction is one chord the user presses again after clicking elsewhere, and the cost
 * of being wrong in the other direction is losing a keystroke out of a paragraph they were writing.
 * A `<select>` counts too: arrow keys and letters drive an open dropdown.
 *
 * `isContentEditable` is true for anything INSIDE a contenteditable host (how the code editors are
 * covered without naming them) but jsdom does not implement it, so the `closest` selector answers
 * the same question for real elements. The DOM reports tagName uppercase, so it is lowered first.
 */
const FIELD_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

interface MaybeField {
  tagName?: unknown;
  isContentEditable?: unknown;
  closest?: unknown;
}

export function isTypingTarget(target: unknown): boolean {
  if (typeof target !== "object" || target === null) return false;
  const t = target as MaybeField;
  if (t.isContentEditable === true) return true;
  if (typeof t.tagName === "string") {
    const tag = t.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
  }
  return typeof t.closest === "function" && (t.closest as (selector: string) => unknown).call(target, FIELD_SELECTOR) !== null;
}
