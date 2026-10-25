/**
 * The request messages for the scene note and for guides (RoleCall's `prompt-assembly.ts` 10.6, 4.5 and 4.6,
 * `guide-runtime.ts` and the worker's guide steps at the). Every expectation is the exact list
 * of messages, derived by hand from RoleCall's code: the note's depth counts every user and assistant
 * message in the request, a depth guide counts from the last user turn, and so on.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import type { PresetBody, PresetPrompt } from "../../entities/preset/schema";
import type { ChatNote } from "../../stage/contracts/chat-settings-types";
import { makePresetPrompt } from "../preset/test-fixtures";
import { assemble } from "./assemble";
import type { AssemblyGuide } from "./guides";
import type { AssemblyInput, HistoryMessage } from "./types";

const card = { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } as CharacterBody;
const msg = (id: string, role: HistoryMessage["role"], content: string): HistoryMessage => ({ id, role, content });
const input = (over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card,
  history: [msg("g", "assistant", "Evening."), msg("u1", "user", "Hi"), msg("a1", "assistant", "Hello.")],
  current: msg("u2", "user", "Any storms?"),
  localVariables: new Map(),
  globalVariables: new Map(),
  now: Date.UTC(2026, 8, 28),
  randomSeed: 1,
  ...over,
});
const lines = (over: Partial<AssemblyInput> = {}) => assemble(input(over)).messages.map((m) => `${m.role}:${m.content}`);
const BASE = ["system:Keeps the light.", "assistant:Evening.", "user:Hi", "assistant:Hello.", "user:Any storms?"];
const NOTE = "system:[Author's Note: N]";
const note = (over: Partial<ChatNote> = {}): ChatNote => ({ text: "N", position: "in_chat", depth: 4, frequency: 1, ...over });
const guide = (over: Partial<AssemblyGuide> & Pick<AssemblyGuide, "content">): AssemblyGuide => ({ id: over.content, role: "system", mode: "standard", ...over });
/** The base request with `extra` spliced in before the line at `index`. */
const before = (index: number, extra: string) => [...BASE.slice(0, index), extra, ...BASE.slice(index)];

const block = (id: string, content: string, over: Partial<PresetPrompt> = {}): PresetPrompt => makePresetPrompt({ id, name: id, content, systemPrompt: true, ...over });
const main = block("main", "Be {{char}}.{{persona}}{{lore}}{{summary}}");
const preset = (...prompts: PresetPrompt[]): PresetBody => ({ name: "Test", prompts: [main, ...prompts] });

describe("the scene note: where it lands", () => {
  test("after the scenario: after the leading system messages, before the greeting", () => {
    expect(lines({ note: note({ position: "after_scenario" }) })).toEqual(before(1, NOTE));
  });

  test("with no leading system message it goes first", () => {
    expect(lines({ note: note({ position: "after_scenario" }), character: { ...card, identity: { name: "Vera" } } as CharacterBody })[0]).toBe(NOTE);
  });

  // Four chat messages: Evening, Hi, Hello, Any storms. RoleCall inserts before chat[total - depth - 1].
  test.each([
    [0, 4],
    [1, 3],
    [2, 2],
    [3, 1],
    [4, 1],
    [10, 1],
  ])("in chat at depth %i it lands before the line at index %i (depth counts every chat message, so 4 is before the last five)", (depth, index) => {
    expect(lines({ note: note({ depth }) })).toEqual(before(index, NOTE));
  });

  test("a preset's user and assistant blocks count toward the depth, and a depth past the total goes before the first of them", () => {
    const set = preset(block("pre", "Pre.", { role: "user" }), block("h", "{{message_history}}"), block("post", "Post.", { role: "user" }));
    const full = ["system:Be Vera.", "user:Pre.", "assistant:Evening.", "user:Hi", "assistant:Hello.", "user:Any storms?", "user:Post."];
    expect(lines({ preset: set })).toEqual(full);
    const at = (depth: number, index: number) => expect(lines({ preset: set, note: note({ depth }) })).toEqual([...full.slice(0, index), NOTE, ...full.slice(index)]);
    at(0, 6);
    at(4, 2);
    at(5, 1);
    at(9, 1);
  });

  test("the note's own macros run, and it is a system message labelled as RoleCall labels it", () => {
    expect(lines({ note: note({ text: "Keep {{char}} tense.", position: "after_scenario" }) })[1]).toBe("system:[Author's Note: Keep Vera tense.]");
  });

  test("after the scenario with a preset: after the preset's leading system blocks only", () => {
    const set = preset(block("h", "{{message_history}}"), block("post", "Post.", { role: "system" }));
    expect(lines({ preset: set, note: note({ position: "after_scenario" }) })).toEqual(["system:Be Vera.", NOTE, "assistant:Evening.", "user:Hi", "assistant:Hello.", "user:Any storms?", "system:Post."]);
  });
});

