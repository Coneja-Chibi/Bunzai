/** Editing the opening message before the first send: kept on the scene per greeting (ChatStore rule 34, RoleCall first_message_override), used by the first send. */
import { describe, expect, test } from "bun:test";
import { memoryChatStore } from "../stage/store/chat-store";
import type { SettingsStoreLike, StudioStoreLike } from "./contracts";
import { StudioValidationError } from "./errors";
import { setSceneOpening } from "./scene-cast";
import { openScene, sendToScene, startScene } from "./scenes";

const vera = {
  kind: "character", id: "vera",
  body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: { firstMessage: "First hello.", alternateGreetings: [{ text: "Second hello." }] }, examples: {}, media: {}, attribution: {}, discovery: {} },
};

function rig() {
  const studio = {
    readVersioned: async (kind: string, id: string) => (kind === "character" && id === "vera" ? { entity: vera, version: 1 } : null),
    summary: async () => ({ version: 1 }),
  } as unknown as StudioStoreLike;
  const settings = { read: async () => ({}) } as unknown as SettingsStoreLike;
  return { chats: memoryChatStore(), studio, settings };
}

const texts = (scene: Awaited<ReturnType<typeof sendToScene>>): string[] => scene!.messages.map((m) => m.swipes[m.current]!.content);

describe("the edited opening message", () => {
  test("it is kept on the scene, per greeting, and a fresh read of the scene still has it", async () => {
    const { chats, studio, settings } = rig();
    const chat = await startScene(chats, studio, settings, "vera");
    const saved = await setSceneOpening(chats, studio, { chatId: chat.id, opening: { edits: [{ index: 1, text: "  My own opening.  " }] } });
    expect(saved!.chat.opening).toEqual({ edits: [{ index: 1, text: "My own opening." }] });
    expect((await openScene(chats, studio, chat.id))!.chat.opening).toEqual({ edits: [{ index: 1, text: "My own opening." }] });
    expect((await setSceneOpening(chats, studio, { chatId: chat.id, opening: null }))!.chat.opening).toBeUndefined();
  });

  test("the first send saves the edit of the chosen greeting as message 1, another greeting stays as the card has it, and the card is untouched", async () => {
    const { chats, studio, settings } = rig();
    const a = await startScene(chats, studio, settings, "vera");
    await setSceneOpening(chats, studio, { chatId: a.id, opening: { edits: [{ index: 1, text: "My own opening." }] } });
    expect(texts(await sendToScene(chats, studio, { chatId: a.id, content: "hi", greetingIndex: 1, expectedVersion: 1 }))).toEqual(["My own opening.", "hi"]);
    const b = await startScene(chats, studio, settings, "vera");
    await setSceneOpening(chats, studio, { chatId: b.id, opening: { edits: [{ index: 1, text: "My own opening." }] } });
    expect(texts(await sendToScene(chats, studio, { chatId: b.id, content: "hi", greetingIndex: 0, expectedVersion: 1 }))).toEqual(["First hello.", "hi"]);
    expect(vera.body.greetings.alternateGreetings[0]!.text).toBe("Second hello.");
  });

  test("a blank edit, a malformed one and one for a greeting the card does not have are refused and nothing is kept", async () => {
    const { chats, studio, settings } = rig();
    const chat = await startScene(chats, studio, settings, "vera");
    for (const opening of [{ edits: [{ index: 0, text: "   " }] }, { edits: [{ index: 2, text: "x" }] }, { edits: "x" }]) {
      await expect(setSceneOpening(chats, studio, { chatId: chat.id, opening: opening as never })).rejects.toBeInstanceOf(StudioValidationError);
    }
    expect((await openScene(chats, studio, chat.id))!.chat.opening).toBeUndefined();
    expect(await setSceneOpening(chats, studio, { chatId: "nope", opening: null })).toBeNull();
  });
});
