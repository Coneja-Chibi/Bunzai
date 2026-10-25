/**
 * A preset as a rulebook (RoleCall's custom-agent preset tests, ported): enabled entries only, the person's per-entry switch wins,
 * markers and empty entries are not rules, and the three caps hold.
 */
import { expect, test } from "bun:test";
import type { PresetPrompt } from "../../entities/preset/schema";
import { RULEBOOK_CHARS, RULEBOOK_ENTRIES, RULEBOOK_ENTRY_CHARS, rulebookOf } from "./rulebook";

const prompt = (id: string, content: string, extra: Partial<PresetPrompt> = {}): PresetPrompt =>
  ({ id, name: `Entry ${id}`, content, role: "system", enabled: true, systemPrompt: false, marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false, ...extra }) as PresetPrompt;

test("lists the enabled entries as rules, in order, and nothing for no preset", () => {
  const rules = rulebookOf({ prompts: [prompt("a", "Keep it dry."), prompt("b", "Off.", { enabled: false }), prompt("c", "  Cut adverbs.  ")] }, undefined);
  expect(rules).toEqual([{ id: "a", name: "Entry a", content: "Keep it dry." }, { id: "c", name: "Entry c", content: "Cut adverbs." }]);
  expect(rulebookOf(null, undefined)).toEqual([]);
});

test("the person's switch beats the entry's own, both ways", () => {
  const rules = rulebookOf({ prompts: [prompt("a", "On by default."), prompt("b", "Off by default.", { enabled: false })] }, { a: false, b: true });
  expect(rules.map((r) => r.id)).toEqual(["b"]);
});

test("a marker and an empty entry are no rule, and a nameless entry is called Prompt entry", () => {
  const rules = rulebookOf({ prompts: [prompt("m", "x", { marker: true }), prompt("e", "   "), prompt("n", "Real.", { name: "" })] }, undefined);
  expect(rules).toEqual([{ id: "n", name: "Prompt entry", content: "Real." }]);
});

test("at most 30 entries, 4,000 characters each and 24,000 in all", () => {
  expect(rulebookOf({ prompts: Array.from({ length: 40 }, (_, i) => prompt(`p${i}`, "x")) }, undefined)).toHaveLength(RULEBOOK_ENTRIES);
  expect(rulebookOf({ prompts: [prompt("a", "y".repeat(5_000))] }, undefined)[0]!.content).toHaveLength(RULEBOOK_ENTRY_CHARS);
  const many = rulebookOf({ prompts: Array.from({ length: 10 }, (_, i) => prompt(`p${i}`, "z".repeat(4_000))) }, undefined);
  expect(many.reduce((n, r) => n + r.content.length, 0)).toBe(RULEBOOK_CHARS);
  expect(many).toHaveLength(6);
});
