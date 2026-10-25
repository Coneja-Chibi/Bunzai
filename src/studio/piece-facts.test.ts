/**
 * Fixture tests for the pure piece-fact functions moved here from src/ui/apps/library
 *. doesWhatForSet's describe block is the one moved
 * verbatim from regex-shelf-ops.test.ts (it already had direct coverage there). writtenChars,
 * filledCardFields, presetFacts, loreFacts and personaFacts had no direct-import tests before the
 * move (only indirect coverage via peekPiece/loadLoreMeta/loadPersonaMeta); their fixtures here are
 * new. A differential harness (scratch/p32a/diff.ts, not checked in) ran the pre-move copies of
 * loadLoreMeta, loadPersonaMeta and peekPiece against the same fixtures as the moved code and found
 * no difference, including the missing-`triggers` case throwing and being skipped identically in
 * both.
 */
import { describe, expect, test } from "bun:test";
import {
  doesWhatForSet,
  filledCardFields,
  loreFacts,
  personaFacts,
  presetFacts,
  promptFormatParts,
  writtenChars,
} from "./piece-facts";
import type { LorebookBody } from "../entities/lorebook/schema";
import type { PersonaBody } from "../entities/persona/schema";
import type { RegexRule, RegexSetBody } from "../entities/regex/schema";

describe("writtenChars", () => {
  test("sums every written string's length across nested arrays and objects", () => {
    expect(writtenChars({ a: "hi", b: ["there", "you"], c: { d: "ok" } })).toBe(2 + 5 + 3 + 2);
  });

  test("stops descending past depth 6 (returns 0 for anything deeper)", () => {
    let deep: unknown = "leaf";
    for (let i = 0; i < 8; i++) deep = { n: deep };
    expect(writtenChars(deep)).toBe(0);
  });

  test("an inline data: picture is media, not written text, so a pack of imported pictures is not millions of tokens", () => {
    expect(writtenChars({ name: "ab", pack: { items: [{ label: "x", ref: `data:image/jpeg;base64,${"A".repeat(5000)}` }] } })).toBe(2 + 1);
  });

  test("numbers, booleans, null contribute nothing", () => {
    expect(writtenChars({ n: 5, b: true, z: null })).toBe(0);
  });
});

describe("filledCardFields", () => {
  test("counts all nine fields when every one is present", () => {
    const body = {
      identity: { name: "Vera", description: "Keeper" },
      persona: { personality: "dry", scenario: "a room" },
      greetings: { firstMessage: "hi", alternateGreetings: ["yo"] },
      examples: { exampleMessages: "ex" },
      prompts: { systemPrompt: "sys", postHistoryInstructions: "phi" },
    };
    expect(filledCardFields(body)).toBe("9/9");
  });

  test("blank strings and empty arrays do not count as filled", () => {
    const body = {
      identity: { name: "Vera", description: "   " },
      persona: {},
      greetings: { alternateGreetings: [] },
    };
    expect(filledCardFields(body)).toBe("1/9");
  });

  test("a totally empty body is 0/9", () => {
    expect(filledCardFields({})).toBe("0/9");
  });
});

describe("presetFacts", () => {
  test("reports only the samplers the body carries", () => {
    expect(presetFacts({ samplers: { temperature: 1.3, topK: 0 }, prompts: [{}, {}, {}] })).toEqual({
      samplers: { temperature: 1.3, topK: 0 },
      blocks: 3,
    });
  });

  test("a sampler set says which dialect it came from; anything else is dropped", () => {
    expect(presetFacts({ prompts: [], samplerSet: "novelai" })).toEqual({ blocks: 0, samplerSet: "novelai" });
    expect(presetFacts({ prompts: [], samplerSet: "other" })).toEqual({ blocks: 0 });
  });

  test("no samplers present means the field is absent, never a default", () => {
    expect(presetFacts({ prompts: [] })).toEqual({ blocks: 0 });
  });

  test("non-numeric or non-finite sampler values are dropped", () => {
    expect(presetFacts({ samplers: { temperature: "hot", topP: Infinity, topK: 5 } })).toEqual({
      samplers: { topK: 5 },
    });
  });

  test("no prompts array at all means no blocks field", () => {
    expect(presetFacts({})).toEqual({});
  });
});

