/**
 * Continue on a scene's last reply, the pure half: when it is offered,
 * and which key presses ask for it and for Regenerate (RoleCall's Ctrl+Shift+C and Ctrl+Shift+R).
 */
import type { Message } from "../../../stage/contracts/chat-store";
import { isTypingTarget } from "../../_shared/typing-target";

/**
 * Offered on the take's last reply when nothing runs or is held, the scene has a connection, you are
 * looking at the version that would be extended (not a peeked one), and the reply can go in the prompt (a
 * hidden or empty one is refused by the turn loop, so the button is never offered for it). The model does
 * not matter: one that refuses a started reply gets a whole new reply instead (rule 13).
 */
export function canContinue(input: { reply: Message | null; busy: boolean; connected: boolean; held: boolean; peeking: boolean }): boolean {
  const { reply } = input;
  if (!reply || reply.hidden || !input.connected || input.busy || input.held || input.peeking) return false;
  return (reply.swipes[reply.current]?.content.trim() ?? "") !== "";
}

/** The key event fields the shortcut reads. */
export interface ContinueKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  repeat: boolean;
  isComposing?: boolean;
  target: unknown;
}


/** The composer's own box: the one field where the chords still fire, since they are never typed text. */
const inComposer = (target: unknown): boolean => {
  const closest = (target as { closest?: unknown } | null)?.closest;
  return typeof closest === "function" && (closest as (selector: string) => unknown).call(target, '[data-part="scene.composer"]') !== null;
};

/**
 * Ctrl+Shift+<letter> (Cmd on a Mac), once per press, never mid-composition. RoleCall's hook skips every field, so there
 * Ctrl+Shift+R in the composer is the browser's hard reload (rc-parity 03 F10); here the composer takes it, other fields do not.
 */
const chord = (e: ContinueKeyEvent, letter: string): boolean =>
  e.key.toLowerCase() === letter && (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && !e.repeat && e.isComposing !== true && (!isTypingTarget(e.target) || inComposer(e.target));

/** Ctrl+Shift+C continues the last reply. */
export const isContinueKey = (e: ContinueKeyEvent): boolean => chord(e, "c");
/** Ctrl+Shift+R regenerates it. */
export const isRegenerateKey = (e: ContinueKeyEvent): boolean => chord(e, "r");
