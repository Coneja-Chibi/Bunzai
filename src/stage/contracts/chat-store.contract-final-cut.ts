/**
 * The ChatStore contract suite's Final Cut half: the master switch, the passes with every setting,
 * and the per-tool model overrides a scene keeps. chatStoreContract runs it on every backend.
 */
import { describe, expect, test } from "bun:test";
import { SANITY_LIST, SANITY_TEXT } from "../../entities/_shared/sanity";
import { createPass, type FinalCutPass } from "../../core/final-cut/pass";
import type { PassTrace } from "../../core/final-cut/trace";
import { StudioValidationError } from "../../studio/errors";
import type { ChatStore } from "./chat-store";
import { chatRig } from "./chat-store.contract-rig";

export function chatStoreFinalCutContract(make: (clock: () => number) => ChatStore): void {
  const { seeded } = chatRig(make);
  const version = async (store: ChatStore, branchId: string) => (await store.readMessages(branchId, { limit: 1 })).branchVersion;
  const editor = (extra: Partial<FinalCutPass> = {}): FinalCutPass => ({ ...createPass("editor", 1), ...extra });

  describe("the scene's Final Cut (rule 44)", () => {
    test("a new chat has none; a patch sets the switch, the passes and the tools, bumping no version and moving no updatedAt", async () => {
      const { store, chat, main, setNow } = await seeded(1);
      expect(chat.finalCut).toBeUndefined();
      const before = await version(store, main);
      setNow(8_000);
      const passes = [createPass("validator", 0), editor()];
      const tools = { rewrite: { connection: { id: "kit1", model: "m" }, temperature: 0.4, maxTokens: 900 } };
      const set = await store.setFinalCut(chat.id, { on: true, passes, tools });
      expect(set!.finalCut).toEqual({ on: true, passes, tools });
      expect((await store.getChat(chat.id))!.finalCut).toEqual({ on: true, passes, tools });
      expect((await store.listChats()).chats.map((c) => c.finalCut)).toEqual([{ on: true, passes, tools }]);
      expect(await version(store, main)).toBe(before);
      expect((await store.getChat(chat.id))!.updatedAt).toBe(chat.updatedAt);
    });

    test("a key left out stays, null clears it, an empty patch changes nothing, and the cell goes when nothing is left", async () => {
      const { store, chat } = await seeded(1);
      const passes = [editor()];
      await store.setFinalCut(chat.id, { on: true, passes });
      expect((await store.setFinalCut(chat.id, {}))!.finalCut).toEqual({ on: true, passes });
      expect((await store.setFinalCut(chat.id, { on: false }))!.finalCut).toEqual({ passes });
      expect((await store.setFinalCut(chat.id, { tools: { correct: { temperature: 0.2 }, custom: { maxTokens: 900 } } }))!.finalCut).toEqual({ passes, tools: { correct: { temperature: 0.2 }, custom: { maxTokens: 900 } } });
      expect((await store.setFinalCut(chat.id, { passes: null }))!.finalCut).toEqual({ tools: { correct: { temperature: 0.2 }, custom: { maxTokens: 900 } } });
      expect("finalCut" in (await store.setFinalCut(chat.id, { tools: null }))!).toBe(false);
      expect("finalCut" in (await store.getChat(chat.id))!).toBe(false);
    });

    test("a pass switched Off keeps every setting it had", async () => {
      const { store, chat } = await seeded(1);
      const loaded = editor({ guideContent: "No softening.", povMode: "first-person", enabled: false });
      expect((await store.setFinalCut(chat.id, { passes: [loaded] }))!.finalCut!.passes).toEqual([loaded]);
    });

    test("every setting of every pass type is kept exactly", async () => {
      const { store, chat } = await seeded(1);
      const passes: FinalCutPass[] = [
        { ...createPass("validator", 0), applyToUserMessages: true, failureMode: "block" },
        { ...createPass("anti-slop", 1), connection: { id: "kit1", model: "small" }, temperature: 0.15, contextMessages: 5, maxOutputTokens: 20_000, stripThinkingFromInput: false, defaultDepth: "deep", bankDepthOverrides: { "wordbank/filter-words": "minimal" }, pinnedBankExamples: { "wordbank/filter-words": ["x", "y"] }, customSlopisms: "breath hitched", antiSlopInstructions: "verbs" },
        editor({ order: 20, profileId: "cinematic", attachedRules: ["rules/show-dont-tell"], tenseMode: "past", preserveDialogue: false, applyRegexToInput: false }),
        { ...createPass("translator", 3), targetLanguage: "French", honorificPolicy: "drop", glossary: "a = b", outputMode: "tagged" },
        { ...createPass("custom-agent", 4), agentPrompt: "Tighten.", customPresetId: "p1", customPresetName: "House", customPresetPromptStates: { e1: false } },
      ];
      expect((await store.setFinalCut(chat.id, { passes }))!.finalCut!.passes).toEqual(passes);
    });

    test("a bad patch is refused whole and changes nothing", async () => {
      const { store, chat } = await seeded(1);
      const keep = [editor()];
      await store.setFinalCut(chat.id, { on: true, passes: keep });
      const bad: unknown[] = [
        { on: "yes" }, { passes: "x" }, { tools: [] }, { nope: 1 }, [], "x", null,
        { passes: [editor(), editor({ id: "other" })] },
        { passes: [{ ...editor(), type: "nonsense" }] },
        { passes: [{ ...editor(), surprise: 1 }] },
        { passes: [{ ...editor(), profileId: "wild" }] },
        { passes: [{ ...editor(), failureMode: "explode" }] },
        { passes: [{ ...editor(), temperature: 2 }] },
        { passes: [{ ...editor(), contextMessages: 11 }] },
        { passes: [{ ...editor(), contextMessages: 2.5 }] },
        { passes: [{ ...editor(), maxOutputTokens: 64_001 }] },
        { passes: [{ ...editor(), guideContent: "x".repeat(20_001) }] },
        { passes: [{ ...editor(), guideContent: "a\u0000b" }] },
        { passes: [{ ...editor(), id: "" }] },
        { passes: [{ ...editor(), order: Number.NaN }] },
        { passes: [{ ...editor(), connection: { id: "k" } }] },
        { passes: [{ ...editor(), connection: { id: "k", model: "m", extra: 1 } }] },
        { passes: [{ ...editor(), attachedRules: [3] }] },
        { passes: [{ ...createPass("anti-slop", 0), defaultDepth: "bottomless" }] },
        { passes: [{ ...createPass("anti-slop", 0), bankDepthOverrides: { a: "bottomless" } }] },
        { passes: [{ ...createPass("anti-slop", 0), pinnedBankExamples: { a: "x" } }] },
        { passes: [{ ...createPass("custom-agent", 0), customPresetPromptStates: { a: "yes" } }] },
        { passes: Array.from({ length: 6 }, () => editor()) },
        { tools: { rewrite: { temperature: 2.1 } } },
        { tools: { rewrite: { maxTokens: 8_001 } } },
        { tools: { spellcheck: { temperature: 0.2 } } },
        { tools: { rewrite: { connection: { id: "k", model: "" } } } },
        { tools: { rewrite: { extra: 1 } } },
        JSON.parse('{"tools":{"__proto__":{"temperature":0.2}}}'),
      ];
      for (const patch of bad) await expect(store.setFinalCut(chat.id, patch as never)).rejects.toBeInstanceOf(StudioValidationError);
      expect((await store.getChat(chat.id))!.finalCut).toEqual({ on: true, passes: keep });
    });

    test("it belongs to the chat: a missing or deleted chat answers null, and a restored one has it back", async () => {
      const { store, chat } = await seeded(1);
      await store.setFinalCut(chat.id, { on: true });
      await store.deleteChat(chat.id);
      expect(await store.setFinalCut(chat.id, { on: false })).toBeNull();
      expect(await store.setFinalCut("nope", { on: true })).toBeNull();
      await store.restoreChat(chat.id);
      expect((await store.getChat(chat.id))!.finalCut).toEqual({ on: true });
    });

    test("a reply's generation can say what Final Cut did, and a malformed summary is refused", async () => {
      const { store, ids } = await seeded(2);
      const summary = { passes: 2, changed: true, failed: 1 };
      const m = await store.addSwipe(ids[1]!, { content: "polished", generation: { model: "m", finalCut: summary } });
      expect(m!.swipes.at(-1)!.generation).toEqual({ model: "m", finalCut: summary });
      for (const bad of [{ passes: 1.5, changed: true, failed: 0 }, { passes: 1, changed: "yes", failed: 0 }, { passes: 1, changed: true }, { passes: 1, changed: true, failed: 0, extra: 1 }, "x"]) {
        await expect(store.addSwipe(ids[1]!, { content: "x", generation: { finalCut: bad } as never })).rejects.toBeInstanceOf(StudioValidationError);
      }
    });

    test("a reply's generation can name the macros the prompt build ran out of time on, and anything else in that field is refused", async () => {
      const { store, ids } = await seeded(2);
      const outOfTime = [{ macro: "tally" }, { macro: "" }];
      const m = await store.addSwipe(ids[1]!, { content: "late", generation: { model: "m", outOfTime } });
      expect(m!.swipes.at(-1)!.generation).toEqual({ model: "m", outOfTime });
      // a hostile list or name is refused as unusually large, never cut: a reply names a handful of macros
      const huge = [Array.from({ length: SANITY_LIST + 1 }, (_, i) => ({ macro: `m${i}` })), [{ macro: "x".repeat(SANITY_TEXT + 1) }]];
      for (const bad of huge) await expect(store.addSwipe(ids[1]!, { content: "x", generation: { outOfTime: bad } as never })).rejects.toThrow("unusually large");
      for (const bad of [[], [{ macro: 1 }], [{ macro: "a", where: "card" }], [{}], "tally", { macro: "tally" }, [null]]) {
        await expect(store.addSwipe(ids[1]!, { content: "x", generation: { outOfTime: bad } as never })).rejects.toBeInstanceOf(StudioValidationError);
      }
    });

    test("a fork leaves it alone: the scene's switch and passes are the scene's, not the take's", async () => {
      const { store, chat, main, ids } = await seeded(2);
      await store.setFinalCut(chat.id, { on: true });
      await store.fork(main, ids[0]!);
      expect((await store.getChat(chat.id))!.finalCut).toEqual({ on: true });
    });
  });

  describe("a reply's Final Cut re-runs (rule 46)", () => {
    const PASSES: PassTrace[] = [{ id: "p", type: "editor", status: "applied", changed: true, ms: 30, changelog: [], warnings: [] }];
    const RUN = { v: 1, at: 5, ms: 40, passes: PASSES };
    const RERUN = { at: 9, ms: 50, before: "one", after: "two", passes: PASSES };
    /** A reply whose commit carried a Final Cut run in its trace. */
    async function replied(withRun = true) {
      const { store, chat, main } = await seeded(1);
      const turn = await store.beginTurn(main, { kind: "reply" });
      const m = (await store.commitTurn(turn!.id, { content: "one", ...(withRun ? { trace: { n: 1, finalCut: RUN } as never } : { trace: { n: 1 } }) }))!;
      return { store, chat, m, swipe: m.swipes[m.current]!.id };
    }

    test("an applied re-run is added to the reply's run, in order, and the rest of the trace is untouched", async () => {
      const { store, m, swipe } = await replied();
      expect(await store.appendFinalCutRerun(m.id, swipe, RERUN)).toBe(true);
      expect(await store.appendFinalCutRerun(m.id, swipe, { ...RERUN, at: 12, after: "three" })).toBe(true);
      const trace = (await store.swipeTrace(m.id, swipe))!;
      expect(trace["n"]).toBe(1);
      expect((trace["finalCut"] as { reruns: { at: number }[] }).reruns.map((r) => r.at)).toEqual([9, 12]);
      expect((trace["finalCut"] as { passes: unknown[] }).passes).toEqual(RUN.passes);
    });

    test("a reply with no run, a swipe or message that is gone, or a malformed entry changes nothing", async () => {
      const bare = await replied(false);
      expect(await bare.store.appendFinalCutRerun(bare.m.id, bare.swipe, RERUN)).toBe(false);
      expect(await bare.store.swipeTrace(bare.m.id, bare.swipe)).toEqual({ n: 1 });
      const { store, m, swipe } = await replied();
      expect(await store.appendFinalCutRerun(m.id, "nope", RERUN)).toBe(false);
      expect(await store.appendFinalCutRerun("nope", swipe, RERUN)).toBe(false);
      for (const bad of [{ ...RERUN, at: "x" }, { ...RERUN, before: 1 }, { ...RERUN, passes: [{ id: 1 }] }, { ...RERUN, extra: 1 }, "x", null]) {
        await expect(store.appendFinalCutRerun(m.id, swipe, bad as never)).rejects.toBeInstanceOf(StudioValidationError);
      }
      expect((await store.swipeTrace(m.id, swipe))!["finalCut"]).toEqual(RUN as never);
    });

    test("a reply keeps at most twenty re-runs; the twenty-first is refused and nothing is dropped", async () => {
      const { store, m, swipe } = await replied();
      for (let i = 0; i < 20; i++) expect(await store.appendFinalCutRerun(m.id, swipe, { ...RERUN, at: i })).toBe(true);
      await expect(store.appendFinalCutRerun(m.id, swipe, RERUN)).rejects.toThrow("20");
      expect(((await store.swipeTrace(m.id, swipe))!["finalCut"] as { reruns: unknown[] }).reruns).toHaveLength(20);
    });
  });
}
