/**
 * The assembler's RoleCall behaviors the recorded fixtures do not reach: which text may change
 * variables, what the final pass strips, where the card's depth notes land, the budget's record of
 * what it trimmed, and the trace.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import type { MacroVariable } from "../macros";
import { assemble } from "./assemble";
import { parityBudgeter } from "./budget-parity";
import type { AssemblyInput, HistoryMessage } from "./types";

const card = (over: Partial<CharacterBody> = {}): CharacterBody =>
  ({
    identity: { name: "Vera", description: "Keeps the light." },
    persona: {},
    prompts: {},
    greetings: {},
    examples: {},
    media: {},
    attribution: {},
    discovery: {},
    ...over,
  }) as CharacterBody;

const msg = (id: string, role: HistoryMessage["role"], content: string): HistoryMessage => ({ id, role, content });
const input = (over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card(),
  history: [msg("g", "assistant", "Evening."), msg("u1", "user", "Hi"), msg("a1", "assistant", "Hello.")],
  current: msg("u2", "user", "Any storms?"),
  localVariables: new Map(),
  globalVariables: new Map(),
  now: Date.UTC(2026, 8, 27),
  randomSeed: 1,
  ...over,
});
const vars = (entries: Record<string, string>): Map<string, MacroVariable> =>
  new Map(Object.entries(entries).map(([k, v]) => [k, { value: v, createdAt: 0, updatedAt: 0 }]));

describe("variables", () => {
  test("the greeting and the current message may set variables, as RoleCall's writable pass does; stored history may not", () => {
    const result = assemble(input({
      history: [msg("g", "assistant", "{{setvar::met::yes}}Evening."), msg("u1", "user", "{{setvar::old::1}}Hi"), msg("a1", "assistant", "Hello.")],
      current: msg("u2", "user", "{{setvar::asked::storms}}Any storms?"),
    }));
    expect(result.local).toEqual({ set: { met: "yes", asked: "storms" }, delete: [] });
    expect(result.messages.map((m) => m.content)).toEqual(["Keeps the light.", "Evening.", "Hi", "Hello.", "Any storms?"]);
  });

  test("only changed names are written, deletions included, and a name like __proto__ is plain data", () => {
    const result = assemble(input({
      localVariables: vars({ keep: "same", drop: "x" }),
      current: msg("u2", "user", "{{setvar::keep::same}}{{flushvar::drop}}{{setvar::__proto__::p}}Any storms?"),
    }));
    expect(Object.keys(result.local.set)).toEqual(["__proto__"]);
    expect(Object.getOwnPropertyDescriptor(result.local.set, "__proto__")?.value).toBe("p");
    expect(result.local.delete).toEqual(["drop"]);
  });

  test("object key order alone does not create a variable write", () => {
    const existing = new Map<string, MacroVariable>([["shape", { value: { b: 2, a: 1 }, createdAt: 0, updatedAt: 0 }]]);
    const result = assemble(input({
      localVariables: existing,
      current: msg("u2", "user", '{{setvar::shape::{"a":1,"b":2} }}Any storms?'),
    }));
    expect(result.local.set).toEqual({});
  });
});

describe("the final pass", () => {
  test("an unknown macro disappears, a message left empty is dropped, and what remains is trimmed", () => {
    const result = assemble(input({ character: card({ identity: { name: "Vera", description: "  {{nosuchmacro}}\n\nKeeps the light.  " } }), current: msg("u2", "user", "{{nosuchmacro}}") }));
    expect(result.messages).toEqual([
      { role: "system", content: "Keeps the light." },
      { role: "assistant", content: "Evening." },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello." },
    ]);
  });
});

describe("the card's depth notes", () => {
  test("land before the message at their depth, counted from the current one; a depth at or past the history's length lands before the greeting", () => {
    const result = assemble(input({
      character: card({ prompts: { depthInjections: [{ text: "Stay wary.", depth: 1 }, { text: "Far back.", depth: 4, role: "user" }, { text: "From ST.", depth: 0, origin: "depth_prompt" }] } }),
    }));
    expect(result.messages.map((m) => `${m.role}:${m.content}`)).toEqual([
      "system:Keeps the light.",
      "user:Far back.",
      "assistant:Evening.",
      "user:Hi",
      "system:Stay wary.",
      "assistant:Hello.",
      "user:Any storms?",
    ]);
    expect(result.trace.map((t) => t.source.kind)).toEqual(["prompt", "depth", "greeting", "history", "depth", "history", "current"]);
  });
});

describe("the budget", () => {
  test("a message that exactly fills what is left is kept", () => {
    // 126 tokens, less 100 reserved: 26 left, exactly two messages of 9 tokens plus 4 framing each.
    const history = [msg("a", "user", "a".repeat(36)), msg("b", "assistant", "b".repeat(36))];
    const fit = parityBudgeter.fitHistory({ window: { context: 126, reply: 0 }, required: ["r".repeat(400)], important: [], raw: history.map((m) => m.content), history });
    expect(fit).toBe(2);
  });

  test("RoleCall's pre-trim never cuts a lone message, even one past its ceiling", () => {
    // 10,000 tokens: over the pre-trim's ceiling (12,000 less 2048) but inside the budget.
    const history = [msg("a", "user", "a".repeat(40_000))];
    expect(parityBudgeter.fitHistory({ window: { context: 12_000, reply: 0 }, required: [], important: [], raw: history.map((m) => m.content), history })).toBe(1);
  });


  test("the final pass drops only what does not fit, and with no user message any turn may go", () => {
    const at = [{ role: "system" as const, content: "s".repeat(36) }, { role: "assistant" as const, content: "a".repeat(36) }, { role: "assistant" as const, content: "b".repeat(36) }];
    expect(parityBudgeter.finalPass(at, 39, []).dropped).toBe(0);
    expect(parityBudgeter.finalPass(at, 38, [])).toEqual({ keep: [true, false, true], dropped: 1 });
  });

  test("without a window nothing is trimmed, however long the history", () => {
    const history = Array.from({ length: 40 }, (_, i) => msg(`h${i}`, i % 2 ? "assistant" : "user", "y".repeat(2_000)));
    expect(assemble(input({ history, budgeter: parityBudgeter })).budget).toEqual({ budgeter: "none", trimmed: [], finalPassDropped: 0 });
  });
});
