/**
 * Final Cut on the turn loop (ChatStore rule 44, RoleCall's post-generation passes): the passes run after the reply is written and before
 * it is saved, the saved text is what they leave, the original and each pass's outcome ride with the reply (trace and generation), Stop
 * keeps what the passes so far accepted, Block generation fails the turn with the reply as a draft, and putting the original back is an
 * edit that keeps the pass's text. Fixtures follow scene-turn-regex.test.ts.
 */
import { describe, expect, test } from "bun:test";
import { createPass, type FinalCutPass } from "../core/final-cut/pass";
import { readTrace } from "../core/final-cut/trace";
import type { PresetBody } from "../entities/preset/schema";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import type { RegexSetBody } from "../entities/regex/schema";
import { answerRegex, type RegexAnswer } from "./scene-turn-regex";
import { runTurn, stopTurn, type Connected, type TurnEvent } from "./scene-turn";

const vera = {
  kind: "character", id: "vera",
  body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} },
};
const isPass = (r: ProviderRequest): boolean => /post-generation|configurable post-generation|Anti-Slop Engine/.test(String(r.messages[0]?.content));
const tagged = (body: string): string => `[CHANGELOG]\n- Tone: warmer\n[REFINED]\n${body}`;

async function scene(passes: FinalCutPass[] | null, answer: (request: ProviderRequest, turnId: () => string) => Partial<ProviderCompletion> | Error, extra: { preset?: PresetBody; reply?: string; regex?: { sets: Record<string, RegexSetBody>; answer(e: Extract<TurnEvent, { type: "regex" }>): RegexAnswer } } = {}) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1, name: "Vera" } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  if (passes) await chats.setFinalCut(chat.id, { on: true, passes });
  if (extra.regex) await chats.setRegex(chat.id, { sets: Object.keys(extra.regex.sets) });
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Any storms?" }]);
  const sent: ProviderRequest[] = [];
  let turnId = "";
  const provider: Provider = {
    id: "fake",
    async send(request) {
      sent.push(request);
      const a = isPass(request) ? answer(request, () => turnId) : { content: extra.reply ?? "Maybe storms.", finish_reason: "stop" };
      if (a instanceof Error) throw a;
      return { content: "", raw: {}, ...a } as ProviderCompletion;
    },
  };
  const deps = {
    chats, state: memoryStateStore(),
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 }),
    readPreset: async () => extra.preset ?? null, readLorebook: async () => null, now: () => (now += 10), randomSeed: () => 7,
    ...(extra.regex ? { readRegex: async (id: string) => extra.regex!.sets[id] ?? null } : {}),
  };
  const events: TurnEvent[] = [];
  const emit = (e: TurnEvent) => {
    if (e.type === "start") turnId = e.turnId;
    events.push(e);
    if (e.type === "regex" && extra.regex) queueMicrotask(() => answerRegex(chat.id, e.turnId, extra.regex!.answer(e)));
  };
  const run = async (kind: "reply" | "swipe" | "continue" = "reply") => runTurn(deps, { chatId: chat.id, kind, expectedVersion: (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion! }, emit);
  const last = async () => (await chats.readMessages(chat.activeBranchId, { limit: 10 })).messages.at(-1)!;
  const trace = async () => { const m = await last(); return (await chats.swipeTrace(m.id, m.swipes[m.current]!.id)) as { finalCut?: Record<string, unknown> } | null; };
  return { chats, chat, sent, events, run, last, trace };
}
const editor = (extra: Partial<FinalCutPass> = {}): FinalCutPass => ({ ...createPass("editor"), outputMode: "tagged", ...extra });

