/** Terminal conversation commands over the same reusable core, scene writes and checkpoints as desktop. */
import type { RoleplayCore, ChatStore, TurnEvent } from "./rp-core";
import type { StudioStoreLike } from "./studio/contracts";
import { sendToScene } from "./studio/scenes";
import { StudioNotFoundError } from "./studio/errors";

export interface RoleplayTerminal {
  core: RoleplayCore;
  chats: ChatStore;
  studio: StudioStoreLike;
  chatId: string;
  lines: AsyncIterable<string>;
  write(text: string): void;
  active(turnId: string | null): void;
}

export async function runRoleplaySession(io: RoleplayTerminal): Promise<void> {
  const { core, chats, chatId } = io;
  await core.resume(chatId);
  for await (const line of io.lines) {
    const text = line.trim();
    if (!text) continue;
    if (text === "/quit") break;
    if (text === "/help") { io.write("Type a message, /continue, /swipe, or /quit. Ctrl+C stops the current turn.\n"); continue; }
    if (text.startsWith("/") && text !== "/continue" && text !== "/swipe") { io.write("Unknown command. Use /help.\n"); continue; }
    const chat = await chats.getChat(chatId);
    if (!chat) throw new StudioNotFoundError("that scene is gone");
    const version = async () => (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    const kind = text === "/continue" ? "continue" : text === "/swipe" ? "swipe" : "reply";
    if (kind === "reply") await sendToScene(chats, io.studio, { chatId, content: line, greetingIndex: 0, expectedVersion: await version() });
    let shown = false;
    const emit = (event: TurnEvent) => {
      if (event.type === "start") io.active(event.turnId);
      if (event.type === "text") { shown = true; io.write(event.full ? `\n${event.delta}` : event.delta); }
      if ((event.type === "done" || event.type === "stopped") && event.message && !shown) io.write(event.message.swipes[event.message.current]!.content);
      if (event.type === "failed") io.write(`\n${event.message}\n`);
      if (event.type === "conflict") io.write(`\nThe scene changed. Reply ${event.turnId} is waiting for recovery in the Studio.\n`);
      if (event.type === "regex") queueMicrotask(() => core.answerRegex(chatId, event.turnId, { kind: "failed", error: "The terminal has no isolated regex worker. Open this scene in the Studio to run its enabled regex sets." }));
      if (event.type === "review") queueMicrotask(() => core.answerReview(chatId, event.turnId, { kind: "cancel" }));
    };
    try { await core.runTurn({ chatId, kind, expectedVersion: await version() }, emit); }
    finally { io.active(null); io.write("\n"); }
  }
}
