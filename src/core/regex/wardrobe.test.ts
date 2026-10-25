/** The Wardrobe's classification (RoleCall lib/regex/wardrobe.ts): which display rules are message themes, which are outfits, and which preset choice casts each outfit. */
import { expect, test } from "bun:test";
import type { RegexRule } from "../../entities/regex/schema";
import type { ChoiceGroup } from "../macros/choice-groups";
import { classifyThemeRule, extractRecordName, extractSwatch, pairWithRoster, themeDisplayName } from "./wardrobe";

const rule = (over: Partial<RegexRule>): RegexRule => ({ id: "r", label: "Dress", find: "x", flags: "g", replace: "<style>.a{color:#FF0000}</style>", phases: ["display"], enabled: true, sortOrder: 0, ...over });

test("a theme is a display rule whose replacement opens with a style block; anything else is not", () => {
  expect(classifyThemeRule(rule({}))).not.toBeNull();
  expect(classifyThemeRule(rule({ replace: "  \n<STYLE>x</STYLE>" }))).not.toBeNull();
  expect(classifyThemeRule(rule({ replace: "text <style>x</style>" }))).toBeNull();
  expect(classifyThemeRule(rule({ phases: ["prompt"] }))).toBeNull();
  expect(classifyThemeRule(rule({ replace: "<styled>" }))).toBeNull();
});

test("a rule anchored on a bracket tag with an uppercase key is an outfit named by that tag; any other theme is a component", () => {
  expect(extractRecordName("\\[RECORD:\\s*HEARTTHROB\\]")).toBe("HEARTTHROB");
  expect(extractRecordName("[THEME: noir_2]")).toBe("noir_2");
  expect(extractRecordName("plain")).toBeNull();
  expect(classifyThemeRule(rule({ find: "\\[RECORD: HEARTTHROB\\]" }))).toMatchObject({ kind: "outfit", recordName: "HEARTTHROB" });
  expect(classifyThemeRule(rule({ find: "inline" }))).toMatchObject({ kind: "component", recordName: null });
});

test("the swatch is the first distinct hex colors in order, lower-cased, at most four; the rack name drops a series prefix and shouts no more", () => {
  expect(extractSwatch("<style>a{color:#AABBCC;background:#abc;border:#aabbcc;x:#111;y:#222;z:#333}</style>")).toEqual(["#aabbcc", "#abc", "#111", "#222"]);
  expect(themeDisplayName("VI Record - HEARTTHROB")).toBe("Heartthrob");
  expect(themeDisplayName("Noir Coat")).toBe("Noir Coat");
});

test("an outfit pairs with the select option whose id or label carries its record name, in the first group that has one; the rest are unpaired", () => {
  const group = (id: string, type: ChoiceGroup["type"], options: [string, string][]): ChoiceGroup => ({ id, label: id, type, options: options.map(([i, l]) => ({ id: i, label: l, prompts: [] })), default: [], prompts: [] });
  const groups = [group("tone", "select_one", [["dark", "Dark"]]), group("cast", "select_many", [["heartthrob-vi", "Lover"], ["x", "The Noir one"]]), group("gore", "toggle", [["heartthrob", "H"]])];
  const entries = ["HEARTTHROB", "NOIR", "GHOST"].map((n) => classifyThemeRule(rule({ id: n, label: n, find: `\\[RECORD: ${n}\\]` }))!);
  const { paired, unpaired } = pairWithRoster([...entries, classifyThemeRule(rule({ id: "c" }))!], groups);
  expect(paired.map((p) => [p.entry.recordName, p.groupId, p.optionId])).toEqual([["HEARTTHROB", "cast", "heartthrob-vi"], ["NOIR", "cast", "x"]]);
  expect(unpaired.map((e) => e.recordName)).toEqual(["GHOST"]);
});
