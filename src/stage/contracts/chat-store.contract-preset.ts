/**
 * The ChatStore contract suite's preset half: the library preset a
 * scene follows, its own on/off toggles over the preset's blocks, and its sampler overrides over the
 * preset's own values. Split from chat-store.contract-turns.ts for the file-size cap.
 * chatStoreContract runs it, so every implementation gets it.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { CAST, SNAP, chatRig } from "./chat-store.contract-rig";

export function chatStorePresetContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;

  describe("the scene's preset (rule 19)", () => {
    const PICK = { id: "preset-1", toggles: { intro: true, outro: false }, samplers: { temperature: 0.8, maxTokens: 512 } };

    test("a new chat has none; setPreset sets, replaces, and clears it, bumping no version and moving no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      expect(chat.preset).toBeUndefined();
      const before = await version(store, main);
      setNow(8_000);
      expect(await store.setPreset(chat.id, PICK)).toEqual({ ...chat, preset: PICK });
      expect((await store.getChat(chat.id))!.preset).toEqual(PICK);
      expect((await store.listChats()).chats.map((c) => c.preset)).toEqual([PICK]);
      const other = { id: "preset-2", toggles: { epilogue: true }, samplers: {} };
      expect((await store.setPreset(chat.id, other))!.preset).toEqual(other);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
      expect(await store.setPreset(chat.id, null)).toEqual(chat);
      expect("preset" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("it is the chat's, so forks, recasts, and appends leave it alone", async () => {
      const { store, chat, main, ids } = await seeded(2);
      await store.setPreset(chat.id, PICK);
      await store.fork(main, ids[0]!);
      await store.appendMessage(main, { role: "user", content: "more" });
      await store.renameChat(chat.id, "Renamed");
      await store.setCast(chat.id, { cast: { ...CAST, character: { ...CAST.character, version: 5 } }, snapshot: SNAP });
      expect((await store.getChat(chat.id))!.preset).toEqual(PICK);
      expect((await store.revertCast(chat.id))!.preset).toEqual(PICK);
    });

    test("an absent or deleted chat takes none; a restored one keeps what it had", async () => {
      const { store, chat } = await seeded(1);
      await store.setPreset(chat.id, PICK);
      expect(await store.setPreset("nope", PICK)).toBeNull();
      await store.deleteChat(chat.id);
      expect(await store.setPreset(chat.id, null)).toBeNull();
      expect((await store.chatGraveyard()).chats[0]!.preset).toEqual(PICK);
      expect((await store.restoreChat(chat.id))!.preset).toEqual(PICK);
    });

    test("switching to a different preset id replaces the toggles and samplers with what the caller passes", async () => {
      const { store, chat } = await seeded(1);
      await store.setPreset(chat.id, PICK);
      const swapped = { id: "preset-2", toggles: { epilogue: true }, samplers: { topP: 0.5 } };
      expect((await store.setPreset(chat.id, swapped))!.preset).toEqual(swapped);
    });

    test("a name that is also an Object property is a plain toggle name", async () => {
      const { store, chat } = await seeded(1);
      const toggles = JSON.parse('{"__proto__": true, "constructor": false}');
      const saved = await store.setPreset(chat.id, { id: "p", toggles, samplers: {} });
      expect(Object.keys(saved!.preset!.toggles).sort()).toEqual(["__proto__", "constructor"]);
      expect(Object.getPrototypeOf(saved!.preset!.toggles)).toBe(Object.prototype);
      expect(saved!.preset!.toggles["constructor"]).toBe(false);
      expect(Object.getOwnPropertyDescriptor(saved!.preset!.toggles, "__proto__")!.value).toBe(true);
    });

    test("anything but a non-empty id, a toggles object of non-empty keys and true or false, and known samplers, is refused and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setPreset(chat.id, PICK);
      const bads = [
        { id: "", toggles: {}, samplers: {} },
        { id: "p", toggles: {} }, // samplers is required
        { toggles: {}, samplers: {} },
        { id: 1, toggles: {}, samplers: {} },
        { id: "p", toggles: { "": true }, samplers: {} },
        { id: "p", toggles: { a: "yes" }, samplers: {} },
        { id: "p", toggles: [], samplers: {} },
        { ...PICK, extra: 1 },
        "preset-1",
        [],
        undefined,
      ];
      for (const bad of bads) {
        await expect(store.setPreset(chat.id, bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
      expect((await store.getChat(chat.id))!.preset).toEqual(PICK);
    });
  });

  describe("the scene's preset samplers (rule 19)", () => {
    const numbered = (samplers: Record<string, unknown>) => ({ id: "p", toggles: {}, samplers });

    test("every named sampler is accepted, each a finite number; maxTokens and maxContext whole and positive", async () => {
      const { store, chat } = await seeded(1);
      const full = {
        temperature: 0.8,
        topP: 0.9,
        topK: 40,
        topA: 0.1,
        minP: 0.05,
        frequencyPenalty: 0.2,
        presencePenalty: -0.2,
        repetitionPenalty: 1.1,
        maxTokens: 2048,
        maxContext: 8192,
        contextMode: "messages" as const,
        maxMessages: 25,
      };
      expect((await store.setPreset(chat.id, numbered(full)))!.preset!.samplers).toEqual(full);
    });

    test("Max Messages accepts zero and a whole count; the context mode is tokens or messages", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setPreset(chat.id, numbered({ contextMode: "tokens", maxMessages: 0 })))!.preset!.samplers).toEqual({ contextMode: "tokens", maxMessages: 0 });
    });

    test("the scene's generation parameters and custom request text are stored, and a bad one is refused whole", async () => {
      const { store, chat } = await seeded(1);
      const own = { params: { min_p: { on: true, value: 0.1 }, seed: { on: false } }, customBody: '{"top_k": 5}', customExclude: "top_p", customHeaders: '{"x-a": "1"}' };
      expect((await store.setPreset(chat.id, numbered(own)))!.preset!.samplers).toEqual(own);
      for (const bad of [{ params: { nope: { on: true } } }, { params: { min_p: { on: true, value: 7 } } }, { customBody: '{"messages": []}' }, { customBody: "top_k: 5" }, { customExclude: "model" }]) {
        await expect(store.setPreset(chat.id, numbered(bad))).rejects.toBeInstanceOf(StudioValidationError);
      }
      expect((await store.getChat(chat.id))!.preset!.samplers).toEqual(own);
    });

    test("an empty samplers object is valid: no overrides", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setPreset(chat.id, numbered({})))!.preset!.samplers).toEqual({});
    });

    test("promptPostProcessing accepts exactly SillyTavern's values and refuses anything else", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setPreset(chat.id, numbered({ promptPostProcessing: "merge_tools" })))!.preset!.samplers).toEqual({
        promptPostProcessing: "merge_tools",
      });
      await expect(store.setPreset(chat.id, numbered({ promptPostProcessing: "constructor" }))).rejects.toBeInstanceOf(StudioValidationError);
    });

    test("an unknown sampler field, including a same-named Object property, is refused", async () => {
      const { store, chat } = await seeded(1);
      await expect(store.setPreset(chat.id, numbered({ notASampler: 1 }))).rejects.toBeInstanceOf(StudioValidationError);
      await expect(store.setPreset(chat.id, numbered({ constructor: 1 }))).rejects.toBeInstanceOf(StudioValidationError);
    });

    test("a non-finite, non-numeric, zero, negative, or fractional value where a whole positive number is required is refused", async () => {
      const { store, chat } = await seeded(1);
      const bads = [
        { temperature: Number.NaN },
        { temperature: Number.POSITIVE_INFINITY },
        { temperature: "0.8" },
        { maxTokens: 0 },
        { maxTokens: -1 },
        { maxTokens: 1.5 },
        { maxContext: 0 },
        { maxContext: -100 },
        { maxContext: 1024.25 },
        { contextMode: "turns" },
        { contextMode: 1 },
        { maxMessages: -1 },
        { maxMessages: 2.5 },
        { maxMessages: "5" },
      ];
      for (const samplers of bads) {
        await expect(store.setPreset(chat.id, numbered(samplers))).rejects.toBeInstanceOf(StudioValidationError);
      }
      expect((await store.getChat(chat.id))!.preset).toBeUndefined();
    });
  });
}
