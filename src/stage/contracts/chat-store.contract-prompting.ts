/**
 * The ChatStore contract suite's prompting half: the guides a scene has
 * switched on and its scene note (RoleCall's selected_guides and author_note fields). Same shape as
 * chat-store.contract-opening.ts; chatStoreContract runs it.
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { ChatNote, ChatStore } from "./chat-store";
import { CAST, SNAP, chatRig } from "./chat-store.contract-rig";
import { SANITY_LIST } from "../../entities/_shared/sanity";

export function chatStorePromptingContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;
  const NOTE: ChatNote = { text: "Keep it tense.", position: "in_chat", depth: 4, frequency: 2 };

  describe("the scene's guides and scene note (rule 37)", () => {
    test("a new chat has none; a patch sets guides and the note apart, bumping no version and moving no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      expect(chat.prompting).toBeUndefined();
      const before = await version(store, main);
      setNow(8_000);
      expect((await store.setPrompting(chat.id, { guides: ["g2", "g1"] }))!.prompting).toEqual({ guides: ["g2", "g1"] });
      expect((await store.setPrompting(chat.id, { note: NOTE }))!.prompting).toEqual({ guides: ["g2", "g1"], note: NOTE });
      expect((await store.getChat(chat.id))!.prompting).toEqual({ guides: ["g2", "g1"], note: NOTE });
      expect((await store.listChats()).chats.map((c) => c.prompting)).toEqual([{ guides: ["g2", "g1"], note: NOTE }]);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
    });

    test("a key left out stays, a key given replaces it, null clears it, and nothing left clears the cell", async () => {
      const { store, chat } = await seeded(1);
      await store.setPrompting(chat.id, { guides: ["a"], note: NOTE });
      expect((await store.setPrompting(chat.id, {}))!.prompting).toEqual({ guides: ["a"], note: NOTE });
      expect((await store.setPrompting(chat.id, { guides: ["b", "c"] }))!.prompting).toEqual({ guides: ["b", "c"], note: NOTE });
      expect((await store.setPrompting(chat.id, { note: null }))!.prompting).toEqual({ guides: ["b", "c"] });
      expect((await store.setPrompting(chat.id, { guides: [] }))!.prompting).toEqual({ guides: [] });
      expect("prompting" in (await store.setPrompting(chat.id, { guides: null }))!).toBe(false);
      expect("prompting" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("Last Message as User is kept only while on: true sets it, false and null clear it, and nothing else is left when it is alone", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setPrompting(chat.id, { lastAsUser: true }))!.prompting).toEqual({ lastAsUser: true });
      expect((await store.setPrompting(chat.id, { guides: ["a"] }))!.prompting).toEqual({ guides: ["a"], lastAsUser: true });
      expect((await store.setPrompting(chat.id, { note: NOTE }))!.prompting).toEqual({ guides: ["a"], note: NOTE, lastAsUser: true });
      expect((await store.setPrompting(chat.id, { lastAsUser: false }))!.prompting).toEqual({ guides: ["a"], note: NOTE });
      await store.setPrompting(chat.id, { lastAsUser: true, guides: null, note: null });
      expect((await store.getChat(chat.id))!.prompting).toEqual({ lastAsUser: true });
      expect("prompting" in (await store.setPrompting(chat.id, { lastAsUser: null }))!).toBe(false);
      for (const bad of ["yes", 1, {}]) await expect(store.setPrompting(chat.id, { lastAsUser: bad } as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect("prompting" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("Narrator Tool Access is kept only while on, and Max tool rounds is a whole number from 1 to 20 that clears with null", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setPrompting(chat.id, { toolAccess: true }))!.prompting).toEqual({ toolAccess: true });
      expect((await store.setPrompting(chat.id, { toolRounds: 3 }))!.prompting).toEqual({ toolAccess: true, toolRounds: 3 });
      expect((await store.setPrompting(chat.id, { guides: ["a"], toolAccess: false }))!.prompting).toEqual({ guides: ["a"], toolRounds: 3 });
      await store.setPrompting(chat.id, { toolAccess: null, toolRounds: null, guides: null });
      expect("prompting" in (await store.getChat(chat.id))!).toBe(false);
      for (const bad of [0, 21, 2.5, "8", true]) await expect(store.setPrompting(chat.id, { toolRounds: bad } as never)).rejects.toBeInstanceOf(StudioValidationError);
      for (const bad of ["yes", 1, {}]) await expect(store.setPrompting(chat.id, { toolAccess: bad } as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect("prompting" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("linked library tools are a list of ids kept in order; an empty list or null clears them", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setPrompting(chat.id, { tools: ["luck", "promise"] }))!.prompting).toEqual({ tools: ["luck", "promise"] });
      await store.setPrompting(chat.id, { tools: [] });
      expect("prompting" in (await store.getChat(chat.id))!).toBe(false);
      for (const bad of ["luck", [1], ["a", "a"], [""], Array.from({ length: SANITY_LIST + 1 }, (_, i) => `t${i}`)]) {
        await expect(store.setPrompting(chat.id, { tools: bad } as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
      // owner rule (limits rework): 20 was a product limit; a scene links as many tools as it likes, and only a hostile list is refused
      const many = Array.from({ length: 300 }, (_, i) => `t${i}`);
      expect((await store.setPrompting(chat.id, { tools: many }))!.prompting).toEqual({ tools: many });
      await store.setPrompting(chat.id, { tools: null });
    });

    test("listChats answers each live scene's links from its settings alone: a linked scene, an unlinked one, and neither a deleted scene", async () => {
      const { store, chat } = await seeded(1);
      const unlinked = await store.createChat({ title: "Quiet", cast: CAST, snapshot: SNAP });
      const gone = await store.createChat({ title: "Gone", cast: CAST, snapshot: SNAP });
      await store.setPrompting(chat.id, { trackers: ["health"], tools: ["luck"] });
      await store.setPrompting(gone.id, { trackers: ["health"], tools: ["luck"] });
      expect(await store.deleteChat(gone.id)).toBe(true);
      const live = (await store.listChats()).chats;
      expect(live.map((c) => [c.id, c.prompting?.trackers, c.prompting?.tools])).toEqual([[chat.id, ["health"], ["luck"]], [unlinked.id, undefined, undefined]]);
      // a deleted scene waits in the graveyard, apart from the live list
      expect((await store.chatGraveyard()).chats.map((c) => c.id)).toEqual([gone.id]);
    });

    test("linked library trackers are a list of ids kept in order, apart from the tools; an empty list or null clears them", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setPrompting(chat.id, { trackers: ["health", "party"], tools: ["luck"] }))!.prompting).toEqual({ trackers: ["health", "party"], tools: ["luck"] });
      expect((await store.setPrompting(chat.id, { tools: null }))!.prompting).toEqual({ trackers: ["health", "party"] });
      await store.setPrompting(chat.id, { trackers: [] });
      expect("prompting" in (await store.getChat(chat.id))!).toBe(false);
      await store.setPrompting(chat.id, { trackers: ["health"] });
      await store.setPrompting(chat.id, { trackers: null });
      expect("prompting" in (await store.getChat(chat.id))!).toBe(false);
      for (const bad of ["health", [1], ["a", "a"], [""], Array.from({ length: SANITY_LIST + 1 }, (_, i) => `t${i}`)]) {
        await expect(store.setPrompting(chat.id, { trackers: bad } as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
      const many = Array.from({ length: 300 }, (_, i) => `t${i}`);
      expect((await store.setPrompting(chat.id, { trackers: many }))!.prompting).toEqual({ trackers: many });
      await store.setPrompting(chat.id, { trackers: null });
    });

    test("change visuals on replies are on unless the scene turns them off: only false is kept, and true or null clears it", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setPrompting(chat.id, { trackerChanges: false }))!.prompting).toEqual({ trackerChanges: false });
      expect((await store.setPrompting(chat.id, { trackers: ["health"] }))!.prompting).toEqual({ trackers: ["health"], trackerChanges: false });
      expect((await store.setPrompting(chat.id, { trackerChanges: true }))!.prompting).toEqual({ trackers: ["health"] });
      await store.setPrompting(chat.id, { trackerChanges: false });
      expect((await store.setPrompting(chat.id, { trackerChanges: null }))!.prompting).toEqual({ trackers: ["health"] });
      await store.setPrompting(chat.id, { trackers: null, trackerChanges: true });
      expect("prompting" in (await store.getChat(chat.id))!).toBe(false);
      for (const bad of ["no", 0, 1, {}]) await expect(store.setPrompting(chat.id, { trackerChanges: bad } as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect("prompting" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("Reasoning Effort, Start Reply With, its role and Catch thinking are kept only while set, and clear with null", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setPrompting(chat.id, { reasoningEffort: "high", prefill: "<think>", prefillRole: "user", capture: { mode: "only", custom: [{ open: "Status:", close: "---" }], builtinTags: ["<plan>"] } }))!.prompting).toEqual({
        reasoningEffort: "high", prefill: "<think>", prefillRole: "user", capture: { mode: "only", custom: [{ open: "Status:", close: "---" }], builtinTags: ["<plan>"] },
      });
      expect((await store.setPrompting(chat.id, { capture: { mode: "auto", custom: [], builtinTags: [] }, prefill: "   " }))!.prompting).toEqual({ reasoningEffort: "high", prefillRole: "user" });
      await store.setPrompting(chat.id, { reasoningEffort: null, prefillRole: null });
      expect("prompting" in (await store.getChat(chat.id))!).toBe(false);
      const bads: unknown[] = [{ reasoningEffort: "auto" }, { reasoningEffort: "max" }, { reasoningEffort: 3 }, { prefill: 5 }, { prefill: "x".repeat(2_001) }, { prefillRole: "assistant" }, { prefillRole: "tool" },
        { capture: { mode: "sometimes", custom: [], builtinTags: [] } }, { capture: { mode: "only", custom: [], builtinTags: ["<nope>"] } }, { capture: { mode: "only", custom: [{ open: "a" }], builtinTags: [] } },
        { capture: { mode: "only", custom: [{ open: "x".repeat(65), close: "y" }], builtinTags: [] } }, { capture: { mode: "only", custom: Array.from({ length: 11 }, () => ({ open: "a", close: "b" })), builtinTags: [] } }, { capture: { mode: "off" } }, { capture: { mode: "off", custom: [], builtinTags: [], extra: 1 } }];
      for (const bad of bads) await expect(store.setPrompting(chat.id, bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect("prompting" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("Let the model see its old thinking, Reasoning continuity and Show Prefill in Chat are kept only while on", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setPrompting(chat.id, { keepThinking: true, continuity: true, showPrefill: true }))!.prompting).toEqual({ keepThinking: true, continuity: true, showPrefill: true });
      expect((await store.setPrompting(chat.id, { continuity: false }))!.prompting).toEqual({ keepThinking: true, showPrefill: true });
      await store.setPrompting(chat.id, { keepThinking: null, showPrefill: false });
      expect("prompting" in (await store.getChat(chat.id))!).toBe(false);
      for (const key of ["keepThinking", "continuity", "showPrefill"]) for (const bad of ["yes", 1, {}]) await expect(store.setPrompting(chat.id, { [key]: bad } as never)).rejects.toBeInstanceOf(StudioValidationError);
    });

    test("two patches in a row never overwrite each other", async () => {
      const { store, chat } = await seeded(1);
      await Promise.all([store.setPrompting(chat.id, { guides: ["a"] }), store.setPrompting(chat.id, { note: NOTE })]);
      expect((await store.getChat(chat.id))!.prompting).toEqual({ guides: ["a"], note: NOTE });
    });

    test("it is the chat's, so forks, recasts and appends leave it alone", async () => {
      const { store, chat, main, ids } = await seeded(2);
      await store.setPrompting(chat.id, { guides: ["a"], note: NOTE });
      await store.fork(main, ids[0]!);
      await store.appendMessage(main, { role: "user", content: "more" });
      await store.renameChat(chat.id, "Renamed");
      expect((await store.getChat(chat.id))!.prompting).toEqual({ guides: ["a"], note: NOTE });
    });

    test("an absent or deleted chat takes none; a restored one keeps what it had", async () => {
      const { store, chat } = await seeded(1);
      await store.setPrompting(chat.id, { note: NOTE });
      expect(await store.setPrompting("nope", { note: NOTE })).toBeNull();
      await store.deleteChat(chat.id);
      expect(await store.setPrompting(chat.id, { note: null })).toBeNull();
      expect((await store.chatGraveyard()).chats[0]!.prompting).toEqual({ note: NOTE });
      expect((await store.restoreChat(chat.id))!.prompting).toEqual({ note: NOTE });
    });

    test("a bad patch is refused and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setPrompting(chat.id, { guides: ["a"], note: NOTE });
      const bads: unknown[] = [
        { guides: ["a", "a"] },
        { guides: [""] },
        { guides: ["has space"] },
        { guides: [5] },
        { guides: Array.from({ length: 51 }, (_, i) => `g${i}`) },
        { guides: "a" },
        { note: { ...NOTE, text: "x".repeat(10_001) } },
        { note: { ...NOTE, text: 5 } },
        { note: { ...NOTE, position: "top" } },
        { note: { ...NOTE, depth: 11 } },
        { note: { ...NOTE, depth: -1 } },
        { note: { ...NOTE, depth: 1.5 } },
        { note: { ...NOTE, frequency: 5 } },
        { note: { ...NOTE, frequency: "1" } },
        { note: { ...NOTE, extra: 1 } },
        { note: { text: "x" } },
        { note: [] },
        { extra: 1 },
        null,
        [],
        "x",
        undefined,
      ];
      for (const bad of bads) await expect(store.setPrompting(chat.id, bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.prompting).toEqual({ guides: ["a"], note: NOTE });
    });

    test("the largest note, 10,000 characters, and the edges of depth and frequency are kept", async () => {
      const { store, chat } = await seeded(1);
      const edge: ChatNote = { text: "x".repeat(10_000), position: "after_scenario", depth: 10, frequency: 0 };
      expect((await store.setPrompting(chat.id, { note: edge }))!.prompting).toEqual({ note: edge });
      const low: ChatNote = { text: "", position: "in_chat", depth: 0, frequency: 4 };
      expect((await store.setPrompting(chat.id, { note: low }))!.prompting).toEqual({ note: low });
    });
  });
}
