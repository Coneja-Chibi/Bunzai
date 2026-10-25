/**
 * An entry's Side Effects through the turn loop (RoleCall prompt-assembly.ts mergeLorebookSideEffects):
 * a reply applies them to the scene's own variables (local to the take, global to the library) before
 * the macros resolve, a paused turn cancelled at the Prompt Inspector and a draft write nothing, and a
 * new version of the reply never counts them twice. RoleCall re-runs assembly on a regenerate over the
 * variables the first attempt already changed, so an Increment counts twice there; here each reply's
 * trace keeps what the effects replaced (`lore.undo`), and the next attempt at that reply starts from
 * the variables as they were before them.
 */
import { describe, expect, test } from "bun:test";
import { ProviderError, type Provider, type ProviderCompletion } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { emptyLoreEntry, emptyLorebookBody } from "../core/lore";
import type { EntrySideEffect, LorebookEntry } from "../entities/lorebook/schema";
import { runDraft } from "./scene-draft";
import { runTurn, stopTurn, type Connected, type TurnEvent } from "./scene-turn";
import { answerReview } from "./scene-turn-review";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, knowledgeRefs: ["b1"] } };
const fx = (effects: EntrySideEffect[], more: Partial<NonNullable<LorebookEntry["sideEffects"]>> = {}): LorebookEntry["sideEffects"] => ({ effects, onlyOnFirstTrigger: false, clearOnDeactivate: false, ...more });
const entry = (id: string, over: Partial<LorebookEntry>): LorebookEntry => ({ ...emptyLoreEntry(id), title: id, content: `TEXT-${id}`, constant: true, ...over });

async function scene(entries: LorebookEntry[]) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const state = memoryStateStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Any storms?" }]);
  const sent: { role: string; content: string }[][] = [];
  /** How the next send behaves: answer (default), fail, or stream some text and wait to be stopped. */
  const behave: { mode: "answer" | "fail" | "hang" | "hangText"; fallbackMode: "answer" | "fail" } = { mode: "answer", fallbackMode: "answer" };
  const down = () => new ProviderError("overloaded", { category: "service_unavailable", code: "service_unavailable", status: 503 });
  const make = (mode: () => string): Provider => ({
    id: "fake",
    async send(request, io) {
      sent.push(request.messages);
      if (mode() === "fail") throw down();
      if (mode() === "hang" || mode() === "hangText") {
        if (mode() === "hangText") io?.onEvent?.({ channel: "content", delta: "Half a thought" });
        await new Promise((_, reject) => io?.signal?.addEventListener("abort", () => reject(io.signal!.reason)));
      }
      return { content: "Colder.", finish_reason: "stop", raw: {} } as ProviderCompletion;
    },
  });
  const main = make(() => behave.mode);
  const backup = make(() => behave.fallbackMode);
  const book = { id: "b1", name: "Book", body: { ...emptyLorebookBody("Book"), entries } };
  const deps = {
    chats, state, connect: async (c: { id: string }): Promise<Connected | null> => ({ provider: c.id === "backup" ? backup : main, kind: "openrouter", context: 32_000 }),
    readPreset: async () => null, readLorebook: async (id: string) => (id === "b1" ? book : null), now: () => (now += 10), randomSeed: () => 7,
  };
  const events: TurnEvent[] = [];
  const turn = async (kind: "reply" | "swipe", extra: { inspect?: boolean; fallback?: { id: string; model: string } } = {}) => {
    const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    await runTurn(deps, { chatId: chat.id, kind, expectedVersion: version, ...extra }, (e) => events.push(e));
  };
  const local = async (): Promise<Record<string, unknown>> => Object.fromEntries(Object.entries((await chats.variables(chat.activeBranchId))!).map(([k, v]) => [k, v.value]));
  const globals = async (): Promise<Record<string, { value: unknown }>> => JSON.parse((await state.read("variables")) ?? "{}");
  return { chats, chat, state, deps, sent, events, turn, local, globals, behave };
}

