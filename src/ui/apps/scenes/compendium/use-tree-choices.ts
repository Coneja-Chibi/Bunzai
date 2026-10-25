/**
 * A book's saved tree choices (Lock, Forbid, Reorganize and Move, ChatStore rule 38) and the edits to them, written through the
 * scene's one Compendium writer so a quick second click is never overtaken by a slow first. Each edit starts from what the scene
 * holds now (the list is replaced whole), says what it did in RoleCall's words, and a refusal is said in the status line.
 */
import type { AppContext } from "../../../app-contract";
import type { Chat, ChatCompendiumTreeConstraints } from "../../../../stage/contracts/chat-store";
import { clearConstraints, setConstraint, setPin, type ConstraintKind } from "../../../../core/compendium";
import { toErrorMessage } from "../../../_shared/error-message";
import { useSceneCompendium } from "../use-scene-compendium";

export interface TreeChoices {
  constraints: ChatCompendiumTreeConstraints | undefined;
  toggle(kind: ConstraintKind, id: string, label: string, on: boolean): Promise<void>;
  pin(entryId: string, entryLabel: string, targetId: string, targetLabel: string): Promise<void>;
  clear(id: string): Promise<void>;
}

const SAID: Record<ConstraintKind, readonly [on: string, off: string]> = {
  locked: ['"{x}" locked.', '"{x}" unlocked.'],
  forbidden: ['"{x}" forbidden from rebuild.', '"{x}" allowed in rebuild.'],
  reorganize: ['Reorganize flag set on "{x}". Press Repair tree from entries to apply it; it is a one-shot that clears after the rebuild.', 'Reorganize flag cleared on "{x}".'],
};

export function useTreeChoices(ctx: AppContext, chat: Chat, onChat: (chat: Chat) => void, bookId: string): TreeChoices {
  const compendium = useSceneCompendium(ctx, chat, onChat);
  const constraints = chat.compendium?.books?.[bookId]?.tree;
  const write = async (next: ChatCompendiumTreeConstraints | null, said: string): Promise<void> => {
    try {
      await compendium.patch({ books: { [bookId]: { tree: next } } });
      ctx.setStatus(said);
    } catch (e) {
      ctx.setStatus(`Could not save the tree choice: ${toErrorMessage(e, "the scene refused it")}`);
    }
  };
  return {
    constraints,
    toggle: (kind, id, label, on) => write(setConstraint(constraints, kind, id, on), SAID[kind][on ? 0 : 1].replace("{x}", label)),
    pin: (entryId, entryLabel, targetId, targetLabel) => write(setPin(constraints, entryId, targetId), `"${entryLabel}" moved under "${targetLabel}".`),
    clear: (id) => write(clearConstraints(constraints, id), "Constraints cleared."),
  };
}
