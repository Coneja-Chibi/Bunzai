/** Portable, lossless-for-text scene export. The library remains unchanged. */
import type { ChatStore } from "../stage/contracts/chat-store";

const encoder = new TextEncoder();
const row = (value: unknown): Uint8Array => encoder.encode(`${JSON.stringify(value)}\n`);

/** A line-delimited JSON stream: scene metadata, frozen cast, each take, each message and its edits. */
export async function exportScene(chats: ChatStore, chatId: string): Promise<Response | null> {
  const chat = await chats.getChat(chatId);
  if (!chat) return null;
  const snapshot = await chats.castSnapshot(chatId);
  if (!snapshot) return null;
  const branches = await chats.listBranches(chatId);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(row({ type: "bunzai.scene/1", exportedAt: new Date().toISOString(), chat, snapshot }));
        for (const branch of branches) {
          controller.enqueue(row({ type: "take", branch }));
          let fromSeq: number | undefined;
          do {
            const page = await chats.readMessages(branch.id, { ...(fromSeq === undefined ? {} : { fromSeq }), limit: 100 });
            for (const message of page.messages) {
              const versions = [];
              for (const swipe of message.swipes) versions.push({
                swipeId: swipe.id,
                edits: await chats.swipeHistory(message.id, swipe.id),
                trace: await chats.swipeTrace(message.id, swipe.id),
              });
              controller.enqueue(row({ type: "message", message, versions }));
            }
            fromSeq = page.nextSeq ?? undefined;
          } while (fromSeq !== undefined);
        }
        controller.close();
      } catch (error) { controller.error(error); }
    },
  });
  const name = `bunzai-scene-${chatId.replace(/[^a-zA-Z0-9_-]/g, "_")}.jsonl`;
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
