/** Library tools a scene links, through the real turn and tool loop against a scripted provider. */
import { expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import type { ToolBody } from "../entities/tool/schema";
import type { ChatPromptingPatch } from "../stage/contracts/chat-store";
import type { Provider, ProviderCompletion, ProviderRequest } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { mulberry32 } from "../core/lore/rng";
import { INVALID_TOOL, type NarratorTool } from "../stage/provider/tool-loop";
import { libraryTools } from "./library-tools";
import { runTurn, type Connected } from "./scene-turn";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, knowledgeRefs: [] } };
const roll: ToolBody = { name: "Roll", description: "Roll for luck.", fields: [], action: { kind: "dice", id: "d20" } };
const note: ToolBody = { name: "Roll", description: "Note a promise.", fields: [{ name: "what", description: "The promise.", type: "text", required: true }], action: { kind: "record" } };
const LIBRARY: Record<string, unknown> = {
  "tool:luck": { schemaVersion: "1", kind: "tool", id: "luck", body: roll },
  "tool:promise": { schemaVersion: "1", kind: "tool", id: "promise", body: note },
  "tool:broken": { schemaVersion: "1", kind: "tool", id: "broken", body: { ...roll, action: { kind: "run" } } },
  "tool:lost": { schemaVersion: "1", kind: "tool", id: "lost", body: { ...roll, action: { kind: "dice", id: "gone" } } },
  "dice:d20": { schemaVersion: "1", kind: "dice", id: "d20", body: { name: "Luck", description: "", type: "roll", dice: "1d20" } },
};
const call = (name: string, args: string): ProviderCompletion => ({ content: "", tool_calls: [{ id: "c1", type: "function", function: { name, arguments: args } }], finish_reason: "tool_calls", raw: {} });
const say = (content: string): ProviderCompletion => ({ content, finish_reason: "stop", raw: {} });

async function turn(prompting: ChatPromptingPatch, script: ProviderCompletion[]) {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  await chats.setPrompting(chat.id, prompting);
  await chats.appendMessages(chat.activeBranchId, [{ role: "user", content: "I try my luck." }]);
  const sent: ProviderRequest[] = [];
  const provider: Provider = { id: "conn", async send(request) { sent.push(structuredClone(request)); return script.shift() ?? say("done"); } };
  const deps = { runtime: createTurnRuntime(),
    chats, state: memoryStateStore(),
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000, tools: true }),
    narratorTools: (ctx: Parameters<typeof libraryTools>[0]) => libraryTools(ctx, async (kind, id) => LIBRARY[`${kind}:${id}`] ?? null, []),
    readPreset: async () => null, readLorebook: async () => null, now: () => (now += 10), randomSeed: () => 7,
  };
  const version = (await chats.readMessages(chat.activeBranchId, { limit: 1 })).branchVersion!;
  await runTurn(deps, { chatId: chat.id, kind: "reply", expectedVersion: version }, () => undefined);
  const m = (await chats.readMessages(chat.activeBranchId, { limit: 5 })).messages.at(-1)!;
  return { sent, trace: (await chats.swipeTrace(m.id, m.swipes[m.current]!.id)) as Record<string, any> };
}

test("a tool linking a dice piece is offered, called, answered from the seeded roll, and traced; a tool that is gone, broken or whose dice are gone is left out", async () => {
  const run = () => turn({ toolAccess: true, tools: ["luck", "gone", "broken", "lost", "promise"] }, [call("roll", "{}"), say("A natural something.")]);
  const a = await run();
  expect(a.sent[0]!.options.tools!.map((t) => t.function.name)).toEqual(["roll", "roll_2"]);
  // the turn's seed (7) decides the roll
  const die = Math.floor(mulberry32(7)() * 20) + 1;
  expect(a.sent[1]!.messages.at(-1)).toMatchObject({ role: "tool", content: `Luck, 1d20: [${die}] = ${die}` });
  expect(a.trace["tools"].calls[0]).toMatchObject({ name: "roll", ok: true, detail: { type: "roll", dice: "1d20", rolls: [die], total: die } });
});

test("bad arguments are refused to the model, and tools stay off without Tool Access", async () => {
  const bad = await turn({ toolAccess: true, tools: ["promise"] }, [call("roll", '{"what":7}'), say("ok")]);
  expect(bad.trace["tools"].calls[0]).toMatchObject({ ok: false, error: "what must be a text." });
  const off = await turn({ tools: ["luck"] }, [say("ok")]);
  expect(off.sent[0]!.options.tools).toBeUndefined();
});

test("a tool's call name never takes one already used: the lookup's, an earlier tool's, or the loop's stand-in for a bad name", async () => {
  const lookup = { definition: { type: "function", function: { name: "explore_lorebook", description: "", parameters: {} } } } as unknown as NarratorTool<never>;
  const piece = (name: string) => ({ schemaVersion: "1", kind: "tool", id: name, body: { ...note, name } });
  const names = ["Explore lorebook", "Invalid tool", "20 sided roll"];
  const ctx = { chat: { prompting: { tools: names } }, rand: () => 0 } as never;
  const tools = await libraryTools(ctx, async (_kind, id) => piece(id), [lookup]);
  expect(tools.map((t) => t.definition.function.name)).toEqual(["explore_lorebook_2", `${INVALID_TOOL}_2`, "tool_20_sided_roll"]);
});

test("a formula tool runs on the context the prompt was built from, and a formula that would write is refused to the model", async () => {
  LIBRARY["formula:luck"] = { schemaVersion: "1", kind: "formula", id: "luck", body: { name: "Luck", description: "", text: "{{char}}: {{calc::{{mentions::luck}} + 1}}" } };
  LIBRARY["formula:sneaky"] = { schemaVersion: "1", kind: "formula", id: "sneaky", body: { name: "Sneaky", description: "", text: "{{setvar::mood::grim}}ok" } };
  LIBRARY["tool:count"] = { schemaVersion: "1", kind: "tool", id: "count", body: { ...roll, name: "Count luck", action: { kind: "formula", id: "luck" } } };
  LIBRARY["tool:sneak"] = { schemaVersion: "1", kind: "tool", id: "sneak", body: { ...roll, name: "Sneak", action: { kind: "formula", id: "sneaky" } } };
  const good = await turn({ toolAccess: true, tools: ["count"] }, [call("count_luck", "{}"), say("ok")]);
  // the prompt's own macro context: the card's name, and the history before the message being answered (as the prompt's macros see it)
  expect(good.sent[1]!.messages.at(-1)).toMatchObject({ role: "tool", content: "Vera: 1" });
  const bad = await turn({ toolAccess: true, tools: ["sneak"] }, [call("sneak", "{}"), say("ok")]);
  expect(bad.trace["tools"].calls[0]).toMatchObject({ ok: false, error: "This formula changes variables (setvar), which it cannot do here." });
});
