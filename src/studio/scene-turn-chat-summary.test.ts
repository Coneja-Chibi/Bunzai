/**
 * The chat summary on the turn loop (rc-parity 08, Memory): the take's saved summary goes with the reply where `{{summary}}` stands, Include in AI context off sends nothing, Hide messages
 * already covered takes only what the summary reaches, the trace records what was hidden, and the Next send forecast is the same request. Fixtures follow scene-turn-review.test.ts.
 */
import { describe, expect, test } from "bun:test";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { blockDeltas } from "../core/summary/rows";
import { forecastRequest } from "./scene-forecast";
import { enqueue } from "./compendium-queue";
import { summarizeAfter } from "./scene-summary";
import { runTurn, type Connected } from "./scene-turn";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } };
const TEXT = "They met at the pier.";

async function scene(opts: { asked?: boolean } = {}) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  await chats.appendMessages(chat.activeBranchId, [
    { role: "assistant", content: "Evening." },
    ...Array.from({ length: 6 }, (_, i) => ({ role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant", content: `line ${i + 1}` })),
    ...(opts.asked === false ? [] : [{ role: "user" as const, content: "Any storms?" }]),
  ]);
  const sent: ProviderRequest[] = [];
  const provider: Provider = { id: "fake", async send(request) { sent.push(request); return { content: "Colder.", finish_reason: "stop", raw: {} } as ProviderCompletion; } };
  const deps = {
    chats, state: memoryStateStore(),
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 }),
    readPreset: async () => null, readLorebook: async () => null,
    now: () => (now += 10), randomSeed: () => 7,
  };
  const ask = async () => { await chats.appendMessage(chat.activeBranchId, { role: "user", content: "Any storms?" }); };
  const reply = async () => {
    const version = (await chats.readMessages((await chats.getChat(chat.id))!.activeBranchId, { limit: 1 })).branchVersion!;
    await runTurn(deps, { chatId: chat.id, kind: "reply", expectedVersion: version }, () => undefined);
    return sent.at(-1)!.messages.map((m) => m.content);
  };
  return { chats, chat, deps, sent, reply, ask };
}

describe("the saved summary in a reply", () => {
  test("is sent where the layout seats {{summary}}, before the history", async () => {
    const s = await scene();
    await s.chats.setSummary(s.chat.activeBranchId, { text: TEXT, through: 4 });
    const out = await s.reply();
    expect(out.filter((c) => c === TEXT)).toHaveLength(1);
    expect(out.indexOf(TEXT)).toBeLessThan(out.indexOf("Evening."));
    expect(out).toContain("line 1");
  });
  test("a take with none sends none", async () => {
    expect(await (await scene()).reply()).not.toContain(TEXT);
  });
  test("Include in AI context off sends none while the text is kept", async () => {
    const s = await scene();
    await s.chats.setSummary(s.chat.activeBranchId, { text: TEXT, through: 4 });
    await s.chats.setSummarySettings(s.chat.id, { include: false });
    expect(await s.reply()).not.toContain(TEXT);
    expect((await s.chats.summaryOf(s.chat.activeBranchId))!.text).toBe(TEXT);
  });
  test("each take reads its own: a fork does not send the original take's summary", async () => {
    const s = await scene();
    await s.chats.setSummary(s.chat.activeBranchId, { text: TEXT, through: 4 });
    const first = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 20 })).messages[5]!;
    const take = await s.chats.fork(s.chat.activeBranchId, first.id, { name: "Take 2" });
    await s.chats.setActiveBranch(s.chat.id, take!.id);
    expect(await s.reply()).not.toContain(TEXT);
  });
});

describe("a new version of a reply", () => {
  // The take's summary a turn builds from is the state the turn loaded (everything before the reply it replaces), not the tip: the reply's own earlier block must not go to the model that writes its replacement.
  test("does not send the summary piece the reply it replaces wrote", async () => {
    const s = await scene();
    await s.reply();
    const branch = s.chat.activeBranchId;
    const made = (await s.chats.readMessages(branch, { limit: 20 })).messages.at(-1)!;
    const version = made.swipes[made.current]!.id;
    const BLOCK = "A block the first answer wrote.";
    await s.chats.recordDeltas(branch, version, blockDeltas(await s.chats.sceneState(branch), { version, text: BLOCK, through: 9, at: 2_000_000, replace: true }));
    expect((await s.chats.summaryOf(branch))!.text).toBe(BLOCK);
    const read = (await s.chats.readMessages(branch, { limit: 1 })).branchVersion!;
    await runTurn(s.deps, { chatId: s.chat.id, kind: "swipe", expectedVersion: read }, () => undefined);
    expect(s.sent.at(-1)!.messages.map((m) => m.content)).not.toContain(BLOCK);
    expect(s.sent.at(-1)!.messages.map((m) => m.content).join(" ")).not.toContain(BLOCK);
  });
  test("a reply that follows a summarized one does send the piece (the check above can fail)", async () => {
    const s = await scene();
    await s.reply();
    const branch = s.chat.activeBranchId;
    const made = (await s.chats.readMessages(branch, { limit: 20 })).messages.at(-1)!;
    const version = made.swipes[made.current]!.id;
    await s.chats.recordDeltas(branch, version, blockDeltas(await s.chats.sceneState(branch), { version, text: "Kept for the next one.", through: 9, at: 2_000_000, replace: true }));
    await s.ask();
    expect((await s.reply()).join(" ")).toContain("Kept for the next one.");
  });
});

