/**
 * Saucepan export: a `chara`-only CCv2 PNG for the Companion Importer, with every field over
 * Saucepan's limits named in the report (the importer clips silently apart from a toast).
 */
import { expect, test } from "bun:test";
import { characterAdapter as saucepan, saucepanWarnings } from "./index";
import { hostCard, textChunks } from "../_fixtures/host-card";

const DATA = {
  name: "Vera",
  description: "A lighthouse keeper who never sleeps.",
  personality: "Watchful.",
  scenario: "A storm rolls in.",
  first_mes: "You came back.",
  alternate_greetings: ["Another night.", "The lamp flickers."],
  creator_notes: "Slow-burn keeper bot.",
  system_prompt: "Stay in character.",
  tags: ["fantasy", "slow burn"],
};

test("writes a V2 card under chara only, even for a V3 card", () => {
  const chunks = textChunks(saucepan.fromCanonical(hostCard(DATA, "v3")).bytes!);
  expect(Object.keys(chunks)).toEqual(["chara"]);
  const card = chunks.chara!;
  expect(card.spec).toBe("chara_card_v2");
  const data = card.data as Record<string, unknown>;
  expect(data.alternate_greetings).toEqual(DATA.alternate_greetings);
  expect(data.creator_notes).toBe(DATA.creator_notes);
  expect(data.tags).toEqual(DATA.tags);
});

test("the report keeps greetings and tags, drops the system prompt, and says where to map it", () => {
  const report = saucepan.fromCanonical(hostCard(DATA)).report!;
  expect(report.dropped).toContain("prompts.systemPrompt");
  expect(report.dropped).not.toContain("greetings.alternateGreetings");
  expect(report.dropped).not.toContain("discovery.tags");
  expect(report.warnings).toEqual([
    'saucepan: system_prompt is discarded by default; in the importer pick "Formatting Instructions" for it under Discarded Fields',
  ]);
  const { system_prompt: _, ...plain } = DATA;
  expect(saucepan.fromCanonical(hostCard(plain)).report!.warnings).toEqual([]);
});

test("both prompts get one hint, and a length warning past Formatting Instructions' limit", () => {
  const warnings = saucepanWarnings({ system_prompt: "x".repeat(6_000), post_history_instructions: "y".repeat(4_000) });
  expect(warnings[0]).toContain("system_prompt and post_history_instructions are discarded");
  expect(warnings[1]).toContain("10002 characters");
});

test("names every field Saucepan would clip, counting code points", () => {
  expect(saucepanWarnings({ creator_notes: "\u{1D400}".repeat(20_000) })).toEqual([]); // two UTF-16 units, one code point
  const warnings = saucepanWarnings({
    description: "x".repeat(120_001),
    creator_notes: "x".repeat(20_001),
    mes_example: "x".repeat(40_001),
    first_mes: "x".repeat(30_001),
    alternate_greetings: Array.from({ length: 50 }, () => "hi"),
  });
  expect(warnings).toHaveLength(5);
  expect(warnings.join("\n")).toContain("51 greetings");
});

test("no PNG art is a refusal", () => {
  expect(() => saucepan.fromCanonical(hostCard(DATA, "v2", false))).toThrow(/PNG card/);
});
