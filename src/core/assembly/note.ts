/**
 * The scene note, RoleCall's author's note (`prompt-assembly.ts` sections "Author's Note Configuration"
 * and 10.6; panel `AuthorNotePanel.tsx`). Whether it rides this turn is decided from the
 * number of user messages, and where it lands from the position and depth. The wire text keeps RoleCall's
 * "[Author's Note: ...]" label.
 *
 * Two RoleCall quirks are kept on purpose, because prompts match RoleCall's. Depth counts every user and
 * assistant message in the whole request at this point, preset blocks included, and the note goes before
 * the one at index `total - depth - 1`, so depth 4 lands before the last FIVE (RoleCall's panel says
 * "before the last 4" and its code comment "before last 3"; the code is what is sent). A depth at or
 * past the total puts the note before the first such message.
 */
import type { ChatNote } from "../../stage/contracts/chat-settings-types";
import type { Block } from "./conversation";

/** The note's limits, one set for the store's check and the panel's controls: text length, depth 0 to this, frequency 0 to this. */
export const NOTE_MAX = 10_000;
export const NOTE_DEPTH_MAX = 10;
export const NOTE_FREQUENCY_MAX = 4;

/** What a scene without a saved note uses (the panel's defaults: in chat, depth 4, every turn). */
export const NOTE_DEFAULTS: ChatNote = { text: "", position: "in_chat", depth: 4, frequency: 1 };

/**
 * Whether the note rides this turn. `userMessages` counts the user messages before the one being
 * answered, hidden ones left out. The first eligible turn fires, then every Nth: frequency 2 fires on
 * turns 1, 3, 5 (SillyTavern's convention, which RoleCall's comment cites).
 */
export function noteDue(note: ChatNote | undefined, userMessages: number): note is ChatNote {
  return note !== undefined && note.text.trim().length > 0 && note.frequency > 0 && userMessages % note.frequency === 0;
}

const conversational = (b: Block): boolean => b.role === "user" || b.role === "assistant";

/** The request with the note's message placed, as RoleCall's section 10.6 does; `text` is already macro-expanded. */
export function placeNote(blocks: readonly Block[], text: string, note: ChatNote): Block[] {
  const out = [...blocks];
  const message: Block = { role: "system", content: `[Author's Note: ${text}]`, source: { kind: "note" } };
  if (note.position === "after_scenario") {
    let lead = 0;
    while (lead < out.length && out[lead]!.role === "system") lead++;
    out.splice(lead, 0, message);
    return out;
  }
  const chat = out.flatMap((b, i) => (conversational(b) ? [i] : []));
  const at = note.depth >= chat.length ? chat[0] ?? out.length : chat[chat.length - note.depth - 1]!;
  out.splice(at, 0, message);
  return out;
}
