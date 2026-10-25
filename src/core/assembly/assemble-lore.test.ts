/**
 * The lore engine, run once per turn and placed into the assembled prompt (2e-d4 plan step 3):
 * `world` through the `{{lore}}` legacy macro, `character`/`scene`/`before_example`/`after_example`
 * spliced among the relative blocks with RoleCall's fallbacks, `depth` on the card's own depth-note
 * list, `append` glued onto history, and the two pins at the very ends. Parity fixtures (01-11, no
 * lorebooks) are proven unchanged by rc-parity.test.ts; this file is the lore-only surface.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import type { LorebookEntry } from "../../entities/lorebook/schema";
import type { PresetBody, PresetPrompt } from "../../entities/preset/schema";
import { assemble } from "./assemble";
import { emptyLoreEntry, emptyLorebookBody } from "../lore/empty-book";
import type { LoreBookInput } from "../lore/engine";
import type { AssemblyInput, HistoryMessage } from "./types";
import { makePresetPrompt } from "../preset/test-fixtures";

const card = (over: Partial<CharacterBody> = {}): CharacterBody =>
  ({ identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {}, ...over }) as CharacterBody;
const msg = (id: string, role: HistoryMessage["role"], content: string, at?: number): HistoryMessage => ({ id, role, content, ...(at === undefined ? {} : { at }) });
const block = (id: string, content: string, over: Partial<PresetPrompt> = {}): PresetPrompt =>
  makePresetPrompt({ id, name: id, content, systemPrompt: true, ...over });

/** A constant entry (always fires, no rng needed) at a given position with the given content. */
const entry = (id: string, position: LorebookEntry["position"], content: string, over: Partial<LorebookEntry> = {}): LorebookEntry => ({
  ...emptyLoreEntry(id),
  constant: true,
  position,
  content,
  ...over,
});
const book = (id: string, entries: LorebookEntry[]): LoreBookInput => ({ id, name: `Book ${id}`, body: { ...emptyLorebookBody(`Book ${id}`), entries } });

const input = (over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card(),
  history: [msg("g", "assistant", "Evening."), msg("u1", "user", "Hi"), msg("a1", "assistant", "Hello.")],
  current: msg("u2", "user", "Any storms?"),
  localVariables: new Map(),
  globalVariables: new Map(),
  now: Date.UTC(2026, 8, 28),
  randomSeed: 1,
  ...over,
});
const lore = (books: LoreBookInput[], budgetShare = 1): AssemblyInput["lore"] => ({ books, recentFires: [], budgetShare });
const lines = (over: Partial<AssemblyInput>) => assemble(input(over)).messages.map((m) => m.content);

describe("HistoryMessage.at powers [recency:...]", () => {
  test("a current message inside the window fires; one outside it does not", () => {
    const now = Date.UTC(2026, 8, 28);
    const b = book("b1", [entry("e", "prepend_top", "RECENT", { constant: false, triggerMode: "simple", triggers: [{ keyword: "[recency:1m]", isRegex: false }] })]);
    const recent = assemble(input({ now, current: msg("u2", "user", "Any storms?", now - 30_000), lore: lore([b]) }));
    const stale = assemble(input({ now, current: msg("u2", "user", "Any storms?", now - 120_000), lore: lore([b]) }));
    expect(recent.lore?.injected.length).toBe(1);
    expect(stale.lore?.injected.length).toBe(0);
  });
});

describe("world", () => {
  test("lands exactly where a preset's {{lore}} block is, and moves when that block moves", () => {
    const b = book("b1", [entry("w", "world", "WORLD")]);
    const here = block("h", "{{message_history}}");
    const a = lines({ preset: { name: "A", prompts: [block("slot", "Before [[{{lore}}]] after"), here] }, lore: lore([b]) });
    expect(a).toContain("Before [[WORLD]] after");

    const moved = lines({ preset: { name: "B", prompts: [here, block("late", "Later: {{lore}}")] }, lore: lore([b]) });
    expect(moved.at(-1)).toBe("Later: WORLD");
  });

  test("a no-preset turn puts world exactly at the default set's worldInfoBefore slot", () => {
    const b = book("b1", [entry("w", "world", "WORLD")]);
    // Personality, scenario, and examples filled in so every relative slot but persona/summary
    // survives the final pass, pinning WORLD's exact position rather than merely "somewhere after".
    const withCard = card({ persona: { personality: "Warm.", scenario: "A quiet inn." }, examples: { exampleMessages: "Example." } });
    const out = lines({ character: withCard, lore: lore([b]) });
    // defaultPrompts order: description, personality, scenario, persona(empty), lore, summary(empty), examples.
    expect(out).toEqual(["Keeps the light.", "Warm.", "A quiet inn.", "WORLD", "Example.", "Evening.", "Hi", "Hello.", "Any storms?"]);
  });
});

