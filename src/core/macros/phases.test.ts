/**
 * Evaluation phases tests: RoleCall's ported to
 * bun:test. Exercises phases.ts (already ported) together with phase-macros.ts's inline fallbacks.
 * RoleCall's `initializeMacros()` / `beforeAll` is dropped: this engine's registry builds itself from
 * CATALOG at import time.
 *
 * Some cases below also exercise `{{state.set}}` and `{{getvar}}` (other handler families); they are
 * ported unchanged and will only pass once those families are registered too.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from ".";
import { containsPhaseMacros, processPhasedBlocks, type PhasedBlock } from "./phases";
import type { MacroContext } from "./types";

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: "TestChar",
    userName: "TestUser",
    messages: [{ role: "user", content: "hi" }],
    messageCount: 1,
    ...overrides,
  });
}

function phased(blocks: PhasedBlock[], context: MacroContext): Map<string, string> {
  return processPhasedBlocks(blocks, (text) => processMacros(text, context).text);
}

describe("containsPhaseMacros", () => {
  test("detects phase-aware macros cheaply", () => {
    expect(containsPhaseMacros("{{phase::pre_render::x}}")).toBe(true);
    expect(containsPhaseMacros("{{defer:: x }}")).toBe(true);
    expect(containsPhaseMacros("{{after::id::x}}")).toBe(true);
    expect(containsPhaseMacros("{{getvar::x}} plain")).toBe(false);
  });
});

describe("processPhasedBlocks", () => {
  test('pre_render runs before earlier blocks render ("init before HEARTTHROB")', () => {
    // Block order: init (reads callsign) comes BEFORE the Director prompt (sets callsign in
    // pre_render). Without phases, init sees stale state.
    const context = ctx();
    const result = phased(
      [
        { id: "init", text: "Director: {{getvar::callsign}}" },
        { id: "heartthrob", text: "{{phase::pre_render::{{state.set::session:callsign::HEARTTHROB}}}}Romance rules." },
      ],
      context,
    );

    expect(result.get("init")).toBe("Director: HEARTTHROB");
    expect(result.get("heartthrob")).toBe("Romance rules.");
  });

  test("phase::render is inline sugar (normal order)", () => {
    const context = ctx();
    const result = phased([{ id: "a", text: "{{phase::render::{{state.set::session:x::1}}}}x={{getvar::x}}" }], context);
    expect(result.get("a")).toBe("x=1");
  });

  test("post_render and defer see state set by LATER blocks", () => {
    const context = ctx();
    const result = phased(
      [
        { id: "summary", text: "Final director: {{defer::{{getvar::callsign}}}}" },
        { id: "late", text: "{{state.set::session:callsign::SCORIA}}" },
      ],
      context,
    );
    expect(result.get("summary")).toBe("Final director: SCORIA");
  });

  test("after:: blocks read state from the named (later) prompt", () => {
    const context = ctx();
    const result = phased(
      [
        { id: "early", text: "{{after::hp_dir_close::Current: {{getvar::callsign}}}}" },
        { id: "hp_dir_close", text: "{{state.set::session:callsign::VICE}}closing." },
      ],
      context,
    );
    expect(result.get("early")).toBe("Current: VICE");
    expect(result.get("hp_dir_close")).toBe("closing.");
  });

  test("evaluation order: pre_render -> render -> after -> post_render -> defer", () => {
    const context = ctx();
    phased(
      [
        { id: "a", text: "{{defer::{{addvar::order::D}}}}{{phase::post_render::{{addvar::order::C}}}}{{addvar::order::B}}" },
        { id: "b", text: "{{phase::pre_render::{{addvar::order::A}}}}" },
      ],
      context,
    );
    expect(context.localVariables.get("order")?.value).toBe("ABCD");
  });

  test("blocks without phase macros pass through unchanged", () => {
    const context = ctx();
    const result = phased([{ id: "plain", text: "Hello {{char}}, no phases here." }], context);
    expect(result.get("plain")).toBe("Hello TestChar, no phases here.");
  });

  test("never leaks sentinel characters", () => {
    const context = ctx();
    const result = phased([{ id: "a", text: "A{{phase::pre_render::{{noop}}}}B{{defer::C}}D" }], context);
    expect(result.get("a")).toBe("ABCD");
    expect(result.get("a")).not.toContain("\x03");
  });
});

describe("inline fallbacks (outside the orchestrator)", () => {
  test("phase/defer/after render their body inline through processMacros", () => {
    const context = ctx();
    expect(processMacros("{{phase::pre_render::hello}}", context).text).toBe("hello");
    expect(processMacros("{{defer::world}}", context).text).toBe("world");
    expect(processMacros("{{after::some_id::content}}", context).text).toBe("content");
    expect(processMacros("{{phase::pre_render::hello}}", context).errors).toHaveLength(0);
  });
});
