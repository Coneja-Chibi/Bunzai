/**
 * Carrying a run's answers to the open scene (loadout-patch.ts): each setter answers the whole chat as the store then held it,
 * so the last one run wins; the persona answer is the whole scene; lore and props answer their own shapes, not a chat.
 */
import { describe, expect, test } from "bun:test";
import type { Chat } from "../../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../../studio/scenes";
import { patchScene } from "./loadout-patch";

const chat = (over: Partial<Chat> = {}): Chat => ({ id: "c1", title: "T", ...over }) as Chat;
const scene = (c: Chat, messageCount = 3): OpenScene => ({ chat: c, messages: [], messageCount }) as unknown as OpenScene;

describe("patching the open scene", () => {
  test("the last chat answer in run order wins, and the messages stay", () => {
    const start = scene(chat());
    const next = patchScene(start, { connection: chat({ title: "A" }), note: chat({ title: "B" }) }, ["connection", "note"]);
    expect(next.chat.title).toBe("B");
    expect(next.messageCount).toBe(3);
  });
  test("lore and props answers are not chats and are ignored", () => {
    const start = scene(chat({ title: "keep" }));
    expect(patchScene(start, { lore: { books: [] }, props: { on: ["x"] } }, ["lore", "props"])).toBe(start);
  });
  test("the persona answer replaces the scene, and a chat answer after it (Undo runs in reverse) is laid over it", () => {
    const start = scene(chat());
    const replaced = scene(chat({ title: "persona" }), 9);
    expect(patchScene(start, { persona: replaced }, ["persona"])).toBe(replaced);
    const next = patchScene(start, { persona: replaced, note: chat({ title: "later" }) }, ["persona", "note"]);
    expect(next.messageCount).toBe(9);
    expect(next.chat.title).toBe("later");
  });
  test("no answers leaves the scene as it was", () => {
    const start = scene(chat());
    expect(patchScene(start, {}, ["connection"])).toBe(start);
  });
});