describe("a scene with Final Cut on", () => {
  test("saves what the passes leave, and keeps the original, the outcome and a summary with the reply", async () => {
    const s = await scene([editor()], () => ({ content: tagged("Maybe storms, and the light holds.") }));
    await s.run();
    const m = await s.last();
    expect(m.swipes[m.current]!.content).toBe("Maybe storms, and the light holds.");
    expect(m.swipes[m.current]!.generation!.finalCut).toEqual({ passes: 1, changed: true, failed: 0 });
    const trace = (await s.trace())!.finalCut as { v: number; original: string; passes: { type: string; status: string; changelog: unknown[]; diff: unknown[]; model: string }[] };
    expect(trace).toMatchObject({ v: 1, original: "Maybe storms." });
    expect(trace.passes[0]).toMatchObject({ type: "editor", status: "applied", model: "vera-1", changelog: [{ rule: "Tone", description: "warmer" }] });
    expect(trace.passes[0]!.diff.length).toBeGreaterThan(0);
    expect(readTrace(trace)).toMatchObject({ original: "Maybe storms.", passes: [{ type: "editor", status: "applied", changed: true }] });
    expect(s.events.find((e) => e.type === "finalcut")).toEqual({ type: "finalcut", pass: "Editor", index: 0, of: 1 });
    expect(s.events.map((e) => e.type).indexOf("finalcut")).toBeLessThan(s.events.map((e) => e.type).indexOf("done"));
    expect(s.events.at(-1)!.type).toBe("done");
  });

  test("the pass sees the reply and the recent messages, on the scene's own model", async () => {
    const s = await scene([editor()], () => ({ content: tagged("x") }));
    await s.run();
    const pass = s.sent.find(isPass)!;
    expect(pass.model).toBe("vera-1");
    expect(String(pass.messages[0]!.content)).toContain("Character: Vera");
    expect(String(pass.messages[0]!.content)).toContain("Any storms?");
    expect(String(pass.messages[1]!.content)).toContain("Original message:\nMaybe storms.");
  });

  test("a reply nothing changed is still marked, with no original kept", async () => {
    const s = await scene([editor()], () => ({ content: "[NO_CHANGES_NEEDED]\n[CHANGELOG]\n[REFINED]\nMaybe storms." }));
    await s.run();
    expect((await s.last()).swipes[0]!.generation!.finalCut).toEqual({ passes: 1, changed: false, failed: 0 });
    expect((await s.trace())!.finalCut).not.toHaveProperty("original");
  });

  test("a pass that fails keeps the reply as written and counts the failure", async () => {
    const s = await scene([editor()], () => new Error("fetch failed"));
    await s.run();
    const m = await s.last();
    expect(m.swipes[m.current]!.content).toBe("Maybe storms.");
    expect(m.swipes[m.current]!.generation!.finalCut).toEqual({ passes: 1, changed: false, failed: 1 });
    expect(s.events.at(-1)!.type).toBe("done");
  });

  test("Block generation saves nothing and hands the reply back as a draft", async () => {
    const s = await scene([editor({ failureMode: "block" })], () => new Error("fetch failed"));
    const before = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 10 })).messages.length;
    await s.run();
    const failed = s.events.at(-1) as Extract<TurnEvent, { type: "failed" }>;
    expect(failed).toMatchObject({ type: "failed", code: "final_cut_blocked", draft: "Maybe storms." });
    expect(failed.message).toContain("Editor");
    expect((await s.chats.readMessages(s.chat.activeBranchId, { limit: 10 })).messages).toHaveLength(before);
    expect(await s.chats.resumeIncomplete()).toEqual([]);
  });

  test("Stop during a pass keeps the reply, and no further pass runs", async () => {
    const s = await scene([{ ...editor(), order: 0 }, { ...createPass("translator"), outputMode: "tagged", order: 10 }], (_r, turn) => {
      stopTurn(s.chat.id, turn());
      return new DOMException("stopped", "AbortError") as unknown as Error;
    });
    await s.run();
    const m = await s.last();
    expect(m.swipes[m.current]!.content).toBe("Maybe storms.");
    expect(s.sent.filter(isPass)).toHaveLength(1);
    expect(((await s.trace())!.finalCut as { stopped: string }).stopped).toBe("cancelled");
  });

  test("a reply that opens with thinking keeps it in front of the edited text, and the pass is given the reply without it", async () => {
    const s = await scene([editor()], () => ({ content: tagged("Better.") }), { reply: "<think>plan the storm</think>Maybe storms." });
    await s.run();
    expect(String(s.sent.find(isPass)!.messages[1]!.content)).toContain("Original message:\nMaybe storms.");
    expect(String(s.sent.find(isPass)!.messages[1]!.content)).not.toContain("plan the storm");
    const m = await s.last();
    expect(m.swipes[m.current]!.content).toBe("<think>plan the storm</think>Better.");
    expect(((await s.trace())!.finalCut as { original: string }).original).toBe("<think>plan the storm</think>Maybe storms.");
  });

  test("the scene's display regex runs on the page, on each pass's input, and the model is given what the page answered", async () => {
    const sets = { s1: { name: "s", rules: [{ id: "r1", label: "r1", find: "storms", flags: "g", replace: "weather", phases: ["display"], enabled: true, sortOrder: 0 }] } as unknown as RegexSetBody };
    const s = await scene([editor()], () => ({ content: tagged("Maybe weather, then rain.") }), { regex: { sets, answer: (e) => ({ kind: "done", texts: { 0: e.items[0]!.text.replace("storms", "weather") } }) } });
    await s.run();
    const asked = s.events.filter((e): e is Extract<TurnEvent, { type: "regex" }> => e.type === "regex");
    expect(asked).toHaveLength(1);
    expect(asked[0]!.phase).toBe("display");
    expect(asked[0]!.items[0]!.text).toBe("Maybe storms.");
    const pass = s.sent.find((r) => /post-generation|Anti-Slop Engine/.test(String(r.messages[0]?.content)))!;
    expect(JSON.stringify(pass.messages)).toContain("Maybe weather.");
    expect(JSON.stringify(pass.messages)).not.toContain("Maybe storms.");
  });

  test("a pass with the toggle off, and a scene with no display rule, ask the page nothing", async () => {
    const sets = { s1: { name: "s", rules: [{ id: "r1", label: "r1", find: "a", flags: "g", replace: "b", phases: ["display"], enabled: true, sortOrder: 0 }] } as unknown as RegexSetBody };
    const off = await scene([editor({ applyRegexToInput: false })], () => ({ content: tagged("Done.") }), { regex: { sets, answer: () => ({ kind: "done", texts: {} }) } });
    await off.run();
    expect(off.events.some((e) => e.type === "regex")).toBe(false);
    const none = await scene([editor()], () => ({ content: tagged("Done.") }));
    await none.run();
    expect(none.events.some((e) => e.type === "regex")).toBe(false);
  });

  test("a worker that cannot run the regex ends the turn before anything is saved, with the reply handed back as a draft", async () => {
    const sets = { s1: { name: "s", rules: [{ id: "r1", label: "r1", find: "a", flags: "g", replace: "b", phases: ["display"], enabled: true, sortOrder: 0 }] } as unknown as RegexSetBody };
    const s = await scene([editor()], () => ({ content: tagged("Done.") }), { regex: { sets, answer: () => ({ kind: "failed", error: "blocked by policy" }) } });
    await s.run();
    const failed = s.events.at(-1) as Extract<TurnEvent, { type: "failed" }>;
    expect(failed).toMatchObject({ type: "failed", code: "regex_unavailable", draft: "Maybe storms." });
    expect(failed.message).toContain("blocked by policy");
    expect(s.sent.some((r) => /post-generation|Anti-Slop Engine/.test(String(r.messages[0]?.content)))).toBe(false);
    expect((await s.last()).role).toBe("user");
  });

  test("switched off, a continue and a scene with no Final Cut run no pass", async () => {
    const off = await scene([editor()], () => ({ content: tagged("x") }));
    await off.chats.setFinalCut(off.chat.id, { on: false });
    await off.run();
    expect(off.sent.filter(isPass)).toHaveLength(0);
    expect(off.events.some((e) => e.type === "finalcut")).toBe(false);
    expect(await off.trace()).not.toHaveProperty("finalCut");
    const none = await scene(null, () => ({ content: tagged("x") }));
    await none.run();
    expect(none.sent).toHaveLength(1);
  });

  test("a custom agent is handed the preset it was given as its rulebook", async () => {
    const preset = { name: "House", prompts: [{ id: "tone", name: "Tone", content: "Keep it dry.", enabled: true, marker: false }] } as unknown as PresetBody;
    const s = await scene([{ ...createPass("custom-agent"), outputMode: "tagged", customPresetId: "pre1", customPresetName: "House" }], () => ({ content: tagged("x") }), { preset });
    await s.run();
    expect(String(s.sent.find(isPass)!.messages[0]!.content)).toContain("## 1. Tone\nKeep it dry.");
  });

  test("putting the original back is an edit: the pass's text stays in the edit history", async () => {
    const s = await scene([editor()], () => ({ content: tagged("Polished.") }));
    await s.run();
    const m = await s.last();
    const swipe = m.swipes[m.current]!;
    const original = ((await s.trace())!.finalCut as { original: string }).original;
    await s.chats.editSwipe(m.id, swipe.id, original);
    expect((await s.last()).swipes[0]!.content).toBe("Maybe storms.");
    expect(await s.chats.swipeHistory(m.id, swipe.id)).toEqual(["Polished."]);
  });
});
