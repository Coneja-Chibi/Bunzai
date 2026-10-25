/**
 * Compare takes (the Branching Tree's compare, ChatStore rules 6 and 12): two takes of one scene read side by side from the message
 * where they part. Read only: nothing is written. A take that is gone, or from another scene, is refused rather than shown as empty.
 */
import { describe, expect, test } from "bun:test";
import { memoryChatStore } from "../stage/store/chat-store";
import { compareTakes, COMPARE_ROWS } from "./scene-take-compare";

async function rig() {
  const chats = memoryChatStore();
  const chat = await chats.createChat({ title: "T", cast: { character: { id: "v", version: 1 } }, snapshot: { character: {} } } as never);
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Hello." }, { role: "user", content: "Hi." }, { role: "assistant", content: "The cold came." }]);
  const { messages } = await chats.readMessages(chat.activeBranchId, { limit: 50 });
  const take = (await chats.fork(chat.activeBranchId, messages[1]!.id, { name: "Take 2" }))!;
  await chats.appendMessages(take.id, [{ role: "assistant", content: "The warm came." }]);
  return { chats, chat, main: chat.activeBranchId, take: take.id };
}

describe("compareTakes", () => {
  test("shares what the takes have in common and lines up the rest by position", async () => {
    const r = await rig();
    const out = await compareTakes(r.chats, { chatId: r.chat.id, a: r.main, b: r.take });
    expect(out.shared).toBe(2);
    expect(out.a.name).toBe("main");
    expect(out.b.name).toBe("Take 2");
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]!.a?.text).toBe("The cold came.");
    expect(out.rows[0]!.b?.text).toBe("The warm came.");
    expect(out.rows[0]!.a?.role).toBe("assistant");
  });
  test("a take with more messages than the other leaves the other side empty, and the rows are bounded", async () => {
    const r = await rig();
    await r.chats.appendMessages(r.take, Array.from({ length: COMPARE_ROWS + 5 }, (_, i) => ({ role: "user" as const, content: `m${i}` })));
    const out = await compareTakes(r.chats, { chatId: r.chat.id, a: r.main, b: r.take });
    expect(out.rows).toHaveLength(COMPARE_ROWS);
    expect(out.rows[1]!.a).toBeNull();
    expect(out.truncated).toBe(true);
  });
  test("a take of another scene, a missing take, or the same take twice is refused", async () => {
    const r = await rig();
    const other = await r.chats.createChat({ title: "O", cast: { character: { id: "v", version: 1 } }, snapshot: { character: {} } } as never);
    await expect(compareTakes(r.chats, { chatId: r.chat.id, a: r.main, b: other.activeBranchId })).rejects.toThrow("take");
    await expect(compareTakes(r.chats, { chatId: r.chat.id, a: r.main, b: "nope" })).rejects.toThrow("take");
    await expect(compareTakes(r.chats, { chatId: r.chat.id, a: r.main, b: r.main })).rejects.toThrow("two different takes");
  });
});
