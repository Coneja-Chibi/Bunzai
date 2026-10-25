/** The draft prompts' pure parts: the impersonation message's three pieces, a rewrite's reply cleanup, and the range helpers RoleCall's Rewrite tab uses. */
import { expect, test } from "bun:test";
import { PERSPECTIVES, PERSPECTIVE_LINES, cleanReplacement, impersonationText, replaceRange, rewritePrompt, textRange, uniqueRange } from "./draft-prompts";

test("the impersonation text is the prompt, then one perspective line, then the hint only when there is one", () => {
  expect(PERSPECTIVES.map((p) => impersonationText("P.", p, ""))).toEqual(PERSPECTIVES.map((p) => `P.\n\n${PERSPECTIVE_LINES[p]}`));
  expect(impersonationText("P.", "1st", "  go  ")).toEndWith("do NOT echo this verbatim):\ngo");
});

test("a rewrite reply loses a code fence and a leading label, and nothing else", () => {
  expect(cleanReplacement("```text\nShe strode.\n```")).toBe("She strode.");
  expect(cleanReplacement("Replacement: She strode.")).toBe("She strode.");
  expect(cleanReplacement("  She said: hi  ")).toBe("She said: hi");
});

test("a rewrite's token cap follows the selection's length, between 300 and 2000", () => {
  expect(rewritePrompt("V", "rewrite", "m", "x").maxTokens).toBe(300);
  expect(rewritePrompt("V", "rewrite", "m", "x".repeat(1000)).maxTokens).toBe(500);
  expect(rewritePrompt("V", "reduce", "m", "x".repeat(9000)).maxTokens).toBe(2000);
});

test("a range is clamped to the message and whitespace is no selection; a range outside it is refused", () => {
  expect(textRange("hello", 3, 99)).toEqual({ start: 3, end: 5, text: "lo" });
  expect(textRange("hello", 4, 1)).toEqual({ start: 1, end: 4, text: "ell" });
  expect(textRange("a  b", 1, 3)).toBeNull();
  expect(replaceRange("hello", { start: 1, end: 3, text: "el" }, "ipp")).toBe("hipplo");
  expect(() => replaceRange("hi", { start: 1, end: 9, text: "x" }, "")).toThrow("outside the message");
});

test("a highlighted string is a range only when it appears once, trimmed if need be", () => {
  expect(uniqueRange("She walked home.", "walked")).toEqual({ start: 4, end: 10, text: "walked" });
  expect(uniqueRange("She walked home.", "\nwalked\n")).toEqual({ start: 4, end: 10, text: "walked" });
  expect(uniqueRange("ha ha", "ha")).toBeNull();
  expect(uniqueRange("hi", "")).toBeNull();
});

test("a Custom rewrite folds the person's instruction into RoleCall's operation, keeps the voice rules, and samples at the expand temperature", () => {
  const p = rewritePrompt("V", "custom", "m", "x", "Make her sound furious and clipped.");
  expect(p.system).toContain("according to the user's instruction below");
  expect(p.system).toContain("User instruction:\nMake her sound furious and clipped.");
  expect(p.system).toContain("preserving the speaker voice, POV, tense, names, and necessary formatting");
  expect(p.temperature).toBe(0.4);
  expect(rewritePrompt("V", "rewrite", "m", "x").system).not.toContain("User instruction");
});
