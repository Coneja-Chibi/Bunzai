/**
 * Catch thinking (RoleCall's Auto / Only these / Off, thinking-tags.ts at the pin): what a reply's
 * display takes out as the model's thinking. Auto catches the preset's own markers, the Start Reply With
 * tag (even when only its closer comes back), the built-in thinking tags, look-alike tag names and a tag that
 * never closes; Only these catches exactly the picked tags and the person's own text, closed blocks only; Off
 * catches nothing.
 */
import { describe, expect, test } from "bun:test";
import { closingForOpening, isThinkingTagName, normalizeCapture, prefillTag, resolveReasoning } from "./reasoning-capture";
import { reasoningSpanAt, splitReasoning, stripReasoningTags, tagThinkingState } from "./reasoning-tags";

const auto = resolveReasoning(undefined, undefined);
const withPrefill = (prefill: string) => resolveReasoning(undefined, { prefill });
const only = (custom: { open: string; close: string }[], builtinTags: string[] = []) => resolveReasoning(undefined, { capture: { mode: "only", custom, builtinTags } });
const off = resolveReasoning(undefined, { capture: { mode: "off", custom: [], builtinTags: [] } });

describe("Auto", () => {
  test("catches the built-in tags, including ones the old three-tag list missed", () => {
    expect(splitReasoning("<scratchpad>plan it</scratchpad>Hello.", auto)).toEqual({ thinking: "plan it", reply: "Hello." });
    expect(splitReasoning("<Reasoning>why</Reasoning>Hi", auto)).toEqual({ thinking: "why", reply: "Hi" });
    expect(splitReasoning("[THINK]square[/THINK]Hi", auto)).toEqual({ thinking: "square", reply: "Hi" });
    expect(splitReasoning("<|begin_of_thought|>deep<|end_of_thought|>Hi", auto)).toEqual({ thinking: "deep", reply: "Hi" });
  });

  test("catches a tag whose name looks like a thinking tag, and never ordinary markup", () => {
    expect(splitReasoning("<think_hard>mull</think_hard>Hi", auto)).toEqual({ thinking: "mull", reply: "Hi" });
    expect(splitReasoning("<internal_monologue>m</internal_monologue>Hi", auto)).toEqual({ thinking: "m", reply: "Hi" });
    for (const keep of ["<b>bold</b> and <i>it</i>", "<div>box</div>", "She said <3 and left", "<emotion>joy</emotion> shows"]) {
      expect(splitReasoning(keep, auto)).toEqual({ thinking: "", reply: keep });
    }
  });

  test("a tag that never closes runs to the end of the reply", () => {
    expect(splitReasoning("Hello <think>cut off mid", auto)).toEqual({ thinking: "cut off mid", reply: "Hello" });
  });

  test("the Start Reply With tag is caught even when the reply only closes it, because the prefill opened it", () => {
    const fmt = withPrefill("<mood>");
    expect(splitReasoning("feeling brave</mood>Hello there.", fmt)).toEqual({ thinking: "feeling brave", reply: "Hello there." });
    expect(splitReasoning("<mood>again</mood>Fine.", fmt)).toEqual({ thinking: "again", reply: "Fine." });
    expect(splitReasoning("no tag at all", fmt)).toEqual({ thinking: "", reply: "no tag at all" });
    expect(splitReasoning("a</mood>b", auto)).toEqual({ thinking: "", reply: "a</mood>b" });
  });

  test("while the reply streams, a prefill-opened block is thinking until its closer arrives", () => {
    const fmt = withPrefill("<think>");
    expect(tagThinkingState("", fmt)).toBe("open");
    expect(tagThinkingState("mulling it over", fmt)).toBe("open");
    expect(tagThinkingState("mulling</think>Hel", fmt)).toBe("closed");
    expect(splitReasoning("mulling it over", fmt, true)).toEqual({ thinking: "mulling it over", reply: "" });
    expect(tagThinkingState("plain", auto)).toBe("none");
  });

  test("a preset's own markers are caught too, alongside the built-in tags", () => {
    const fmt = resolveReasoning({ prefix: "<<", suffix: ">>", separator: "" }, undefined);
    expect(splitReasoning("<<mine>>Reply <think>t</think>.", fmt)).toEqual({ thinking: "mine\n\nt", reply: "Reply ." });
  });
});

describe("Only these", () => {
  test("catches exactly the picked built-in tags and the person's own text, and nothing inferred", () => {
    const fmt = only([{ open: "Status:", close: "---" }], ["<plan>"]);
    expect(splitReasoning("<plan>p</plan>Status: calm---Hello", fmt)).toEqual({ thinking: "p\n\ncalm", reply: "Hello" });
    expect(splitReasoning("<think>t</think>Hi", fmt)).toEqual({ thinking: "", reply: "<think>t</think>Hi" });
    expect(splitReasoning("<think_hard>t</think_hard>Hi", fmt)).toEqual({ thinking: "", reply: "<think_hard>t</think_hard>Hi" });
  });

  test("an unclosed block stays in the reply once the reply is finished, and is thinking in progress while it streams", () => {
    const fmt = only([], ["<think>"]);
    expect(splitReasoning("Hi <think>open end", fmt)).toEqual({ thinking: "", reply: "Hi <think>open end" });
    expect(splitReasoning("Hi <think>open end", fmt, true)).toEqual({ thinking: "open end", reply: "Hi" });
  });

  test("an own tag still being typed (an empty opening or closing text) catches nothing", () => {
    const fmt = only([{ open: "", close: "</x>" }, { open: "<x>", close: "" }]);
    expect(splitReasoning("<x>a</x> ok", fmt)).toEqual({ thinking: "", reply: "<x>a</x> ok" });
  });

  test("a prefill's closer alone is not caught: that is Auto's", () => {
    const fmt = resolveReasoning(undefined, { prefill: "<mood>", capture: { mode: "only", custom: [], builtinTags: ["<think>"] } });
    expect(splitReasoning("brave</mood>Hello", fmt)).toEqual({ thinking: "", reply: "brave</mood>Hello" });
  });
});

