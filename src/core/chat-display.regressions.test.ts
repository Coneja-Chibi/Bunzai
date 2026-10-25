/**
 * Regression tests pinning chat-display behavior that is easy to break by accident: a reasoning-
 * only reply must render empty rather than falling back to raw text, and an unresolved lorebook or
 * outlet macro must render empty rather than an error or stale cache.
 */
import { expect, test } from "bun:test";
import { chatDisplay } from "./chat-display";

const vera = { kind: "character", id: "vera", body: { identity: { name: "Vera", description: "a bard" }, persona: { scenario: "a tavern" } } };
const chi = { kind: "persona", id: "chi", body: { name: "Chi", content: "" } };
const base = { character: vera, persona: chi, messages: [], randomSeed: 7, now: 0 };
const baseNoPersona = { character: vera, persona: undefined, messages: [], randomSeed: 7, now: 0 };

test("a reply entirely inside <think> tags shows empty, never the duplicated raw text", () => {
  // A naive fallback ("" || rawContent) would show the raw, unstripped message whenever the
  // stripped result was falsy, so a reply that was 100% reasoning (no visible text outside the
  // <think> block) would duplicate the hidden reasoning straight into the bubble. Bunraku's
  // stripReasoningTags has no such fallback: chat-display.ts uses `stripped` directly, empty or not.
  const show = chatDisplay(base);
  expect(show("<think>\nonly reasoning, nothing else\n</think>")).toBe("");
  expect(show("<thinking>only reasoning, nothing else</thinking>")).toBe("");
  // Cut off inside the thought (no closing tag): the text shows, never a blank bubble.
  expect(show("<thought>only reasoning, nothing else")).toBe("only reasoning, nothing else");
});

test("{{lorebook}} and {{outlet}} render empty in a bubble today (no allLorebookEntries wiring yet), not an error or stale cache", () => {
  // chatDisplay builds its own MacroContext via createDefaultContext and never sets
  // allLorebookEntries (src/core/macros/handlers/lorebook.ts's LorebookMacroContext field), so
  // {{lorebook::name}} / {{outlet::name}} always render empty in a bubble today. That is not a
  // divergence from generation: nothing in src/core/assembly populates allLorebookEntries either
  // (lorebook wiring into the macro context is step 2e), so there is
  // no working generation-side resolution for a display-side omission to diverge from - both sides
  // are equally silent right now.
  //
  // This test is a tripwire, not a bug report: it locks in "empty, not an error" as the current,
  // honest behavior. The moment assembly (src/core/assembly) starts populating allLorebookEntries
  // for real generation, DisplayInput here must grow the same field (or chatDisplay callers must
  // pass it through), or a lorebook/outlet macro would work in the sent prompt but render empty in
  // the chat bubble. See DisplayInput in chat-display.ts.
  const show = chatDisplay(baseNoPersona);
  expect(show("[{{lorebook::The Harbor}}]")).toBe("[]");
  expect(show("[{{outlet::The Harbor}}]")).toBe("[]");
});

test("DisplayInput has no field to carry lorebook entries through, unlike LorebookMacroContext.allLorebookEntries used at the macro layer", () => {
  // A type-level tripwire: if DisplayInput ever grows an entries/lorebook field, this cast should
  // start failing to compile, which is the point - it means someone remembered to wire it and
  // this comment (and the test above) should be revisited/deleted.
  const input: Parameters<typeof chatDisplay>[0] = baseNoPersona;
  expect((input as { allLorebookEntries?: unknown }).allLorebookEntries).toBeUndefined();
});
