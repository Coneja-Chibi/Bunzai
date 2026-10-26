/**
 * The header's dim topic line (shell.html `.topic`): the character, the message count and what is on, from counts the page already holds. A part with no readable source is left out
 * rather than guessed: the Story Director's arc is not readable here, only whether the Prop is on. Pure.
 */
import { plural } from "../../../../../core/text";

export interface TopicFacts {
  characterName: string;
  messages: number;
  /** Lorebooks the scene reads, or null while that is not known yet. */
  lorebooksOn: number | null;
  directorOn: boolean;
}

export function topicLine(f: TopicFacts): string {
  return [
    f.characterName,
    plural(f.messages, "message", "messages"),
    ...(f.lorebooksOn !== null && f.lorebooksOn > 0 ? [`${plural(f.lorebooksOn, "lorebook", "lorebooks")} on`] : []),
    ...(f.directorOn ? ["Story Director on"] : []),
  ].join(" · ");
}
