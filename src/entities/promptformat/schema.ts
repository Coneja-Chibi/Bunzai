/** Canonical prompt-format piece: how a text-completion model wants its prompt written out. */
import type { CanonicalEntity } from "../../core/canonical";

/**
 * CanonicalPromptFormat - SillyTavern's instruct template (the sequences that wrap each turn: input,
 * output, system, stop strings, names behavior) and context template (the story string that lays out
 * the card, the example separator, the chat start), as ONE piece. ST binds them by name, so a
 * same-named instruct and context are one format, and either half may be absent.
 *
 * NOTHING USES IT YET. Bunzai talks to chat-completion connections only, which take role-tagged
 * messages and need no hand-written turn markers. A prompt format is for text-completion
 * connections, which Bunzai does not have, so no assembler or request builder reads this piece.
 * It is kept whole so the files are not lost and the day that connection exists has its data.
 *
 * Each half keeps ST's own field names and every value ST wrote, with nothing renamed or dropped, so
 * export writes the files back. The name lives on the body, not in the halves.
 */

/** One half as ST writes it: its own keys, scalar values only. */
export type PromptFormatPart = Record<string, string | number | boolean>;

export interface PromptFormatBody {
  name: string;
  /** SillyTavern instruct template (input_sequence, output_sequence, stop_sequence, ...). */
  instruct?: PromptFormatPart;
  /** SillyTavern context template (story_string, example_separator, chat_start, ...). */
  context?: PromptFormatPart;
  /** The author's own notes. */
  notes?: string;
}

export type CanonicalPromptFormat = CanonicalEntity<"promptformat", PromptFormatBody>;

/** A new, empty format. */
export const emptyPromptFormatBody = (name: string): PromptFormatBody => ({ name });
