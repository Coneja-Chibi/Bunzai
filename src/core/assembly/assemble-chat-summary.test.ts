/**
 * The chat summary in the assembled request (rc-parity 08, Memory; RoleCall `prompt-assembly.ts:684-735, 3274-3300`): its text is what `{{summary}}` and `{{chatsummary}}` expand to, the preset
 * layout seats it before the history (presetPlan adds the "Chat Summary" block when a preset names neither), and messages the summary already covers can leave the prompt, but only those it covers.
 * Every expectation is the exact list of messages.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import type { PresetBody } from "../../entities/preset/schema";
import { makePresetPrompt } from "../preset/test-fixtures";
import { assemble } from "./assemble";
import { hideCovered } from "./chat-summary";
import type { AssemblyInput, HistoryMessage } from "./types";

const card = { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } as CharacterBody;
const msg = (id: string, role: HistoryMessage["role"], content: string, index?: number): HistoryMessage => ({ id, role, content, ...(index === undefined ? {} : { index }) });
const input = (over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card,
  history: [msg("g", "assistant", "Evening.", 0), msg("u1", "user", "Hi", 1), msg("a1", "assistant", "Hello.", 2)],
  current: msg("u2", "user", "Any storms?"),
  localVariables: new Map(),
  globalVariables: new Map(),
  now: Date.UTC(2026, 8, 28),
  randomSeed: 1,
  ...over,
});
const lines = (over: Partial<AssemblyInput> = {}) => assemble(input(over)).messages.map((m) => `${m.role}:${m.content}`);
const TEXT = "They met at the pier.";
const main = (content: string): PresetBody => ({ name: "P", prompts: [makePresetPrompt({ id: "main", name: "Main", content, systemPrompt: true })] });

describe("{{summary}}", () => {
  test.each(["{{summary}}", "{{chatsummary}}", "{{ summary }}"])("a preset that seats %s carries the text where it wrote it", (macro) => {
    const out = lines({ preset: main(`Be {{char}}.\nSo far: ${macro}`), chatSummary: { text: TEXT, through: 3 } });
    expect(out[0]).toBe(`system:Be Vera.\nSo far: ${TEXT}`);
    expect(out.filter((l) => l.includes(TEXT))).toHaveLength(1);
  });
  test("a preset that names neither gets the Chat Summary block RoleCall adds, in front of the history, holding the raw text", () => {
    const out = lines({ preset: main("Be {{char}}."), chatSummary: { text: TEXT, through: 3 } });
    expect(out.slice(0, 3)).toEqual(["system:Be Vera.", `system:${TEXT}`, "assistant:Evening."]);
  });
  test("with no summary the slot is empty and sends nothing, as before", () => {
    expect(lines({ preset: main("Be {{char}}.\nSo far: {{summary}}") })[0]).toBe("system:Be Vera.\nSo far:");
    expect(lines({ preset: main("Be {{char}}.") }).some((l) => l.includes(TEXT))).toBe(false);
  });
  test("with no preset the default layout seats it as well", () => {
    expect(lines({ chatSummary: { text: TEXT, through: 3 } })).toContain(`system:${TEXT}`);
    expect(lines()).toEqual(["system:Keeps the light.", "assistant:Evening.", "user:Hi", "assistant:Hello.", "user:Any storms?"]);
  });
});

describe("hideCovered", () => {
  const h = (n: number, from = 1): HistoryMessage[] => Array.from({ length: n }, (_, i) => msg(`m${from + i}`, "user", "x", from + i));
  test("is a leading run of covered messages, never more than leaves the newest keep", () => {
    expect(hideCovered(h(6), 4, 2)).toBe(3);
    expect(hideCovered(h(6), 5, 3)).toBe(3);
    expect(hideCovered(h(6), 2, 1)).toBe(1);
    expect(hideCovered(h(6), 99, 6)).toBe(0);
    expect(hideCovered(h(6), 99, 0)).toBe(6);
  });
  test("stops at the first message the summary does not reach or that has no place in the take", () => {
    expect(hideCovered([msg("a", "user", "x", 1), msg("b", "user", "x"), msg("c", "user", "x", 3)], 99, 0)).toBe(1);
  });
});

describe("hiding what the summary covers", () => {
  const long = [msg("g", "assistant", "Evening.", 0), ...Array.from({ length: 6 }, (_, i) => msg(`m${i + 1}`, i % 2 === 0 ? "user" : "assistant", `line ${i + 1}`, i + 1))];
  const shown = (over: Partial<AssemblyInput>) => assemble(input({ history: long, ...over }));
  const sent = (r: ReturnType<typeof shown>) => r.messages.map((m) => m.content).filter((c) => c.startsWith("line"));

  test("the messages it covers go and the newest stay: covered 1 to 3, keep 2", () => {
    const r = shown({ chatSummary: { text: TEXT, through: 4, hideKeep: 2 } });
    expect(sent(r)).toEqual(["line 4", "line 5", "line 6"]);
    expect(r.chatSummary).toEqual({ hidden: ["m1", "m2", "m3"] });
  });
  test("never a message the summary does not reach: covered only message 1, keep 1, so only that one leaves (RoleCall would drop five and lose the middle)", () => {
    const r = shown({ chatSummary: { text: TEXT, through: 2, hideKeep: 1 } });
    expect(sent(r)).toEqual(["line 2", "line 3", "line 4", "line 5", "line 6"]);
    expect(r.chatSummary!.hidden).toEqual(["m1"]);
  });
  test("the greeting stays whatever is covered", () => {
    expect(shown({ chatSummary: { text: TEXT, through: 99, hideKeep: 1 } }).messages.map((m) => m.content)).toContain("Evening.");
  });
  test("without hideKeep nothing leaves, and the trace says nothing was hidden", () => {
    const r = shown({ chatSummary: { text: TEXT, through: 7 } });
    expect(sent(r)).toHaveLength(6);
    expect(r.chatSummary).toBeUndefined();
  });
  test("together with the Historian's recaps a message goes when either covers it, and both are sent", () => {
    const many = [msg("g", "assistant", "Evening.", 0), ...Array.from({ length: 14 }, (_, i) => msg(`m${i + 1}`, i % 2 === 0 ? "user" : "assistant", `line ${i + 1}`, i + 1))];
    const recap = { entryKey: "b:r", title: "Early", content: "Early days.", from: 1, to: 3 };
    const r = shown({ history: many, summaries: { recaps: [recap] }, chatSummary: { text: TEXT, through: 8, hideKeep: 5 } });
    expect(sent(r)).toEqual(["line 8", "line 9", "line 10", "line 11", "line 12", "line 13", "line 14"]);
    expect(r.messages.some((m) => m.content.startsWith("[Summary: Early]"))).toBe(true);
    expect(r.messages.some((m) => m.content.includes(TEXT))).toBe(true);
    expect(r.summaries!.dropped).toEqual(["m1", "m2"]);
    expect(r.chatSummary!.hidden).toEqual(["m3", "m4", "m5", "m6", "m7"]);
  });
});
