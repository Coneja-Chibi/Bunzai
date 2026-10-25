/**
 * Which shell action a key means. Pure, so the routing can be proven without a terminal.
 *
 * The hook that uses this owns exactly one impure thing: reading the running turn off its ref at
 * KEYPRESS time. That read is deliberately not in here, because the bug this file exists to prevent
 * was a value snapshot - the turn was read at render time, so an escape pressed in the window between
 * `activeTurn.current = job` and React committing the busy re-render aborted nothing at all.
 */
import type { KeyEvent } from "@opentui/core";
import { intentOf, type IntentBinding } from "./primitives/nav/intent";

export type ShellKeyAction =
  | "interrupt"
  | "fold"
  | "search"
  | "scroll-bottom"
  | "scroll-top"
  | "page-up"
  | "page-down";

const SHELL_KEYS: readonly IntentBinding<ShellKeyAction>[] = [
  { chord: "escape", intent: "interrupt" },
  { chord: "ctrl+o", intent: "fold" },
  { chord: "ctrl+f", intent: "search" },
  { chord: "end", intent: "scroll-bottom" },
  { chord: "home", intent: "scroll-top" },
  { chord: "pageup", intent: "page-up" },
  { chord: "pagedown", intent: "page-down" },
];

/** Whether this action wants the key consumed rather than passed on to whatever is under it. */
export function consumesKey(action: ShellKeyAction): boolean {
  // Folding is the one that does not: ctrl+o is not typed text and nothing else claims it, so
  // preventing the default would only mask a future binding conflict rather than avoid one.
  return action !== "fold";
}

/**
 * The action for this key, or null when the shell wants nothing to do with it.
 *
 * `active` is false whenever something layered over the session owns the keyboard - the search card,
 * the rewind rail, the gate, or any full screen. It is one guard rather than a condition repeated per
 * case, because a binding that forgot the guard would fire underneath an open panel.
 */
export function shellKeyAction(event: KeyEvent, active: boolean): ShellKeyAction | null {
  if (!active) return null;
  return intentOf(event, SHELL_KEYS);
}