const counter = (over: Partial<LorebookEntry> = {}) => entry("count", { sideEffects: fx([{ type: "incvar", variable: "storms", amount: 1, scope: "local" }]), ...over });

describe("a reply applies the effects of the entries that fired", () => {
  test("set, append, increment, decrement and delete, local and global", async () => {
    const s = await scene([entry("fx", { sideEffects: fx([
      { type: "setvar", variable: "mood", value: "wary", scope: "local" },
      { type: "addvar", variable: "log", value: "A", scope: "local" },
      { type: "addvar", variable: "log", value: "B", scope: "local" },
      { type: "incvar", variable: "storms", amount: 2, scope: "local" },
      { type: "decvar", variable: "calm", amount: 1, scope: "local" },
      { type: "setvar", variable: "season", value: "autumn", scope: "global" },
      { type: "delvar", variable: "gone", scope: "local" },
    ]) })]);
    await s.chats.changeVariables(s.chat.activeBranchId, { set: { gone: "x" }, delete: [] });
    await s.turn("reply");
    expect(await s.local()).toEqual({ mood: "wary", log: "AB", storms: 2, calm: -1 });
    expect((await s.globals())["season"]!.value).toBe("autumn");
  });

  test("a macro in the same prompt reads the new value", async () => {
    const s = await scene([entry("fx", { content: "Storms so far: {{getvar::storms}}", sideEffects: fx([{ type: "incvar", variable: "storms", amount: 1, scope: "local" }]) })]);
    await s.turn("reply");
    expect(s.sent[0]!.some((m) => m.content.includes("Storms so far: 1"))).toBe(true);
  });

  test("an entry that did not fire does nothing, and onlyOnFirstTrigger runs once", async () => {
    const s = await scene([
      entry("quiet", { constant: false, triggers: [{ keyword: "dragon", isRegex: false }], sideEffects: fx([{ type: "setvar", variable: "dragon", value: "1", scope: "local" }]) }),
      counter({ sideEffects: fx([{ type: "incvar", variable: "storms", amount: 1, scope: "local" }], { onlyOnFirstTrigger: true }) }),
    ]);
    await s.turn("reply");
    expect(await s.local()).toEqual({ storms: 1 });
    await s.chats.appendMessage(s.chat.activeBranchId, { role: "user", content: "More?" });
    await s.turn("reply");
    expect(await s.local()).toEqual({ storms: 1 });
  });
});

describe("what writes nothing", () => {
  test("a reply cancelled at the Prompt Inspector leaves the variables alone", async () => {
    const s = await scene([counter()]);
    const run = s.turn("reply", { inspect: true });
    for (let i = 0; i < 200 && !s.events.some((e) => e.type === "review"); i++) await Bun.sleep(5);
    const review = s.events.find((e) => e.type === "review") as Extract<TurnEvent, { type: "review" }>;
    answerReview(s.chat.id, review.turnId, { kind: "cancel" });
    await run;
    expect(await s.local()).toEqual({});
    expect(await s.globals()).toEqual({});
  });

  test("a draft (impersonate) runs the lore without writing its effects", async () => {
    const s = await scene([counter()]);
    await runDraft({ ...s.deps, chats: s.chats, state: s.state }, { chatId: s.chat.id, kind: "impersonate", brief: "" });
    expect(await s.local()).toEqual({});
  });
});

