/**
 * Reading a pass's answer (RoleCall's parser tests, ported): markers under decoration, a bracketed word in the body that must not cut it
 * short, no guessing, the outer fence, the no-op signals, and the tool-call forms.
 */
import { describe, expect, test } from "bun:test";
import { changelogFromTool, detectMarker, parseTagged, ruleReviewOf, toolArgs, toolArgsFromText } from "./parse";

describe("the canonical form", () => {
  test("[CHANGELOG] and [REFINED]", () => {
    const out = parseTagged("[CHANGELOG]\n- Tense: fixed slip\n[REFINED]\nthe edited body", "REFINED");
    expect(out).toEqual({ text: "the edited body", changelog: [{ rule: "Tense", description: "fixed slip" }], warnings: [] });
  });
  test("[TRANSLATED] for a translator", () => {
    expect(parseTagged("[CHANGELOG]\n- Glossary: kept name\n[TRANSLATED]\nle corps traduit", "TRANSLATED").text).toBe("le corps traduit");
  });
  test("a changelog line with no rule is filed under General", () => {
    expect(parseTagged("[CHANGELOG]\njust words\n[REFINED]\nb", "REFINED").changelog).toEqual([{ rule: "General", description: "just words" }]);
  });
});

describe("decoration is tolerated", () => {
  const cases: Array<[string, string]> = [
    ["lowercase", "[changelog]\n- a: b\n[refined]\nbody"],
    ["spaces inside", "[ CHANGELOG ]\n- a: b\n[ REFINED ]\nbody"],
    ["bold", "**[CHANGELOG]**\n- a: b\n**[REFINED]**\nbody"],
    ["markdown header", "## CHANGELOG\n- a: b\n## REFINED\nbody"],
    ["dash banner", "--- CHANGELOG ---\n- a: b\n--- REFINED ---\nbody"],
    ["equals banner", "=== CHANGELOG ===\n- a: b\n=== REFINED ===\nbody"],
    ["html-ish", "<CHANGELOG>\n- a: b\n<REFINED>\nbody"],
    ["self-closing", "<CHANGELOG/>\n- a: b\n<REFINED/>\nbody"],
    ["asian brackets", "【CHANGELOG】\n- a: b\n【REFINED】\nbody"],
    ["trailing colon", "[CHANGELOG]:\n- a: b\n[REFINED]:\nbody"],
    ["leading space", "  [CHANGELOG]\n- a: b\n  [REFINED]\nbody"],
  ];
  for (const [label, input] of cases) {
    test(label, () => {
      const out = parseTagged(input, "REFINED");
      expect(out.text).toBe("body");
      expect(out.warnings).toEqual([]);
    });
  }
});

describe("only known markers end a section, and a marker must be alone on its line", () => {
  test("[NOTE] and [OOC] inside the body stay in it", () => {
    expect(parseTagged("[CHANGELOG]\n- a: b\n[REFINED]\nLine one\n[NOTE] kept\n[OOC] aside\nLine three", "REFINED").text).toBe("Line one\n[NOTE] kept\n[OOC] aside\nLine three");
  });
  test("a later known marker is a real break", () => {
    expect(parseTagged("[REFINED]\nfirst\n[CHANGELOG]\n- after: yes", "REFINED").text).toBe("first");
  });
  test("the word REFINED in prose is not a marker", () => {
    expect(parseTagged("[CHANGELOG]\n- a: b\n[REFINED]\nThe REFINED prose now reads better.\nMore.", "REFINED").text).toBe("The REFINED prose now reads better.\nMore.");
  });
  test("no markers at all: the raw answer is the body, with a warning", () => {
    const out = parseTagged("just prose", "REFINED");
    expect(out.text).toBe("just prose");
    expect(out.warnings).toHaveLength(1);
  });
  test("a changelog with no body section gives an empty body, never the changelog as the message", () => {
    const out = parseTagged("[CHANGELOG]\n- a: b", "REFINED");
    expect(out.text).toBe("");
    expect(out.warnings[0]).toContain("no [REFINED] section");
  });
});