describe("Off", () => {
  test("nothing is taken out of the reply", () => {
    const text = "<think>t</think>Hello <plan>p</plan>";
    expect(splitReasoning(text, off)).toEqual({ thinking: "", reply: text });
    expect(stripReasoningTags(text, off)).toBe(text);
    expect(tagThinkingState(text, off)).toBe("none");
    expect(reasoningSpanAt(text, 3, off)).toBeNull();
  });
});

describe("the rest of the display reads the same scan", () => {
  test("stripReasoningTags and reasoningSpanAt agree with splitReasoning under Auto", () => {
    const text = "Hi <scratchpad>p</scratchpad> there";
    expect(stripReasoningTags(text, auto)).toBe("Hi  there");
    expect(reasoningSpanAt(text, 8, auto)).toEqual([3, 29]);
    expect(reasoningSpanAt(text, 1, auto)).toBeNull();
  });
});

describe("the policy as stored", () => {
  test("a known mode keeps its lists, anything else reads as Auto", () => {
    expect(normalizeCapture({ mode: "only", custom: [{ open: " <a> ", close: "</a>" }], builtinTags: ["<think>", "<nope>"] })).toEqual({ mode: "only", custom: [{ open: "<a>", close: "</a>" }], builtinTags: ["<think>"] });
    expect(normalizeCapture({ mode: "weird" }).mode).toBe("auto");
    expect(normalizeCapture(undefined)).toEqual({ mode: "auto", custom: [], builtinTags: [] });
  });
  test("closing text pairs with an opening tag", () => {
    expect(closingForOpening("<plan>")).toBe("</plan>");
    expect(closingForOpening("[THINK]")).toBe("[/THINK]");
    expect(closingForOpening("<|begin_of_thought|>")).toBe("<|end_of_thought|>");
    expect(closingForOpening("◁think▷")).toBe("◁/think▷");
    expect(closingForOpening("Status:")).toBe("");
  });
  test("the Start Reply With tag is read from the prefill text", () => {
    expect(prefillTag("<Plan attr=1>")).toEqual({ open: "<Plan attr=1>", close: "</Plan>" });
    expect(prefillTag("[think]")).toEqual({ open: "[THINK]", close: "[/THINK]" });
    expect(prefillTag("no tag")).toBeNull();
  });
  test("thinking tag names: the list, the compounds and look-alikes, never HTML", () => {
    for (const yes of ["think", "THINKING", "scratchpad", "chain-of-thought", "think_hard", "internal_monologue", "reasonng"]) expect(isThinkingTagName(yes)).toBe(true);
    for (const no of ["b", "div", "emotion", "action", "span"]) expect(isThinkingTagName(no)).toBe(false);
  });
});

describe("Auto's heading, untagged and recovered thinking (RoleCall's marker block, glue boundary and Smart Recovery)", () => {
  test("a Thinking: section followed by a Response: heading is caught when no tag is", () => {
    const text = "Thinking:\nI should plan the scene carefully.\n\nResponse:\nThe door opens.";
    expect(splitReasoning(text, auto)).toEqual({ thinking: "I should plan the scene carefully.", reply: "The door opens." });
    expect(splitReasoning("Analysis:\nshort\n\nAnswer:\nHi", auto)).toEqual({ thinking: "", reply: "Analysis:\nshort\n\nAnswer:\nHi" });
    expect(splitReasoning(text, only([], ["<think>"]))).toEqual({ thinking: "", reply: text });
    expect(splitReasoning(text, off)).toEqual({ thinking: "", reply: text });
    expect(splitReasoning("<think>t</think>Thinking:\nI should plan the scene carefully.\n\nResponse:\nX", auto).thinking).toBe("t");
  });

  test("reasoning that runs into the reply with no space is caught only after a reply-planning opener, and only once the reply is finished", () => {
    const text = "I should keep the reply short and in character.She turns to face you now.";
    expect(splitReasoning(text, auto)).toEqual({ thinking: "I should keep the reply short and in character.", reply: "She turns to face you now." });
    expect(splitReasoning(text, auto, true)).toEqual({ thinking: "", reply: text });
    expect(splitReasoning("She turns to face you now.Rain falls on the glass outside.", auto).thinking).toBe("");
    expect(splitReasoning("I should keep the *reply* short and in character.She turns to face you now.", auto).thinking).toBe("");
    expect(splitReasoning(text, only([], ["<think>"])).thinking).toBe("");
  });

  test("thinking a helper model found at the start of a reply is caught by its stored end, in Auto only", () => {
    const text = "The user wants a short answer so I will say it plainly. The lamp flickers.";
    const at = text.indexOf("The lamp");
    expect(splitReasoning(text, { ...auto, recoveredEnd: at })).toEqual({ thinking: "The user wants a short answer so I will say it plainly.", reply: "The lamp flickers." });
    expect(splitReasoning(text, { ...off, recoveredEnd: at }).thinking).toBe("");
    expect(splitReasoning(text, { ...auto, recoveredEnd: text.length + 5 }).thinking).toBe("");
  });
});
