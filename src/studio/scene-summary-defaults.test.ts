/**
 * The summary settings a new scene starts with (rc-parity 08, follow-up 2; RoleCall's Defaults "Memory & Summaries", `quick-start-defaults.ts`): the person's saved defaults become the new
 * scene's own settings when it is started, and only then. A scene started before keeps what it has, and defaults that cannot be read as settings never stop a scene from starting.
 */
import { describe, expect, test } from "bun:test";
import { memoryChatStore } from "../stage/store/chat-store";
import type { SettingsStoreLike, StudioStoreLike } from "./contracts";
import { DEFAULT_SUMMARY_PREF, startScene } from "./scenes";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } };
const studio = { readVersioned: async (kind: string, id: string) => (kind === "character" && id === "vera" ? { entity: vera, version: 1 } : null) } as unknown as StudioStoreLike;
const settingsWith = (pref: unknown): SettingsStoreLike => ({ read: async () => (pref === undefined ? {} : { [DEFAULT_SUMMARY_PREF]: pref }) }) as unknown as SettingsStoreLike;

describe("startScene: summary defaults", () => {
  test("the saved defaults become the new scene's settings, stored with the scene", async () => {
    const chats = memoryChatStore();
    const chat = await startScene(chats, studio, settingsWith({ auto: true, interval: 40, include: false, method: "rolling", mode: "additive" }), "vera");
    expect(chat.summary?.settings).toEqual({ auto: true, interval: 40, include: false, method: "rolling", mode: "additive" });
    expect((await chats.getChat(chat.id))?.summary?.settings).toEqual({ auto: true, interval: 40, include: false, method: "rolling", mode: "additive" });
  });
  test("without defaults the scene carries no summary settings, as before", async () => {
    expect((await startScene(memoryChatStore(), studio, settingsWith(undefined), "vera")).summary).toBeUndefined();
    expect((await startScene(memoryChatStore(), studio, settingsWith({}), "vera")).summary).toBeUndefined();
  });
  test("defaults that are not valid summary settings are not applied, and the scene still starts", async () => {
    for (const bad of [{ interval: -5 }, { nonsense: true }, "auto", 7, [1]]) {
      const chat = await startScene(memoryChatStore(), studio, settingsWith(bad), "vera");
      expect(chat.summary).toBeUndefined();
      expect(chat.title).toBe("Vera");
    }
  });
  test("changing the defaults later does not touch a scene already started", async () => {
    const chats = memoryChatStore();
    const first = await startScene(chats, studio, settingsWith({ auto: true }), "vera");
    await startScene(chats, studio, settingsWith({ auto: false, interval: 10 }), "vera");
    expect((await chats.getChat(first.id))?.summary?.settings).toEqual({ auto: true });
  });
});
