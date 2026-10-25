/**
 * The ChatStore contract suite, first pass. Every implementation runs it:
 * the memory one in phase 0, SQLite in phase 1, with this file unchanged. Numbers in test names point
 * at the spec's rules (r) and edge cases (e).
 */
import { describe, expect, test } from "bun:test";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { CAST, GEN, SNAP, chatRig } from "./chat-store.contract-rig";
import { chatStoreCutContract } from "./chat-store.contract-cuts";
import { chatStoreFoldersContract } from "./chat-store.contract-folders";
import { chatStoreHistoryContract } from "./chat-store.contract-history";
import { chatStoreHiddenContract } from "./chat-store.contract-hidden";
import { chatStoreAtContract } from "./chat-store.contract-at";
import { chatStoreSearchContract } from "./chat-store.contract-search";
import { chatStoreSwipeCutContract } from "./chat-store.contract-swipe-cuts";
import { chatStorePersonaContract } from "./chat-store.contract-persona";
import { chatStoreStatsContract } from "./chat-store.contract-stats";
import { chatStoreVariantContract } from "./chat-store.contract-variant";
import { chatStoreLoreContract } from "./chat-store.contract-lore";
import { chatStorePresetContract } from "./chat-store.contract-preset";
import { chatStorePropsContract } from "./chat-store.contract-props";
import { chatStoreOpeningContract } from "./chat-store.contract-opening";
import { chatStorePromptingContract } from "./chat-store.contract-prompting";
import { chatStoreCompendiumContract } from "./chat-store.contract-compendium";
import { chatStoreReceiptsContract } from "./chat-store.contract-receipts";
import { chatStoreTreesContract } from "./chat-store.contract-trees";
import { chatStoreParticipantsContract } from "./chat-store.contract-participants";
import { chatStoreRegexContract } from "./chat-store.contract-regex";
import { chatStoreFinalCutContract } from "./chat-store.contract-final-cut";
import { chatStoreTrackersContract } from "./chat-store.contract-trackers";
import { chatStoreSummaryContract } from "./chat-store.contract-summary";
import { chatStoreDirectorContract } from "./chat-store.contract-director";
import { chatStoreBackdropContract } from "./chat-store.contract-backdrop";
import { chatStoreRequestContract } from "./chat-store.contract-request";
import { chatStoreWriteContract } from "./chat-store.contract-writes";
import { chatStoreTurnContract } from "./chat-store.contract-turns";

