/**
 * The ChatStore contract suite's Compendium half: a scene's sparse Compendium
 * choices. Same shape as chat-store.contract-prompting.ts; chatStoreContract runs it on every backend.
 */
import { describe, expect, test } from "bun:test";
import { COMPENDIUM_DEFAULTS, resolveCompendium, writeBookOf } from "../../core/compendium/defaults";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { CAST, chatRig, SNAP } from "./chat-store.contract-rig";

export function chatStoreCompendiumContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;

  describe("the scene's Compendium choices (rule 38)", () => {
    test("a new chat has none, and what resolves is the owner's defaults: off, filing waits one message, books are read only", async () => {
      const { chat } = await seeded(1);
      expect(chat.compendium).toBeUndefined();
      const d = resolveCompendium(chat.compendium);
      expect(d.on).toBe(false);
      expect(d.filing).toMatchObject({ on: true, wait: 1, everyN: 1, guide: undefined });
      expect(d.filing.allow).toHaveLength(11);
      expect(d.recall).toMatchObject({ on: true, maxEntries: 10, minEntries: 0, contextMessages: 20, detail: "taglines", depth: 2, bookDisplay: "unified", keywordHints: true, guide: undefined });
      expect(COMPENDIUM_DEFAULTS.access).toBe("read_only");
      expect(writeBookOf(chat.compendium)).toBeUndefined();
    });

    test("a patch sets fields apart, bumping no version and moving no updatedAt; defaults are never stored", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      const before = await version(store, main);
      setNow(8_000);
      expect((await store.setCompendium(chat.id, { on: true }))!.compendium).toEqual({ on: true });
      expect((await store.setCompendium(chat.id, { language: "French", model: { id: "c1", model: "m1" } }))!.compendium).toEqual({ on: true, language: "French", model: { id: "c1", model: "m1" } });
      expect((await store.getChat(chat.id))!.compendium).toEqual({ on: true, language: "French", model: { id: "c1", model: "m1" } });
      expect((await store.listChats()).chats.map((c) => c.compendium)).toEqual([{ on: true, language: "French", model: { id: "c1", model: "m1" } }]);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
    });

    test("recall and filing merge field by field, so a toggle and a guidance edit never overwrite each other", async () => {
      const { store, chat } = await seeded(1);
      await store.setCompendium(chat.id, { recall: { on: false } });
      await store.setCompendium(chat.id, { recall: { guidance: "Prefer places." } });
      await store.setCompendium(chat.id, { filing: { wait: 0, guide: "noir_1" } });
      await store.setCompendium(chat.id, { filing: { allow: ["character", "plot"] } });
      expect((await store.getChat(chat.id))!.compendium).toEqual({
        recall: { on: false, guidance: "Prefer places." },
        filing: { wait: 0, guide: "noir_1", allow: ["character", "plot"] },
      });
      expect((await store.setCompendium(chat.id, { recall: { on: null } }))!.compendium!.recall).toEqual({ guidance: "Prefer places." });
      expect((await store.setCompendium(chat.id, { filing: { allow: [] } }))!.compendium!.filing).toEqual({ wait: 0, guide: "noir_1", allow: [] });
      const r = resolveCompendium((await store.getChat(chat.id))!.compendium);
      expect(r.filing).toMatchObject({ wait: 0, guide: "noir_1", allow: [], on: true, everyN: 1 });
      await Promise.all([store.setCompendium(chat.id, { recall: { maxEntries: 5 } }), store.setCompendium(chat.id, { recall: { minEntries: 2 } })]);
      expect((await store.getChat(chat.id))!.compendium!.recall).toEqual({ guidance: "Prefer places.", maxEntries: 5, minEntries: 2 });
    });

    test("books merge per book and per field; null removes a book, and nothing left clears the cell", async () => {
      const { store, chat } = await seeded(1);
      await store.setCompendium(chat.id, { books: { a: { access: "read_write" }, b: { ignoreKeywords: true } } });
      await store.setCompendium(chat.id, { books: { a: { ignoreKeywords: true } } });
      expect((await store.getChat(chat.id))!.compendium).toEqual({ books: { a: { access: "read_write", ignoreKeywords: true }, b: { ignoreKeywords: true } } });
      await store.setCompendium(chat.id, { books: { b: null }, writeBook: "a" });
      expect((await store.getChat(chat.id))!.compendium).toEqual({ books: { a: { access: "read_write", ignoreKeywords: true } }, writeBook: "a" });
      expect(writeBookOf((await store.getChat(chat.id))!.compendium)).toBe("a");
      await store.setCompendium(chat.id, { books: { a: { access: "read_only" } } });
      expect(writeBookOf((await store.getChat(chat.id))!.compendium)).toBeUndefined(); // one default write book, and only while it can write
      await store.setCompendium(chat.id, { books: null, writeBook: null });
      expect("compendium" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("a key left out stays, null clears it, and an empty patch changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setCompendium(chat.id, { on: true, language: "Latin" });
      expect((await store.setCompendium(chat.id, {}))!.compendium).toEqual({ on: true, language: "Latin" });
      expect((await store.setCompendium(chat.id, { language: null }))!.compendium).toEqual({ on: true });
      expect("compendium" in (await store.setCompendium(chat.id, { on: null }))!).toBe(false);
    });

    test("it is the chat's, so forks, recasts and appends leave it alone, and a restored scene keeps it", async () => {
      const { store, chat, main, ids } = await seeded(2);
      await store.setCompendium(chat.id, { on: true, recall: { depth: 3 } });
      await store.setCast(chat.id, { cast: { ...CAST, character: { ...CAST.character, version: 5 } }, snapshot: SNAP });
      await store.fork(main, ids[0]!);
      await store.appendMessage(main, { role: "user", content: "more" });
      await store.renameChat(chat.id, "Renamed");
      expect((await store.getChat(chat.id))!.compendium).toEqual({ on: true, recall: { depth: 3 } });
      await store.deleteChat(chat.id);
      expect(await store.setCompendium(chat.id, { on: false })).toBeNull();
      expect((await store.chatGraveyard()).chats[0]!.compendium).toEqual({ on: true, recall: { depth: 3 } });
      expect((await store.restoreChat(chat.id))!.compendium).toEqual({ on: true, recall: { depth: 3 } });
      expect(await store.setCompendium("nope", { on: true })).toBeNull();
    });

    test("a bad patch is refused and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setCompendium(chat.id, { on: true, books: { a: { access: "read_write" } } });
      const bads: unknown[] = [
        { on: "yes" }, { on: 1 }, { extra: 1 }, { language: 5 }, { language: "x".repeat(81) }, { writeBook: "" }, { writeBook: "x".repeat(201) },
        { model: { id: "c" } }, { model: { id: "", model: "m" } }, { model: [] },
        { books: [] }, { books: { "": { access: "read_only" } } }, { books: { a: { access: "owner" } } }, { books: { a: { ignoreKeywords: "no" } } }, { books: { a: { extra: 1 } } },
        { books: { a: [] } }, { books: JSON.parse('{"__proto__": {"access": "off"}}') },
        { recall: { on: "x" } }, { recall: { maxEntries: 0 } }, { recall: { maxEntries: 31 } }, { recall: { maxEntries: 1.5 } }, { recall: { minEntries: 21 } },
        { recall: { contextMessages: 4 } }, { recall: { contextMessages: 101 } }, { recall: { depth: 0 } }, { recall: { depth: 21 } }, { recall: { detail: "full" } },
        { recall: { bookDisplay: "both" } }, { recall: { keywordHints: 1 } }, { recall: { guide: "has space" } }, { recall: { guide: "" } }, { recall: { guidance: "x".repeat(4_001) } },
        { recall: { extra: 1 } }, { recall: [] }, { recall: "on" },
        { filing: { everyN: 0 } }, { filing: { everyN: 11 } }, { filing: { wait: -1 } }, { filing: { wait: 6 } }, { filing: { allow: ["character", "character"] } },
        { filing: { allow: ["dragon"] } }, { filing: { allow: "character" } }, { filing: { allow: [5] } }, { filing: { guide: 5 } }, { filing: { extra: true } },
        null, [], "x", undefined,
      ];
      for (const bad of bads) await expect(store.setCompendium(chat.id, bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.compendium).toEqual({ on: true, books: { a: { access: "read_write" } } });
    });

    test("the Clear feed watermark is a whole time that merges and clears like any field", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setCompendium(chat.id, { feedClearedAt: 9_000, on: true }))!.compendium).toEqual({ feedClearedAt: 9_000, on: true });
      expect((await store.setCompendium(chat.id, { feedClearedAt: 0 }))!.compendium).toEqual({ feedClearedAt: 0, on: true });
      for (const bad of [-1, 1.5, "9", Number.NaN]) await expect(store.setCompendium(chat.id, { feedClearedAt: bad } as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.setCompendium(chat.id, { feedClearedAt: null }))!.compendium).toEqual({ on: true });
    });

    test("Narrator explore tool (RoleCall's tv_during_gen_search) is off by default, stored only when set, and a boolean", async () => {
      const { store, chat } = await seeded(1);
      expect(resolveCompendium(chat.compendium).lookup).toBe(false);
      expect((await store.setCompendium(chat.id, { lookup: true }))!.compendium).toEqual({ lookup: true });
      expect(resolveCompendium((await store.getChat(chat.id))!.compendium).lookup).toBe(true);
      for (const bad of ["yes", 1, {}]) await expect(store.setCompendium(chat.id, { lookup: bad } as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect("compendium" in (await store.setCompendium(chat.id, { lookup: null }))!).toBe(false);
    });

    test("tree building merges field by field, and a book's tree choices are replaced whole and cleared by null", async () => {
      const { store, chat } = await seeded(1);
      await store.setCompendium(chat.id, { treeBuild: { granularity: 3 } });
      await store.setCompendium(chat.id, { treeBuild: { detail: "full", placement: "parallel", refine: true } });
      expect((await store.getChat(chat.id))!.compendium!.treeBuild).toEqual({ granularity: 3, detail: "full", placement: "parallel", refine: true });
      expect(resolveCompendium((await store.getChat(chat.id))!.compendium).treeBuild).toEqual({ granularity: 3, detail: "full", placement: "parallel", refine: true });
      expect(resolveCompendium(undefined).treeBuild).toEqual({ granularity: 0, detail: "lite", placement: "auto", refine: false });
      expect((await store.setCompendium(chat.id, { treeBuild: { detail: null } }))!.compendium!.treeBuild).toEqual({ granularity: 3, placement: "parallel", refine: true });
      const tree = { locked: ["n:people"], forbidden: ["n:misc"], reorganize: [], pins: { e1: "e2" } };
      expect((await store.setCompendium(chat.id, { books: { a: { tree } } }))!.compendium!.books).toEqual({ a: { tree } });
      expect((await store.setCompendium(chat.id, { books: { a: { access: "read_write" } } }))!.compendium!.books).toEqual({ a: { tree, access: "read_write" } });
      expect((await store.setCompendium(chat.id, { books: { a: { tree: { locked: ["n:x"] } } } }))!.compendium!.books!["a"]!.tree).toEqual({ locked: ["n:x"] });
      expect((await store.setCompendium(chat.id, { books: { a: { tree: null } } }))!.compendium!.books).toEqual({ a: { access: "read_write" } });
    });

    test("the Historian merges field by field, resolves to 20, 10 and smart context off, and refuses a number out of range", async () => {
      const { store, chat } = await seeded(1);
      expect(resolveCompendium(undefined).historian).toEqual({ interval: 20, overlap: 10, smartContext: false });
      await store.setCompendium(chat.id, { historian: { interval: 0 } });
      await store.setCompendium(chat.id, { historian: { overlap: 40 } });
      await store.setCompendium(chat.id, { historian: { smartContext: true } });
      expect((await store.getChat(chat.id))!.compendium!.historian).toEqual({ interval: 0, overlap: 40, smartContext: true });
      expect(resolveCompendium((await store.getChat(chat.id))!.compendium).historian).toEqual({ interval: 0, overlap: 40, smartContext: true });
      for (const bad of [{ interval: 101 }, { interval: -1 }, { overlap: 41 }, { overlap: 1.5 }, { smartContext: "yes" }, { extra: 1 }]) await expect(store.setCompendium(chat.id, { historian: bad } as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.setCompendium(chat.id, { historian: null }))!.compendium).toBeUndefined();
    });

    test("Import chat history merges field by field, resolves to RoleCall's defaults, and refuses what is out of range", async () => {
      const { store, chat } = await seeded(1);
      expect(resolveCompendium(undefined).ingest).toEqual({ continuity: true, model: "compendium", chunkTokens: 6000, search: true, facts: true, narrative: true });
      await store.setCompendium(chat.id, { ingest: { chunkTokens: 1000, facts: false } });
      await store.setCompendium(chat.id, { ingest: { model: "scene" } });
      expect(resolveCompendium((await store.getChat(chat.id))!.compendium).ingest).toEqual({ continuity: true, model: "scene", chunkTokens: 1000, search: true, facts: false, narrative: true });
      await store.setCompendium(chat.id, { ingest: { chunkTokens: 32000 } });
      for (const bad of [{ chunkTokens: 999 }, { chunkTokens: 32001 }, { chunkTokens: 6000.5 }, { model: "tv" }, { search: "yes" }, { extra: 1 }]) await expect(store.setCompendium(chat.id, { ingest: bad } as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.compendium!.ingest).toEqual({ chunkTokens: 32000, facts: false, model: "scene" });
    });

    test("a bad tree choice is refused and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setCompendium(chat.id, { treeBuild: { granularity: 2 }, books: { a: { tree: { locked: ["n:a"] } } } });
      const many = Array.from({ length: 401 }, (_, i) => `n:${i}`);
      const bads: unknown[] = [
        { treeBuild: { granularity: 5 } }, { treeBuild: { granularity: "2" } }, { treeBuild: { detail: "all" } }, { treeBuild: { placement: "fast" } }, { treeBuild: { refine: "yes" } }, { treeBuild: { extra: 1 } }, { treeBuild: [] },
        { books: { a: { tree: { locked: "n:a" } } } }, { books: { a: { tree: { locked: [""] } } } }, { books: { a: { tree: { locked: [5] } } } }, { books: { a: { tree: { forbidden: many } } } },
        { books: { a: { tree: { pins: [] } } } }, { books: { a: { tree: { pins: { e1: "" } } } } }, { books: { a: { tree: { pins: { e1: 5 } } } } }, { books: { a: { tree: { extra: [] } } } }, { books: { a: { tree: [] } } },
      ];
      for (const bad of bads) await expect(store.setCompendium(chat.id, bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.compendium).toEqual({ treeBuild: { granularity: 2 }, books: { a: { tree: { locked: ["n:a"] } } } });
    });

    test("the Standardize defaults resolve to RoleCall's (5 entries, 5 at once, 8 rounds, retry once, the Compendium's model), and a patch keeps only what changed", async () => {
      const { store, chat } = await seeded(1);
      expect(resolveCompendium(chat.compendium).standardize).toEqual({ batchSize: 5, parallelism: 5, maxRounds: 8, autoRetry: true, modelSource: "compendium" });
      const set = await store.setCompendium(chat.id, { standardize: { batchSize: 500, parallelism: 1, maxRounds: 20, autoRetry: false, modelSource: "scene" } });
      expect(set!.compendium!.standardize).toEqual({ batchSize: 500, parallelism: 1, maxRounds: 20, autoRetry: false, modelSource: "scene" });
      expect((await store.setCompendium(chat.id, { standardize: { batchSize: 1, parallelism: null, maxRounds: null } }))!.compendium!.standardize).toEqual({ batchSize: 1, autoRetry: false, modelSource: "scene" });
      expect((await store.setCompendium(chat.id, { standardize: null }))!.compendium).toBeUndefined();
      for (const bad of [{ batchSize: 0 }, { batchSize: 501 }, { batchSize: 2.5 }, { parallelism: 0 }, { parallelism: 21 }, { maxRounds: 0 }, { maxRounds: 21 }, { autoRetry: "yes" }, { modelSource: "main" }, { extra: 1 }]) {
        await expect(store.setCompendium(chat.id, { standardize: bad } as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
      expect((await store.getChat(chat.id))!.compendium).toBeUndefined();
    });

    test("the edges of every range are kept", async () => {
      const { store, chat } = await seeded(1);
      const edge = { maxEntries: 30, minEntries: 20, contextMessages: 100, depth: 20, detail: "preview" as const, bookDisplay: "per_book" as const, guidance: "x".repeat(4_000) };
      expect((await store.setCompendium(chat.id, { recall: edge }))!.compendium!.recall).toEqual(edge);
      const low = { maxEntries: 1, minEntries: 0, contextMessages: 5, depth: 1 };
      expect((await store.setCompendium(chat.id, { recall: low }))!.compendium!.recall).toEqual({ ...edge, ...low });
      expect((await store.setCompendium(chat.id, { filing: { everyN: 10, wait: 5 } }))!.compendium!.filing).toEqual({ everyN: 10, wait: 5 });
      expect((await store.setCompendium(chat.id, { filing: { everyN: 1, wait: 0 } }))!.compendium!.filing).toEqual({ everyN: 1, wait: 0 });
    });
  });
}
