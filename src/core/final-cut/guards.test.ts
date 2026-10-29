/**
 * Final Cut's small pure guards: protected blocks, the bounded word diff, the safety check and the refusal guard (RoleCall's
 * suspect-rewrite and protected-marker tests, ported; the diff is the one place Bunzai differs, and its test is the bound).
 */
import { describe, expect, test } from "bun:test";
import { buildWordDiff } from "./diff";
import { findMissingProtectedBlocks, protectStructuredBlocks, restoreStructuredBlocks } from "./protect";
import { suspectRewrite, summarizeIssues, validateText } from "./validate";

const NARRATOR =
  "The sound you make when you kneel, the wet scrape of shoe on stone, the rustle of fabric, the small animal noises of a body putting itself within " +
  "reach of something that bites, lands in my ears like a gunshot. Wolf ears don't miss much. Even now. Even with half my blood pooling between the " +
  "cobblestones and the rest of it pounding in my skull like a second heartbeat. The alley smells of rust and rain and the particular sweetness of things that have given up.";

describe("protected blocks", () => {
  test("macros, tags and fences are swapped out and come back exactly", () => {
    const text = "Hello {{char}}, <action>waves</action> [VN:smile] ```code``` end.";
    const { text: masked, blocks } = protectStructuredBlocks(text);
    expect(masked).not.toContain("{{char}}");
    expect(masked).not.toContain("<action>");
    expect(blocks.map((b) => b.kind).sort()).toEqual(["angle_tag", "angle_tag", "code_fence", "macro", "vn_tag"]);
    expect(restoreStructuredBlocks(masked, blocks)).toBe(text);
  });
  test("a block the answer lost is found", () => {
    const { blocks } = protectStructuredBlocks("Hi {{user}}.");
    expect(findMissingProtectedBlocks("Hi there.", blocks).map((b) => b.value)).toEqual(["{{user}}"]);
    expect(findMissingProtectedBlocks("Hi {{user}}.", blocks)).toEqual([]);
  });
  test("a placeholder left in the text is a leak the check refuses", () => {
    for (const leak of ["__FC_PROTECTED_2_ANGLE_TAG__", "[REFINED]_FC_PROTECTED", "__FC_PROTECTED_BLOCK_0__"]) {
      expect(validateText(`She went. ${leak}`).some((i) => i.code === "protected-block-token-leak" && i.severity === "error")).toBe(true);
    }
  });
});

describe("the safety check", () => {
  test("an empty reply is an error, the rest are warnings", () => {
    expect(validateText("  ")).toEqual([{ code: "empty-message", severity: "error", message: "Message is empty." }]);
    expect(validateText("fine.")).toEqual([]);
    const codes = validateText("```open {{char} <action>x [REFINED]").map((i) => i.code);
    expect(codes).toEqual(["unclosed-code-fence", "unbalanced-macro", "post-production-tag-leak", "unbalanced-action-tag"]);
  });
  test("issues read as SEVERITY: message", () => {
    expect(summarizeIssues(validateText(""))).toEqual(["ERROR: Message is empty."]);
  });
});

describe("the refusal guard", () => {
  test("rejects the reported Chinese refusal, an English one, a near-empty answer and a script flip", () => {
    expect(suspectRewrite(NARRATOR, "你好，我无法给到相关内容。")).toBeTruthy();
    expect(suspectRewrite(NARRATOR, "I'm sorry, but I cannot continue with this request.")).toBeTruthy();
    expect(suspectRewrite(NARRATOR, "ok.")).toBeTruthy();
    expect(suspectRewrite(NARRATOR, "狼の耳は多くを聞き逃さない。".repeat(12))).toBeTruthy();
  });
  test("allows a translator to change language, a normal rewrite, a substantial trim, dialogue that says can't help, and short inputs", () => {
    expect(suspectRewrite(NARRATOR, "狼の耳は多くを聞き逃さない。".repeat(24), "translator")).toBeNull();
    expect(suspectRewrite(NARRATOR, NARRATOR.replace("like a gunshot", "like a thunderclap"))).toBeNull();
    expect(suspectRewrite(NARRATOR, NARRATOR.slice(0, Math.floor(NARRATOR.length * 0.6)))).toBeNull();
    expect(suspectRewrite(NARRATOR, `"I can't help you," she said. ${NARRATOR}`)).toBeNull();
    expect(suspectRewrite("Hello there.", "Hi.")).toBeNull();
  });
});

describe("the word diff", () => {
  test("shows what was removed and added and keeps everything else", () => {
    const d = buildWordDiff("the cat sat down", "the dog sat down");
    expect(d.map((s) => [s.type, s.text])).toEqual([["equal", "the "], ["removed", "cat"], ["added", "dog"], ["equal", " sat down"]]);
    expect(d.filter((s) => s.type !== "added").map((s) => s.text).join("")).toBe("the cat sat down");
    expect(d.filter((s) => s.type !== "removed").map((s) => s.text).join("")).toBe("the dog sat down");
  });
  test("identical and empty texts", () => {
    expect(buildWordDiff("same", "same")).toEqual([{ type: "equal", text: "same" }]);
    expect(buildWordDiff("", "")).toEqual([]);
    expect(buildWordDiff("", "new").map((s) => s.type)).toEqual(["added"]);
  });
  test("a huge edit does not build the table: past the budget the middle is one removal and one addition, and the text still adds up", () => {
    const words = (n: number, w: string): string => Array.from({ length: n }, (_, i) => `${w}${i}`).join(" ");
    const a = `start ${words(3000, "a")} end`;
    const b = `start ${words(3000, "b")} end`;
    const d = buildWordDiff(a, b);
    expect(d.map((s) => s.type)).toEqual(["equal", "removed", "added", "equal"]);
    expect(d.filter((s) => s.type !== "added").map((s) => s.text).join("")).toBe(a);
    expect(d.filter((s) => s.type !== "removed").map((s) => s.text).join("")).toBe(b);
  });
  test("a small budget forces the coarse answer; a large one keeps the fine one", () => {
    expect(buildWordDiff("a b c d", "a x c d", 1).map((s) => s.type)).toEqual(["equal", "removed", "added", "equal"]);
    expect(buildWordDiff("a b c d", "a x c d", 1_000).length).toBeGreaterThan(0);
  });
});