describe("the scene note: how often", () => {
  // Turn t has t - 1 user messages before the one being answered; RoleCall fires when (t - 1) % frequency is 0.
  const turn = (t: number, frequency: number) => {
    const history = [msg("g", "assistant", "Evening.")];
    for (let i = 1; i < t; i++) history.push(msg(`u${i}`, "user", `u${i}`), msg(`a${i}`, "assistant", `a${i}`));
    return lines({ history, current: msg("c", "user", "now"), note: note({ position: "after_scenario", frequency }) }).includes(NOTE);
  };
  test.each([
    [0, [false, false, false, false, false]],
    [1, [true, true, true, true, true]],
    [2, [true, false, true, false, true]],
    [3, [true, false, false, true, false]],
    [4, [true, false, false, false, true]],
  ])("frequency %i over turns 1 to 5", (frequency, expected) => {
    expect([1, 2, 3, 4, 5].map((t) => turn(t, frequency))).toEqual(expected);
  });

  test("a blank note, or none at all, adds nothing", () => {
    expect(lines({ note: note({ text: "  \n" }) })).toEqual(BASE);
    expect(lines()).toEqual(BASE);
  });
});

describe("guides: standard placement", () => {
  test("a user guide is prepended to the message being answered, the last selected first, and never stored", () => {
    const messages = lines({ guides: [guide({ content: "G1", role: "user" }), guide({ content: "G2", role: "user" })] });
    expect(messages).toEqual([...BASE.slice(0, 4), "user:G2\n\nG1\n\nAny storms?"]);
  });

  test("system guides become one block after the leading system messages, joined by a space", () => {
    expect(lines({ guides: [guide({ content: "S1" }), guide({ content: "S2" })] })).toEqual(before(1, "system:[Take the following into special consideration for your next message: S1 S2]"));
  });

  test("a system guide with a preset goes after the leading system prefix, not after post-history blocks", () => {
    const set = preset(block("h", "{{message_history}}"), block("post", "Post.", { role: "system" }));
    expect(lines({ preset: set, guides: [guide({ content: "S" })] })).toEqual(["system:Be Vera.", "system:[Take the following into special consideration for your next message: S]", "assistant:Evening.", "user:Hi", "assistant:Hello.", "user:Any storms?", "system:Post."]);
  });

  test("assistant guides are the prefill, joined by a line break, and replace the preset's", () => {
    const plain = assemble(input({ guides: [guide({ content: "A1", role: "assistant" }), guide({ content: "A2", role: "assistant" })] }));
    expect(plain.prefill).toBe("A1\nA2");
    expect(plain.messages.map((m) => `${m.role}:${m.content}`)).toEqual(BASE);
    const set: PresetBody = { ...preset(block("h", "{{message_history}}")), systemPrompts: { assistantPrefill: "Preset prefill" } };
    expect(assemble(input({ preset: set })).prefill).toBe("Preset prefill");
    expect(assemble(input({ preset: set, guides: [guide({ content: "A1", role: "assistant" })] })).prefill).toBe("A1");
  });

  test("the scene's own Start Reply With replaces the preset's and leads the assistant guides", () => {
    const set: PresetBody = { ...preset(block("h", "{{message_history}}")), systemPrompts: { assistantPrefill: "Preset prefill" } };
    expect(assemble(input({ preset: set, prefill: "<think>" })).prefill).toBe("<think>");
    expect(assemble(input({ preset: set, prefill: "<think>", guides: [guide({ content: "A1", role: "assistant" })] })).prefill).toBe("<think>\nA1");
    expect(assemble(input({ preset: set, prefill: "  " })).prefill).toBe("Preset prefill");
  });

  test("guide text has its macros expanded, and a guide with no text is skipped", () => {
    expect(lines({ guides: [guide({ content: "Mind {{char}}.", role: "user" }), guide({ content: "  ", role: "user" })] })[4]).toBe("user:Mind Vera.\n\nAny storms?");
  });

  test("an opening with no message to answer takes no user guide", () => {
    expect(assemble(input({ history: [], current: msg("t", "user", ""), guides: [guide({ content: "G", role: "user" })] })).messages.map((m) => m.content)).toEqual(["Keeps the light."]);
  });
});

