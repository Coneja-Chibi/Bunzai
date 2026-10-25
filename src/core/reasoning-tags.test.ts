/** stripReasoningTags: the display-only <think>/<thinking>/<thought> stripper (VVS think-block leak). */
import { expect, test } from "bun:test";
import { splitReasoning, stripReasoningTags, tagThinkingState } from "./reasoning-tags";

test("text with no reasoning tag passes through unchanged", () => {
  expect(stripReasoningTags("plain narration with *asterisks*")).toBe("plain narration with *asterisks*");
  expect(stripReasoningTags("")).toBe("");
});

test("a closed <think> block is removed, narration after it survives", () => {
  expect(stripReasoningTags("<think>\nplanning the scene\n</think>\n\nShe opened the door.")).toBe("She opened the door.");
});

test("case-insensitive tag name, and the thinking/thought siblings", () => {
  expect(stripReasoningTags("<THINK>plan</THINK>text")).toBe("text");
  expect(stripReasoningTags("<thinking>plan</thinking>text")).toBe("text");
  expect(stripReasoningTags("<thought>plan</thought>text")).toBe("text");
});

test("two separate closed blocks in one message both go, the narration between and after survives", () => {
  expect(stripReasoningTags("<think>a</think>middle<think>b</think>end")).toBe("middleend");
});

test("a duplicate opening tag before the real content (ST prefill + model echo) still resolves at the one closing tag", () => {
  expect(stripReasoningTags("<think>\n\n<think>\nturkish planning text\n</think>\n\nShe ran outside.")).toBe("She ran outside.");
});

test("an unclosed block (generation cut off mid-thought) removes to the end of the text", () => {
  expect(stripReasoningTags("Before.\n<think>\nnever closes\n")).toBe("Before.");
});

test("a message that is only an unclosed thought shows that text, never a blank bubble", () => {
  expect(stripReasoningTags("<think>\nstill deciding what happens next")).toBe("still deciding what happens next");
  expect(stripReasoningTags("<think>a</think>\n<thinking>b never closes")).toBe("b never closes");
  expect(stripReasoningTags("<think>only a thought</think>")).toBe("");
});

test("leading whitespace left after removal is trimmed", () => {
  expect(stripReasoningTags("\n\n<think>plan</think>\n\nShe spoke.")).toBe("She spoke.");
});

test("a lone literal angle bracket or the bare word think is never touched", () => {
  expect(stripReasoningTags("He said <3 and started to think about it.")).toBe("He said <3 and started to think about it.");
});

const gemma = { prefix: "<|channel>thought\n", suffix: "<channel|>", separator: "\n\n" };
const harmony = { prefix: "<|start|>assistant<|channel|>analysis<|message|>", suffix: "<|start|>assistant<|channel|>final<|message|>", separator: "" };

test("a preset's own markers hide the reasoning and the separator after it", () => {
  expect(stripReasoningTags("<|channel>thought\nplan the scene<channel|>\n\nShe opened the door.", gemma)).toBe("She opened the door.");
  expect(stripReasoningTags("<|start|>assistant<|channel|>analysis<|message|>hmm<|start|>assistant<|channel|>final<|message|>Hello.", harmony)).toBe("Hello.");
});

test("a preset's markers are literal text, never a pattern", () => {
  const fmt = { prefix: "(.*", suffix: ")+", separator: "" };
  expect(stripReasoningTags("(.*secret)+visible", fmt)).toBe("visible");
  expect(stripReasoningTags("plain (.* text", { prefix: "(.*", suffix: ")+", separator: "" })).toBe("plain");
});

test("with a custom format, an unclosed block runs to the end and the built-in tags are left alone", () => {
  expect(stripReasoningTags("Before.<|channel>thought\nnever closes", gemma)).toBe("Before.");
  expect(stripReasoningTags("<think>kept</think>text", gemma)).toBe("<think>kept</think>text");
});

test("a blank format (no prefix or no suffix) falls back to the built-in tags", () => {
  const blank = { prefix: "", suffix: "", separator: "" };
  expect(stripReasoningTags("<think>a</think>text", blank)).toBe("text");
  expect(stripReasoningTags("<think>a</think>text", undefined)).toBe("text");
  expect(stripReasoningTags("<think>a</think>text", { prefix: "<x>", suffix: "", separator: "" })).toBe("text");
});

test("splitReasoning gives the thinking inside the tags and the reply outside, in order", () => {
  expect(splitReasoning("<think>a</think>middle<thinking>b</thinking>end")).toEqual({ thinking: "a\n\nb", reply: "middleend" });
  expect(splitReasoning("plain narration")).toEqual({ thinking: "", reply: "plain narration" });
  expect(splitReasoning("")).toEqual({ thinking: "", reply: "" });
});

test("splitReasoning honours the preset's own markers and keeps built-in tags as reply text", () => {
  expect(splitReasoning("<|channel>thought\nplan<channel|>\n\nHello.", gemma)).toEqual({ thinking: "plan", reply: "Hello." });
  expect(splitReasoning("<think>kept</think>text", gemma)).toEqual({ thinking: "", reply: "<think>kept</think>text" });
});

test("a finished reply's split matches stripReasoningTags, including the only-unclosed fallback", () => {
  for (const text of ["<think>\nstill deciding", "<think>a</think>\n<thinking>b never closes", "<think>only</think>", "Before.\n<think>never closes\n"]) {
    expect(splitReasoning(text).reply).toBe(stripReasoningTags(text));
  }
  // The fallback shows the unclosed text as the reply, so the block does not repeat it.
  expect(splitReasoning("<think>\nstill deciding")).toEqual({ thinking: "", reply: "still deciding" });
  expect(splitReasoning("<think>a</think>\n<thinking>b never closes")).toEqual({ thinking: "a", reply: "b never closes" });
});

test("a custom format with only an unclosed block has no fallback: it is thinking, and the reply is empty", () => {
  expect(splitReasoning("<|channel>thought\nnever closes", gemma)).toEqual({ thinking: "never closes", reply: "" });
});

test("while the reply is still streaming an unclosed block is thinking in progress, never reply text", () => {
  expect(splitReasoning("<think>\nstill deciding", undefined, true)).toEqual({ thinking: "still deciding", reply: "" });
  expect(splitReasoning("<think>a</think>The beam <think>b", undefined, true)).toEqual({ thinking: "a\n\nb", reply: "The beam" });
});

test("tagThinkingState tells none, open and closed apart", () => {
  expect(tagThinkingState("hello")).toBe("none");
  expect(tagThinkingState("<think>half")).toBe("open");
  expect(tagThinkingState("<think>half</think>")).toBe("closed");
  expect(tagThinkingState("<think>a</think>then <thought>b")).toBe("open");
  expect(tagThinkingState("<|channel>thought\nx", gemma)).toBe("open");
});
