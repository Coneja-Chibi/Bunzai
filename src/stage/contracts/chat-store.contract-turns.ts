/**
 * The ChatStore contract suite's turn half: checkpoints
 * that stream without bumping anything, the one-transaction commit that stores a reply with its trace,
 * and the connection and model a scene remembers. chatStoreContract runs it, so every implementation gets it.
 */
import { describe, expect, test } from "bun:test";
import { StudioConflictError, StudioValidationError } from "../../studio/errors";

import type { ChatStore } from "./chat-store";
import { CAST, GEN, SNAP, chatRig } from "./chat-store.contract-rig";

const TRACE = { blocks: [{ source: "character", tokens: 120 }, { source: "history", tokens: 800 }], total: 920 };

export function chatStoreTurnContract(make: (clock: () => number) => ChatStore): void {
  const { seeded, texts } = chatRig(make);
  const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;
  const lastOf = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1_000 })).messages.at(-1)!;

  describe("checkpoints (rule 16)", () => {
    test("opening and saving a checkpoint change no version and no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(2);
      const before = await version(store, main);
      setNow(9_000);
      const turn = await store.beginTurn(main, { kind: "reply" });
      expect(turn).toEqual({ id: expect.any(String), chatId: chat.id, branchId: main, kind: "reply", messageId: null, content: "", baseVersion: before!, startedAt: 9_000, savedAt: 9_000 });
      setNow(9_500);
      const saved = await store.saveCheckpoint(turn!.id, { content: "Half a", trace: TRACE, providerRequestId: "req-1" });
      expect(saved).toEqual({ ...turn!, content: "Half a", trace: TRACE, providerRequestId: "req-1", savedAt: 9_500 });
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
      // A guarded write based on the version read before the stream is not stale because of it.
      expect(await store.appendMessage(main, { role: "user", content: "meanwhile" }, { expectedVersion: before! })).not.toBeNull();
    });

    test("a save that leaves out the trace or request id keeps the ones saved before", async () => {
      const { store, main } = await seeded(1);
      const turn = await store.beginTurn(main, { kind: "reply" });
      await store.saveCheckpoint(turn!.id, { content: "a", trace: TRACE, providerRequestId: "req-1" });
      const later = await store.saveCheckpoint(turn!.id, { content: "ab" });
      expect([later!.content, later!.trace, later!.providerRequestId]).toEqual(["ab", TRACE, "req-1"]);
    });

    test("a branch has one open checkpoint; another branch has its own", async () => {
      const { store, main, ids } = await seeded(2);
      await store.beginTurn(main, { kind: "reply" });
      expect(store.beginTurn(main, { kind: "swipe", messageId: ids[1]! })).rejects.toBeInstanceOf(StudioConflictError);
      const take = await store.fork(main, ids[1]!);
      expect(await store.beginTurn(take!.id, { kind: "reply" })).not.toBeNull();
    });

    test("committing a reply appends it with its generation and trace, bumps once, and closes the checkpoint", async () => {
      const { store, main } = await seeded(2);
      const turn = await store.beginTurn(main, { kind: "reply" });
      const before = await version(store, main);
      const m = await store.commitTurn(turn!.id, { content: "The whole reply", generation: GEN, trace: TRACE }, { expectedVersion: before! });
      expect(m).toMatchObject({ role: "assistant", current: 0, swipes: [{ content: "The whole reply", generation: GEN }] });
      expect(await version(store, main)).toBe(before! + 1);
      expect(await store.swipeTrace(m!.id, m!.swipes[0]!.id)).toEqual(TRACE);
      expect(await store.resumeIncomplete()).toEqual([]);
      expect(await store.saveCheckpoint(turn!.id, { content: "late" })).toBeNull();
      expect(await store.beginTurn(main, { kind: "reply" })).not.toBeNull();
    });

    test("committing a swipe adds it as current; each swipe keeps its own trace", async () => {
      const { store, main, ids } = await seeded(2);
      const first = await store.beginTurn(main, { kind: "swipe", messageId: ids[1]! });
      const once = await store.commitTurn(first!.id, { content: "take two", trace: { n: 2 } });
      const second = await store.beginTurn(main, { kind: "swipe", messageId: ids[1]! });
      const twice = await store.commitTurn(second!.id, { content: "take three", trace: { n: 3 } });
      expect(twice!.current).toBe(2);
      expect(twice!.swipes.map((s) => s.content)).toEqual(["line 2", "take two", "take three"]);
      expect(await store.swipeTrace(ids[1]!, once!.swipes[1]!.id)).toEqual({ n: 2 });
      expect(await store.swipeTrace(ids[1]!, twice!.swipes[2]!.id)).toEqual({ n: 3 });
      expect(await store.swipeTrace(ids[1]!, twice!.swipes[0]!.id)).toBeNull();
    });

    test("a stale commit is a conflict and keeps the paid-for text; an unguarded commit then lands it", async () => {
      const { store, main } = await seeded(1);
      const turn = await store.beginTurn(main, { kind: "reply" });
      const saved = await store.saveCheckpoint(turn!.id, { content: "paid for", trace: TRACE });
      const before = await version(store, main);
      await store.appendMessage(main, { role: "user", content: "edit race" });
      expect(store.commitTurn(turn!.id, { content: "paid for" }, { expectedVersion: before! })).rejects.toBeInstanceOf(StudioConflictError);
      expect(await store.resumeIncomplete()).toEqual([saved!]);
      expect(await texts(store, main)).toEqual(["line 1", "edit race"]);
      await store.commitTurn(turn!.id, { content: "paid for" });
      expect(await texts(store, main)).toEqual(["line 1", "edit race", "paid for"]);
    });

    test("a turn begun from a stale version is a conflict; a resumed turn's base version catches a later write", async () => {
      const { store, main } = await seeded(1);
      const before = await version(store, main);
      await store.appendMessage(main, { role: "user", content: "moved on" });
      expect(store.beginTurn(main, { kind: "reply" }, { expectedVersion: before! })).rejects.toBeInstanceOf(StudioConflictError);
      expect(await store.resumeIncomplete()).toEqual([]);
      const turn = await store.beginTurn(main, { kind: "reply" }, { expectedVersion: before! + 1 });
      expect(turn!.baseVersion).toBe(before! + 1);
      await store.appendMessage(main, { role: "user", content: "while it streamed" });
      const [resumed] = await store.resumeIncomplete();
      expect(store.commitTurn(resumed!.id, { content: "r" }, { expectedVersion: resumed!.baseVersion })).rejects.toBeInstanceOf(StudioConflictError);
    });

    test("a stale swipe commit is a conflict and keeps the checkpoint", async () => {
      const { store, main, ids } = await seeded(2);
      const turn = await store.beginTurn(main, { kind: "swipe", messageId: ids[1]! });
      await store.appendMessage(main, { role: "user", content: "edit race" });
      expect(store.commitTurn(turn!.id, { content: "paid for" }, { expectedVersion: turn!.baseVersion })).rejects.toBeInstanceOf(StudioConflictError);
      expect((await store.resumeIncomplete()).map((c) => c.id)).toEqual([turn!.id]);
      expect((await store.readMessages(main, { limit: 5 })).messages[1]!.swipes).toHaveLength(1);
    });

    test("a swipe whose message a restore moved to a new take commits as null, and the take is free", async () => {
      const { store, main, ids } = await seeded(2);
      const turn = await store.beginTurn(main, { kind: "swipe", messageId: ids[1]! });
      const cut = await store.cutMessages(main, ids[1]!, "from");
      await store.appendMessage(main, { role: "user", content: "after" });
      const back = await store.restoreCut(main, cut!.cutId);
      expect(back!.branchId).not.toBe(main);
      const takeVersion = await version(store, back!.branchId);
      expect(await store.commitTurn(turn!.id, { content: "stray" })).toBeNull();
      expect(await version(store, back!.branchId)).toBe(takeVersion);
      expect((await lastOf(store, back!.branchId)).swipes).toHaveLength(1);
      expect(await store.beginTurn(back!.branchId, { kind: "swipe", messageId: ids[1]! })).not.toBeNull();
    });

    test("a swipe turn only targets an assistant message, as RoleCall's swipe controls do", async () => {
      const { store, main, ids } = await seeded(2);
      expect(await store.beginTurn(main, { kind: "swipe", messageId: ids[0]! })).toBeNull();
    });

    test("a swipe whose message was cut commits as null and keeps its checkpoint; dropping removes it", async () => {
      const { store, main, ids } = await seeded(2);
      const turn = await store.beginTurn(main, { kind: "swipe", messageId: ids[1]! });
      await store.cutMessages(main, ids[1]!, "one");
      expect(await store.commitTurn(turn!.id, { content: "orphan" })).toBeNull();
      expect((await store.resumeIncomplete()).map((c) => c.id)).toEqual([turn!.id]);
      expect(await store.dropTurn(turn!.id)).toBe(true);
      expect(await store.dropTurn(turn!.id)).toBe(false);
      expect(await store.resumeIncomplete()).toEqual([]);
    });

    test("a turn cannot open on an absent branch, or swipe a message that is absent, cut, or elsewhere", async () => {
      const { store, main, ids } = await seeded(3);
      const take = await store.fork(main, ids[1]!);
      await store.cutMessages(main, ids[2]!, "one");
      expect(await store.beginTurn("nope", { kind: "reply" })).toBeNull();
      expect(await store.beginTurn(main, { kind: "swipe", messageId: "nope" })).toBeNull();
      expect(await store.beginTurn(main, { kind: "swipe", messageId: ids[2]! })).toBeNull();
      expect(await store.beginTurn(take!.id, { kind: "swipe", messageId: ids[0]! })).toBeNull();
      expect(await store.resumeIncomplete()).toEqual([]);
    });

    test("resumeIncomplete lists open turns oldest first, hides a deleted chat's or take's, and brings them back", async () => {
      const { store, chat, main, ids, setNow } = await seeded(2);
      const take = await store.fork(main, ids[1]!);
      setNow(2_000);
      const a = await store.beginTurn(take!.id, { kind: "reply" });
      setNow(3_000);
      const b = await store.beginTurn(main, { kind: "reply" });
      expect((await store.resumeIncomplete()).map((c) => c.id)).toEqual([a!.id, b!.id]);
      await store.deleteBranch(take!.id);
      expect((await store.resumeIncomplete()).map((c) => c.id)).toEqual([b!.id]);
      expect(await store.saveCheckpoint(a!.id, { content: "x" })).toBeNull();
      await store.deleteChat(chat.id);
      expect(await store.resumeIncomplete()).toEqual([]);
      expect(await store.commitTurn(b!.id, { content: "x" })).toBeNull();
      expect(await store.dropTurn(b!.id)).toBe(false);
      await store.restoreChat(chat.id);
      await store.restoreBranch(take!.id);
      expect((await store.resumeIncomplete()).map((c) => c.id)).toEqual([a!.id, b!.id]);
    });

    test("purging a chat takes its checkpoints with it", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      await store.beginTurn(main, { kind: "reply" });
      await store.deleteChat(chat.id);
      setNow(50_000);
      await store.purgeChats(40_000);
      await store.restoreChat(chat.id);
      expect(await store.resumeIncomplete()).toEqual([]);
    });

    test("bad progress or results are refused and change nothing", async () => {
      const { store, main } = await seeded(1);
      const turn = await store.beginTurn(main, { kind: "reply" });
      expect(store.saveCheckpoint(turn!.id, { content: 5 as unknown as string })).rejects.toBeInstanceOf(StudioValidationError);
      expect(store.saveCheckpoint(turn!.id, { content: "x", trace: { n: Number.NaN } })).rejects.toBeInstanceOf(StudioValidationError);
      expect(store.commitTurn(turn!.id, { content: "x", trace: [] as unknown as { n: number } })).rejects.toBeInstanceOf(StudioValidationError);
      expect(store.beginTurn(main, { kind: "later" } as unknown as { kind: "reply" })).rejects.toBeInstanceOf(StudioValidationError);
      expect(store.beginTurn(main, { kind: "reply", messageId: "x" } as unknown as { kind: "reply" })).rejects.toBeInstanceOf(StudioValidationError);
      // A misspelt field is refused, never dropped: the trace or request id would be lost without a word.
      expect(store.saveCheckpoint(turn!.id, { content: "x", traces: {} } as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect(store.commitTurn(turn!.id, { content: "x", providerRequestID: "r" } as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.resumeIncomplete())[0]!.content).toBe("");
    });
  });

  describe("continuing the last reply (rule 31)", () => {
    const reply = async (store: ChatStore, main: string, id: string) => (await store.readMessages(main, { limit: 50 })).messages.find((m) => m.id === id)!;

    test("a continue opens on an assistant message like a swipe, and nowhere else", async () => {
      const { store, main, ids } = await seeded(3);
      const take = await store.fork(main, ids[1]!);
      await store.cutMessages(main, ids[2]!, "one");
      expect(await store.beginTurn(main, { kind: "continue", messageId: ids[0]! })).toBeNull();
      expect(await store.beginTurn(main, { kind: "continue", messageId: ids[2]! })).toBeNull();
      expect(await store.beginTurn(main, { kind: "continue", messageId: "nope" })).toBeNull();
      expect(await store.beginTurn(take!.id, { kind: "continue", messageId: ids[1]!.concat("x") })).toBeNull();
      expect(await store.resumeIncomplete()).toEqual([]);
      const turn = await store.beginTurn(main, { kind: "continue", messageId: ids[1]! });
      expect(turn).toMatchObject({ kind: "continue", messageId: ids[1], content: "" });
      expect(store.beginTurn(main, { kind: "reply" })).rejects.toBeInstanceOf(StudioConflictError);
      expect(store.beginTurn(main, { kind: "continue" } as unknown as { kind: "reply" })).rejects.toBeInstanceOf(StudioValidationError);
    });

    test("committing appends to the current swipe, keeps the old text in its history, adds no swipe, and bumps once", async () => {
      const { store, main, ids } = await seeded(2);
      const turn = await store.beginTurn(main, { kind: "continue", messageId: ids[1]! });
      await store.saveCheckpoint(turn!.id, { content: " and then" });
      const before = await version(store, main);
      const m = await store.commitTurn(turn!.id, { content: " and then the lamp", generation: { finishReason: "stop" }, trace: { n: 1 }, request: { texts: ["x"] } }, { expectedVersion: before! });
      expect(m).toMatchObject({ id: ids[1], current: 0, swipes: [{ content: "line 2 and then the lamp", generation: { finishReason: "stop" } }] });
      expect(m!.swipes).toHaveLength(1);
      expect(await store.swipeHistory(ids[1]!, m!.swipes[0]!.id)).toEqual(["line 2"]);
      expect(await version(store, main)).toBe(before! + 1);
      expect(await store.resumeIncomplete()).toEqual([]);
      // The trace and the request text it was handed are not stored: they belong to the prompt that wrote the first part.
      expect(await store.swipeTrace(ids[1]!, m!.swipes[0]!.id)).toBeNull();
      expect(await store.lastRequest(main)).toBeNull();
    });

    test("it extends the swipe that is current, not the first", async () => {
      const { store, main, ids } = await seeded(2);
      const s = await store.beginTurn(main, { kind: "swipe", messageId: ids[1]! });
      await store.commitTurn(s!.id, { content: "second take" });
      const turn = await store.beginTurn(main, { kind: "continue", messageId: ids[1]! });
      const m = await store.commitTurn(turn!.id, { content: "..." });
      expect(m!.swipes.map((w) => w.content)).toEqual(["line 2", "second take..."]);
      expect(m!.current).toBe(1);
    });

    test("the generation takes the continuation's finish reason and adds tokens and time, keeping model and reasoning", async () => {
      const { store, main, ids } = await seeded(2);
      const first = await store.beginTurn(main, { kind: "swipe", messageId: ids[1]! });
      await store.commitTurn(first!.id, { content: "cut off", generation: { ...GEN, finishReason: "length" } });
      const turn = await store.beginTurn(main, { kind: "continue", messageId: ids[1]! });
      const m = await store.commitTurn(turn!.id, { content: " finished", generation: { model: "other", finishReason: "stop", completionTokens: 30, generationMs: 600 } });
      expect(m!.swipes[1]!.generation).toEqual({ ...GEN, finishReason: "stop", completionTokens: 150, generationMs: 3_000 });
      const dropped = await store.beginTurn(main, { kind: "continue", messageId: ids[1]! });
      const bare = await store.commitTurn(dropped!.id, { content: "!" });
      expect(bare!.swipes[1]!.generation).not.toHaveProperty("finishReason");
    });

    test("a swipe with no generation takes the continuation's", async () => {
      const { store, main, ids } = await seeded(2);
      const turn = await store.beginTurn(main, { kind: "continue", messageId: ids[1]! });
      const m = await store.commitTurn(turn!.id, { content: "+", generation: GEN });
      expect(m!.swipes[0]!.generation).toEqual(GEN);
    });

    test("an edit or a version change since it began is a conflict that keeps the checkpoint; unguarded, it appends to what is current", async () => {
      const { store, main, ids } = await seeded(2);
      const turn = await store.beginTurn(main, { kind: "continue", messageId: ids[1]! });
      await store.saveCheckpoint(turn!.id, { content: " paid for" });
      const swipeId = (await reply(store, main, ids[1]!)).swipes[0]!.id;
      await store.editSwipe(ids[1]!, swipeId, "line 2, edited");
      expect(store.commitTurn(turn!.id, { content: " paid for" }, { expectedVersion: turn!.baseVersion })).rejects.toBeInstanceOf(StudioConflictError);
      expect((await store.resumeIncomplete()).map((c) => c.content)).toEqual([" paid for"]);
      expect((await reply(store, main, ids[1]!)).swipes[0]!.content).toBe("line 2, edited");
      const m = await store.commitTurn(turn!.id, { content: " paid for" });
      expect(m!.swipes[0]!.content).toBe("line 2, edited paid for");
      expect(await store.swipeHistory(ids[1]!, swipeId)).toEqual(["line 2", "line 2, edited"]);
    });

    test("selecting another version since it began is a conflict too", async () => {
      const { store, main, ids } = await seeded(2);
      const s = await store.beginTurn(main, { kind: "swipe", messageId: ids[1]! });
      await store.commitTurn(s!.id, { content: "second" });
      const turn = await store.beginTurn(main, { kind: "continue", messageId: ids[1]! });
      await store.selectSwipe(ids[1]!, 0);
      expect(store.commitTurn(turn!.id, { content: "more" }, { expectedVersion: turn!.baseVersion })).rejects.toBeInstanceOf(StudioConflictError);
    });

    test("a message cut or moved to a new take commits as null and keeps the checkpoint", async () => {
      const { store, main, ids } = await seeded(2);
      const turn = await store.beginTurn(main, { kind: "continue", messageId: ids[1]! });
      await store.cutMessages(main, ids[1]!, "one");
      expect(await store.commitTurn(turn!.id, { content: "orphan" })).toBeNull();
      expect((await store.resumeIncomplete()).map((c) => c.id)).toEqual([turn!.id]);
      expect(await store.dropTurn(turn!.id)).toBe(true);
    });
  });

  describe("traces (rule 15)", () => {
    test("reads never carry a trace, and a swipe made without one has none", async () => {
      const { store, main, ids } = await seeded(1);
      const turn = await store.beginTurn(main, { kind: "reply" });
      await store.commitTurn(turn!.id, { content: "r", trace: TRACE });
      const shown = await lastOf(store, main);
      expect(Object.keys(shown.swipes[0]!).sort()).toEqual(["content", "createdAt", "id", "pinned"]);
      const plain = (await store.readMessages(main, { limit: 1 })).messages[0]!;
      expect(await store.swipeTrace(ids[0]!, plain.swipes[0]!.id)).toBeNull();
      expect(await store.swipeTrace("nope", "nope")).toBeNull();
    });

    test("a fork and a cut restored as a new take keep the traces, each its own copy", async () => {
      const { store, main } = await seeded(1);
      const turn = await store.beginTurn(main, { kind: "reply" });
      const reply = await store.commitTurn(turn!.id, { content: "r", trace: TRACE });
      const swipeId = reply!.swipes[0]!.id;
      const take = await store.fork(main, reply!.id);
      const copy = await lastOf(store, take!.id);
      expect(await store.swipeTrace(copy.id, swipeId)).toEqual(TRACE);

      const cut = await store.cutMessages(main, reply!.id, "from");
      await store.appendMessage(main, { role: "user", content: "after" });
      const back = await store.restoreCut(main, cut!.cutId);
      expect(back!.branchId).not.toBe(main);
      expect(await store.swipeTrace((await lastOf(store, back!.branchId)).id, swipeId)).toEqual(TRACE);
    });
  });

  describe("the scene's connection (rule 18)", () => {
    const PICK = { id: "conn-1", model: "anthropic/claude-opus-5-5" };

    test("a new chat has none; setConnection sets, replaces, and clears it, bumping no version and moving no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      expect(chat.connection).toBeUndefined();
      const before = await version(store, main);
      setNow(8_000);
      expect(await store.setConnection(chat.id, PICK)).toEqual({ ...chat, connection: PICK });
      expect((await store.getChat(chat.id))!.connection).toEqual(PICK);
      expect((await store.listChats()).chats.map((c) => c.connection)).toEqual([PICK]);
      const other = { id: "conn-2", model: "deepseek-v4-pro" };
      expect((await store.setConnection(chat.id, other))!.connection).toEqual(other);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
      expect(await store.setConnection(chat.id, null)).toEqual(chat);
      expect("connection" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("it is the chat's, so forks, recasts, and appends leave it alone", async () => {
      const { store, chat, main, ids } = await seeded(2);
      await store.setConnection(chat.id, PICK);
      await store.fork(main, ids[0]!);
      await store.appendMessage(main, { role: "user", content: "more" });
      await store.renameChat(chat.id, "Renamed");
      await store.setCast(chat.id, { cast: { ...CAST, character: { ...CAST.character, version: 5 } }, snapshot: SNAP });
      expect((await store.getChat(chat.id))!.connection).toEqual(PICK);
      expect((await store.revertCast(chat.id))!.connection).toEqual(PICK);
    });

    test("an absent or deleted chat takes none; a restored one keeps what it had", async () => {
      const { store, chat } = await seeded(1);
      await store.setConnection(chat.id, PICK);
      expect(await store.setConnection("nope", PICK)).toBeNull();
      await store.deleteChat(chat.id);
      expect(await store.setConnection(chat.id, null)).toBeNull();
      expect((await store.chatGraveyard()).chats[0]!.connection).toEqual(PICK);
      expect((await store.restoreChat(chat.id))!.connection).toEqual(PICK);
    });

    test("anything but an id and a model, both non-empty text, is refused and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      await store.setConnection(chat.id, PICK);
      const bads = [{ id: "", model: "m" }, { id: "c", model: "" }, { id: "c" }, { model: "m" }, { id: 1, model: "m" }, { ...PICK, extra: 1 }, "conn-1", [], undefined];
      for (const bad of bads) {
        expect(store.setConnection(chat.id, bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
      expect((await store.getChat(chat.id))!.connection).toEqual(PICK);
    });
  });
}
