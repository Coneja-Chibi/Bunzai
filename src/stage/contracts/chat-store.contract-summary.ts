/**
 * The ChatStore contract suite's summary half: a scene's summary settings, and a take's summary text, which is the `summary` slot (written on a message, or on a version through recordDeltas). chatStoreContract runs it on every backend.
 */
import { describe, expect, test } from "bun:test";
import { StudioConflictError } from "../../studio/atomic-file";
import { StudioValidationError } from "../../studio/errors";
import { heldAs } from "../../core/scene-state/fold";
import type { Delta } from "../../core/scene-state/types";
import { blockDeltas, layersOf, sawOf } from "../../core/summary/rows";
import type { SummaryRow } from "../../core/summary/row-shape";
import { SANITY_TEXT } from "../../entities/_shared/sanity";
import { slotOf } from "../../generated/slots";
import type { ChatStore } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

export function chatStoreSummaryContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const rejected = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);
  const row = (version: string, text: string, through = 1, at = 1_000, extra: Partial<SummaryRow> = {}): SummaryRow => ({ version, text, through, at, ...extra });
  /** The deltas that write `r` as a writer that read `from` would: it records the person's text it saw, and a replacing block also removes the generated rows of that state. */
  const put = (r: SummaryRow, from?: unknown): Delta[] => blockDeltas((from ?? null) as never, { ...r, ...sawOf((from ?? null) as never) });
  /** The id of a version of the message at `index` (cut messages count), the shown one unless `position` is given. */
  const swipeOf = async (store: ChatStore, branch: string, index: number, position?: number) => {
    const m = (await store.readMessages(branch, { limit: 1_000 })).messages[index]!;
    return m.swipes[position ?? m.current]!.id;
  };
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

  describe("a take's summary text (rule 45): the `summary` slot", () => {
    test("a take has none until one is written; the person's text sits on the take's newest message and is stamped with the store's clock", async () => {
      const { store, chat, main, setNow } = await seeded(2);
      expect(await store.summaryOf(main)).toBeNull();
      setNow(5_000);
      const wrote = await store.setSummary(main, { text: "They met at the pier.", through: 3 });
      expect(wrote).toEqual({ summary: { text: "They met at the pier.", through: 3, at: 5_000 } });
      expect(await store.summaryOf(main)).toEqual(wrote!.summary);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
      expect("summary" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("a write replaces the take's whole text, generated rows too, without writing their paths; null clears it, and a line written after the clear shows", async () => {
      const { store, main, ids } = await seeded(3);
      const first = await swipeOf(store, main, 1);
      await store.recordDeltas(main, first, put(row(first, "Earlier.")));
      expect((await store.summaryOf(main))!.text).toBe("Earlier.");
      await store.setSummary(main, { text: "One.", through: 1 });
      await store.setSummary(main, { text: "Two.", through: 2 });
      expect((await store.summaryOf(main))!.text).toBe("Two.");
      expect((await store.sceneState(main))!["summary"]).toHaveLength(2); // the generated row is still there, covered by the person's
      expect(await store.setSummary(main, null)).toEqual({ summary: null });
      expect(await store.summaryOf(main)).toBeNull();
      const later = await swipeOf(store, main, 2);
      await store.recordDeltas(main, later, put(row(later, "Turn 2: B."), await store.sceneState(main)));
      expect((await store.summaryOf(main))!.text).toBe("Turn 2: B.");
      expect(ids).toHaveLength(3);
    });

    test("clearing, then a new version of the newest reply: the new version's line shows", async () => {
      const { store, main, ids } = await seeded(2);
      const old = await swipeOf(store, main, 1);
      await store.recordDeltas(main, old, put(row(old, "Turn 1: A.")));
      await store.setSummary(main, null);
      expect(await store.summaryOf(main)).toBeNull();
      await store.addSwipe(ids[1]!, { content: "again" });
      const fresh = await swipeOf(store, main, 1);
      await store.recordDeltas(main, fresh, put(row(fresh, "Turn 1: B."), await store.sceneState(main)));
      expect((await store.summaryOf(main))!.text).toBe("Turn 1: B.");
      await store.selectSwipe(ids[1]!, 0);
      expect(await store.summaryOf(main)).toBeNull(); // the cleared version stays cleared
    });

    test("a fork keeps the text of the messages it kept, and its own text never reaches the source", async () => {
      const { store, main, ids } = await seeded(3);
      const first = await swipeOf(store, main, 0);
      await store.recordDeltas(main, first, put(row(first, "Prefix.")));
      await store.setSummary(main, { text: "Main.", through: 3 });
      const fork = await store.fork(main, ids[1]!, { name: "Take 2" });
      expect((await store.summaryOf(fork!.id))!.text).toBe("Prefix.");
      await store.setSummary(fork!.id, { text: "Fork.", through: 2 });
      expect((await store.summaryOf(fork!.id))!.text).toBe("Fork.");
      expect((await store.summaryOf(main))!.text).toBe("Main.");
    });

    test("a guard naming the branch version it read refuses a write after the take moved on, and changes nothing", async () => {
      const { store, main } = await seeded(2);
      await store.setSummary(main, { text: "First.", through: 1 });
      const read = await version(store, main);
      await store.appendMessage(main, { role: "user", content: "more" });
      const lost = await rejected(store.setSummary(main, { text: "Generated from an old reading.", through: 2 }, { expectedVersion: read! }));
      expect(lost).toBeInstanceOf(StudioConflictError);
      expect((await store.summaryOf(main))!.text).toBe("First.");
    });

    test("a bad write is refused whole; a missing or deleted take, and a take with no message to sit on, answer null", async () => {
      const { store, main } = await seeded(2);
      await store.setSummary(main, { text: "Keep.", through: 1 });
      const bad: unknown[] = [{ text: "", through: 1 }, { text: "  ", through: 1 }, { text: 5, through: 1 }, { text: "x".repeat(100_001), through: 1 }, { text: "x", through: -1 }, { text: "x", through: 1.5 }, { text: "x", through: 1_000_001 }, { text: "x" }, { text: "x", through: 1, last: "m1" }, { text: "x", through: 1, extra: 1 }, "x", []];
      for (const input of bad) await expect(store.setSummary(main, input as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.summaryOf(main))!.text).toBe("Keep.");
      expect(await store.setSummary("nope", { text: "x", through: 1 })).toBeNull();
      expect(await store.summaryOf("nope")).toBeNull();
      const empty = await seeded(0);
      expect(await empty.store.setSummary(empty.main, { text: "Nowhere to sit.", through: 0 })).toBeNull();
      expect(await empty.store.summaryOf(empty.main)).toBeNull();
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

    test("the person's text sits on the message, so choosing another version of it keeps it, and cutting the message takes it, restoring brings it back", async () => {
      const { store, main, ids } = await seeded(2);
      await store.addSwipe(ids[1]!, { content: "another" });
      await store.setSummary(main, { text: "Mine.", through: 2 });
      await store.selectSwipe(ids[1]!, 0);
      expect((await store.summaryOf(main))!.text).toBe("Mine.");
      await store.selectSwipe(ids[1]!, 1);
      expect((await store.summaryOf(main))!.text).toBe("Mine.");
      const cut = await store.cutMessages(main, ids[1]!, "one");
      expect(await store.summaryOf(main)).toBeNull();
      await store.restoreCut(main, cut!.cutId);
      expect((await store.summaryOf(main))!.text).toBe("Mine.");
    });
  });

  describe("the person's saves form a chain", () => {
    test("deleting the newest save's message brings the older save back, and the lines written after the newest still show; restoring brings the newest back", async () => {
      const { store, main, ids } = await seeded(3);
      await store.setSummary(main, { text: "Old.", through: 3 }); // on ids[2]
      const second = await store.appendMessage(main, { role: "assistant", content: "a reply" });
      const l2 = second!.swipes[second!.current]!.id;
      await store.recordDeltas(main, l2, put(row(l2, "L2."), await store.sceneState(main))); // written while Old stood
      const asked = await store.appendMessage(main, { role: "user", content: "and then" });
      await store.setSummary(main, { text: "New.", through: 5 }); // on the later message
      expect((await store.summaryOf(main))!.text).toBe("New.");
      const third = await store.appendMessage(main, { role: "assistant", content: "another reply" });
      const l3 = third!.swipes[third!.current]!.id;
      await store.recordDeltas(main, l3, put(row(l3, "L3."), await store.sceneState(main))); // written after New
      expect((await store.summaryOf(main))!.text).toBe("New.\nL3.");
      const cut = await store.cutMessages(main, asked!.id, "one");
      expect((await store.summaryOf(main))!.text).toBe("Old.\nL2.\nL3.");
      await store.restoreCut(main, cut!.cutId);
      expect((await store.summaryOf(main))!.text).toBe("New.\nL3.");
      expect(ids).toHaveLength(3);
    });

    test("a fork where both takes save with the same counter: each take shows only its own text and its own line", async () => {
      const { store, main, ids } = await seeded(3);
      const prior = await swipeOf(store, main, 1);
      await store.recordDeltas(main, prior, put(row(prior, "Prior."))); // written before either save, so both saves cover it
      const fork = (await store.fork(main, ids[1]!, { name: "Take 2" }))!.id;
      await store.setSummary(main, { text: "Main.", through: 3 });
      await store.setSummary(fork, { text: "Fork.", through: 2 });
      expect([layersOf(await store.sceneState(main)).person!.n, layersOf(await store.sceneState(fork)).person!.n]).toEqual([1, 1]);
      const lineIn = async (branch: string, text: string) => {
        const reply = await store.appendMessage(branch, { role: "assistant", content: text });
        const version = reply!.swipes[reply!.current]!.id;
        await store.recordDeltas(branch, version, put(row(version, text), await store.sceneState(branch)));
      };
      await lineIn(main, "Main line.");
      await lineIn(fork, "Fork line.");
      expect((await store.summaryOf(main))!.text).toBe("Main.\nMain line.");
      expect((await store.summaryOf(fork))!.text).toBe("Fork.\nFork line.");
    });

    test("deleting the only save brings back the generated line it covered, and restoring the message covers it again", async () => {
      const { store, main, ids } = await seeded(2);
      const version = await swipeOf(store, main, 1);
      await store.recordDeltas(main, version, put(row(version, "Line.")));
      const asked = await store.appendMessage(main, { role: "user", content: "and then" });
      await store.setSummary(main, { text: "Saved.", through: 3 });
      expect((await store.summaryOf(main))!.text).toBe("Saved.");
      const cut = await store.cutMessages(main, asked!.id, "one");
      expect((await store.summaryOf(main))!.text).toBe("Line.");
      await store.restoreCut(main, cut!.cutId);
      expect((await store.summaryOf(main))!.text).toBe("Saved.");
      expect(ids).toHaveLength(2);
    });
  });

  describe("a version's summary rows (ChatStore.recordDeltas)", () => {
    test("a row written on a version shows while that version is shown, and again when it is chosen back", async () => {
      const { store, main, ids } = await seeded(2);
      const first = await swipeOf(store, main, 1);
      expect(await store.recordDeltas(main, first, put(row(first, "Turn 1: A.")))).toBe(true);
      expect((await store.summaryOf(main))!.text).toBe("Turn 1: A.");
      await store.addSwipe(ids[1]!, { content: "again" });
      expect(await store.summaryOf(main)).toBeNull();
      const second = await swipeOf(store, main, 1, 1);
      expect(await store.recordDeltas(main, second, put(row(second, "Turn 1: B.")))).toBe(true);
      expect((await store.summaryOf(main))!.text).toBe("Turn 1: B.");
      await store.selectSwipe(ids[1]!, 0);
      expect((await store.summaryOf(main))!.text).toBe("Turn 1: A.");
      await store.selectSwipe(ids[1]!, 1);
      expect((await store.summaryOf(main))!.text).toBe("Turn 1: B.");
    });

    test("a version that is not shown can be written, and stays hidden until it is chosen", async () => {
      const { store, main, ids } = await seeded(2);
      const old = await swipeOf(store, main, 1);
      await store.addSwipe(ids[1]!, { content: "again" });
      expect(await store.recordDeltas(main, old, put(row(old, "Late line.")))).toBe(true);
      expect(await store.summaryOf(main)).toBeNull();
      await store.selectSwipe(ids[1]!, 0);
      expect((await store.summaryOf(main))!.text).toBe("Late line.");
    });

    test("a write is this take's: a fork never writes into the source, the source never writes into a fork made before, and a fork made after has it", async () => {
      const { store, main, ids } = await seeded(4);
      const a = await swipeOf(store, main, 1);
      const tip = await swipeOf(store, main, 3);
      await store.recordDeltas(main, a, put(row(a, "Turn 1: A.")));
      await store.recordDeltas(main, tip, put(row(tip, "Turn 2: B.")));
      const early = await store.fork(main, ids[3]!, { name: "Early" });
      expect((await store.summaryOf(early!.id))!.text).toBe("Turn 1: A.\nTurn 2: B."); // the fork inherits the prefix's writes
      const state = await store.sceneState(early!.id);
      const block = row(tip, "Fork block.", 4, 5_000, { replace: true });
      expect(await store.recordDeltas(early!.id, tip, put(block, state), { expect: heldAs(state!, put(block, state).filter((d) => d.removed), slotOf) })).toBe(true);
      expect((await store.summaryOf(early!.id))!.text).toBe("Fork block."); // the fork's block replaces the rows it saw, in the fork only
      expect((await store.summaryOf(main))!.text).toBe("Turn 1: A.\nTurn 2: B."); // the source is as it was
      const second = await swipeOf(store, main, 1);
      await store.recordDeltas(main, second, put(row(second, "Turn 1: A, revised.")));
      expect((await store.summaryOf(early!.id))!.text).toBe("Fork block."); // nor does the source reach into the fork
      const late = await store.fork(main, ids[3]!, { name: "Late" });
      expect((await store.summaryOf(late!.id))!.text).toBe("Turn 1: A, revised.\nTurn 2: B.");
    });

    test("a row is keyed by the version, so a fork's copy of the message holds the same key and finds the line already there", async () => {
      const { store, main, ids } = await seeded(2);
      const reply = await swipeOf(store, main, 1);
      await store.recordDeltas(main, reply, put(row(reply, "Turn 1: A.")));
      const fork = await store.fork(main, ids[1]!, { name: "F" });
      expect(layersOf(await store.sceneState(fork!.id)).rows.map((r) => r.version)).toEqual([reply]);
      expect((await store.readMessages(fork!.id, { limit: 10 })).messages[1]!.swipes[0]!.id).toBe(reply);
    });

    test("a cut message takes its row with it and restoring the cut brings it back", async () => {
      const { store, main, ids } = await seeded(3);
      const a = await swipeOf(store, main, 1);
      const b = await swipeOf(store, main, 2);
      await store.recordDeltas(main, a, put(row(a, "Turn 1: A.")));
      await store.recordDeltas(main, b, put(row(b, "Turn 2: B.")));
      expect((await store.summaryOf(main))!.text).toBe("Turn 1: A.\nTurn 2: B.");
      const cut = await store.cutMessages(main, ids[1]!, "one");
      expect((await store.summaryOf(main))!.text).toBe("Turn 2: B.");
      await store.restoreCut(main, cut!.cutId);
      expect((await store.summaryOf(main))!.text).toBe("Turn 1: A.\nTurn 2: B.");
    });

    test("a block that replaces earlier rows is written on the version it ends at: a new version or a cut of that message gives the earlier rows back exactly", async () => {
      const { store, main, ids } = await seeded(4);
      const a = await swipeOf(store, main, 1);
      const b = await swipeOf(store, main, 2);
      const end = await swipeOf(store, main, 3);
      await store.recordDeltas(main, a, put(row(a, "Turn 1: A.")));
      await store.recordDeltas(main, b, put(row(b, "Turn 2: B.")));
      const block = put(row(end, "Block.", 4, 2_000, { replace: true }), await store.sceneState(main));
      expect(block.filter((d) => d.removed)).toHaveLength(2);
      await store.recordDeltas(main, end, block);
      expect((await store.summaryOf(main))!.text).toBe("Block.");
      await store.addSwipe(ids[3]!, { content: "again" });
      expect((await store.summaryOf(main))!.text).toBe("Turn 1: A.\nTurn 2: B.");
      await store.selectSwipe(ids[3]!, 0);
      expect((await store.summaryOf(main))!.text).toBe("Block.");
      const cut = await store.cutMessages(main, ids[3]!, "one");
      expect((await store.summaryOf(main))!.text).toBe("Turn 1: A.\nTurn 2: B.");
      await store.restoreCut(main, cut!.cutId);
      expect((await store.summaryOf(main))!.text).toBe("Block.");
    });

    test("a block written over the person's text stands in for it, and a new version of its message brings the person's text back (not the block)", async () => {
      const { store, main, ids } = await seeded(2);
      await store.setSummary(main, { text: "Mine.", through: 2 });
      const end = await swipeOf(store, main, 1);
      await store.recordDeltas(main, end, put(row(end, "Auto block.", 2, 2_000, { replace: true }), await store.sceneState(main)));
      expect((await store.summaryOf(main))!.text).toBe("Auto block.");
      await store.addSwipe(ids[1]!, { content: "regenerated" });
      expect((await store.summaryOf(main))!.text).toBe("Mine.");
      await store.selectSwipe(ids[1]!, 0);
      expect((await store.summaryOf(main))!.text).toBe("Auto block.");
    });

    test("a block that ends at a reply before a user message carrying the person's text lands, judged against the state through that reply", async () => {
      const { store, main, ids } = await seeded(3);
      await store.setSummary(main, { text: "Mine.", through: 3 });
      const read = (await store.sceneState(main))!;
      const end = await swipeOf(store, main, 1);
      const block = put(row(end, "Backfill.", 2, 2_000, { replace: true }), read);
      expect(await store.recordDeltas(main, end, block, { expect: heldAs(read, block.filter((d) => d.removed), slotOf) })).toBe(true);
      expect((await store.summaryOf(main))!.text).toBe("Backfill.");
      expect(ids).toHaveLength(3);
    });

    test("a text the person saves after the run read is newer than the block, so it stays shown", async () => {
      const { store, main } = await seeded(2);
      const end = await swipeOf(store, main, 1);
      const read = await store.sceneState(main);
      await store.setSummary(main, { text: "Saved meanwhile.", through: 2 });
      await store.recordDeltas(main, end, put(row(end, "Auto block.", 2, 500, { replace: true }), read));
      expect((await store.summaryOf(main))!.text).toBe("Saved meanwhile."); // the block was read before the text was saved, so it neither replaces it nor shows beside it
    });

    test("a write of what the version already shows adds nothing", async () => {
      const { store, main, ids } = await seeded(2);
      const reply = await swipeOf(store, main, 1);
      await store.recordDeltas(main, reply, put(row(reply, "Same.")));
      const before = (await store.sceneDeltas(main, ids[1]!))!.messages[0]!.deltas;
      await store.recordDeltas(main, reply, put(row(reply, "Same.")));
      expect((await store.sceneDeltas(main, ids[1]!))!.messages[0]!.deltas).toEqual(before);
    });

    test("a version that is absent, cut, or on a message this take does not show is refused with false", async () => {
      const { store, main, ids } = await seeded(3);
      const line = put(row("x", "x"));
      expect(await store.recordDeltas(main, "nope", line)).toBe(false);
      expect(await store.recordDeltas("nope", await swipeOf(store, main, 1), line)).toBe(false);
      await store.addSwipe(ids[1]!, { content: "again" });
      const first = await swipeOf(store, main, 1, 0);
      await store.cutSwipe(ids[1]!, first);
      expect(await store.recordDeltas(main, first, line)).toBe(false);
      const fork = await store.fork(main, ids[0]!, { name: "Short" });
      expect(await store.recordDeltas(fork!.id, await swipeOf(store, main, 2), line)).toBe(false);
      await store.cutMessages(main, ids[2]!, "one");
      expect(await store.recordDeltas(main, await swipeOf(store, main, 2), line)).toBe(false);
    });

    test("a guard naming the rows the writer removes refuses a write when one changed since it read, and changes nothing", async () => {
      const { store, main } = await seeded(4);
      const a = await swipeOf(store, main, 1);
      const end = await swipeOf(store, main, 3);
      await store.recordDeltas(main, a, put(row(a, "Turn 1: A.")));
      const read = (await store.sceneState(main))!;
      const block = put(row(end, "Block.", 4, 2_000, { replace: true }), read);
      await store.recordDeltas(main, a, [{ slot: "summary", path: [a], value: row(a, "Turn 1: A, changed.") as never, at: 3 }]); // another writer got there first
      const lost = await rejected(store.recordDeltas(main, end, block, { expect: heldAs(read, block.filter((d) => d.removed), slotOf) }));
      expect(lost).toBeInstanceOf(StudioConflictError);
      expect((await store.summaryOf(main))!.text).toBe("Turn 1: A, changed.");
    });

    test("a write that does not fit the slot is refused whole: an undeclared slot, a row of the wrong shape, an oversized one", async () => {
      const { store, main } = await seeded(2);
      const reply = await swipeOf(store, main, 1);
      const at = (value: unknown): Delta[] => [{ slot: "summary", path: [reply], value: value as never, at: 1 }];
      await expect(store.recordDeltas(main, reply, [{ slot: "nope", path: ["x"], value: 1, at: 1 }])).rejects.toBeInstanceOf(StudioValidationError);
      for (const bad of ["just text", { version: reply }, { ...row(reply, "x"), extra: 1 }, { ...row(reply, "x"), through: -1 }, { ...row(reply, "x"), text: 5 }, row(reply, "x".repeat(SANITY_TEXT + 1))]) await expect(store.recordDeltas(main, reply, at(bad))).rejects.toBeInstanceOf(StudioValidationError);
      expect(await store.summaryOf(main)).toBeNull();
    });
  });
}