describe("guides: depth and append", () => {
  const depth = (d: number, over: Partial<AssemblyGuide> = {}) => guide({ content: "D", mode: "depth", depth: d, ...over });
  const append = (d: number, over: Partial<AssemblyGuide> = {}) => guide({ content: "AP", mode: "append", depth: d, role: "user", ...over });

  // Depth counts from the last user turn: 0 is right after it, 1 right before it, and so on.
  test.each([
    [0, 5],
    [1, 4],
    [2, 3],
    [3, 2],
    [4, 1],
    [99, 1],
  ])("a depth guide at %i is its own message at index %i", (d, index) => {
    expect(lines({ guides: [depth(d)] })).toEqual(before(index, "system:D"));
  });

  test("it keeps its own role", () => {
    expect(lines({ guides: [depth(0, { role: "user" })] }).at(-1)).toBe("user:D");
    expect(lines({ guides: [depth(0, { role: "assistant" })] }).at(-1)).toBe("assistant:D");
  });

  test("guides at one depth keep their order, and a preset's closing blocks do not bury them", () => {
    expect(lines({ guides: [depth(0, { content: "D1" }), depth(0, { content: "D2" })] }).slice(-3)).toEqual(["user:Any storms?", "system:D1", "system:D2"]);
    const set = preset(block("h", "{{message_history}}"), block("post", "Post.", { role: "system" }));
    expect(lines({ preset: set, guides: [depth(0)] }).slice(-3)).toEqual(["user:Any storms?", "system:D", "system:Post."]);
  });

  test("an append guide is glued onto the message of its role at that depth, with a line break", () => {
    expect(lines({ guides: [append(0)] }).at(-1)).toBe("user:Any storms?\nAP");
    expect(lines({ guides: [append(1)] })[2]).toBe("user:Hi\nAP");
    expect(lines({ guides: [append(0, { role: "assistant" })] })[3]).toBe("assistant:Hello.\nAP");
    expect(lines({ guides: [append(0, { role: "system" })] }).at(-1)).toBe("user:Any storms?\nAP");
  });

  test("an append with no message that deep becomes its own message at the end", () => {
    expect(lines({ guides: [append(5)] })).toEqual([...BASE, "user:AP"]);
  });

  test("a guide with a depth and no mode is placed by depth, as RoleCall's older records are", () => {
    expect(lines({ guides: [guide({ content: "D", depth: 0 })] }).at(-1)).toBe("system:D");
  });
});

describe("guides: macro and chat start", () => {
  const macro = (target: AssemblyGuide["target"], side: AssemblyGuide["side"] = "append") => guide({ content: "Extra", mode: "macro", target, side });

  test("a macro guide glues onto the value, before or after it", () => {
    expect(lines({ guides: [macro("description")] })[0]).toBe("system:Keeps the light.\nExtra");
    expect(lines({ guides: [macro("description", "prepend")] })[0]).toBe("system:Extra\nKeeps the light.");
  });

  test("an empty value takes the guide as its whole value, so a persona or scenario guide works without one", () => {
    for (const target of ["scenario", "persona", "summary", "personality"] as const) expect(lines({ guides: [macro(target)] }).slice(0, 2)).toEqual(["system:Keeps the light.", "system:Extra"]);
  });

  test("several guides on one value stack in order", () => {
    expect(lines({ guides: [guide({ content: "One", mode: "macro", target: "description", side: "append" }), guide({ content: "Two", mode: "macro", target: "description", side: "prepend" })] })[0]).toBe("system:Two\nKeeps the light.\nOne");
  });

  test("a chat-start guide runs its macros once, shows nothing, and is latched so a regenerate does not run it again", () => {
    const start = guide({ id: "s1", content: "{{setvar::mood::calm}}", mode: "chat_start" });
    const first = assemble(input({ guides: [start] }));
    expect(first.messages.map((m) => `${m.role}:${m.content}`)).toEqual(BASE);
    expect(first.local.set).toEqual({ mood: "calm", "__rc_chat_start_fired::s1": "1" });
    const again = assemble(input({ guides: [start], localVariables: new Map([["__rc_chat_start_fired::s1", { value: "1", createdAt: 0, updatedAt: 0 }]]) }));
    expect(again.local).toEqual({ set: {}, delete: [] });
  });
});

describe("the note and guides together", () => {
  test("the note is placed first and the worker's guide steps after it", () => {
    expect(lines({ note: note({ depth: 0 }), guides: [guide({ content: "S" }), guide({ content: "D", mode: "depth", depth: 0 })] })).toEqual([
      "system:Keeps the light.",
      "system:[Take the following into special consideration for your next message: S]",
      "assistant:Evening.",
      "user:Hi",
      "assistant:Hello.",
      NOTE,
      "user:Any storms?",
      "system:D",
    ]);
  });

  test("the trace stays level with the messages", () => {
    const result = assemble(input({ note: note(), guides: [guide({ content: "S" }), guide({ content: "D", mode: "depth", depth: 0 })] }));
    expect(result.messages).toHaveLength(result.trace.length);
    expect(result.trace.map((b) => b.source.kind)).toEqual(["prompt", "note", "guide", "greeting", "history", "history", "current", "guide"]);
  });
});
