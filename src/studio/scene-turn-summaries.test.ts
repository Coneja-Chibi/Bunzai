/**
 * Summary-aware context truncation through the turn loop (RoleCall `tv_smart_context`): with the setting on, the Compendium's recaps
 * replace the oldest messages they cover in the request the narrator gets, the stored trace says which messages went and which recap
 * blocks came, a message no recap covers stays, and with the setting off the request is whole.
 */
import { describe, expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import { emptyLoreEntry, emptyLorebookBody } from "../core/lore";
import type { Provider, ProviderCompletion } from "../stage/contracts/provider";
import type { ChatCompendiumPatch } from "../stage/contracts/chat-store";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { runTurn, type Connected } from "./scene-turn";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, knowledgeRefs: ["b1"] } };
const recap = (id: string, title: string, from: number, to: number, over: Record<string, unknown> = {}) => ({ ...emptyLoreEntry(id), title, content: `${title} happened.`, enabled: true, metadata: { entry_type: "summary", structured_data: { title, turn_range: { from, to } }, ...over } });
const BOOK = (entries: ReturnType<typeof recap>[]) => ({ id: "b1", name: "Harbor", body: { ...emptyLorebookBody("Harbor"), entries } });

async function scene(entries: ReturnType<typeof recap>[], compendium: ChatCompendiumPatch) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  await chats.setCompendium(chat.id, compendium);
  const lines = Array.from({ length: 15 }, (_, i) => ({ role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant", content: `line ${i + 1}` }));
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, ...lines]);
  const narrator: { role: string; content: string }[][] = [];
  const provider: Provider = { id: "conn", async send(request) { narrator.push(request.messages); return { content: "Colder.", finish_reason: "stop", raw: {} } as ProviderCompletion; } };
  const deps = { runtime: createTurnRuntime(),
    chats, state: memoryStateStore(),
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000 }),
    readPreset: async () => null, readLorebook: async (id: string) => (id === "b1" ? BOOK(entries) : null), now: () => (now += 10), randomSeed: () => 7,
  };
  const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
  await runTurn(deps, { chatId: chat.id, kind: "reply", expectedVersion: version }, () => undefined);
  const last = (await chats.readMessages(chat.activeBranchId, { limit: 50 })).messages.at(-1)!;
  const trace = (await chats.swipeTrace(last.id, last.swipes[last.current]!.id)) as Record<string, any>;
  return { narrator: narrator[0]!.map((m) => m.content), trace };
}

const ON: ChatCompendiumPatch = { on: true, recall: { on: false }, historian: { smartContext: true } };

describe("a reply with Summary-aware context truncation on", () => {
  test("the covered messages go, the recap stands in front of the rest, and the trace says so", async () => {
    // 16 live messages after the greeting (index 0): the recap covers 1..4, so four go; the newest 10 are kept anyway.
    const s = await scene([recap("r1", "Fog night", 1, 5)], ON);
    expect(s.narrator.slice(0, 4)).toEqual(["Keeps the light.", "Evening.", "[Summary: Fog night]\nFog night happened.", "line 5"]);
    expect(s.narrator.at(-1)).toBe("line 15");
    expect(s.narrator.some((t) => t === "line 4")).toBe(false);
    expect(s.trace["summaries"]).toMatchObject({ injected: [{ entryKey: "b1:r1", title: "Fog night" }] });
    expect(s.trace["summaries"].dropped.length).toBe(4);
    expect(s.trace["blocks"].map((b: { source: { kind: string } }) => b.source.kind)).toContain("summary");
    expect(s.trace["blocks"].length).toBe(s.narrator.length);
  });

  test("a message with no recap over it is never dropped: a gap in the recaps stops the cut", async () => {
    const s = await scene([recap("r1", "Fog night", 1, 3), recap("r2", "Later", 5, 9)], ON);
    expect(s.narrator).toContain("line 3");
    expect(s.narrator).toContain("line 5");
    expect(s.trace["summaries"].dropped.length).toBe(2);
    expect(s.narrator.some((t) => t.startsWith("[Summary: Later]"))).toBe(false);
  });

  test("a retired or disabled recap replaces nothing", async () => {
    const off = { ...recap("r1", "Fog night", 1, 5), enabled: false };
    const retired = recap("r2", "Gone", 1, 5, { retired: true });
    const s = await scene([off, retired], ON);
    expect(s.narrator.length).toBe(1 + 1 + 15);
    expect(s.trace["summaries"]).toBeUndefined();
  });
});

describe("what a recap may not do", () => {
  test("a recap with no text replaces nothing: its messages stay", async () => {
    const s = await scene([{ ...recap("r1", "Fog night", 1, 5), content: " " }], ON);
    expect(s.narrator.length).toBe(1 + 1 + 15);
    expect(s.trace["summaries"]).toBeUndefined();
  });

  test("a book the Compendium may only write to is not read, so its recaps replace nothing", async () => {
    const s = await scene([recap("r1", "Fog night", 1, 5)], { ...ON, books: { b1: { access: "write_only" } } });
    expect(s.narrator.length).toBe(1 + 1 + 15);
  });
});

describe("with the setting off", () => {
  test("the request is whole and carries no recap block", async () => {
    const s = await scene([recap("r1", "Fog night", 1, 5)], { on: true, recall: { on: false } });
    expect(s.narrator.length).toBe(1 + 1 + 15);
    expect(s.trace["summaries"]).toBeUndefined();
  });
});
