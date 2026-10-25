/**
 * What an assembly reports of its own macro pass (rc-parity 08, the Context wing's Macros tab and per-variable history): the macros the prompt used with the text each
 * produced, the errors it hit, the variable writes they made, and every variable that ended the assembly different from how it started. All from the one pass that built the
 * request; nothing is re-run to produce it.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import type { MacroVariable } from "../macros";
import { assemble } from "./assemble";
import type { AssemblyInput, HistoryMessage } from "./types";

const card = { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } as CharacterBody;
const msg = (id: string, role: HistoryMessage["role"], content: string): HistoryMessage => ({ id, role, content });
const vars = (entries: Record<string, string>): Map<string, MacroVariable> => new Map(Object.entries(entries).map(([k, v]) => [k, { value: v, createdAt: 0, updatedAt: 0 }]));
const input = (over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card,
  history: [msg("g", "assistant", "Evening.")],
  current: msg("u2", "user", "Any storms?"),
  localVariables: new Map(),
  globalVariables: new Map(),
  now: Date.UTC(2026, 9, 12),
  randomSeed: 1,
  ...over,
});

describe("the macro report", () => {
  test("each macro the prompt used, with how often, what it first produced and what that cost", () => {
    const r = assemble(input({ current: msg("u2", "user", "{{char}} and {{char}}: {{user}}?") }));
    const char = r.macros!.used.find((m) => m.name === "char")!;
    expect(char).toMatchObject({ name: "char", count: 2, example: "{{char}}", value: "Vera" });
    expect(char.tokens).toBeGreaterThan(0);
    expect(r.macros!.used.find((m) => m.name === "user")!.count).toBe(1);
  });

  test("a macro that fails is listed with its message, and the variable writes name the macro that made them", () => {
    const r = assemble(input({ current: msg("u2", "user", "{{setvar::mood::calm}}{{nosuchmacro::x}}Any storms?") }));
    expect(r.macros!.errors.map((e) => e.macro)).toEqual(["{{nosuchmacro::x}}"]);
    expect(r.macros!.mutations).toEqual([{ scope: "local", key: "mood", value: "calm", cause: "setvar" }]);
  });

  test("a long produced value is cut for the report, never for the request", () => {
    const long = "x".repeat(900);
    const r = assemble(input({ current: msg("u2", "user", "{{setvar::big::" + long + "}}{{getvar::big}}") }));
    const got = r.macros!.used.find((m) => m.name === "getvar")!;
    expect(got.value.length).toBeLessThan(400);
    expect(got.value.endsWith("...")).toBe(true);
    expect(r.messages.at(-1)!.content).toBe(long);
  });

  test("RoleCall's own names (the second pass fills them in) are not reported as failures", () => {
    const r = assemble(input({ current: msg("u2", "user", "{{lore}} {{message_history}} {{summary}}") }));
    expect(r.macros!.errors).toEqual([]);
  });

  test("the variables that ended different: what each was before and after, a delete included", () => {
    const r = assemble(input({
      localVariables: vars({ keep: "same", drop: "x", mood: "calm" }),
      globalVariables: vars({ tally: "1" }),
      current: msg("u2", "user", "{{setvar::keep::same}}{{setvar::mood::wary}}{{flushvar::drop}}{{setvar::fresh::1}}{{setglobalvar::tally::2}}Any storms?"),
    }));
    expect(r.changes).toEqual([
      { scope: "local", key: "mood", before: "calm", after: "wary" },
      { scope: "local", key: "fresh", after: 1 },
      { scope: "local", key: "drop", before: "x", deleted: true },
      { scope: "global", key: "tally", before: "1", after: 2 },
    ]);
  });

  test("no change, no entry", () => {
    expect(assemble(input()).changes).toBeUndefined();
  });
});