describe("the summary after a turn", () => {
  // The route runs the summary writer when the turn emits "done" (ui/server-chats-turn.ts); the same hook is wired here, and the writer's own lane is awaited, so nothing is left pending when the rows are read.
  const withHook = async (s: Awaited<ReturnType<typeof scene>>, deps: Parameters<typeof runTurn>[0]) => {
    await s.chats.setSummarySettings(s.chat.id, { auto: true, method: "pair" });
    const events: string[] = [];
    const version = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 1 })).branchVersion!;
    await runTurn(deps, { chatId: s.chat.id, kind: "reply", expectedVersion: version }, (e) => {
      events.push(e.type);
      if (e.type === "done") summarizeAfter({ chats: s.chats, connect: s.deps.connect }, s.chat.id, "reply", e.message);
    });
    await enqueue(s.chat.id, async () => undefined);
    return events;
  };
  const rows = async (s: Awaited<ReturnType<typeof scene>>) => ((await s.chats.sceneState(s.chat.activeBranchId))!["summary"] ?? []) as unknown[];

  test("a turn that fails leaves no summary row: the writer runs only when a reply lands", async () => {
    const s = await scene();
    const before = s.sent.length;
    const down: Provider = { id: "down", async send() { s.sent.push({} as ProviderRequest); throw new Error("provider down"); } };
    const events = await withHook(s, { ...s.deps, connect: async (): Promise<Connected | null> => ({ provider: down, kind: "openrouter", context: 32_000 }) });
    expect(events).toContain("failed");
    expect(events).not.toContain("done");
    expect(s.sent.length - before).toBeGreaterThan(0); // the turn really tried the provider
    expect(await rows(s)).toEqual([]);
    expect((await s.chats.readMessages(s.chat.activeBranchId, { limit: 20 })).messages.at(-1)!.role).toBe("user");
  });

  test("a reply that lands does write its line (so the check above can fail)", async () => {
    const s = await scene();
    const events = await withHook(s, s.deps);
    expect(events).toContain("done");
    expect(await rows(s)).toHaveLength(1);
  });
});

describe("Hide messages already covered", () => {
  test("takes the messages the summary reaches and keeps the newest; the trace says which", async () => {
    const s = await scene();
    await s.chats.setSummary(s.chat.activeBranchId, { text: TEXT, through: 4 });
    await s.chats.setSummarySettings(s.chat.id, { hideOld: true, keepRecent: 2 });
    const out = await s.reply();
    expect(out).toContain("Evening.");
    expect(["line 1", "line 2", "line 3"].filter((l) => out.includes(l))).toEqual([]);
    expect(["line 4", "line 5", "line 6", "Any storms?"].filter((l) => out.includes(l))).toEqual(["line 4", "line 5", "line 6", "Any storms?"]);
    const reply = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 20 })).messages.at(-1)!;
    const trace = await s.chats.swipeTrace(reply.id, reply.swipes[0]!.id);
    const hidden = (trace!["chatSummary"] as { hidden: string[] }).hidden;
    expect(hidden).toHaveLength(3);
  });
  test("with nothing hidden the trace carries no chatSummary", async () => {
    const s = await scene();
    await s.chats.setSummary(s.chat.activeBranchId, { text: TEXT, through: 4 });
    await s.reply();
    const reply = (await s.chats.readMessages(s.chat.activeBranchId, { limit: 20 })).messages.at(-1)!;
    expect((await s.chats.swipeTrace(reply.id, reply.swipes[0]!.id))!["chatSummary"]).toBeUndefined();
  });
});

describe("the forecast", () => {
  test("is the same request, summary and hidden messages included", async () => {
    const s = await scene({ asked: false });
    await s.chats.setSummary(s.chat.activeBranchId, { text: TEXT, through: 4 });
    await s.chats.setSummarySettings(s.chat.id, { hideOld: true, keepRecent: 2 });
    const forecast = await forecastRequest(s.deps, { chatId: s.chat.id, draft: "Any storms?" });
    await s.ask();
    const sentOut = await s.reply();
    expect(forecast.messages.map((m) => m.content)).toEqual(sentOut);
    expect(forecast.messages.some((m) => m.content === TEXT)).toBe(true);
  });
});
