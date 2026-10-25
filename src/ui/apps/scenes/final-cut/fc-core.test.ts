/**
 * The Final Cut tab's pure half: the stats strip, how a pass is switched and changed (Off keeps its settings), the contract preview
 * that is the real prompt, and the bank search over labels, patterns and entries.
 */
import { describe, expect, test } from "bun:test";
import { BANKS } from "../../../../core/final-cut/banks";
import { createPass, type FinalCutPass } from "../../../../core/final-cut/pass";
import { antiSlopMessages } from "../../../../core/final-cut/prompt-antislop";
import { contractOf, onPass, patchPass, searchBanks, stats, togglePass } from "./fc-core";

const editor = (extra: Partial<FinalCutPass> = {}): FinalCutPass => ({ ...createPass("editor", 0), ...extra });

describe("the stats strip", () => {
  test("reads Off for what is not there, and counts what is", () => {
    expect(stats(undefined)).toEqual([
      { label: "Creative Passes", value: "0" }, { label: "Anti-Slop", value: "Off" }, { label: "Editor Rules", value: "Off" }, { label: "Output Safety", value: "Off" }, { label: "User Message Check", value: "Off" },
    ]);
    const passes = [createPass("anti-slop", 0), editor({ attachedRules: ["rules/show-dont-tell", "rules/sensory-density"], order: 10 }), { ...createPass("validator", 2), applyToUserMessages: true }];
    expect(stats(passes).map((s) => s.value)).toEqual(["2", "6 banks", "2 attached", "On", "On"]);
  });
  test("a pass switched Off counts as Off", () => {
    expect(stats([editor({ enabled: false })]).map((s) => s.value)).toEqual(["0", "Off", "Off", "Off", "Off"]);
  });
});

describe("switching and changing a pass", () => {
  test("a type never run starts from its defaults; Off keeps what it was set to and On brings it back", () => {
    const first = togglePass(undefined, "editor");
    expect(first).toEqual([createPass("editor", 1)]);
    const tuned = patchPass(first, "editor", { povMode: "first-person", guideContent: "Keep it dry." });
    const off = togglePass(tuned, "editor");
    expect(off[0]).toMatchObject({ enabled: false, povMode: "first-person", guideContent: "Keep it dry." });
    expect(onPass(off, "editor")).toBeUndefined();
    expect(togglePass(off, "editor")[0]).toMatchObject({ enabled: true, povMode: "first-person", guideContent: "Keep it dry." });
  });
  test("changing a pass switches it on, from a patch or from the pass as it is", () => {
    const off = togglePass([editor()], "editor");
    expect(patchPass(off, "editor", { tenseMode: "past" })[0]).toMatchObject({ enabled: true, tenseMode: "past" });
    expect(patchPass(undefined, "translator", (c) => ({ targetLanguage: `${c.targetLanguage}-x` }))[0]).toMatchObject({ type: "translator", targetLanguage: "English-x" });
    const two = patchPass(patchPass([editor()], "editor", (c) => ({ attachedRules: [...(c.attachedRules ?? []), "a"] })), "editor", (c) => ({ attachedRules: [...(c.attachedRules ?? []), "b"] }));
    expect(two[0]!.attachedRules).toEqual(["a", "b"]);
  });
});

describe("the Pipeline Prompt Contract", () => {
  test("is the pass's real system prompt, in a wrapper that names its settings, with its tokens", () => {
    const pass = createPass("anti-slop", 0);
    const [contract] = contractOf([pass]);
    expect(contract).toMatchObject({ type: "anti-slop", label: "Anti-Slop" });
    expect(contract!.xml.startsWith(`<antislop_pass model="scene-default" sets="2" banks_enabled="6" default_depth="standard" failure="skip">`)).toBe(true);
    const real = antiSlopMessages("{{previous_pass_output}}", pass, { characterName: "{{char}}", recentMessages: [] })[0]!.content;
    expect(contract!.xml).toContain(real.split("\n").filter(Boolean)[0]!);
    expect(contract!.xml).toContain("<input>{{previous_pass_output}}</input>");
    expect(contract!.tokens).toBeGreaterThan(500);
  });
  test("lists the enabled passes in order, the safety check with no tokens, and nothing for nothing", () => {
    const list = contractOf([{ ...createPass("validator", 0), applyToUserMessages: true }, { ...editor({ order: 10 }) }, editor({ id: "x", type: "translator", order: 20, enabled: false })]);
    expect(list.map((c) => c.type)).toEqual(["validator", "editor"]);
    expect(list[0]).toMatchObject({ tokens: 0, label: "Safety" });
    expect(list[0]!.xml).toContain('check_user_messages="true"');
    expect(contractOf([])).toEqual([]);
  });
  test("a custom agent shows the preset entries it was handed", () => {
    const [c] = contractOf([{ ...createPass("custom-agent", 0), customPresetId: "p", customPresetName: "House" }], [{ id: "t", name: "Tone", content: "Keep it dry." }]);
    expect(c!.xml).toContain("Keep it dry.");
    expect(c!.xml).toContain('preset="House"');
  });
});

describe("the bank search", () => {
  const attached = ["wordbank", "universal-tells"];
  test("nothing typed finds nothing; a bank's name, and an entry, find their bank, entries first", () => {
    expect(searchBanks(attached, "  ")).toEqual([]);
    const byName = searchBanks(attached, "filter words");
    expect(byName.map((r) => r.bankId)).toContain("wordbank/filter-words");
    const entry = BANKS["wordbank/canonical-ai-tells"]!.examples[0]!.toLowerCase().replace(/[^a-z ]/g, "").split(" ")[0]!;
    const byEntry = searchBanks(attached, entry);
    expect(byEntry.some((r) => r.matching.length > 0)).toBe(true);
    expect(byEntry[0]!.matching.length).toBeGreaterThanOrEqual(byEntry.at(-1)!.matching.length);
  });
  test("only the attached sets are searched, and a bank is listed once", () => {
    const all = searchBanks(["wordbank", "wordbank"], "filter");
    expect(new Set(all.map((r) => r.bankId)).size).toBe(all.length);
    expect(searchBanks([], "filter")).toEqual([]);
    expect(searchBanks(["nope"], "filter")).toEqual([]);
  });
});
