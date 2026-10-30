/**
 * Linked skills through a real turn with a scripted provider: a mentioned skill rides in the Skills block, a picked one is listed by
 * open_skill, opening it answers with its text and keeps it in the next reply's prompt, a regenerate takes the opening back with the
 * version, close_skill takes it out, and a picked skill's close rule closes it when its triggers stop matching.
 */
import { describe, expect, test } from "bun:test";
import { createTurnRuntime } from "./scene-turn-runtime";
import { openSkills } from "../core/skill";
import { emptySkillBody, type SkillBody } from "../entities/skill/schema";
import type { ProviderCompletion, ProviderRequest, Provider } from "../stage/contracts/provider";
import { memoryChatStore } from "../stage/store/chat-store";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { narratorTools } from "./library-tools";
import { runTurn, type Connected } from "./scene-turn";

const say = (content: string): ProviderCompletion => ({ content, finish_reason: "stop", raw: {} });
const call = (name: string, skill: string): ProviderCompletion => ({ content: "", tool_calls: [{ id: `${name}-${skill}`, type: "function", function: { name, arguments: JSON.stringify({ name: skill }) } }], finish_reason: "tool_calls", raw: {} });
const skill = (name: string, over: Partial<SkillBody> = {}): SkillBody => ({ ...emptySkillBody(name), description: `${name} help`, text: `${name} rules.`, ...over });

async function scene(script: ProviderCompletion[], library: Record<string, SkillBody>, first = "Any storms?") {
  let now = 1_000;
  const chats = memoryChatStore(() => now);
  const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, knowledgeRefs: [] } };
  const chat = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: vera } });
  await chats.setConnection(chat.id, { id: "conn", model: "vera-1" });
  await chats.setPrompting(chat.id, { toolAccess: true, skills: Object.keys(library) });
  await chats.appendMessages(chat.activeBranchId, [{ role: "assistant", content: "Evening." }, { role: "user", content: first }]);
  const sent: ProviderRequest[] = [];
  const queue = [...script];
  const provider: Provider = { id: "conn", async send(request) { sent.push(structuredClone(request)); return queue.shift() ?? say("done"); } };
  const read = async (kind: string, id: string) => (kind === "skill" && library[id] ? { schemaVersion: "1", kind: "skill", id, body: library[id] } : null);
  const deps = { runtime: createTurnRuntime(),
    chats, state: memoryStateStore(), narratorTools: narratorTools(read), readLibrary: read,
    connect: async (): Promise<Connected | null> => ({ provider, kind: "openrouter", context: 32_000, tools: true }),
    readPreset: async () => null, readLorebook: async () => null, now: () => (now += 10), randomSeed: () => 7,
  };
  const branch = chat.activeBranchId;
  const turn = async (kind: "reply" | "swipe" = "reply") => {
    const version = (await chats.readMessages(branch, { limit: 1 })).branchVersion!;
    await runTurn(deps, { chatId: chat.id, kind, expectedVersion: version }, () => undefined);
  };
  const user = (content: string) => chats.appendMessages(branch, [{ role: "user", content }]);
  const open = async () => [...openSkills((await chats.sceneState(branch))!)];
  const block = (r: ProviderRequest) => r.messages.find((m) => m.content.startsWith("### Skills"))?.content;
  return { sent, turn, user, open, block };
}

describe("skills in a turn", () => {
  test("a mentioned skill rides in the Skills block when its trigger is in the chat", async () => {
    const s = await scene([say("ok")], { sword: skill("Sword fight", { triggers: [{ keyword: "storms", isRegex: false }] }) });
    await s.turn();
    expect(s.block(s.sent[0]!)).toBe("### Skills\n\n## Sword fight\nSword fight rules.");
  });

  test("a picked skill is listed by open_skill; opening it answers with its text and keeps it in the next prompt; close_skill takes it out", async () => {
    const s = await scene([call("open_skill", "Haggling"), say("Deal."), say("Again."), call("close_skill", "Haggling"), say("Bye."), say("Later.")], { hag: skill("Haggling", { when: "picked" }) });
    await s.turn();
    expect(s.sent[0]!.options.tools?.map((t) => t.function.name)).toEqual(["open_skill", "close_skill"]);
    expect(s.sent[0]!.options.tools![0]!.function.description).toContain("- Haggling: Haggling help");
    expect(s.block(s.sent[0]!)).toBeUndefined();
    expect(s.sent[1]!.messages.at(-1)).toMatchObject({ role: "tool", name: "open_skill", content: "Haggling rules." });
    expect(await s.open()).toEqual(["hag"]);
    await s.user("How much?");
    await s.turn();
    expect(s.block(s.sent[2]!)).toBe("### Skills\n\n## Haggling\nHaggling rules.");
    await s.user("Fine.");
    await s.turn();
    expect(await s.open()).toEqual([]);
    await s.user("Hm?");
    await s.turn();
    expect(s.block(s.sent[5]!)).toBeUndefined();
  });

  test("a regenerate takes the opening back with the version it was made on", async () => {
    const s = await scene([call("open_skill", "Haggling"), say("Deal."), say("No deal.")], { hag: skill("Haggling", { when: "picked" }) });
    await s.turn();
    expect(await s.open()).toEqual(["hag"]);
    await s.turn("swipe");
    expect(await s.open()).toEqual([]);
  });

  test("an open picked skill with the close rule closes on the turn its triggers stop matching", async () => {
    const hag = skill("Haggling", { when: "picked", closeWhenUnmentioned: true, scanDepth: 1, triggers: [{ keyword: "coin", isRegex: false }] });
    const s = await scene([call("open_skill", "Haggling"), say("Deal."), say("Calm.")], { hag }, "A coin?");
    await s.turn();
    expect(await s.open()).toEqual(["hag"]);
    await s.user("The sea is calm.");
    await s.turn();
    expect(s.block(s.sent[2]!)).toBeUndefined();
    expect(await s.open()).toEqual([]);
  });

  test("reopened by the model on the turn its close rule fires, it stays open", async () => {
    const hag = skill("Haggling", { when: "picked", closeWhenUnmentioned: true, scanDepth: 1, triggers: [{ keyword: "coin", isRegex: false }] });
    const s = await scene([call("open_skill", "Haggling"), say("Deal."), call("open_skill", "Haggling"), say("Still haggling.")], { hag }, "A coin?");
    await s.turn();
    await s.user("Goodbye then.");
    await s.turn();
    expect(await s.open()).toEqual(["hag"]);
  });
});
