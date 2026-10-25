/**
 * The ChatStore contract suite's summary half: a scene's summary settings, and one summary text per take. chatStoreContract runs it on every backend.
 */
import { describe, expect, test } from "bun:test";
import { StudioConflictError } from "../../studio/atomic-file";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

export function chatStoreSummaryContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;

  describe("the scene's summary settings (rule 45)", () => {
    test("a new chat has none; a patch keeps what it gives, bumping no version and moving no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      expect(chat.summary).toBeUndefined();
      const before = await version(store, main);
      setNow(8_000);
      const set = await store.setSummarySettings(chat.id, { auto: true, interval: 40, method: "pair", temperature: 0.5, model: { id: "conn", model: "m" }, prompt: "Recap {{conversationHistory}}" });
      expect(set!.summary).toEqual({ settings: { auto: true, interval: 40, method: "pair", temperature: 0.5, model: { id: "conn", model: "m" }, prompt: "Recap {{conversationHistory}}" } });
      expect((await store.getChat(chat.id))!.summary).toEqual(set!.summary);
      expect((await store.listChats()).chats.map((c) => c.summary)).toEqual([set!.summary]);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
    });

    test("a key left out stays, a key given as null goes back to the default, and a patch that leaves nothing leaves no cell", async () => {
      const { store, chat } = await seeded(1);
      await store.setSummarySettings(chat.id, { auto: true, include: false });
      expect((await store.setSummarySettings(chat.id, { hideOld: true }))!.summary!.settings).toEqual({ auto: true, include: false, hideOld: true });
      expect((await store.setSummarySettings(chat.id, { include: null }))!.summary!.settings).toEqual({ auto: true, hideOld: true });
      expect((await store.setSummarySettings(chat.id, {}))!.summary!.settings).toEqual({ auto: true, hideOld: true });
      await store.setSummarySettings(chat.id, { auto: null, hideOld: null });
      expect("summary" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("a bad patch is refused whole and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setSummarySettings(chat.id, { interval: 10 });
      const bad: unknown[] = [
        { auto: "yes" }, { interval: -1 }, { interval: 1.5 }, { interval: 100_001 }, { method: "sometimes" }, { mode: "append" }, { include: 1 }, { window: 0 }, { keepRecent: 0 },
        { temperature: 1.1 }, { temperature: -0.1 }, { maxTokens: 0 }, { truncate: "x" }, { reasoning: 2 }, { model: { id: "" } }, { model: "gpt" }, { prompt: 7 }, { prompt: "x".repeat(20_001) },
        { nope: 1 }, [], "x", null,
      ];
      for (const patch of bad) await expect(store.setSummarySettings(chat.id, patch as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.summary).toEqual({ settings: { interval: 10 } });
    });

    test("it belongs to the chat: a missing or deleted chat answers null, and a restore brings it back", async () => {
      const { store, chat } = await seeded(1);
      await store.setSummarySettings(chat.id, { auto: true });
      await store.deleteChat(chat.id);
      expect(await store.setSummarySettings(chat.id, { auto: false })).toBeNull();
      expect(await store.setSummarySettings("nope", { auto: false })).toBeNull();
      await store.restoreChat(chat.id);
      expect((await store.getChat(chat.id))!.summary).toEqual({ settings: { auto: true } });
    });
  });

  describe("a take's summary text (rule 45)", () => {
    test("a take has none until one is written; the store stamps the time and keeps what it was told", async () => {
      const { store, chat, main, setNow } = await seeded(2);
      expect(await store.summaryOf(main)).toBeNull();
      setNow(5_000);
      const wrote = await store.setSummary(main, { text: "They met at the pier.", through: 3, last: "m9" });
      expect(wrote).toEqual({ summary: { text: "They met at the pier.", through: 3, at: 5_000, last: "m9" } });
      expect(await store.summaryOf(main)).toEqual(wrote!.summary);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
      expect("summary" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("a write replaces the take's text; null clears it; each take has its own", async () => {
      const { store, chat, main } = await seeded(2);
      const fork = await store.fork(main, (await store.readMessages(main, { limit: 1 })).messages[0]!.id, { name: "Take 2" });
      await store.setSummary(main, { text: "One.", through: 1 });
      await store.setSummary(fork!.id, { text: "Two.", through: 1 });
      expect((await store.summaryOf(main))!.text).toBe("One.");
      expect((await store.summaryOf(fork!.id))!.text).toBe("Two.");
      expect(await store.setSummary(main, null)).toEqual({ summary: null });
      expect(await store.summaryOf(main)).toBeNull();
      expect((await store.summaryOf(fork!.id))!.text).toBe("Two.");
      expect(chat.id).toBeTruthy();
    });

    test("a guard on the time it was read at refuses a write another wrote over, and changes nothing", async () => {
      const { store, main, setNow } = await seeded(2);
      setNow(100);
      await store.setSummary(main, { text: "First.", through: 1 }, { at: null });
      setNow(200);
      await store.setSummary(main, { text: "Edited by hand.", through: 1 }, { at: 100 });
      const lost = await store.setSummary(main, { text: "Generated from old reading.", through: 2 }, { at: 100 }).then(() => null, (e: unknown) => e);
      expect(lost).toBeInstanceOf(StudioConflictError);
      expect((await store.summaryOf(main))!.text).toBe("Edited by hand.");
      const wrongNone = await store.setSummary(main, { text: "x", through: 1 }, { at: null }).then(() => null, (e: unknown) => e);
      expect(wrongNone).toBeInstanceOf(StudioConflictError);
    });

    test("every write is stamped later than the one before it, even inside one millisecond, so the guard can always tell them apart", async () => {
      const { store, main } = await seeded(2);
      const one = (await store.setSummary(main, { text: "One.", through: 1 }))!.summary!;
      const two = (await store.setSummary(main, { text: "Two.", through: 1 }, { at: one.at }))!.summary!;
      expect(two.at).toBeGreaterThan(one.at);
      const lost = await store.setSummary(main, { text: "Three.", through: 1 }, { at: one.at }).then(() => null, (e: unknown) => e);
      expect(lost).toBeInstanceOf(StudioConflictError);
    });

    test("a bad write is refused whole; a missing or deleted take answers null", async () => {
      const { store, main } = await seeded(2);
      await store.setSummary(main, { text: "Keep.", through: 1 });
      const bad: unknown[] = [{ text: "", through: 1 }, { text: "  ", through: 1 }, { text: 5, through: 1 }, { text: "x".repeat(100_001), through: 1 }, { text: "x", through: -1 }, { text: "x", through: 1.5 }, { text: "x", through: 1_000_001 }, { text: "x" }, { text: "x", through: 1, last: "" }, { text: "x", through: 1, extra: 1 }, "x", []];
      for (const input of bad) await expect(store.setSummary(main, input as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.summaryOf(main))!.text).toBe("Keep.");
      expect(await store.setSummary("nope", { text: "x", through: 1 })).toBeNull();
      expect(await store.summaryOf("nope")).toBeNull();
    });

    test("the last run's failure is kept in words and cleared by saying null; it rides on the chat, not on the text", async () => {
      const { store, chat } = await seeded(1);
      expect((await store.setSummaryError(chat.id, "The summary model returned no text."))!.summary).toEqual({ error: "The summary model returned no text." });
      expect((await store.setSummaryError(chat.id, null))).not.toBeNull();
      expect("summary" in (await store.getChat(chat.id))!).toBe(false);
      await expect(store.setSummaryError(chat.id, "x".repeat(501))).rejects.toBeInstanceOf(StudioValidationError);
      expect(await store.setSummaryError("nope", "x")).toBeNull();
    });

    test("a take's text survives the take going to the Trash and coming back,", async () => {
      const { store, main } = await seeded(2);
      const fork = await store.fork(main, (await store.readMessages(main, { limit: 1 })).messages[0]!.id, { name: "Take 2" });
      await store.setSummary(fork!.id, { text: "Kept.", through: 1 });
      await store.deleteBranch(fork!.id);
      await store.restoreBranch(fork!.id);
      expect((await store.summaryOf(fork!.id))!.text).toBe("Kept.");
    });
  });
}