describe("character, scene, and example anchors", () => {
  const hits = () =>
    book("b1", [
      entry("char", "character", "CHARHIT"),
      entry("scene", "scene", "SCENEHIT"),
      entry("bex", "before_example", "BEFOREEX"),
      entry("aex", "after_example", "AFTEREX"),
    ]);

  test("with real anchors, each lands right where RoleCall puts it", () => {
    const preset: PresetBody = {
      name: "T",
      prompts: [block("charDescription", "Desc."), block("scenario", "Scenario."), block("dialogueExamples", "Examples."), block("h", "{{message_history}}")],
    };
    const out = lines({ preset, lore: lore([hits()]) });
    expect(out).toEqual(["Desc.", "CHARHIT", "Scenario.", "SCENEHIT", "BEFOREEX", "Examples.", "AFTEREX", "Evening.", "Hi", "Hello.", "Any storms?"]);
  });

  test("with no anchors, character opens the relative blocks and scene/examples stack after it, in order", () => {
    const preset: PresetBody = { name: "T", prompts: [block("main", "Main text."), block("h", "{{message_history}}")] };
    const out = lines({ preset, lore: lore([hits()]) });
    expect(out.slice(0, 5)).toEqual(["CHARHIT", "SCENEHIT", "BEFOREEX", "AFTEREX", "Main text."]);
  });
});

describe("depth and append", () => {
  test("a depth hit interleaves with the card's own depth notes, on the same list", () => {
    const b = book("b1", [entry("dep", "depth", "DEPTHHIT", { depth: 1, role: "user" })]);
    const out = lines({ character: card({ prompts: { depthInjections: [{ text: "Card note.", depth: 1 }] } }), lore: lore([b]) });
    expect(out).toEqual(["Keeps the light.", "Evening.", "Hi", "Card note.", "DEPTHHIT", "Hello.", "Any storms?"]);
  });

  test("an append hit glues onto the message at its depth, using the entry's own role", () => {
    const b = book("b1", [entry("app", "append", "APPENDHIT", { depth: 0, role: "assistant" })]);
    const out = lines({ lore: lore([b]) });
    expect(out).toContain("Hello.\nAPPENDHIT");
  });
});

describe("the pins", () => {
  test("prepend_top and append_bottom sit at the very ends, outside everything else", () => {
    const b = book("b1", [entry("t", "prepend_top", "TOPHIT"), entry("bo", "append_bottom", "BOTTOMHIT")]);
    const out = lines({ lore: lore([b]) });
    expect(out[0]).toBe("TOPHIT");
    expect(out.at(-1)).toBe("BOTTOMHIT");
  });

  test("prepend_top lands before the preset's own top pin, and append_bottom after its own bottom pin", () => {
    const b = book("b1", [entry("t", "prepend_top", "TOPHIT"), entry("bo", "append_bottom", "BOTTOMHIT")]);
    const preset: PresetPrompt[] = [block("h", "{{message_history}}"), block("pt", "PRESETTOP", { placement: "prepend_preset" }), block("pb", "PRESETBOTTOM", { placement: "append_preset" })];
    const out = lines({ preset: { name: "T", prompts: preset }, lore: lore([b]) });
    expect(out.slice(0, 2)).toEqual(["TOPHIT", "PRESETTOP"]);
    expect(out.slice(-2)).toEqual(["PRESETBOTTOM", "BOTTOMHIT"]);
  });
});

describe("the lore share", () => {
  test("caps what survives, and the rest comes back in result.lore.cut", () => {
    const a = entry("a", "world", "Alpha lore. ".repeat(30), { sortOrder: 1 });
    const b = entry("b", "world", "Beta lore. ".repeat(30), { sortOrder: 2 });
    const result = assemble(input({ window: { context: 400, reply: 100 }, lore: lore([book("b1", [a, b])], 0.25) }));
    expect(result.lore?.injected.map((h) => h.entryKey)).toEqual(["b1:a"]);
    expect(result.lore?.cut.map((h) => h.entryKey)).toEqual(["b1:b"]);
    expect(result.lore?.totalTokens).toBeGreaterThan(0);
  });
});

