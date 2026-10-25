/**
 * What a scene does with a reply that did not finish (turn-loop rules 4 and 13; split from scene-turn.ts for the file-size cap): "add it at
 * the end" and "discard" for a reply held by a conflict, and the sweep that keeps what arrived of a turn a crash left behind.
 */
import type { ChatStore, Message } from "../stage/contracts/chat-store";
import { StudioConflictError } from "./atomic-file";
import { running } from "./scene-turn-running";

/** A scene's waiting turn, never one still streaming. */
async function waiting(chats: ChatStore, chatId: string, turnId: string) {
  if (running.has(turnId)) return undefined;
  return (await chats.resumeIncomplete()).find((c) => c.id === turnId && c.chatId === chatId);
}

/** "Add it at the end": commits a conflicted turn's saved text unguarded, at the end of the take. */
export async function commitAnyway(chats: ChatStore, chatId: string, turnId: string): Promise<Message | null> {
  const open = await waiting(chats, chatId, turnId);
  if (!open) return null;
  return chats.commitTurn(turnId, { content: open.content, ...(open.trace ? { trace: open.trace } : {}) });
}

/** "Discard": drops a conflicted turn's waiting text. */
export async function discardWaiting(chats: ChatStore, chatId: string, turnId: string): Promise<boolean> {
  return (await waiting(chats, chatId, turnId)) ? chats.dropTurn(turnId) : false;
}

/**
 * A crash keeps what arrived (turn-loop rule 4): run when a scene opens. Each checkpoint of this
 * scene no turn in this process owns is committed with finish reason `interrupted`, guarded by the
 * version it began from, and unguarded on a conflict (it belongs to the scene either way); an empty
 * one, or one whose message is gone, is dropped. A continue that finds the version moved is dropped
 * too: its text was written to continue a reply that has since been edited or swapped, and is never
 * applied to the new text unasked (turn-loop rule 13).
 */
export async function resumeScene(chats: ChatStore, chatId: string): Promise<number> {
  let kept = 0;
  for (const c of await chats.resumeIncomplete()) {
    if (c.chatId !== chatId || running.has(c.id)) continue;
    if (!c.content) {
      await chats.dropTurn(c.id);
      continue;
    }
    const result = { content: c.content, generation: { finishReason: "interrupted" }, ...(c.trace ? { trace: c.trace } : {}) };
    let message: Message | null;
    try {
      message = await chats.commitTurn(c.id, result, { expectedVersion: c.baseVersion });
    } catch (error) {
      if (!(error instanceof StudioConflictError)) throw error;
      if (c.kind === "continue") {
        await chats.dropTurn(c.id);
        continue;
      }
      message = await chats.commitTurn(c.id, result);
    }
    if (message) kept++;
    else await chats.dropTurn(c.id);
  }
  return kept;
}
