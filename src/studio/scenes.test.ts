/**
 * Scenes: takeCount on the Scenes list summary and sceneTail, the preview panel's read. Modeled on scene-turn.test.ts's rig: memoryChatStore directly,
 * no server.
 */
import { describe, expect, test } from "bun:test";
import type { ChatStore } from "../stage/contracts/chat-store";
import type { SettingsStoreLike, StudioStoreLike } from "./contracts";
import { memoryChatStore } from "../stage/store/chat-store";
import { listScenes, openScene, sceneTail, startScene } from "./scenes";

const vera = {
  kind: "character",
  id: "vera",
  body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
};
const CAST = { character: { id: "vera", version: 1, name: "Vera" }, persona: { id: "chi", version: 1 } };
const SNAP = { character: vera, persona: { kind: "persona", id: "chi", body: { name: "Chi" } } };

describe("listScenes: takeCount", () => {
  test("counts the scene's live takes (branches)", async () => {
    const chats = memoryChatStore();
    const chat = await chats.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    const [m] = (await chats.appendMessages(chat.activeBranchId, [{ role: "user", content: "hi" }]))!;
    expect((await listScenes(chats))[0]!.takeCount).toBe(1);
    const take = await chats.fork(chat.activeBranchId, m!.id, { name: "Take 2" });
    expect((await listScenes(chats))[0]!.takeCount).toBe(2);
    await chats.deleteBranch(take!.id);
    expect((await listScenes(chats))[0]!.takeCount).toBe(1);
  });
});

describe("listScenes: activeTake", () => {
  test("the original take reads original:true, on the main branch's own name", async () => {
    const chats = memoryChatStore();
    await chats.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    expect((await listScenes(chats))[0]!.activeTake).toEqual({ name: "main", original: true });
  });

  test("switching to a fork reads original:false, with the take's own name", async () => {
    const chats = memoryChatStore();
    const chat = await chats.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    const [m] = (await chats.appendMessages(chat.activeBranchId, [{ role: "user", content: "hi" }]))!;
    const take = await chats.fork(chat.activeBranchId, m!.id, { name: "Take 2" });
    await chats.setActiveBranch(chat.id, take!.id);
    expect((await listScenes(chats))[0]!.activeTake).toEqual({ name: "Take 2", original: false });
  });
});

describe("listScenes: hasPortrait", () => {
  test("a frozen scene reports the art its snapshot holds, not the cast flag it was created with", async () => {
    const chats = memoryChatStore();
    await chats.createChat({ title: "T", cast: { ...CAST, character: { ...CAST.character, hasArt: true } }, snapshot: SNAP });
    expect((await listScenes(chats))[0]!.hasPortrait).toBe(false);
  });
});

describe("listScenes: accent", () => {
  test("reads the accent straight off the cast reference, never the frozen snapshot", async () => {
    const chats = memoryChatStore();
    await chats.createChat({ title: "T", cast: { ...CAST, character: { ...CAST.character, accent: "#ff00aa" } }, snapshot: SNAP });
    expect((await listScenes(chats))[0]!.accent).toBe("#ff00aa");
  });

  test("absent when the cast reference carries none", async () => {
    const chats = memoryChatStore();
    await chats.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    expect((await listScenes(chats))[0]!.accent).toBeUndefined();
  });

  test("never opens the frozen snapshot to answer it (the 0.26s -> 1.17s regression this replaced)", async () => {
    const chats = memoryChatStore();
    await chats.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    let castSnapshotCalls = 0;
    const counting: ChatStore = new Proxy(chats, {
      get(target, prop, receiver) {
        if (prop === "castSnapshot") return (...args: Parameters<ChatStore["castSnapshot"]>) => { castSnapshotCalls++; return Reflect.get(target, prop, receiver).apply(target, args); };
        return Reflect.get(target, prop, receiver);
      },
    });
    await listScenes(counting);
    expect(castSnapshotCalls).toBe(0);
  });
});

describe("startScene: accent", () => {
  const signed = { ...vera, body: { ...vera.body, presentation: { signatureColor: "#ff00aa" } } };
  const studio: StudioStoreLike = {
    readVersioned: async (kind: string, id: string) => (kind === "character" && id === "vera" ? { entity: signed, version: 3 } : null),
  } as unknown as StudioStoreLike;
  const settings: SettingsStoreLike = { read: async () => ({}) } as unknown as SettingsStoreLike;

  test("records the card's signature color on the cast reference at scene creation", async () => {
    const chats = memoryChatStore();
    const chat = await startScene(chats, studio, settings, "vera");
    expect(chat.cast.character.accent).toBe("#ff00aa");
    // And listScenes reads that same value straight back, with no further lookup.
    expect((await listScenes(chats))[0]!.accent).toBe("#ff00aa");
  });

  test("a card carrying both a solid signature and a gradient takes the gradient's first stop, which is what the Cast editor writes", async () => {
    const both = { ...vera, body: { ...vera.body, presentation: { signatureColor: "#ff00aa", gradientColors: ["#008080", "#ffffff"] } } };
    const chat = await startScene(memoryChatStore(), { readVersioned: async () => ({ entity: both, version: 3 }) } as unknown as StudioStoreLike, settings, "vera");
    expect(chat.cast.character.accent).toBe("#008080");
  });
});