export function chatStoreContract(label: string, make: (clock: () => number) => ChatStore): void {
  const { rig, seeded, texts } = chatRig(make);

  describe(`ChatStore contract: ${label}`, () => {
    describe("chats and messages", () => {
      test("r1. a new chat has one main branch, and it is active; the cast keeps its versions", async () => {
        const { store } = rig();
        const chat = await store.createChat({ title: "Night market", cast: CAST, snapshot: SNAP });
        const branches = await store.listBranches(chat.id);
        expect(branches).toHaveLength(1);
        expect(branches[0]).toMatchObject({ name: "main", id: chat.activeBranchId, parentBranchId: null });
        expect((await store.getChat(chat.id))?.cast).toEqual(CAST);
      });

      test("r2. appending numbers messages in order, each with one current swipe", async () => {
        const { store, main } = await seeded(3);
        const { messages } = await store.readMessages(main, { limit: 10 });
        expect(messages.map((m) => [m.seq, m.role, m.swipes.length, m.current])).toEqual([
          [1, "user", 1, 0],
          [2, "assistant", 1, 0],
          [3, "user", 1, 0],
        ]);
      });

      test("r3. adding a swipe keeps the earlier ones and makes the new one current", async () => {
        const { store, ids } = await seeded(2);
        const m = await store.addSwipe(ids[1]!, { content: "a second take", generation: GEN });
        expect(m?.swipes.map((s) => s.content)).toEqual(["line 2", "a second take"]);
        expect(m?.current).toBe(1);
        expect(m?.swipes[1]?.generation).toEqual(GEN);
      });

      test("r4. selecting a swipe changes only which one is current", async () => {
        const { store, ids } = await seeded(2);
        await store.addSwipe(ids[1]!, { content: "take two" });
        const m = await store.selectSwipe(ids[1]!, 0);
        expect(m?.current).toBe(0);
        expect(m?.swipes.map((s) => s.content)).toEqual(["line 2", "take two"]);
      });

      test("r5. an edit keeps the text it replaced and moves the chat up; an edit to the same text changes nothing", async () => {
        const { store, main, ids, chat, setNow } = await seeded(2);
        const swipeId = (await store.readMessages(main, { limit: 5 })).messages[1]!.swipes[0]!.id;
        setNow(2_000);
        await store.editSwipe(ids[1]!, swipeId, "revised once");
        await store.editSwipe(ids[1]!, swipeId, "revised twice");
        expect((await store.getChat(chat.id))!.updatedAt).toBe(2_000);
        setNow(3_000);
        await store.editSwipe(ids[1]!, swipeId, "revised twice");
        expect(await store.swipeHistory(ids[1]!, swipeId)).toEqual(["line 2", "revised once"]);
        expect((await store.getChat(chat.id))!.updatedAt).toBe(2_000);
      });

      test("r7. reads are paged in sequence order and report where to continue", async () => {
        const { store, main } = await seeded(5);
        const first = await store.readMessages(main, { limit: 2 });
        expect(first.messages.map((m) => m.seq)).toEqual([1, 2]);
        expect(first.nextSeq).toBe(3);
        const last = await store.readMessages(main, { fromSeq: 5, limit: 2 });
        expect(last.messages.map((m) => m.seq)).toEqual([5]);
        expect(last.nextSeq).toBeNull();
      });

      test("r9. invalid input throws and writes nothing", async () => {
        const { store, main, ids } = await seeded(1);
        await expect(store.createChat({ title: "", cast: CAST, snapshot: SNAP })).rejects.toBeInstanceOf(StudioValidationError);
        await expect(store.appendMessage(main, { role: "narrator" as never, content: "x" })).rejects.toBeInstanceOf(
          StudioValidationError,
        );
        await expect(store.appendMessage(main, { role: "user", content: 7 as never })).rejects.toBeInstanceOf(
          StudioValidationError,
        );
        await expect(store.readMessages(main, { limit: 0 })).rejects.toBeInstanceOf(StudioValidationError);
        await expect(store.addSwipe(ids[0]!, { content: null as never })).rejects.toBeInstanceOf(StudioValidationError);
        expect(await texts(store, main)).toEqual(["line 1"]);
      });

      test("r9b. countMessages counts without reading, and a cast carries its listing fields", async () => {
        const { store, main } = await seeded(3);
        expect(await store.countMessages(main)).toBe(3);
        expect(await store.countMessages("no-such-branch")).toBe(0);
        const chat = await store.createChat({ title: "T", cast: { character: { id: "vera", version: 2, name: "Vera", hasArt: true, accent: "#ff00aa" } }, snapshot: { character: {} } });
        expect((await store.getChat(chat.id))?.cast.character).toEqual({ id: "vera", version: 2, name: "Vera", hasArt: true, accent: "#ff00aa" });
        await expect(store.createChat({ title: "T", cast: { character: { id: "vera", version: 2, name: 5 as never } }, snapshot: { character: {} } })).rejects.toBeInstanceOf(StudioValidationError);
        // an accent that is not a #rrggbb color (a CSS fragment) is refused, never stored
        await expect(store.createChat({ title: "T", cast: { character: { id: "vera", version: 2, accent: "red;background:url(x)" } }, snapshot: { character: {} } })).rejects.toBeInstanceOf(StudioValidationError);
        await expect(store.createChat({ title: "T", cast: { character: { id: "vera", version: 2, accent: "#fff" } }, snapshot: { character: {} } })).rejects.toBeInstanceOf(StudioValidationError);
      });

      test("r9a. appendMessages writes every message in order, or none of them", async () => {
        const { store, main } = await seeded(1);
        await expect(store.appendMessages(main, [{ role: "assistant", content: "greeting" }, { role: "user", content: 7 as never }])).rejects.toBeInstanceOf(StudioValidationError);
        await expect(store.appendMessages(main, [])).rejects.toBeInstanceOf(StudioValidationError);
        expect(await texts(store, main)).toEqual(["line 1"]);
        const before = (await store.readMessages(main, { limit: 10 })).branchVersion!;
        const added = await store.appendMessages(main, [{ role: "assistant", content: "greeting" }, { role: "user", content: "hello" }], { expectedVersion: before });
        expect(added?.map((m) => [m.role, m.seq])).toEqual([["assistant", 2], ["user", 3]]);
        expect(await texts(store, main)).toEqual(["line 1", "greeting", "hello"]);
        expect((await store.readMessages(main, { limit: 10 })).branchVersion).toBe(before + 2);
      });

      test("r9. a malformed page start or generation throws and writes nothing", async () => {
        const { store, main, ids } = await seeded(2);
        for (const fromSeq of [Number.NaN, 1.5, "2" as never]) {
          await expect(store.readMessages(main, { fromSeq, limit: 5 })).rejects.toBeInstanceOf(StudioValidationError);
        }
        await expect(store.addSwipe(ids[1]!, { content: "x", generation: { model: () => 1 } as never })).rejects.toBeInstanceOf(
          StudioValidationError,
        );
        expect((await store.readMessages(main, { limit: 5 })).messages[1]!.swipes).toHaveLength(1);
      });

      test("r9. generation details must be plain data, and come back exactly as given", async () => {
        const { store, ids } = await seeded(1);
        const bad: unknown[] = [
          { ...GEN, promptTokens: Number.NaN },
          { ...GEN, generationMs: Number.POSITIVE_INFINITY },
          { ...GEN, reasoningMs: Number.NaN },
          { ...GEN, tagThinkingMs: "3s" },
          { ...GEN, guidance: 4 },
          { ...GEN, model: new Date(0) },
          { ...GEN, samplers: new Map([["temperature", 1]]) },
          { ...GEN, samplers: { temperature: 10n } },
          { ...GEN, samplers: { nested: { deep: 1 } } },
          { ...GEN, reasoning: { text: 7 } },
          { ...GEN, prefill: 4 },
          { ...GEN, thinkingEnd: 0 },
          { ...GEN, thinkingEnd: 1.5 },
          { ...GEN, thinkingEnd: "9" },
          { ...GEN, surprise: "unknown field" },
        ];
        for (const generation of bad) {
          await expect(store.addSwipe(ids[0]!, { content: "x", generation: generation as never })).rejects.toBeInstanceOf(
            StudioValidationError,
          );
        }
        const m = await store.addSwipe(ids[0]!, { content: "ok", generation: { ...GEN, presetName: undefined } });
        const { presetName: _dropped, ...expected } = GEN;
        expect(m?.swipes[1]?.generation).toStrictEqual(expected);
      });

      test("r9. validation comes before absence, and numbers past the safe range are refused", async () => {
        const { store, main } = await seeded(1);
        await expect(store.fork("nope", "nope", { name: "   " })).rejects.toBeInstanceOf(StudioValidationError);
        await expect(
          store.createChat({ title: "T", cast: { character: { id: "vera", version: 2 ** 63 } }, snapshot: { character: {} } }),
        ).rejects.toBeInstanceOf(StudioValidationError);
        const huge = 2 ** 63;
        await expect(store.readMessages(main, { limit: huge })).rejects.toBeInstanceOf(StudioValidationError);
        await expect(store.readMessages(main, { fromSeq: huge, limit: 5 })).rejects.toBeInstanceOf(StudioValidationError);
        await expect(store.appendMessage(main, { role: "user", content: "x" }, { expectedVersion: huge })).rejects.toBeInstanceOf(
          StudioValidationError,
        );
      });

      test("r2. a new message and its first swipe share one timestamp", async () => {
        let t = 0;
        const store = make(() => ++t);
        const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
        const m = await store.appendMessage(chat.activeBranchId, { role: "user", content: "hi" });
        expect(m!.swipes[0]!.createdAt).toBe(m!.createdAt);
      });

      test("r10. a cast rejects an unknown member, including a removed preset (rule 19), never dropping it silently", async () => {
        const { store } = rig();
        const withPreset = { ...CAST, preset: { id: "not a cast member anymore" } };
        await expect(store.createChat({ title: "T", cast: withPreset as never, snapshot: SNAP })).rejects.toBeInstanceOf(StudioValidationError);
        const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
        await expect(
          store.setCast(chat.id, { cast: withPreset as never, snapshot: SNAP }),
        ).rejects.toBeInstanceOf(StudioValidationError);
        expect((await store.getChat(chat.id))?.cast).toEqual(CAST);
      });

      test("r10. a chat keeps a frozen copy of its cast, returned exactly and never shared", async () => {
        const { store } = rig();
        const input = structuredClone(SNAP);
        const chat = await store.createChat({ title: "Frozen", cast: CAST, snapshot: input });
        (input.character as { id: string }).id = "changed after";
        const first = await store.castSnapshot(chat.id);
        expect(first).toStrictEqual(SNAP);
        (first!.character as { id: string }).id = "changed a copy";
        expect(await store.castSnapshot(chat.id)).toStrictEqual(SNAP);
      });

      test("r10. the snapshot must match the cast and hold only JSON", async () => {
        const { store } = rig();
        const bad: unknown[] = [
          undefined,
          {},
          { character: SNAP.character },
          { ...SNAP, preset: { id: "not in the cast" } },
          { ...SNAP, character: "not an object" },
          { ...SNAP, character: [1, 2] },
          { ...SNAP, character: { when: new Date(0) } },
          { ...SNAP, character: { lookup: new Map() } },
          { ...SNAP, character: { n: Number.NaN } },
          { ...SNAP, character: { gone: undefined } },
          { ...SNAP, character: { list: [1, undefined] } },
          { ...SNAP, character: { big: 1n } },
          // eslint-disable-next-line no-sparse-arrays
          { ...SNAP, character: { holes: [1, , 3] } },
          { ...SNAP, extra: { id: "not a cast member" } },
          { ...SNAP, character: { zero: -0 } },
          (() => {
            const loop: Record<string, unknown> = { id: "loop" };
            loop.self = loop;
            return { ...SNAP, character: loop };
          })(),
        ];
        for (const snapshot of bad) {
          await expect(store.createChat({ title: "T", cast: CAST, snapshot: snapshot as never })).rejects.toBeInstanceOf(
            StudioValidationError,
          );
        }
        expect(await store.listChats()).toEqual({ chats: [], quarantined: [] });
      });

      test("r10. a deleted chat's snapshot is hidden until restored; an absent chat has none", async () => {
        const { store } = rig();
        const chat = await store.createChat({ title: "T", cast: CAST, snapshot: SNAP });
        await store.deleteChat(chat.id);
        expect(await store.castSnapshot(chat.id)).toBeNull();
        await store.restoreChat(chat.id);
        expect(await store.castSnapshot(chat.id)).toStrictEqual(SNAP);
        expect(await store.castSnapshot("nope")).toBeNull();
      });

      test("r9. absent ids give null or empty, never an exception", async () => {
        const { store } = rig();
        expect(await store.getChat("nope")).toBeNull();
        expect(await store.listBranches("nope")).toEqual([]);
        expect(await store.appendMessage("nope", { role: "user", content: "x" })).toBeNull();
        expect(await store.readMessages("nope", { limit: 5 })).toEqual({ messages: [], nextSeq: null, branchVersion: null });
        expect(await store.addSwipe("nope", { content: "x" })).toBeNull();
        expect(await store.swipeHistory("nope", "nope")).toEqual([]);
        expect(await store.fork("nope", "nope")).toBeNull();
      });

      test("listChats filters by character, and renameChat updates the title", async () => {
        const { store, setNow } = rig();
        const a = await store.createChat({ title: "A", cast: CAST, snapshot: SNAP });
        await store.createChat({ title: "B", cast: { character: { id: "other", version: 1 } }, snapshot: { character: { id: "other" } } });
        expect((await store.listChats({ characterId: "vera" })).chats.map((c) => c.id)).toEqual([a.id]);
        setNow(5_000);
        expect(await store.renameChat(a.id, "A, renamed")).toMatchObject({ title: "A, renamed", updatedAt: 5_000 });
      });

      // Bug 5: listChats/chatGraveyard return { chats,
      // quarantined } so one damaged row never hides the rest of a list. A healthy store's
      // quarantined list is always empty, on every backend.
      test("r26. listChats and chatGraveyard carry an empty quarantined list when every row is healthy", async () => {
        const { store } = await seeded(1);
        const chat = (await store.listChats()).chats[0]!;
        await store.deleteChat(chat.id);
        expect(await store.listChats()).toEqual({ chats: [], quarantined: [] });
        expect((await store.chatGraveyard()).quarantined).toEqual([]);
      });
    });

    describe("forking copies, and the branches share nothing afterwards", () => {
      test("r6. a fork holds copies up to and including the fork message, and becomes active", async () => {
        const { store, chat, main, ids } = await seeded(4);
        const branch = await store.fork(main, ids[1]!, { name: "what if" });
        expect(branch).toMatchObject({ chatId: chat.id, name: "what if", parentBranchId: main, forkMessageId: ids[1] });
        expect(await texts(store, branch!.id)).toEqual(["line 1", "line 2"]);
        expect((await store.getChat(chat.id))?.activeBranchId).toBe(branch!.id);
      });

      test("r6. a fork keeps the chosen swipe at the fork point", async () => {
        const { store, main, ids } = await seeded(2);
        const withTake = await store.addSwipe(ids[1]!, { content: "take two" });
        const firstSwipe = withTake!.swipes[0]!.id;
        const branch = await store.fork(main, ids[1]!, { swipeId: firstSwipe });
        expect(branch?.forkSwipeId).toBe(firstSwipe);
        expect(await texts(store, branch!.id)).toEqual(["line 1", "line 2"]);
        expect(await texts(store, main)).toEqual(["line 1", "take two"]);
      });

      test("r6. edits, swipes, and appends on either side never reach the other", async () => {
        const { store, main, ids } = await seeded(2);
        const branch = await store.fork(main, ids[1]!);
        const copy = (await store.readMessages(branch!.id, { limit: 5 })).messages[1]!;
        await store.editSwipe(copy.id, copy.swipes[0]!.id, "edited on the branch");
        await store.addSwipe(ids[1]!, { content: "new take on main" });
        await store.appendMessage(main, { role: "user", content: "main only" });
        await store.appendMessage(branch!.id, { role: "user", content: "branch only" });
        expect(await texts(store, main)).toEqual(["line 1", "new take on main", "main only"]);
        expect(await texts(store, branch!.id)).toEqual(["line 1", "edited on the branch", "branch only"]);
      });

      test("r6. the fork-point message shares no swipe state or edit history with its original", async () => {
        const { store, main, ids } = await seeded(2);
        const branch = await store.fork(main, ids[1]!);
        const copy = (await store.readMessages(branch!.id, { limit: 5 })).messages[1]!;
        const swipeId = copy.swipes[0]!.id;
        await store.editSwipe(copy.id, swipeId, "edited on the branch");
        await store.addSwipe(ids[1]!, { content: "new take on main" });
        const onMain = (await store.readMessages(main, { limit: 5 })).messages[1]!;
        const onBranch = (await store.readMessages(branch!.id, { limit: 5 })).messages[1]!;
        expect(onMain.swipes.map((x) => x.content)).toEqual(["line 2", "new take on main"]);
        expect(onBranch.swipes.map((x) => x.content)).toEqual(["edited on the branch"]);
        expect(await store.swipeHistory(ids[1]!, swipeId)).toEqual([]);
        expect(await store.swipeHistory(copy.id, swipeId)).toEqual(["line 2"]);
      });

      test("e1. forking at a message on another branch creates nothing", async () => {
        const { store, chat, main, ids } = await seeded(2);
        const other = await store.fork(main, ids[0]!);
        const before = (await store.listBranches(chat.id)).length;
        expect(await store.fork(other!.id, ids[1]!)).toBeNull();
        expect(await store.listBranches(chat.id)).toHaveLength(before);
      });

      test("e2. forking with a swipe that is not on the fork message creates nothing", async () => {
        const { store, chat, main, ids } = await seeded(2);
        expect(await store.fork(main, ids[1]!, { swipeId: "no-such-swipe" })).toBeNull();
        expect(await store.listBranches(chat.id)).toHaveLength(1);
      });

      test("e3. copied messages get new ids, and their swipe ids are kept", async () => {
        const { store, main, ids } = await seeded(2);
        const original = (await store.readMessages(main, { limit: 5 })).messages;
        const branch = await store.fork(main, ids[1]!);
        const copied = (await store.readMessages(branch!.id, { limit: 5 })).messages;
        expect(copied.map((m) => m.id).some((id) => ids.includes(id))).toBe(false);
        expect(copied.map((m) => m.swipes[0]!.id)).toEqual(original.map((m) => m.swipes[0]!.id));
      });

      test("setActiveBranch accepts only a branch of that chat", async () => {
        const { store, chat, main } = await seeded(1);
        const elsewhere = await store.createChat({ title: "Other", cast: CAST, snapshot: SNAP });
        expect(await store.setActiveBranch(chat.id, elsewhere.activeBranchId)).toBeNull();
        expect((await store.setActiveBranch(chat.id, main))?.activeBranchId).toBe(main);
      });
    });

    describe("swipe edge cases", () => {
      test("e5. a fractional or negative index throws; one past the end is refused as absent", async () => {
        const { store, ids } = await seeded(2);
        await expect(store.selectSwipe(ids[1]!, 0.5)).rejects.toBeInstanceOf(StudioValidationError);
        await expect(store.selectSwipe(ids[1]!, -1)).rejects.toBeInstanceOf(StudioValidationError);
        expect(await store.selectSwipe(ids[1]!, 1)).toBeNull();
      });

      test("pinning marks one swipe and leaves the rest alone", async () => {
        const { store, ids } = await seeded(2);
        const m = await store.addSwipe(ids[1]!, { content: "take two" });
        const pinned = await store.setPinned(ids[1]!, m!.swipes[0]!.id, true);
        expect(pinned?.swipes.map((s) => s.pinned)).toEqual([true, false]);
      });
    });
    chatStoreWriteContract(make);
    chatStoreCutContract(make);
    chatStorePersonaContract(make);
    chatStoreVariantContract(make);
    chatStoreStatsContract(make);
    chatStoreTurnContract(make);
    chatStorePresetContract(make);
    chatStoreLoreContract(make);
    chatStorePropsContract(make);
    chatStoreOpeningContract(make);
    chatStorePromptingContract(make);
    chatStoreBackdropContract(make);
    chatStoreCompendiumContract(make);
    chatStoreReceiptsContract(make);
    chatStoreTreesContract(make);
    chatStoreParticipantsContract(make);
    chatStoreRegexContract(make);
    chatStoreFinalCutContract(make);
    chatStoreTrackersContract(make);
    chatStoreSummaryContract(make);
    chatStoreDirectorContract(make);
    chatStoreRequestContract(make);
    chatStoreFoldersContract(make);
    chatStoreHistoryContract(make);
    chatStoreHiddenContract(make);
    chatStoreAtContract(make);
    chatStoreSearchContract(make);
    chatStoreSwipeCutContract(make);
  });
}
