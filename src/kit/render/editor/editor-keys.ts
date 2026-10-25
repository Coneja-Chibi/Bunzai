/**
 * What a key does inside the block editor.
 *
 * Pure and separate for the reason every key decision in Kit ended up that way: the editor is a modal
 * surface sitting over a rail and a composer that both want the same keys, and every time that was
 * decided inline it went wrong somewhere nobody looked - arrows that were dead, a letter that
 * answered a confirmation, an escape that did nothing.
 *
 * THE EDITOR CLAIMS EVERY KEY IT IS OFFERED. There is no fall-through: while this card is up it owns
 * the keyboard completely, because the alternative is a keystroke meant for a paragraph reaching the
 * rail and toggling a block behind the card.
 */
import type { Move } from "./text-buffer";
import { intentOf, type IntentBinding } from "../primitives/nav/intent";

/** Just the parts of a key event this reads. */
export interface EditorKey {
  readonly name?: string | undefined;
  readonly sequence?: string | undefined;
  readonly ctrl?: boolean | undefined;
  readonly shift?: boolean | undefined;
  readonly meta?: boolean | undefined;
  readonly option?: boolean | undefined;
}

export type EditorAction =
  /** Put the clipboard in at the cursor, replacing any selection. */
  | { readonly kind: "paste" }
  /** Put the selection on the clipboard. */
  | { readonly kind: "copy" }
  /** Copy, then remove it. */
  | { readonly kind: "cut" }
  | { readonly kind: "select-all" }
  /** Move, extending the selection from wherever it was anchored. */
  | { readonly kind: "extend"; readonly how: Move }
  /** Keep the text and close, staging it as an ordinary draft. */
  | { readonly kind: "save" }
  /** Close and throw the edit away. */
  | { readonly kind: "cancel" }
  | { readonly kind: "insert"; readonly char: string }
  | { readonly kind: "newline" }
  | { readonly kind: "backspace" }
  | { readonly kind: "delete" }
  | { readonly kind: "move"; readonly how: Move }
  /** Recognised as the editor's, and nothing to do. Still swallowed. */
  | { readonly kind: "ignore" };

const MOVES: Record<string, Move> = {
  left: "left", right: "right", up: "up", down: "down", home: "home", end: "end",
};

type EditorIntent =
  | "copy" | "cut" | "paste" | "select-all" | "save" | "cancel"
  | "top" | "bottom" | "extend-left" | "extend-right" | "extend-up" | "extend-down"
  | "extend-home" | "extend-end" | "newline" | "backspace" | "delete"
  | "move-left" | "move-right" | "move-up" | "move-down" | "move-home" | "move-end";

const EDITOR_KEYS: readonly IntentBinding<EditorIntent>[] = [
  ...(["c", "x", "v", "a", "s", "q"] as const).map((key) => ({
    chord: `ctrl+${key}`,
    intent: ({ c: "copy", x: "cut", v: "paste", a: "select-all", s: "save", q: "cancel" } as const)[key],
  })),
  { chord: "ctrl+home", intent: "top" }, { chord: "ctrl+end", intent: "bottom" },
  ...(["left", "right", "up", "down", "home", "end"] as const).map((key) => ({
    chord: `shift+${key}`, intent: `extend-${key}` as EditorIntent,
  })),
  { chord: "escape", intent: "cancel" }, { chord: "return", intent: "newline" },
  { chord: "backspace", intent: "backspace" }, { chord: "delete", intent: "delete" },
  ...(["left", "right", "up", "down", "home", "end"] as const).map((key) => ({
    chord: key, intent: `move-${key}` as EditorIntent,
  })),
];

/**
 * Decide.
 *
 * CTRL+S SAVES AND ESCAPE CANCELS, rather than Enter doing either. Enter is the single most-typed
 * key in a block of prose, and the old editor spent it on "commit" - which is exactly why a newline
 * could not be typed at all. Here it is a paragraph break and nothing else.
 */
export function editorAction(key: EditorKey): EditorAction {
  const name = key.name ?? "";

  const intent = intentOf(key, EDITOR_KEYS);
  if (intent) {
    if (intent.startsWith("extend-")) {
      const how = intent.slice(7) as keyof typeof MOVES;
      return { kind: "extend", how: MOVES[how]! };
    }
    if (intent.startsWith("move-")) {
      const how = intent.slice(5) as keyof typeof MOVES;
      return { kind: "move", how: MOVES[how]! };
    }
    if (intent === "top" || intent === "bottom") return { kind: "move", how: intent };
    switch (intent) {
      case "copy": return { kind: "copy" };
      case "cut": return { kind: "cut" };
      case "paste": return { kind: "paste" };
      case "select-all": return { kind: "select-all" };
      case "save": return { kind: "save" };
      case "cancel": return { kind: "cancel" };
      case "newline": return { kind: "newline" };
      case "backspace": return { kind: "backspace" };
      case "delete": return { kind: "delete" };
    }
  }
  if (key.ctrl === true) return { kind: "ignore" };

  const typed = key.sequence ?? "";
  // The SEQUENCE, not the name: `name` reports a space as the word "space", which would put that
  // word into somebody's prompt. The rail's editor learned this one the hard way.
  if (typed.length === 1 && typed >= " ") return { kind: "insert", char: typed };

  // Swallowed rather than passed on. A key that fell through would reach the rail behind the card.
  return { kind: "ignore" };
}