describe("sceneTail", () => {
  async function scene(n = 8) {
    const chats = memoryChatStore();
    const chat = await chats.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    for (let i = 0; i < n; i++) {
      await chats.appendMessage(chat.activeBranchId, { role: i % 2 === 0 ? "user" : "assistant", content: `line ${i}` });
    }
    return { chats, chat };
  }

  test("null for a missing chat", async () => {
    const chats = memoryChatStore();
    expect(await sceneTail(chats, "nope", 3)).toBeNull();
  });

  test("the persona speaks a user line, the character everything else, oldest first", async () => {
    const { chats, chat } = await scene(4);
    const tail = await sceneTail(chats, chat.id, 4);
    expect(tail!.map((m) => [m.role, m.speaker, m.text])).toEqual([
      ["user", "Chi", "line 0"],
      ["assistant", "Vera", "line 1"],
      ["user", "Chi", "line 2"],
      ["assistant", "Vera", "line 3"],
    ]);
  });

  test("clamps n to 1..5: a huge n answers at most 5, the most recent; a non-positive n answers 1", async () => {
    const { chats, chat } = await scene(8);
    const big = await sceneTail(chats, chat.id, 999);
    expect(big).toHaveLength(5);
    expect(big!.map((m) => m.text)).toEqual(["line 3", "line 4", "line 5", "line 6", "line 7"]);
    expect((await sceneTail(chats, chat.id, 0))!).toHaveLength(1);
    expect((await sceneTail(chats, chat.id, -3))!).toHaveLength(1);
    expect((await sceneTail(chats, chat.id, Number.NaN))!).toHaveLength(1);
  });

  test("cut messages are excluded", async () => {
    const { chats, chat } = await scene(4);
    const page = await chats.readMessages(chat.activeBranchId, { limit: 10 });
    await chats.cutMessages(chat.activeBranchId, page.messages[2]!.id, "one");
    const tail = await sceneTail(chats, chat.id, 4);
    expect(tail!.map((m) => m.text)).toEqual(["line 0", "line 1", "line 3"]);
  });

  test("text is cut to 600 characters", async () => {
    const chats = memoryChatStore();
    const chat = await chats.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    await chats.appendMessage(chat.activeBranchId, { role: "user", content: "x".repeat(900) });
    const tail = await sceneTail(chats, chat.id, 1);
    expect(tail![0]!.text).toHaveLength(600);
  });
});

describe("a scene whose character was deleted before it ever froze one (snapshot version 0)", () => {
  /** The store as a pre-migration-22 row reads: version 0, no frozen parts. No current code path creates one. */
  async function legacy() {
    const chats = memoryChatStore();
    const chat = await chats.createChat({ title: "T", cast: CAST, snapshot: SNAP });
    await chats.appendMessage(chat.activeBranchId, { role: "user", content: "hi" });
    const v0: ChatStore = new Proxy(chats, {
      get(target, prop, receiver) {
        if (prop === "getChat") return async (id: string) => { const c = await target.getChat(id); return c && { ...c, snapshotVersion: 0 }; };
        if (prop === "listChats") return async () => { const l = await target.listChats(); return { ...l, chats: l.chats.map((c) => ({ ...c, snapshotVersion: 0 })) }; };
        if (prop === "castSnapshotVersioned" || prop === "lightCastSnapshot") return async () => null;
        return Reflect.get(target, prop, receiver);
      },
    });
    return { chats: v0, chat };
  }
  const gone = { read: async () => null, summary: async () => null } as unknown as StudioStoreLike;
  const there = { read: async () => vera, summary: async () => ({ id: "vera" }) } as unknown as StudioStoreLike;

  test("open and tail say why, with the stable code cast_missing, instead of a bare null", async () => {
    const { chats, chat } = await legacy();
    const opened = await openScene(chats, gone, chat.id).then(() => null, (e: unknown) => e);
    const tailed = await sceneTail(chats, chat.id, 2, gone).then(() => null, (e: unknown) => e);
    for (const e of [opened, tailed]) expect((e as { code?: string } | null)?.code).toBe("cast_missing");
  });

  test("a chat that does not exist is still a plain null, not cast_missing", async () => {
    const { chats } = await legacy();
    expect(await openScene(chats, gone, "nope")).toBeNull();
  });

  test("the list marks the scene unreadable only while its card is gone", async () => {
    const { chats } = await legacy();
    expect((await listScenes(chats, gone))[0]!.castMissing).toBe(true);
    expect((await listScenes(chats, there))[0]!.castMissing).toBeUndefined();
    expect((await listScenes(chats))[0]!.castMissing).toBeUndefined();
  });
});