describe("a new version of a reply does not apply the effects again", () => {
  test("Increment: reply, then two swipes, still counted once", async () => {
    const s = await scene([counter()]);
    await s.turn("reply");
    await s.turn("swipe");
    expect(await s.local()).toEqual({ storms: 1 });
    await s.turn("swipe");
    expect(await s.local()).toEqual({ storms: 1 });
  });

  test("Append and Set are not doubled either, and a variable a swipe no longer touches goes back", async () => {
    const s = await scene([
      entry("log", { sideEffects: fx([{ type: "addvar", variable: "log", value: "A", scope: "local" }, { type: "setvar", variable: "season", value: "autumn", scope: "global" }]) }),
      entry("first", { constant: false, triggers: [{ keyword: "[generationType:normal]", isRegex: false }], sideEffects: fx([{ type: "incvar", variable: "only", amount: 1, scope: "local" }]) }),
    ]);
    await s.turn("reply");
    expect(await s.local()).toEqual({ log: "A", only: 1 });
    await s.turn("swipe"); // the "normal-only" entry stays silent on a swipe: its count is taken back
    expect(await s.local()).toEqual({ log: "A" });
    expect((await s.globals())["season"]!.value).toBe("autumn");
  });

  test("each reply keeps what its effects replaced in its trace", async () => {
    const s = await scene([counter()]);
    await s.turn("reply");
    const last = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 20 })).messages.at(-1)!;
    const trace = (await s.chats.swipeTrace(last.id, last.swipes[last.current]!.id)) as { lore?: { undo?: unknown } };
    expect(trace.lore?.undo).toEqual([{ scope: "local", name: "storms", had: false }]);
  });
});

describe("a turn that does not commit leaves no trace of its effects", () => {
  test("the provider fails after assembly: the variables are as they were", async () => {
    const s = await scene([counter()]);
    s.behave.mode = "fail";
    await s.turn("reply");
    expect(s.events.some((e) => e.type === "failed")).toBe(true);
    expect(await s.local()).toEqual({});
  });

  const glob = entry("g", { sideEffects: fx([{ type: "setvar", variable: "season", value: "autumn", scope: "global" }]) });
  test("Stop before any text: nothing is kept, local or global", async () => {
    const s = await scene([counter(), glob]);
    s.behave.mode = "hang";
    const run = s.turn("reply");
    for (let i = 0; i < 200 && !s.events.some((e) => e.type === "start"); i++) await Bun.sleep(5);
    await Bun.sleep(20);
    const start = s.events.find((e) => e.type === "start") as Extract<TurnEvent, { type: "start" }>;
    stopTurn(s.chat.id, start.turnId);
    await run;
    expect(await s.local()).toEqual({});
    expect(await s.globals()).toEqual({});
  });

  test("Stop with text keeps the reply, so its effects stay and count once", async () => {
    const s = await scene([counter(), glob]);
    s.behave.mode = "hangText";
    const run = s.turn("reply");
    for (let i = 0; i < 200 && !s.events.some((e) => e.type === "text"); i++) await Bun.sleep(5);
    const start = s.events.find((e) => e.type === "start") as Extract<TurnEvent, { type: "start" }>;
    stopTurn(s.chat.id, start.turnId);
    await run;
    expect(await s.local()).toEqual({ storms: 1 });
    expect((await s.globals())["season"]!.value).toBe("autumn");
  });

  test("a failed retry, then a successful one: the Increment applies exactly once", async () => {
    const s = await scene([counter()]);
    s.behave.mode = "fail";
    await s.turn("reply");
    expect(await s.local()).toEqual({});
    s.behave.mode = "answer";
    await s.turn("reply");
    expect(await s.local()).toEqual({ storms: 1 });
  });

  test("a failed swipe keeps the reply it failed to replace counted once, and a good one still counts once", async () => {
    const s = await scene([counter()]);
    await s.turn("reply");
    s.behave.mode = "fail";
    await s.turn("swipe");
    expect(await s.local()).toEqual({ storms: 1 }); // the reply that is still there keeps its own
    s.behave.mode = "answer";
    await s.turn("swipe");
    expect(await s.local()).toEqual({ storms: 1 });
  });

  test("the fallback model: both failing leaves nothing; the fallback answering counts once", async () => {
    const s = await scene([counter()]);
    const fallback = { id: "backup", model: "vera-lite" };
    s.behave.mode = "fail";
    s.behave.fallbackMode = "fail";
    await s.turn("reply", { fallback });
    expect(await s.local()).toEqual({});
    s.behave.fallbackMode = "answer";
    await s.turn("reply", { fallback });
    expect(await s.local()).toEqual({ storms: 1 });
  });
});
