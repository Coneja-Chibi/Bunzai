/** The scene's reasoning blocks, the logic once: what each kind holds, the labels, the open rules and the remembered choices. */
import { beforeEach, expect, test } from "bun:test";
import { autoOpenReasoning, capLongReasoning, carryOpenChoices, chooseOpen, durationLabel, forgetOpenChoices, isOpen, reasoningOf, snippetOf } from "./scene-reasoning-core";

const prefs = (values: Record<string, unknown> = {}) => ({ get: (key: string) => values[key] });
const base = { key: "s1", format: undefined, live: null, prefs: prefs() } as const;

beforeEach(forgetOpenChoices);

test("a finished reply splits native reasoning from tag thinking, each with its own stored time", () => {
  const got = reasoningOf({ ...base, content: "<think>plan it</think>Yes.", gen: { reasoning: { text: " Weigh the sky. " }, reasoningMs: 8_400, tagThinkingMs: 3_100 } });
  expect(got.props).toEqual({ rKey: "s1", rNat: "Weigh the sky.", rNatMs: 8_400, rTag: "plan it", rTagMs: 3_100, rLive: false, rAuto: true, rCap: false });
});

test("no reasoning, or whitespace only, means no blocks; an import with no timing carries no time", () => {
  expect(reasoningOf({ ...base, content: "Plain.", gen: { reasoning: { text: "  \n" } } }).props).toEqual({});
  expect(reasoningOf({ ...base, content: "<think>x</think>Hi", gen: undefined }).props).toEqual({ rKey: "s1", rTag: "x", rLive: false, rAuto: true, rCap: false });
});

test("the preset's own markers split the tag thinking", () => {
  const format = { prefix: "[[", suffix: "]]", separator: "" };
  expect(reasoningOf({ ...base, format, content: "[[mine]]Hello <think>kept</think>", gen: undefined }).props.rTag).toBe("mine");
});

test("a live turn shows its reasoning so far and keeps unclosed tag thinking out of the reply", () => {
  const thinking = reasoningOf({ ...base, key: "turn:1", content: undefined, gen: undefined, live: { text: "", reasoning: "Weigh" } });
  expect(thinking.props).toMatchObject({ rKey: "turn:1", rNat: "Weigh", rLive: true, rDots: "native" });
  expect(thinking.reply).toBe("");
  const tagging = reasoningOf({ ...base, content: undefined, gen: undefined, live: { text: "<think>half", reasoning: "" } });
  expect(tagging.props).toMatchObject({ rTag: "half", rDots: "tags" });
  expect(tagging.reply).toBe("");
  const replying = reasoningOf({ ...base, content: undefined, gen: undefined, live: { text: "<think>a</think>The beam", reasoning: "Weigh" } });
  expect(replying.props.rDots).toBeUndefined();
  expect(replying.reply).toBe("The beam");
});

test("the two settings travel with the blocks", () => {
  const got = reasoningOf({ ...base, prefs: prefs({ "scenes.autoOpenReasoning": false, "scenes.capLongReasoning": true }), content: "<think>x</think>Hi", gen: undefined });
  expect(got.props).toMatchObject({ rAuto: false, rCap: true });
});

test("labels: stored time, no time on an import, and the live words", () => {
  expect(durationLabel("native", 8_400, false)).toBe("Reasoned for 8.4s");
  expect(durationLabel("tags", 3_100, false)).toBe("Thought for 3.1s");
  expect(durationLabel("native", undefined, false)).toBe("Native reasoning");
  expect(durationLabel("tags", undefined, false)).toBe("Thought");
  expect(durationLabel("native", undefined, true)).toBe("Reasoning");
  expect(durationLabel("tags", 100, true)).toBe("Thinking");
});

test("the snippet is the flattened start of the text, cut at 60 characters", () => {
  expect(snippetOf("I read the\nlast turns.")).toBe("I read the last turns.");
  expect(snippetOf("x".repeat(80))).toBe("x".repeat(60) + "...");
});

test("the two settings: open while streaming is on unless false, the cap is off unless true", () => {
  expect([autoOpenReasoning(undefined), autoOpenReasoning(false), autoOpenReasoning(true)]).toEqual([true, false, true]);
  expect([capLongReasoning(undefined), capLongReasoning(false), capLongReasoning(true)]).toEqual([false, false, true]);
});

test("a block is closed by default; it opens by itself only for native reasoning while streaming with the setting on, or when it is the whole reply", () => {
  const closed = { key: "s1", kind: "native", live: false, auto: true, only: false } as const;
  expect(isOpen(closed)).toBe(false);
  expect(isOpen({ ...closed, live: true })).toBe(true);
  expect(isOpen({ ...closed, live: true, auto: false })).toBe(false);
  expect(isOpen({ ...closed, kind: "tags", live: true })).toBe(false);
  expect(isOpen({ ...closed, only: true })).toBe(true);
});

test("a choice by hand wins, per block, and survives the live turn becoming the saved reply", () => {
  const live = { key: "turn:1", kind: "native", live: true, auto: true, only: false } as const;
  chooseOpen("turn:1", "native", false);
  expect(isOpen(live)).toBe(false);
  expect(isOpen({ ...live, kind: "tags", only: true })).toBe(true);
  carryOpenChoices("turn:1", "swipe-9");
  expect(isOpen({ ...live, key: "swipe-9", live: false })).toBe(false);
  expect(isOpen({ ...live, key: "swipe-9", live: true })).toBe(false);
  chooseOpen("swipe-9", "tags", true);
  expect(isOpen({ ...live, key: "swipe-9", kind: "tags", live: false })).toBe(true);
});

test("Show Prefill in Chat puts the Start Reply With text back in front of the reply, so a prefill-opened block reads as one", () => {
  const format = { prefix: "", suffix: "", separator: "", capture: { mode: "auto" as const, custom: [], builtinTags: [] } };
  const shown = reasoningOf({ ...base, format, showPrefill: true, content: "mulling</think>Hi", gen: { prefill: "<think>" } });
  expect(shown.props.rTag).toBe("mulling");
  expect(shown.reply).toBe("Hi");
  expect(reasoningOf({ ...base, format, showPrefill: true, content: " smiled.", gen: { prefill: "*She" } }).reply).toBe("*She smiled.");
  expect(reasoningOf({ ...base, format, content: " smiled.", gen: { prefill: "*She" } }).reply).toBe(" smiled.");
  const live = reasoningOf({ ...base, format, showPrefill: true, content: undefined, gen: undefined, live: { text: "Hello", reasoning: "", prefill: "*She " } });
  expect(live.reply).toBe("*She Hello");
});
