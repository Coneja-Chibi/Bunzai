/**
 * The Final Cut prompts: each pass says what it is and how to answer, the Anti-Slop contract honours depth, pins, shared entries and
 * history, the catalog is what RoleCall ships, and nothing sent to a model carries the mojibake RoleCall's prompt file does.
 */
import { describe, expect, test } from "bun:test";
import { BANKS, BANK_DEPTH, EDITOR_RULES, SETS, bankIdsInSet, getBank, getSet, resolveBankId, resolveSetId, type Bank } from "./banks";
import { createPass, type FinalCutPass } from "./pass";
import { antiSlopMessages } from "./prompt-antislop";
import { customAgentMessages, editorMessages, translatorMessages } from "./prompts";
import { toolFor } from "./tools";

/** An em dash, a right arrow, or the Latin-1 reading of a UTF-8 quote (the damage RoleCall's prompt file carries): none may reach a model or the panel. */
const STRAY = new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2192)}]|${String.fromCharCode(0xe2)}${String.fromCharCode(0x20ac)}`);
const ctx = (n: number) => ({ characterName: "Vera", recentMessages: Array.from({ length: n }, (_, i) => ({ role: i % 2 ? "user" : "assistant", content: `line ${i} <b>&</b>` })) });
const sys = (m: { role: string; content: string }[]): string => m[0]!.content;

describe("the catalog", () => {
  test("every bank is in exactly one set, and no stray em dash or arrow reaches a model", () => {
    const listed = SETS.flatMap((s) => s.banks);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(Object.keys(BANKS).sort());
    expect(JSON.stringify([BANKS, SETS, EDITOR_RULES])).not.toMatch(STRAY);
  });
  test("old ids still resolve, to the bank and set they became", () => {
    expect(resolveBankId("wb-verbs")).toBe("wordbank/canonical-ai-tells");
    expect(getBank("ai-tells")?.label).toBeTruthy();
    expect(resolveSetId("universal-core")).toBe("universal-tells");
    expect(getSet("universal-core")?.id).toBe("universal-tells");
    expect(bankIdsInSet("nope")).toEqual([]);
  });
  test("a new pass's default banks all exist in its default sets", () => {
    const p = createPass("anti-slop");
    for (const id of p.enabledBanks!) expect(getBank(id)).toBeDefined();
    for (const id of p.enabledBanks!) expect(p.attachedSets!.some((s) => bankIdsInSet(s).includes(id))).toBe(true);
  });
  test("depths send what their hints say", () => {
    expect(BANK_DEPTH.minimal).toMatchObject({ examples: 0, action: false, replace: false });
    expect(BANK_DEPTH.light).toMatchObject({ examples: 2, action: true, replace: false });
    expect(BANK_DEPTH.standard).toMatchObject({ examples: 5, replace: true });
    expect(BANK_DEPTH.deep.examples).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("the tools", () => {
  test("every model pass has its own strict tool, the safety check has none", () => {
    expect(toolFor("validator")).toBeNull();
    const names = (["editor", "anti-slop", "translator", "custom-agent"] as const).map((t) => toolFor(t)!.name);
    expect(new Set(names).size).toBe(4);
    const editor = toolFor("editor")!.tool.function;
    expect(editor.strict).toBe(true);
    expect((editor.parameters["required"] as string[]).sort()).toEqual(["changelog", "no_changes_needed", "refined", "rule_review"]);
    expect(toolFor("translator")!.bodyField).toBe("translated");
    expect((toolFor("translator")!.tool.function.parameters["required"] as string[])).toContain("already_in_target_language");
    expect(toolFor("anti-slop")!.changelogShape).toBe("bank-change");
  });
});

describe("the editor", () => {
  const editor = (extra: Partial<FinalCutPass> = {}): FinalCutPass => ({ ...createPass("editor"), ...extra });
  test("states the profile, every contract line, the preservation rules and the text, and asks for a tool call by default", () => {
    const m = editorMessages("Hello {{char}}.", editor({ profileId: "strict-pov", povMode: "first-person", guideContent: "No softening." }), ctx(0));
    expect(m.map((x) => x.role)).toEqual(["system", "user"]);
    expect(sys(m)).toContain("Profile: Strict POV");
    expect(sys(m)).toContain("POV contract: Maintain first-person narration.");
    expect(sys(m)).toContain("House style / scene rules:\nNo softening.");
    expect(sys(m)).toContain("Call the submit_edited_message tool exactly once");
    expect(sys(m)).toContain("Character: Vera");
    expect(m[1]!.content).toBe("Original message:\nHello {{char}}.\n\nCall submit_edited_message with the edited body and a per-rule changelog.");
  });
  test("tagged mode asks for the two sections instead", () => {
    const m = editorMessages("x", editor({ outputMode: "tagged" }));
    expect(sys(m)).toContain("Return exactly two sections: [CHANGELOG] and [REFINED].");
    expect(sys(m)).toContain("prefix your response with `[NO_CHANGES_NEEDED]`");
    expect(m[1]!.content).toBe("Original message:\nx\n\nReturn [CHANGELOG] and [REFINED].");
  });
  test("an attached craft rule ships under a craft-floor header, and a turn-history rule waits for two messages", () => {
    const history = Object.values(EDITOR_RULES).find((r) => r.scope === "turn-history");
    const other = Object.values(EDITOR_RULES).find((r) => r.scope !== "turn-history")!;
    const attached = editor({ attachedRules: [other.id, ...(history ? [history.id] : []), "rules/not-real"] });
    expect(sys(editorMessages("x", attached, ctx(0)))).toContain(`## ${other.label}`);
    if (history) {
      expect(sys(editorMessages("x", attached, ctx(0)))).not.toContain(`## ${history.label}`);
      expect(sys(editorMessages("x", attached, ctx(2)))).toContain(`## ${history.label}`);
    }
  });
  test("recent messages are escaped, limited to the pass's window, and numbered back from the newest", () => {
    const text = sys(editorMessages("x", editor({ contextMessages: 2 }), ctx(5)));
    expect(text).toContain("<recent_outputs n=\"2\">");
    expect(text).toContain("<msg n=\"-1\" role=\"user\">line 3 &lt;b&gt;&amp;&lt;/b&gt;</msg>");
    expect(text).toContain("<msg n=\"0\" role=\"assistant\">line 4 ");
    expect(text).not.toContain("line 2");
  });
});