describe("an outer code fence", () => {
  test("goes when the whole answer is one fence with a marker inside", () => {
    expect(parseTagged("```markdown\n[CHANGELOG]\n- a: b\n[REFINED]\nthe body\n```", "REFINED").text).toBe("the body");
    expect(parseTagged("```\n[CHANGELOG]\n- a: b\n[REFINED]\nthe body\n```", "REFINED").text).toBe("the body");
  });
  test("stays when it holds no marker: it is the body's own code block", () => {
    const raw = "```python\nprint('hello')\n```";
    expect(parseTagged(raw, "REFINED").text).toBe(raw);
  });
  test("an inner code block of the body is kept", () => {
    const out = parseTagged("```\n[CHANGELOG]\n- a: b\n[REFINED]\nbefore\n```python\nprint(1)\n```\nafter\n```", "REFINED");
    expect(out.text).toContain("```python");
  });
});

describe("the no-op signals", () => {
  test("NO_CHANGES_NEEDED in any dress", () => {
    for (const m of ["[NO_CHANGES_NEEDED]", "[no_changes_needed]", "### NO CHANGES NEEDED", "[ no-changes-needed ]"]) {
      expect(detectMarker(`${m}\n[CHANGELOG]\n[REFINED]\nx`, "NO_CHANGES_NEEDED")).toBe(true);
    }
  });
  test("ALREADY_IN_TARGET, and not a phrase inside prose", () => {
    expect(detectMarker("**[already_in_target]**\n[TRANSLATED]\nx", "ALREADY_IN_TARGET")).toBe(true);
    expect(detectMarker("the message was already in target language", "ALREADY_IN_TARGET")).toBe(false);
  });
});

describe("the tool-call form", () => {
  test("arguments arrive as a string or an object, and anything else is not arguments", () => {
    expect(toolArgs("{\"refined\":\"x\"}")).toEqual({ refined: "x" });
    expect(toolArgs({ refined: "x" })).toEqual({ refined: "x" });
    expect(toolArgs("[1]")).toBeNull();
    expect(toolArgs("not json")).toBeNull();
    expect(toolArgs(undefined)).toBeNull();
  });
  test("the JSON a model wrote in its reply is recovered, fenced or with prose around it, but only when it has the body field, a changelog or the no-op flag", () => {
    expect(toolArgsFromText("```json\n{\"refined\":\"x\",\"changelog\":[]}\n```", "refined")).toEqual({ refined: "x", changelog: [] });
    expect(toolArgsFromText("Sure. {\"refined\":\"has {braces} and \\\"quotes\\\"\"} done", "refined")).toEqual({ refined: "has {braces} and \"quotes\"" });
    expect(toolArgsFromText("{\"other\":1}", "refined")).toBeNull();
    expect(toolArgsFromText("no json here", "refined")).toBeNull();
    expect(toolArgsFromText("{\"no_changes_needed\":true}", "refined")).toEqual({ no_changes_needed: true });
  });
  test("a changelog maps by shape and drops malformed entries", () => {
    expect(changelogFromTool([{ bank: "AI tells", change: "cut" }, { bank: 1 }], "bank-change")).toEqual([{ rule: "AI tells", description: "cut" }]);
    expect(changelogFromTool([{ rule: "POV", description: "fixed" }, null], "rule-description")).toEqual([{ rule: "POV", description: "fixed" }]);
    expect(changelogFromTool("x", "rule-description")).toEqual([]);
  });
  test("a rule review keeps whole entries with a known verdict, else is absent", () => {
    expect(ruleReviewOf([{ rule: "a", verdict: "clean", reasoning: "r" }, { rule: "b", verdict: "weird", reasoning: "r" }, { rule: "c" }])).toEqual([{ rule: "a", verdict: "clean", reasoning: "r" }]);
    expect(ruleReviewOf(null)).toBeUndefined();
    expect(ruleReviewOf([])).toBeUndefined();
  });
});
