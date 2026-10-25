/** Playing as another persona and saving the scene's card (ChatStore rules 13 and 26), over the memory ChatStore. */
import { describe, expect, test } from "bun:test";
import type { Message } from "../stage/contracts/chat-store";
import { memoryChatStore } from "../stage/store/chat-store";
import { TURN_OPEN } from "../stage/store/cast-rules";
import type { SettingsStoreLike, StudioStoreLike } from "./contracts";
import { StudioNotFoundError, StudioValidationError } from "./errors";
import { personaSwaps } from "../core/persona-swaps";
import { changeScenePersona, personaStatsOf, saveSceneMember, setSceneVariant } from "./scene-cast";
import { createPass } from "../core/final-cut/pass";
import { sceneTail, sendToScene, startScene } from "./scenes";

const character = (name = "Vera") => ({
  kind: "character", id: "vera",
  body: { identity: { name }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
});
const persona = (id: string, name: string) => ({ kind: "persona", id, body: { name } });

/** A studio holding what the test puts in `library`; only what scenes read. */
function rig() {
  const library = new Map<string, { entity: unknown; version: number }>([
    ["character:vera", { entity: character(), version: 1 }],
    ["persona:nuit", { entity: persona("nuit", "Nuit"), version: 2 }],
    ["persona:corvin", { entity: persona("corvin", "Corvin"), version: 1 }],
  ]);
  const studio = {
    readVersioned: async (kind: string, id: string) => library.get(`${kind}:${id}`) ?? null,
    summary: async (kind: string, id: string) => (library.has(`${kind}:${id}`) ? { version: library.get(`${kind}:${id}`)!.version } : null),
  } as unknown as StudioStoreLike;
  const settings: SettingsStoreLike = { read: async () => ({ "persona.default": "nuit" }) } as unknown as SettingsStoreLike;
  return { chats: memoryChatStore(), studio, settings, library };
}

describe("sendToScene and the Final Cut safety check", () => {
  test("a message the safety check refuses is not saved", async () => {
    const { chats, studio, settings } = rig();
    const chat = await startScene(chats, studio, settings, "vera");
    await chats.setFinalCut(chat.id, { on: true, passes: [{ ...createPass("validator", 0), applyToUserMessages: true, failureMode: "block" }] });
    await expect(sendToScene(chats, studio, { chatId: chat.id, content: "no __FC_PROTECTED_1_CODE__", greetingIndex: 0, expectedVersion: 1 })).rejects.toThrow("Your message was not sent.");
    expect((await chats.readMessages((await chats.getChat(chat.id))!.activeBranchId, { limit: 10 })).messages).toHaveLength(0);
  });
});

describe("startScene and sendToScene stamp the persona", () => {
  test("a new scene's persona carries its name, and each message keeps the persona that wrote it", async () => {
    const { chats, studio, settings } = rig();
    const chat = await startScene(chats, studio, settings, "vera");
    expect(chat.cast.persona).toEqual({ id: "nuit", version: 2, name: "Nuit" });
    await sendToScene(chats, studio, { chatId: chat.id, content: "one", greetingIndex: 0, expectedVersion: 1 });
    await changeScenePersona(chats, studio, { chatId: chat.id, personaId: "corvin" });
    const scene = await sendToScene(chats, studio, { chatId: chat.id, content: "two", greetingIndex: 0, expectedVersion: 2 });
    expect(scene!.messages.filter((m) => m.role === "user").map((m) => m.persona)).toEqual([{ id: "nuit", name: "Nuit" }, { id: "corvin", name: "Corvin" }]);
    expect((await sceneTail(chats, chat.id, 5, studio))!.map((l) => l.speaker)).toEqual(["Nuit", "Corvin"]);
  });
});

describe("changeScenePersona", () => {
  test("plays this scene as another persona, or none, and leaves the default setting alone", async () => {
    const { chats, studio, settings } = rig();
    const chat = await startScene(chats, studio, settings, "vera");
    const swapped = await changeScenePersona(chats, studio, { chatId: chat.id, personaId: "corvin" });
    expect(swapped!.chat.cast.persona).toEqual({ id: "corvin", version: 1, name: "Corvin" });
    expect(swapped!.snapshot.persona).toMatchObject({ id: "corvin" });
    expect((await changeScenePersona(chats, studio, { chatId: chat.id, personaId: null }))!.chat.cast.persona).toBeUndefined();
    expect(((await settings.read()) as Record<string, unknown>)["persona.default"]).toBe("nuit");
  });

  test("a persona that is not in the Library is refused and the scene is unchanged; a gone scene is null", async () => {
    const { chats, studio, settings } = rig();
    const chat = await startScene(chats, studio, settings, "vera");
    await expect(changeScenePersona(chats, studio, { chatId: chat.id, personaId: "ghost" })).rejects.toBeInstanceOf(StudioNotFoundError);
    expect((await chats.getChat(chat.id))!.cast.persona!.id).toBe("nuit");
    expect(await changeScenePersona(chats, studio, { chatId: "gone", personaId: null })).toBeNull();
  });

  test("it is refused while a reply is open, and the scene is unchanged", async () => {
    const { chats, studio, settings } = rig();
    const chat = await startScene(chats, studio, settings, "vera");
    await chats.appendMessage(chat.activeBranchId, { role: "user", content: "hi" });
    await chats.beginTurn(chat.activeBranchId, { kind: "reply" });
    await expect(changeScenePersona(chats, studio, { chatId: chat.id, personaId: "corvin" })).rejects.toThrow(TURN_OPEN);
    expect((await chats.getChat(chat.id))!.cast.persona!.id).toBe("nuit");
  });
});

describe("saveSceneMember", () => {
  const saved = (version: number) => async () => ({ status: "saved" as const, revision: "r", summary: { id: "vera", kind: "character", name: "Vera II", version } as never });

  test("saves the card in the Library, then moves this scene onto it", async () => {
    const { chats, studio, settings, library } = rig();
    const chat = await startScene(chats, studio, settings, "vera");
    const result = await saveSceneMember(chats, studio, {
      chatId: chat.id, kind: "character",
      save: async () => { library.set("character:vera", { entity: character("Vera II"), version: 2 }); return saved(2)(); },
    });
    expect(result).toMatchObject({ status: "saved", applied: true });
    expect((await chats.getChat(chat.id))!.cast.character).toMatchObject({ version: 2, name: "Vera II" });
  });

  test("a stale save writes nothing and the scene stays where it was", async () => {
    const { chats, studio, settings } = rig();
    const chat = await startScene(chats, studio, settings, "vera");
    expect(await saveSceneMember(chats, studio, { chatId: chat.id, kind: "character", save: async () => ({ status: "stale" }) })).toEqual({ status: "stale" });
    expect((await chats.getChat(chat.id))!.snapshotVersion).toBe(chat.snapshotVersion);
  });

  test("a save is refused before it writes the Library while a reply is open", async () => {
    const { chats, studio, settings } = rig();
    const chat = await startScene(chats, studio, settings, "vera");
    await chats.appendMessage(chat.activeBranchId, { role: "user", content: "hi" });
    await chats.beginTurn(chat.activeBranchId, { kind: "reply" });
    let wrote = false;
    await expect(saveSceneMember(chats, studio, { chatId: chat.id, kind: "character", save: async () => { wrote = true; return saved(2)(); } })).rejects.toThrow(TURN_OPEN);
    expect(wrote).toBe(false);
  });

  test("when a reply opens after the Library saved, the scene is left alone and the result says so", async () => {
    const { chats, studio, settings, library } = rig();
    const chat = await startScene(chats, studio, settings, "vera");
    await chats.appendMessage(chat.activeBranchId, { role: "user", content: "hi" });
    const result = await saveSceneMember(chats, studio, {
      chatId: chat.id, kind: "character",
      save: async () => {
        library.set("character:vera", { entity: character(), version: 2 });
        await chats.beginTurn(chat.activeBranchId, { kind: "reply" });
        return saved(2)();
      },
    });
    expect(result).toMatchObject({ status: "saved", applied: false });
    expect((await chats.getChat(chat.id))!.cast.character.version).toBe(1);
  });

  test("a persona save moves the scene's persona to the saved version", async () => {
    const { chats, studio, settings, library } = rig();
    const chat = await startScene(chats, studio, settings, "vera");
    const result = await saveSceneMember(chats, studio, {
      chatId: chat.id, kind: "persona",
      save: async () => { library.set("persona:nuit", { entity: persona("nuit", "Nuit the Late"), version: 3 }); return saved(3)(); },
    });
    expect(result).toMatchObject({ applied: true });
    expect((await chats.getChat(chat.id))!.cast.persona).toEqual({ id: "nuit", version: 3, name: "Nuit the Late" });
  });
});

describe("personaSwaps", () => {
  const user = (id: string, who: Message["persona"], extra: Partial<Message> = {}): Message => ({ id, branchId: "b", seq: 1, role: "user", swipes: [], current: 0, createdAt: 0, ...(who === undefined ? {} : { persona: who }), ...extra });
  const N = { id: "nuit", name: "Nuit" };
  const C = { id: "corvin", name: "Corvin" };

  test("marks a user message whose persona differs from the previous user message's", () => {
    const marks = personaSwaps([user("a", N), { ...user("r", undefined), role: "assistant" }, user("b", N), user("c", C), user("d", null), user("e", N)]);
    expect([...marks]).toEqual([["c", "Corvin"], ["d", null], ["e", "Nuit"]]);
  });

  test("old unstamped messages and cut messages say nothing", () => {
    expect([...personaSwaps([user("a", undefined), user("b", N), user("x", C, { cut: { id: "k", at: 1 } }), user("c", N)])]).toEqual([]);
    expect([...personaSwaps([user("a", N), user("legacy", undefined), user("b", C)])]).toEqual([["b", "Corvin"]]);
  });
});

describe("setSceneVariant and personaStatsOf", () => {
  const withVariant = () => {
    const r = rig();
    r.library.set("character:vera", { entity: { ...character(), body: { ...character().body, variants: [{ id: "storm", label: "Storm", overrides: {} }] } }, version: 1 });
    return r;
  };

  test("plays the scene as a look its card carries, or the base with null; any other id is refused", async () => {
    const { chats, studio, settings } = withVariant();
    const chat = await startScene(chats, studio, settings, "vera");
    expect((await setSceneVariant(chats, studio, { chatId: chat.id, variantId: "storm" }))!.chat.variantId).toBe("storm");
    await expect(setSceneVariant(chats, studio, { chatId: chat.id, variantId: "nope" })).rejects.toBeInstanceOf(StudioValidationError);
    expect((await chats.getChat(chat.id))!.variantId).toBe("storm");
    expect((await setSceneVariant(chats, studio, { chatId: chat.id, variantId: null }))!.chat.variantId).toBeUndefined();
    expect(await setSceneVariant(chats, studio, { chatId: "gone", variantId: null })).toBeNull();
  });

  test("reads a persona's counters, and starts the background count of older scenes once", async () => {
    const { chats, studio, settings } = rig();
    const a = await startScene(chats, studio, settings, "vera");
    await startScene(chats, studio, settings, "vera");
    let backfills = 0;
    const real = chats.backfillPersonaStats.bind(chats);
    chats.backfillPersonaStats = async (pause) => { backfills += 1; return real(pause); };
    expect((await personaStatsOf(chats, "nuit")).scenes).toBe(2);
    await changeScenePersona(chats, studio, { chatId: a.id, personaId: "corvin" });
    expect([(await personaStatsOf(chats, "nuit")).scenes, (await personaStatsOf(chats, "corvin")).scenes]).toEqual([1, 1]);
    expect(backfills).toBe(1);
    await chats.deleteChat(a.id);
    expect((await personaStatsOf(chats, "corvin")).scenes).toBe(0);
  });
});
