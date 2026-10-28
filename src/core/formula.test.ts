/** A formula run where nothing may change: on a copy, every kind of write refused in words, the real context untouched. */
import { describe, expect, test } from "bun:test";
import { runFormulaReadOnly } from "./formula";
import { createDefaultContext, type MacroContext } from "./macros";

const scene = (): MacroContext => createDefaultContext({
  characterName: "Vera",
  messages: [
    { role: "user", content: "A storm comes." },
    { role: "assistant", content: "The storm breaks. {{setvar::mood::grim}}" },
  ],
  messageCount: 2,
  localVariables: new Map([["luck", { value: 3, createdAt: 1, updatedAt: 1 }]]),
  now: Date.UTC(2026, 9, 27),
});
const run = (text: string, context = scene(), seed = 7) => runFormulaReadOnly(text, context, seed);

describe("reading", () => {
  test("a formula reads the chat, variables and dice through the macros it is given", () => {
    expect(run("{{calc::{{mentions::storm}} + {{getvar::luck}}}}")).toEqual({ text: "5" });
    expect(run("{{if::{{odds::100}}::{{char}} acts::wait}}")).toEqual({ text: "Vera acts" });
    expect(run("{{roll::1d20}}")).toEqual(run("{{roll::1d20}}"));
  });

  test("a blank formula and a macro error are refused, never shown half-run", () => {
    expect(run("  ")).toEqual({ error: "This formula is empty." });
    expect(run("{{mentions::storm::zero}}")).toEqual({ error: "This formula has a problem: The message count must be a whole number of 1 or more" });
  });
});

describe("writing is refused out loud and reaches nothing", () => {
  for (const [what, text] of [
    ["setvar", "{{setvar::luck::9}}"],
    ["incvar", "{{incvar::luck}}"],
    ["pushvar", "{{pushvar::bag::rope}}"],
    ["setglobalvar", "{{setglobalvar::world::ash}}"],
    ["state.set", "{{state.set::scene:alarm::on}}"],
    ["once", "{{once::intro::Hello}}"],
    ["ask_in_reply", "{{ask_in_reply::How tense is it?::into=scene:tension}}"],
  ] as const) {
    test(what, () => {
      const context = scene();
      const before = structuredClone(context);
      const out = run(text, context);
      expect("error" in out && out.error).toStartWith("This formula changes variables (");
      expect(context).toEqual(before);
    });
  }

  test("a message holding macros is read as the chat, and cannot write through the formula", () => {
    const context = scene();
    const out = run("{{lastmessage}}", context);
    expect("error" in out && out.error).toStartWith("This formula changes variables (");
    expect(context.localVariables.has("mood")).toBe(false);
  });
});

// Owner rule (limits rework): no fixed step number for formulas. A formula stops when the reply's tool time budget is spent, a clock the
// caller hands in (the engine reads no ambient time, ADR-012). The old FORMULA_STEPS tests are rewritten for that rule.
const clock = (step: number) => { let t = 0; return { now: () => (t += step) }; };

describe("the tool time budget", () => {
  const long = createDefaultContext({ messages: Array.from({ length: 200 }, (_, i) => ({ role: i % 2 ? "assistant" as const : "user" as const, content: "storm guild rain ".repeat(130) })), messageCount: 200 });
  const runaway = "{{foreach::a in {{repeat::1,::1000}}::{{foreach::b in {{repeat::1,::1000}}::{{length::{{recentmessages::200}}}}}}}}}";

  test("a runaway formula stops when the budget is spent, with an error the model reads, and fast", () => {
    const started = performance.now();
    const out = runFormulaReadOnly(runaway, long, 7, { at: 50, ...clock(1) });
    expect(out).toEqual({ error: "This formula has a problem: the time budget for this run is spent; stopped" });
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  test("a formula inside its budget is untouched, and a budget already spent stops it at the first check", () => {
    expect(runFormulaReadOnly("{{calc::2+3}}", scene(), 7, { at: 1_000_000, ...clock(1) })).toEqual({ text: "5" });
    const many = `{{foreach::a in ${Array.from({ length: 500 }, (_, i) => i).join(",")}::{{calc::1+1}}}}`;
    expect("error" in runFormulaReadOnly(many, scene(), 7, { at: -1, ...clock(1) })).toBe(true);
  });

  test("a formula with no deadline runs on the engine's own caps only", () => {
    expect(runFormulaReadOnly("{{repeat::x::1000}}", scene(), 7)).toEqual({ text: "x".repeat(1_000) });
  });
});

describe("second fix round: the deadline reaches inside the work", () => {
  const chat = () => createDefaultContext({ messages: Array.from({ length: 300 }, (_, i) => ({ role: i % 2 ? "assistant" as const : "user" as const, content: Array.from({ length: 200 }, (_, j) => `the w${(i * 13 + j * 7) % 2_000}`).join(" ") })), messageCount: 300 });

  test("a long tally is stopped by the deadline and the formula answers with the error, never 'ok' (it ran 13.7 s and returned ok at 2,000 messages)", () => {
    const phrases = Array.from({ length: 60_000 }, (_, i) => `the w${i % 2_000}`).join(",");
    const out = runFormulaReadOnly(`{{tally::${phrases}}}`, chat(), 1, { at: 50, ...clock(1) });
    expect(out).toEqual({ error: "This formula has a problem: the time budget for this run is spent; stopped" });
  });

  test("a formula's calls do not copy the chat: the messages are shared, everything that can be written is not", () => {
    const context = chat();
    let seen: unknown;
    const spy = { ...context, get messages() { seen = context.messages; return context.messages; } };
    runFormulaReadOnly("{{mentions::the}}", spy as never, 1);
    expect(seen).toBe(context.messages);
    const written = scene();
    const before = structuredClone(written.localVariables);
    runFormulaReadOnly("{{getvar::luck}}", written, 1);
    expect(written.localVariables).toEqual(before);
  });
});