// -- doesWhatForSet: moved verbatim from regex-shelf-ops.test.ts, which had this coverage already
// (fixtures unchanged from src/ui/apps/library/regex-shelf-ops.test.ts before the move) --------

const rule = (over: Partial<RegexRule> & { id: string }): RegexRule => ({
  label: "",
  find: "x",
  flags: "g",
  replace: "",
  phases: ["output"],
  enabled: true,
  sortOrder: 0,
  ...over,
});

const setOf = (over: Partial<RegexSetBody>): RegexSetBody => ({
  name: "Set",
  rules: [],
  ...over,
});

describe("doesWhatForSet", () => {
  test("prefers a non-empty description", () => {
    expect(doesWhatForSet(setOf({ description: "Cleans the reply." }))).toBe("Cleans the reply.");
  });

  test("empty set reads honestly", () => {
    expect(doesWhatForSet(setOf({}))).toBe("No rules yet.");
  });

  test("joins the first labels and counts the overflow", () => {
    const body = setOf({
      rules: [
        rule({ id: "1", label: "Fix ellipsis" }),
        rule({ id: "2", label: "Curl quotes" }),
        rule({ id: "3", label: "Strip HTML" }),
        rule({ id: "4", label: "Trim spaces" }),
      ],
    });
    expect(doesWhatForSet(body)).toBe("Fix ellipsis, Curl quotes, Strip HTML +1 more");
  });

  test("reads a plain word from an unlabeled rule's own pattern", () => {
    const body = setOf({ rules: [rule({ id: "1", label: "", find: "\\bhello\\b", flags: "i" })] });
    expect(doesWhatForSet(body)).toContain("hello");
  });
});

describe("loreFacts", () => {
  const entry = (keywords: string[]) => ({
    triggers: keywords.map((keyword) => ({ keyword, isRegex: false })),
  });

  test("counts entries and flattens every trigger keyword across them", () => {
    const body = {
      entries: [entry(["alpha", "beta"]), entry(["gamma"])],
    } as unknown as LorebookBody;
    expect(loreFacts(body)).toEqual({ entryCount: 2, searchKeys: ["alpha", "beta", "gamma"] });
  });

  test("empty-string keywords are dropped; no entries is zero and empty", () => {
    const body = { entries: [entry(["", "kept"])] } as unknown as LorebookBody;
    expect(loreFacts(body)).toEqual({ entryCount: 1, searchKeys: ["kept"] });
    expect(loreFacts({} as LorebookBody)).toEqual({ entryCount: 0, searchKeys: [] });
  });
});

describe("personaFacts", () => {
  test("reads brief, sections, and lorebook presence", () => {
    const body: PersonaBody = {
      name: "P",
      content: "",
      brief: "  A quiet keeper.  ",
      sections: { appearance: "tall", personality: "" },
      knowledgeRefs: ["book1"],
    };
    expect(personaFacts(body)).toEqual({
      brief: "A quiet keeper.",
      pronouns: undefined,
      sectionCount: 1,
      hasLorebook: true,
    });
  });

  test("pronounSet builds a subjective/objective string when pronouns is absent", () => {
    const body: PersonaBody = {
      name: "P",
      content: "",
      identity: { pronounSet: { subjective: "she", objective: "her", possessive: "hers" } },
    };
    expect(personaFacts(body).pronouns).toBe("she/her");
  });

  test("explicit pronouns string wins over pronounSet", () => {
    const body: PersonaBody = {
      name: "P",
      content: "",
      identity: { pronouns: "they/them", pronounSet: { subjective: "she", objective: "her", possessive: "hers" } },
    };
    expect(personaFacts(body).pronouns).toBe("they/them");
  });

  test("a blank brief and no lorebook refs are absent/false, not empty strings", () => {
    const body: PersonaBody = { name: "P", content: "", brief: "   " };
    expect(personaFacts(body)).toEqual({
      brief: undefined,
      pronouns: undefined,
      sectionCount: 0,
      hasLorebook: false,
    });
  });
});

describe("promptFormatParts", () => {
  test("names the halves a prompt format holds, in a fixed order", () => {
    expect(promptFormatParts({ name: "x", context: { story_string: "s" }, instruct: { input_sequence: "i" } })).toEqual(["instruct", "context"]);
    expect(promptFormatParts({ name: "x", context: {} })).toEqual(["context"]);
    expect(promptFormatParts({ name: "x", instruct: "nope" })).toEqual([]);
  });
});
