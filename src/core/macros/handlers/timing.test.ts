/**
 * Timing macro tests: ported from RoleCall's phase1-macros.test.ts, the "timing macros" describe block. Beyond the caller's
 * assigned list (ports processor.test.ts and phase2-macros.test.ts's
 * pick_in_reply block only); included here because it's timing.ts's only characterization coverage.
 *
 * One case also exercises `{{state.set}}` (another handler family); ported unchanged.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "..";
import type { MacroContext } from "../types";

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: "TestChar",
    userName: "TestUser",
    messages: [
      { role: "user", content: "Hello there!" },
      { role: "assistant", content: "Hi! How are you?" },
    ],
    messageCount: 2,
    ...overrides,
  });
}

describe("timing macros", () => {
  const turn1Messages = [{ role: "user" as const, content: "hi" }];
  const turn3Messages = [
    { role: "user" as const, content: "1" },
    { role: "assistant" as const, content: "r1" },
    { role: "user" as const, content: "2" },
    { role: "assistant" as const, content: "r2" },
    { role: "user" as const, content: "3" },
  ];

  test("{{first_turn}} renders only on turn 1", () => {
    expect(processMacros("{{first_turn::Welcome!}}", ctx({ messages: turn1Messages })).text).toBe("Welcome!");
    expect(processMacros("{{first_turn::Welcome!}}", ctx({ messages: turn3Messages })).text).toBe("");
    // Greeting-only chat (no user messages yet) counts as turn 1.
    expect(processMacros("{{first_turn::Welcome!}}", ctx({ messages: [] })).text).toBe("Welcome!");
  });

  test("skipped {{first_turn}} content fires no side effects", () => {
    const context = ctx({ messages: turn3Messages });
    processMacros("{{first_turn::{{state.set::session:boot::yes}}}}", context);
    expect(context.localVariables.has("boot")).toBe(false);
  });

  test("{{every::N}} renders on divisible turns", () => {
    expect(processMacros("{{every::3::tick}}", ctx({ messages: turn3Messages })).text).toBe("tick");
    expect(processMacros("{{every::2::tick}}", ctx({ messages: turn3Messages })).text).toBe("");
  });

  test("{{after_turn}} / {{before_turn}}", () => {
    expect(processMacros("{{after_turn::3::late}}", ctx({ messages: turn3Messages })).text).toBe("late");
    expect(processMacros("{{after_turn::4::late}}", ctx({ messages: turn3Messages })).text).toBe("");
    expect(processMacros("{{before_turn::4::early}}", ctx({ messages: turn3Messages })).text).toBe("early");
    expect(processMacros("{{before_turn::3::early}}", ctx({ messages: turn3Messages })).text).toBe("");
  });

  test("{{once::id}} fires once and records state", () => {
    const context = ctx();
    expect(processMacros("{{once::boot::Booted}}", context).text).toBe("Booted");
    // The hidden state var now records the firing; second render skips.
    expect(processMacros("{{once::boot::Booted}}", context).text).toBe("");
    expect(processMacros("{{once::other::Other}}", context).text).toBe("Other");
  });
});