describe("generationType and currentSpeaker (2e-d7 plan step 5)", () => {
  test("a [generationType:swipe] entry fires on a swipe and not on a reply", () => {
    const b = book("b1", [entry("g", "prepend_top", "SWIPEHIT", {
      constant: false, triggerMode: "simple", triggers: [{ keyword: "[generationType:swipe]", isRegex: false }],
    })]);
    const reply = assemble(input({ lore: lore([b]) }));
    const swipe = assemble(input({ generationType: "swipe", lore: lore([b]) }));
    expect(reply.lore?.injected.length).toBe(0);
    expect(swipe.lore?.injected.length).toBe(1);
  });

  test("a [speaker:<name>] entry fires for the scene's character", () => {
    const b = book("b1", [entry("s", "prepend_top", "SPEAKERHIT", {
      constant: false, triggerMode: "simple", triggers: [{ keyword: "[speaker:Vera]", isRegex: false }],
    })]);
    // card() names the character "Vera"; a different name refuses to fire it.
    const hit = assemble(input({ lore: lore([b]) }));
    const miss = assemble(input({ character: card({ identity: { name: "Someone else", description: "Keeps the light." } }), lore: lore([b]) }));
    expect(hit.lore?.injected.length).toBe(1);
    expect(miss.lore?.injected.length).toBe(0);
  });
});

describe("the seed", () => {
  const rolled = (seed: number) => {
    const b = book("b1", [entry("e", "prepend_top", "ROLLED", { constant: false, triggers: [{ keyword: "storms", isRegex: false }], probability: 50 })]);
    return assemble(input({ randomSeed: seed, lore: lore([b]) })).lore?.injected.length ?? -1;
  };

  test("the same randomSeed gives the same lore run", () => {
    expect(rolled(1)).toBe(rolled(1));
  });

  test("a different seed can differ", () => {
    expect(rolled(1)).not.toBe(rolled(2));
  });

  test("result.lore is plain JSON: it round-trips", () => {
    const b = book("b1", [entry("w", "world", "WORLD")]);
    const result = assemble(input({ lore: lore([b]) }));
    expect(JSON.parse(JSON.stringify(result.lore))).toEqual(result.lore);
  });
});

describe("explain (th-t3 plan step 1)", () => {
  test("runLore runs with explain: true, one verdict per entry, fired and skipped alike", () => {
    const b = book("b1", [
      entry("fired", "world", "WORLD"),
      entry("off", "world", "OFF", { enabled: false }),
      entry("empty", "world", "EMPTY", { constant: false, triggers: [] }),
    ]);
    const result = assemble(input({ lore: lore([b]) }));
    const byId = new Map(result.lore?.verdicts.map((v) => [v.entryId, v]));
    expect(byId.get("fired")).toMatchObject({ fired: true, reason: "constant" });
    expect(byId.get("off")).toMatchObject({ fired: false, reason: "disabled" });
    expect(byId.get("empty")).toMatchObject({ fired: false, reason: "empty-keys" });
    expect(result.lore?.verdictsTruncated).toBeUndefined();
  });

  test("an injected and a cut hit each keep the entry's position", () => {
    const fits = entry("fits", "character", "Alpha lore. ".repeat(30), { sortOrder: 1 });
    const tooBig = entry("cut", "scene", "Beta lore. ".repeat(30), { sortOrder: 2 });
    const b = book("b1", [fits, tooBig]);
    const result = assemble(input({ window: { context: 400, reply: 100 }, lore: lore([b], 0.25) }));
    expect(result.lore?.injected[0]).toMatchObject({ entryKey: "b1:fits", position: { kind: "character" } });
    expect(result.lore?.cut[0]).toMatchObject({ entryKey: "b1:cut", position: { kind: "scene" } });
  });

  test("past 1000 verdicts, every fired one is kept, then misses up to 1000 total", () => {
    const entries: LorebookEntry[] = [entry("fired-1", "world", "W1"), entry("fired-2", "world", "W2")];
    for (let i = 0; i < 1005; i++) entries.push(entry(`off-${i}`, "world", "x", { enabled: false }));
    const b = book("b1", entries);
    const result = assemble(input({ lore: lore([b]) }));
    expect(result.lore?.verdicts).toHaveLength(1000);
    expect(result.lore?.verdicts.filter((v) => v.fired)).toHaveLength(2);
    expect(result.lore?.verdictsTruncated).toBe(true);
  });
});
