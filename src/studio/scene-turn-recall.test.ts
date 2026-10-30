/**
 * Recall through the turn loop (04b D4) against a scripted provider: the picked entries reach
 * the request in front of the message being answered with no reasoning, the trace and the events say what happened, nothing recall
 * does can stop or alter the reply, it runs once (the Inspector's pause, a regenerate and a draft never ask again), and nothing
 * runs at all when the Compendium is off.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import { emptyLoreEntry, emptyLorebookBody } from "../core/lore";
import { ProviderError, type Provider, type ProviderCompletion } from "../stage/contracts/provider";
import type { ChatCompendiumPatch } from "../stage/contracts/chat-store";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { clearRecallCache, runRecall } from "./compendium-recall";
import { runDraft } from "./scene-draft";
import { runTurn, stopTurn, type Connected, type TurnEvent } from "./scene-turn";
import { answerReview } from "./scene-turn-review";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, knowledgeRefs: ["b1"] } };
const note = (id: string, title: string, content: string) => ({ ...emptyLoreEntry(id), title, content });
const BOOK = { id: "b1", name: "Harbor", body: { ...emptyLorebookBody("Harbor"), entries: [note("e1", "Mira", "Mira keeps the lantern."), note("e2", "Harbor", "A salt town.")] } };
const ANSWER = '{"entry_ids": ["e1"], "reasons": {"e1": "SECRET-REASON she is in the scene"}}';
const isRecall = (messages: { content: string }[]) => messages[0]!.content.includes("lorebook retrieval agent");

type Recall = string | Error | "hang";
async function scene(compendium: ChatCompendiumPatch | null = { on: true }, answers: Recall[] = [ANSWER]) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const state = memoryStateStore();
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  if (compendium) await chats.setCompendium(chat.id, compendium);
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: "Any storms?" }]);
  const narrator: { role: string; content: string }[][] = [];
  const asked: { model: string; messages: { role: string; content: string }[] }[] = [];
  const queue = [...answers];
  const provider = (id: string): Provider => ({
    id,
    async send(request, io) {
      if (!isRecall(request.messages)) {
        narrator.push(request.messages);
        return { content: "Colder.", finish_reason: "stop", raw: {} } as ProviderCompletion;
      }
      asked.push({ model: request.model, messages: request.messages });
      const next = queue.shift() ?? ANSWER;
      if (next === "hang") await new Promise((_, reject) => io?.signal?.addEventListener("abort", () => reject(io.signal!.reason)));
      if (next instanceof Error) throw next;
      return { content: next as string, reasoning: "SECRET-NATIVE-THOUGHT", finish_reason: "stop", raw: {} } as ProviderCompletion;
    },
  });
  const connected: string[] = [];
  const deps = { runtime: createTurnRuntime(),
    chats, state,
    connect: async (c: { id: string }): Promise<Connected | null> => { connected.push(c.id); return { provider: provider(c.id), kind: "openrouter", context: 32_000 }; },
    readPreset: async () => null, readLorebook: async (id: string) => (id === "b1" ? BOOK : null), now: () => (now += 10), randomSeed: () => 7,
  };
  const events: TurnEvent[] = [];
  const turn = async (kind: "reply" | "swipe" = "reply", extra: { inspect?: boolean } = {}) => {
    const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
    await runTurn(deps, { chatId: chat.id, kind, expectedVersion: version, ...extra }, (e) => events.push(e));
  };
  const trace = async () => {
    const last = (await chats.readMessages(chat.activeBranchId, { limit: 50 })).messages.at(-1)!;
    return (await chats.swipeTrace(last.id, last.swipes[last.current]!.id)) as Record<string, any> | null;
  };
  return { chats, chat, state, deps, narrator, asked, events, turn, trace, connected };
}

beforeEach(clearRecallCache);

describe("a reply with recall on", () => {
  test("the picked entry is in the request in front of the message being answered, the selector's reasons are not, and the trace says what happened", async () => {
    const s = await scene();
    await s.turn();
    expect(s.asked.length).toBe(1);
    expect(s.narrator[0]!.map((m) => m.content)).toEqual(["Keeps the light.", "Evening.", "[Retrieved World Knowledge]\n[Lore: Mira]\nMira keeps the lantern.", "Any storms?"]);
    expect(JSON.stringify(s.narrator)).not.toMatch(/SECRET/);
    const t = (await s.trace())!;
    expect(t["recall"]).toMatchObject({ status: "recalled", calls: 1, model: "vera-1", selected: [{ entryKey: "b1:e1", title: "Mira", reason: "SECRET-REASON she is in the scene" }], injected: [{ entryKey: "b1:e1" }], cut: [] });
    expect(JSON.stringify(t["recall"])).not.toContain("Mira keeps the lantern");
    expect(t["blocks"].map((b: { source: { kind: string } }) => b.source.kind)).toContain("recall");
    expect(t["blocks"].length).toBe(s.narrator[0]!.length);
    expect(s.events.filter((e) => e.type === "world")).toEqual([{ type: "world", status: "recalling" }, { type: "world", status: "recalled", count: 1 }]);
  });

  test("the index the selector reads names the open book's entries by handle, and the model's native thoughts are never read", async () => {
    const s = await scene();
    await s.turn();
    const user = s.asked[0]!.messages[1]!.content;
    expect(user).toContain("[e1] Mira");
    expect(user).toContain("[e2] Harbor");
    expect(user).toContain("[user]: Any storms?");
  });

  test("a regenerate asks nothing again: the picks are cached for the same scene, messages and books", async () => {
    const s = await scene();
    await s.turn();
    await s.turn("swipe");
    expect(s.asked.length).toBe(1);
    expect(s.narrator.length).toBe(2);
    expect(s.narrator[1]!.map((m) => m.content)).toContain("[Retrieved World Knowledge]\n[Lore: Mira]\nMira keeps the lantern.");
    expect((await s.trace())!["recall"]).toMatchObject({ status: "recalled", calls: 0, cached: true });
  });

  test("the Prompt Inspector's pause does not ask twice: recall ran before the request was shown, and Send reuses it", async () => {
    const s = await scene();
    const run = s.turn("reply", { inspect: true });
    for (let i = 0; i < 200 && !s.events.some((e) => e.type === "review"); i++) await Bun.sleep(5);
    const review = s.events.find((e) => e.type === "review") as Extract<TurnEvent, { type: "review" }>;
    expect(review.messages.some((m) => m.content.includes("[Lore: Mira]"))).toBe(true);
    answerReview(s.deps.runtime, s.chat.id, review.turnId, { kind: "send", edits: {} });
    await run;
    expect(s.asked.length).toBe(1);
    expect(s.narrator.length).toBe(1);
  });

  test("an Expand-as-character draft never runs recall", async () => {
    const s = await scene();
    const draft = await runDraft({ ...s.deps, chats: s.chats, state: s.state }, { chatId: s.chat.id, kind: "impersonate" });
    expect(draft.text).toBe("Colder.");
    expect(s.asked.length).toBe(0);
  });
});

describe("recall never blocks the reply", () => {
  test("a provider failure leaves the request exactly as it is without recall, and the trace and event say it failed", async () => {
    const off = await scene(null);
    await off.turn();
    const s = await scene({ on: true }, [new ProviderError("overloaded", { category: "service_unavailable", code: "service_unavailable", status: 503 })]);
    await s.turn();
    expect(s.narrator[0]).toEqual(off.narrator[0]!);
    expect(s.events.at(-1)!.type).toBe("done");
    expect((await s.trace())!["recall"]).toMatchObject({ status: "failed", reason: "overloaded", calls: 1, selected: [] });
    expect(s.events.filter((e) => e.type === "world").at(-1)).toMatchObject({ status: "failed", reason: "overloaded" });
  });

  test("prose twice is a failure with two calls and no more; prose then the JSON object is one repair and a success", async () => {
    const bad = await scene({ on: true }, ["I would rather not.", "Still no."]);
    await bad.turn();
    expect(bad.asked.length).toBe(2);
    expect(bad.asked[1]!.messages.at(-1)!.content).toContain("not the JSON object");
    expect((await bad.trace())!["recall"]).toMatchObject({ status: "failed", calls: 2 });
    expect(bad.narrator[0]!.map((m) => m.content)).toEqual(["Keeps the light.", "Evening.", "Any storms?"]);
    const fixed = await scene({ on: true }, ["Sorry!", ANSWER]);
    await fixed.turn();
    expect((await fixed.trace())!["recall"]).toMatchObject({ status: "recalled", calls: 2 });
  });

  test("fewer picks than the minimum earns one more call, never a third", async () => {
    const s = await scene({ on: true, recall: { minEntries: 2 } }, [ANSWER, '{"entry_ids": ["e1", "e2"]}']);
    await s.turn();
    expect(s.asked.length).toBe(2);
    expect(s.asked[1]!.messages.at(-1)!.content).toContain("at least 2");
    expect((await s.trace())!["recall"]).toMatchObject({ status: "recalled", calls: 2, selected: [{ entryKey: "b1:e1" }, { entryKey: "b1:e2" }] });
    const short = await scene({ on: true, recall: { minEntries: 2 } }, [ANSWER, ANSWER, ANSWER]);
    await short.turn();
    expect(short.asked.length).toBe(2);
  });

  test("a handle the index never printed is dropped and counted, and the reply still goes", async () => {
    const s = await scene({ on: true }, ['{"entry_ids": ["e9", "e2"]}']);
    await s.turn();
    expect(s.narrator[0]!.map((m) => m.content)).toContain("[Retrieved World Knowledge]\n[Lore: Harbor]\nA salt town.");
    expect((await s.trace())!["recall"]).toMatchObject({ status: "recalled", unknown: 1 });
  });

  test("Stop while recall is thinking stops the turn with nothing saved and no request to the narrator", async () => {
    const s = await scene({ on: true }, ["hang"]);
    const run = s.turn();
    for (let i = 0; i < 200 && !s.events.some((e) => e.type === "world"); i++) await Bun.sleep(5);
    const started = s.events.find((e) => e.type === "start") as Extract<TurnEvent, { type: "start" }>;
    expect(stopTurn(s.deps.runtime, s.chat.id, started.turnId)).toBe(true);
    await run;
    expect(s.events.at(-1)).toEqual({ type: "stopped", message: null });
    expect(s.narrator.length).toBe(0);
    expect((await s.chats.readMessages(s.chat.activeBranchId, { limit: 50 })).messages.length).toBe(2);
  });

  test("a selector that never answers fails after its time limit and says so", async () => {
    const s = await scene({ on: true }, ["hang"]);
    const loaded = { history: [{ id: "g", role: "assistant" as const, content: "Evening." }], current: { id: "u", role: "user" as const, content: "Any storms?" }, lore: { books: [BOOK], recentFires: [] } };
    const chat = (await s.chats.getChat(s.chat.id))!;
    const run = await runRecall(s.deps, chat, loaded as never, { connected: await s.deps.connect({ id: "conn" }) as Connected, model: "vera-1" }, new AbortController().signal, undefined, 20);
    expect(run).toMatchObject({ status: "failed", reason: "the selector took too long", calls: 1 });
  });
});

describe("when it does not run", () => {
  test("a scene that never turned the Compendium on asks nothing and sees no recall event, section or block", async () => {
    const s = await scene(null);
    await s.turn();
    expect(s.asked.length).toBe(0);
    expect(s.events.some((e) => e.type === "world")).toBe(false);
    expect((await s.trace())!["recall"]).toBeUndefined();
    expect(s.narrator[0]!.map((m) => m.content)).toEqual(["Keeps the light.", "Evening.", "Any storms?"]);
  });

  test("on with recall off, or recall on with the Compendium off, is the same", async () => {
    for (const patch of [{ on: true, recall: { on: false } }, { on: false }]) {
      const s = await scene(patch);
      await s.turn();
      expect(s.asked.length).toBe(0);
      expect(s.events.some((e) => e.type === "world")).toBe(false);
    }
  });

  test("a book set to off or write only is never read, so there is nothing to recall from, and it says so", async () => {
    for (const access of ["off", "write_only"] as const) {
      const s = await scene({ on: true, books: { b1: { access } } });
      await s.turn();
      expect(s.asked.length).toBe(0);
      expect((await s.trace())!["recall"]).toMatchObject({ status: "skipped", calls: 0 });
      expect(s.events.filter((e) => e.type === "world")).toEqual([{ type: "world", status: "skipped", count: 0, reason: "no book is open for the Compendium to read" }]);
    }
  });

  test("read and write is read too", async () => {
    const s = await scene({ on: true, books: { b1: { access: "read_write" } } });
    await s.turn();
    expect(s.asked.length).toBe(1);
  });
});

describe("which model answers", () => {
  test("the scene's own by default; the Compendium's when one is chosen, through its own connection", async () => {
    const own = await scene();
    await own.turn();
    expect([own.asked[0]!.model, own.connected]).toEqual(["vera-1", ["conn"]]);
    const chosen = await scene({ on: true, model: { id: "other", model: "tiny-1" } });
    await chosen.turn();
    expect(chosen.asked[0]!.model).toBe("tiny-1");
    expect(chosen.connected).toContain("other");
  });

  test("a Compendium model Kit no longer has skips the pass instead of failing the reply", async () => {
    const s = await scene({ on: true, model: { id: "gone", model: "x" } });
    const connect = s.deps.connect;
    s.deps.connect = async (c) => (c.id === "gone" ? null : connect(c));
    await s.turn();
    expect(s.asked.length).toBe(0);
    expect((await s.trace())!["recall"]).toMatchObject({ status: "skipped", reason: "the Compendium's model is not available in Kit" });
    expect(s.events.at(-1)!.type).toBe("done");
  });
});

describe("every drawn Settings row reaches the request the selector reads (what is shown is what is used)", () => {
  const typed = (id: string, title: string, tagline: string, content: string) => ({ ...emptyLoreEntry(id), title, content, metadata: { entry_type: "character", structured_data: { name: title, tagline } } });
  const withBook = async (compendium: ChatCompendiumPatch) => {
    const s = await scene(compendium);
    BOOK.body.entries = [typed("e1", "Mira", "Keeps the lantern.", "Mira's long text."), typed("e2", "Harbor", "A salt town.", "Harbor's long text.")];
    return s;
  };
  const restore = () => { BOOK.body.entries = [note("e1", "Mira", "Mira keeps the lantern."), note("e2", "Harbor", "A salt town.")]; };

  test("detail, display, the cap, the minimum and the number of recent messages", async () => {
    try {
      const names = await withBook({ on: true, recall: { detail: "names", maxEntries: 4, bookDisplay: "per_book", contextMessages: 5 } });
      await names.turn();
      const user = names.asked[0]!.messages[1]!.content;
      expect(user).toContain("[e1] Mira\n");
      expect(user).not.toContain("Keeps the lantern.");
      expect(user).toContain('=== Lorebook: "Harbor"');
      expect(user).toContain("Select at most 4 entries.");
      expect(user).toContain("(last 2 messages)");
      const preview = await withBook({ on: true, recall: { detail: "preview" } });
      await preview.turn();
      expect(preview.asked[0]!.messages[1]!.content).toContain("[e1] Mira - Keeps the lantern. | Mira's long text.");
      const taglines = await withBook({ on: true });
      await taglines.turn();
      expect(taglines.asked[0]!.messages[1]!.content).toContain("[e1] Mira - Keeps the lantern.\n");
    } finally {
      restore();
    }
  });

  test("the Guide's current text, then the inline guidance, in the system message", async () => {
    const s = await scene({ on: true, recall: { guide: "g1", guidance: "Inline words." } });
    const { saveGuide } = await import("./guides");
    await saveGuide(s.state, { title: "Slow burn", content: "Guide words.", type: "guide", category: "situational", role: "system", mode: "standard", depth: null, target: null, side: null, visible: true }, 1, () => "g1");
    await s.turn();
    const system = s.asked[0]!.messages[0]!.content;
    expect(system.indexOf("Guide words.")).toBeGreaterThan(0);
    expect(system.indexOf("Guide words.")).toBeLessThan(system.indexOf("Inline words."));
  });

  test("a Guide that is gone or hidden adds nothing, and the pass still runs", async () => {
    const s = await scene({ on: true, recall: { guide: "lost" } });
    await s.turn();
    expect(s.asked.length).toBe(1);
    expect(s.asked[0]!.messages[0]!.content).not.toContain("USER RETRIEVAL GUIDANCE");
  });
});