describe("the translator and the custom agent", () => {
  test("the translator names the target, the policies and the term locks, and may declare the text already translated", () => {
    const p: FinalCutPass = { ...createPass("translator"), targetLanguage: "French", glossary: "kami = spirit", neverTranslateTerms: "Bankai", honorificPolicy: "drop" };
    const text = sys(translatorMessages("Hello", p));
    expect(text).toContain("Translate the supplied roleplay message into French.");
    expect(text).toContain("ALREADY entirely in French");
    expect(text).toContain("already_in_target_language: true");
    expect(text).toContain("Honorific/title policy: Remove honorifics");
    expect(text).toContain("Glossary:\nkami = spirit");
    expect(text).toContain("Never translate these terms/names:\nBankai");
    expect(translatorMessages("Hello", { ...p, outputMode: "tagged" })[1]!.content).toContain("[TRANSLATED]");
  });
  test("the custom agent follows its instruction and lists the preset entries it was handed", () => {
    const p: FinalCutPass = { ...createPass("custom-agent"), agentPrompt: "Tighten pacing.", customPresetId: "pre1", customPresetName: "House rules" };
    const text = sys(customAgentMessages("x", p, undefined, [{ id: "1", identifier: "tone", name: "Tone", content: "Keep it dry." }]));
    expect(text).toContain("Custom instruction:\nTighten pacing.");
    expect(text).toContain("Attached preset rulebook:\nPreset: House rules");
    expect(text).toContain("## 1. Tone (tone)\nKeep it dry.");
    expect(sys(customAgentMessages("x", p))).toContain("was selected, but no enabled prompt entries were available");
  });
});

