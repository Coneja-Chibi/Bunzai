/**
 * Editing the opening message before the first send (RoleCall handleSaveEdit "first-" branch,
 * useChatMessageHandlers.ts:2266-2306): the edit is scoped to the greeting being edited and an empty
 * save is ignored. Like RoleCall's first_message_override it is kept on the scene (ChatStore rule 34,
 * `chat.opening`) so it survives a reload, and the first send saves it as message 1. The editor opens on
 * the raw greeting, macros unexpanded, as RoleCall's does.
 */
import { useCallback, useState } from "react";
import type { ChatOpening } from "../../../stage/contracts/chat-store";

export interface GreetingDraft {
  /** The greeting as it will be saved: the person's edit of it, or the card's text. */
  raw: string;
  /** The edit box's text while open (for this greeting only), otherwise undefined. */
  editing: string | undefined;
  start(): void;
  change(id: string, text: string): void;
  save(): void;
  cancel(): void;
}

/** The opening to keep after greeting `index` is edited to `text`: null when the edit is empty (ignored, as RoleCall ignores it); `{ opening: null }` when no edit is left, as saving the card's own text is no edit at all. */
export function openingAfterEdit(greetings: string[], saved: ChatOpening | undefined, index: number, text: string): { opening: ChatOpening | null } | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const others = (saved?.edits ?? []).filter((e) => e.index !== index);
  const edits = (trimmed === greetings[index] ? others : [...others, { index, text: trimmed }]).sort((a, b) => a.index - b.index);
  return { opening: edits.length > 0 ? { edits } : null };
}

/** The greeting as it will be saved: the person's edit of it, or the card's text. */
export const greetingText = (greetings: string[], saved: ChatOpening | undefined, index: number): string => saved?.edits.find((e) => e.index === index)?.text ?? greetings[index] ?? "";

export function useGreetingDraft(greetings: string[], index: number, saved: ChatOpening | undefined, keep: (opening: ChatOpening | null) => void): GreetingDraft {
  const [edit, setEdit] = useState<{ index: number; text: string } | null>(null);
  const raw = greetingText(greetings, saved, index);
  const start = useCallback(() => setEdit({ index, text: raw }), [index, raw]);
  const change = useCallback((_id: string, text: string) => setEdit({ index, text }), [index]);
  const cancel = useCallback(() => setEdit(null), []);
  const save = useCallback(() => {
    if (!edit) return;
    const next = openingAfterEdit(greetings, saved, edit.index, edit.text);
    if (!next) return; // RoleCall ignores an empty save and keeps the box open
    keep(next.opening);
    setEdit(null);
  }, [edit, greetings, saved, keep]);
  return { raw, editing: edit?.index === index ? edit.text : undefined, start, change, save, cancel };
}
