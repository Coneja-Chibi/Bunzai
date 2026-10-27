/** A formula run where nothing may change: on a copy, every kind of write refused in words, the real context untouched. */
import { describe, expect, test } from "bun:test";
import { FORMULA_STEPS, runFormulaReadOnly } from "./formula";
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

test("a runaway formula stops at its own small step budget, fast, even over a long chat", () => {
  const long = createDefaultContext({ messages: Array.from({ length: 200 }, (_, i) => ({ role: i % 2 ? "assistant" as const : "user" as const, content: "storm guild rain ".repeat(130) })), messageCount: 200 });
  const words = Array.from({ length: 20 }, (_, i) => `w${i}`).join(",");
  // the same words again and again (their scans are reused), new words every time (scans are capped per chat), and the whole recent history
  const same = `{{foreach::a in {{repeat::1,::1000}}::{{foreach::b in {{repeat::1,::1000}}::{{tally::${words}}}}}}}}`;
  const fresh = `{{foreach::a in ${Array.from({ length: 2000 }, (_, i) => i).join(",")}::{{tally::${Array.from({ length: 20 }, (_, i) => `x${i}q$a`).join(",")}}}}}`;
  expect(run(same, long)).toEqual({ error: `This formula has a problem: evaluation step budget of ${FORMULA_STEPS} hit; truncated` });
  const history = "{{foreach::a in {{repeat::1,::1000}}::{{foreach::b in {{repeat::1,::1000}}::{{length::{{recentmessages::200}}}}}}}}}";
  for (const runaway of [same, fresh, history]) {
    const started = performance.now();
    expect("error" in run(runaway, long)).toBe(true);
    expect(performance.now() - started).toBeLessThan(500);
  }
});

test("a step budget that is not a number is no budget at all: the engine's own cap holds", async () => {
  const { processMacros } = await import("./macros");
  expect(processMacros("{{repeat::x::1000}}", { ...scene(), maxSteps: Number.NaN }).text).toBe("x".repeat(1000));
  expect(processMacros("{{foreach::a in {{repeat::1,::50}}::a}}", { ...scene(), maxSteps: 3 }).errors[0]?.message).toContain("step budget of 3 hit");
});