describe("the Anti-Slop contract", () => {
  const pass = (extra: Partial<FinalCutPass> = {}): FinalCutPass => ({ ...createPass("anti-slop"), ...extra });
  const wordbank = SETS.find((s) => s.id === "wordbank")!;
  test("groups the enabled banks under their set at the pass's depth", () => {
    const id = "wordbank/canonical-ai-tells";
    const m = antiSlopMessages("Text", pass({ attachedSets: ["wordbank"], enabledBanks: [id], defaultDepth: "light" }), ctx(0));
    const text = sys(m);
    expect(text).toContain(`# ${wordbank.label}`);
    expect(text).toContain(`## ${BANKS[id]!.label}  [wordbank]`);
    expect(text).toContain(`Banned entries (2/${BANKS[id]!.examples.length}`);
    expect(text).not.toContain("Replace with:");
    expect(text).toContain("Action: Treat every entry below as banned.");
    expect(text).toContain("Call the submit_refined_message tool exactly once");
  });
  test("a minimal bank sends the pattern only, and a per-bank depth is tagged", () => {
    const id = "wordbank/canonical-ai-tells";
    const text = sys(antiSlopMessages("T", pass({ attachedSets: ["wordbank"], enabledBanks: [id], defaultDepth: "standard", bankDepthOverrides: { [id]: "minimal" } })));
    expect(text).toContain("(depth=minimal)");
    expect(text).not.toContain("Banned entries");
    expect(text).not.toContain("  Action:");
  });
  test("nothing enabled says the pass will do nothing", () => {
    expect(sys(antiSlopMessages("T", pass({ enabledBanks: [] })))).toContain("(no banks enabled - pass should be a no-op)");
  });
  test("a bank that needs turn history waits for two messages and is counted as skipped", () => {
    const pattern = Object.entries(BANKS).find(([, b]) => b.kind === "pattern")!;
    const set = SETS.find((s) => s.banks.includes(pattern[0]))!;
    const p = pass({ attachedSets: [set.id], enabledBanks: [pattern[0]] });
    expect(sys(antiSlopMessages("T", p, ctx(1)))).toContain("1 skipped - needs turn history");
    expect(sys(antiSlopMessages("T", p, ctx(1)))).not.toContain(`## ${pattern[1].label}`);
    expect(sys(antiSlopMessages("T", p, ctx(2)))).toContain(`## ${pattern[1].label}`);
  });
  test("a pin is sent first and only when the catalog holds that exact entry", () => {
    const id = "wordbank/canonical-ai-tells";
    const examples = BANKS[id]!.examples;
    const last = examples[examples.length - 1]!;
    const text = sys(antiSlopMessages("T", pass({ attachedSets: ["wordbank"], enabledBanks: [id], defaultDepth: "light", pinnedBankExamples: { [id]: [last, "an entry the catalog never had"] } })));
    expect(text).toContain("1 pinned");
    expect(text).toContain(last);
    expect(text).not.toContain("an entry the catalog never had");
  });
  test("a phrase listed under two banks is sent once", () => {
    const twin: Bank = { label: "Twin", kind: "phrase", pattern: "p", examples: ["the quiet hum of machinery", "a lone moth against the pane"], replace: "" };
    const first: Bank = { label: "First", kind: "phrase", pattern: "p", examples: ["the quiet hum of machinery"], replace: "" };
    const text = sys(antiSlopMessages("T", pass({ attachedSets: [], enabledBanks: [] }), undefined, { "user/a": first, "user/b": twin }));
    expect(text.match(/the quiet hum of machinery/g)).toHaveLength(1);
    expect(text).toContain("1 shared entry listed under earlier banks");
    expect(text).toContain("# User-authored banks");
    expect(text).toContain("[user-authored]");
  });
  test("the watchlist and global guidance ride at the end", () => {
    const text = sys(antiSlopMessages("T", pass({ customSlopisms: "breath hitched", antiSlopInstructions: "Use verbs." })));
    expect(text).toContain("[USER WATCHLIST - additional phrases, treat as kind=phrase]\nbreath hitched");
    expect(text).toContain("[USER REPLACEMENT GUIDANCE - global override]\nUse verbs.");
  });
});

describe("what a model is sent", () => {
  test("carries no mojibake, em dash or arrow from any builder", () => {
    const every = [
      ...editorMessages("x", createPass("editor"), ctx(3)), ...translatorMessages("x", createPass("translator"), ctx(3)),
      ...customAgentMessages("x", createPass("custom-agent"), ctx(3)), ...antiSlopMessages("x", createPass("anti-slop"), ctx(3)),
    ].map((m) => m.content).join("\n");
    expect(every).not.toMatch(STRAY);
  });
});
