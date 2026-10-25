/**
 * The World wing draws a control only for a field the activation engine reads. This is the list: for
 * every field the entry editor writes, flipping it from its default changes what the engine does with
 * the same chat (scene-lore-editor.test.tsx proves each control writes the field; this proves the
 * field matters; Side Effects' application is in studio/scene-turn-lore-effects.test.ts). A field
 * RoleCall draws that nothing reads is not in the editor. Preserve is read by Standardize, not the engine: its last test is the proof.
 */
import { describe, expect, test } from "bun:test";
import { emptyLoreEntry, emptyLorebookBody } from "../../../core/lore";
import { runLore, type LoreFire, type LoreScan } from "../../../core/lore/engine";
import { countText } from "../../../core/tokens";
import { classicSources } from "../../../core/compendium";
import type { LorebookEntry } from "../../../entities/lorebook/schema";

const e = (id: string, over: Partial<LorebookEntry> = {}): LorebookEntry => ({ ...emptyLoreEntry(id), title: id, content: `content-${id}`, triggers: [{ keyword: "storm", isRegex: false }], ...over });
const scanOf = (said: string[], over: Partial<LoreScan> = {}): LoreScan => ({
  messages: said.map((content) => ({ role: "user", content })), messageCount: said.length,
  character: { name: "Aria", tags: ["hero"], description: "", personality: "", scenario: "" },
  persona: "", generationType: "normal", variables: {}, now: 1_700_000_000_000, ...over,
});
function run(entries: LorebookEntry[], said: string[] | LoreScan = ["the storm"], opts: { rng?: () => number; recentFires?: LoreFire[] } = {}) {
  const books = [{ id: "b", name: "b", body: { ...emptyLorebookBody("b"), globalRecursion: true, entries } }];
  const result = runLore(books, Array.isArray(said) ? scanOf(said) : said, { rng: opts.rng ?? (() => 0.5), countTokens: countText, budgetTokens: Infinity, recentFires: opts.recentFires ?? [] });
  return { ids: result.injected.map((h) => h.entryId), hits: result.injected };
}
const fires = (entry: LorebookEntry, said?: string[] | LoreScan, opts?: Parameters<typeof run>[2]): boolean => run([entry], said, opts).ids.includes(entry.id);

describe("each field the editor writes changes what the engine does", () => {
  test("enabled", () => { expect(fires(e("x"))).toBe(true); expect(fires(e("x", { enabled: false }))).toBe(false); });
  test("constant: fires with no keyword match", () => {
    expect(fires(e("x", { triggers: [] }), ["nothing"])).toBe(false);
    expect(fires(e("x", { triggers: [], constant: true }), ["nothing"])).toBe(true);
  });
  test("keywords and regex keywords", () => {
    expect(fires(e("x"), ["a calm day"])).toBe(false);
    expect(fires(e("x", { triggers: [{ keyword: "mage|wizard", isRegex: true, flags: "i" }] }), ["A WIZARD arrives"])).toBe(true);
  });
  test("secondary keywords and the logic between them", () => {
    const sec = [{ keyword: "lamp", isRegex: false }];
    for (const [selectiveLogic, only, both] of [["and_any", false, true], ["and_all", false, true], ["not_any", true, false], ["not_all", true, false]] as const) {
      const x = e("x", { secondaryTriggers: sec, selectiveLogic });
      expect([selectiveLogic, fires(x, ["the storm"]), fires(x, ["the storm and a lamp"])]).toEqual([selectiveLogic, only, both]);
    }
  });
  test("Advanced mode: a trigger's own percent decides, Simple mode: the entry's", () => {
    const adv = (probability: number) => e("x", { triggerMode: "advanced", triggers: [{ keyword: "storm", isRegex: false, probability }] });
    expect([fires(adv(0)), fires(adv(100))]).toEqual([false, true]);
    expect([fires(e("x", { probability: 0 })), fires(e("x", { probability: 100 }))]).toEqual([false, true]);
  });
  test("a trigger's cooldown (frequency) holds it back after it matched", () => {
    const recent: LoreFire[] = [{ entryKey: "b:x", messagesAgo: 2, fresh: true, keywords: ["storm"] }];
    const withFrequency = (frequency: number) => e("x", { triggerMode: "advanced", triggers: [{ keyword: "storm", isRegex: false, frequency }] });
    expect([fires(withFrequency(5), undefined, { recentFires: recent }), fires(withFrequency(1), undefined, { recentFires: recent })]).toEqual([false, true]);
  });
  test("Order (sortOrder) is where it lands among the others", () => {
    expect(run([e("late", { sortOrder: 9 }), e("early", { sortOrder: 1 })]).ids).toEqual(["early", "late"]);
    expect(run([e("late", { sortOrder: 1 }), e("early", { sortOrder: 9 })]).ids).toEqual(["late", "early"]);
  });
  test("Scan: how many recent messages are read", () => {
    const said = ["storm", "x", "y"];
    expect([fires(e("x", { scanDepth: 1 }), said), fires(e("x", { scanDepth: 3 }), said)]).toEqual([false, true]);
  });
  test("Injection: each position card, with depth and role", () => {
    const at = (over: Partial<LorebookEntry>) => run([e("x", over)]).hits[0]!.position;
    expect(at({ position: "world" })).toEqual({ kind: "world" });
    expect(at({ position: "character" })).toEqual({ kind: "character" });
    expect(at({ position: "scene" })).toEqual({ kind: "scene" });
    expect(at({ position: "depth", depth: 6, role: "user" })).toEqual({ kind: "depth", depth: 6, role: "user" });
    expect(at({ position: "append", depth: 2 })).toMatchObject({ kind: "append", depth: 2 });
    expect(at({ position: "prepend_top" })).toEqual({ kind: "prepend_top" });
    expect(at({ position: "append_bottom" })).toEqual({ kind: "append_bottom" });
  });
  test("Sticky keeps it firing after the keyword is gone; Cool blocks it; Delay waits for enough messages", () => {
    const recent = (messagesAgo: number): LoreFire[] => [{ entryKey: "b:x", messagesAgo, fresh: true, keywords: ["storm"] }];
    expect([fires(e("x", { sticky: 0 }), ["calm"], { recentFires: recent(1) }), fires(e("x", { sticky: 3 }), ["calm"], { recentFires: recent(1) })]).toEqual([false, true]);
    expect([fires(e("x", { cooldown: 0 }), ["the storm"], { recentFires: recent(2) }), fires(e("x", { cooldown: 5 }), ["the storm"], { recentFires: recent(2) })]).toEqual([true, false]);
    expect([fires(e("x", { delay: 5 }), scanOf(["the storm"], { messageCount: 2 })), fires(e("x", { delay: 5 }), scanOf(["the storm"], { messageCount: 6 }))]).toEqual([false, true]);
  });
  test("Recursion: Prevent stops an entry waking others; Delay waits for a later pass", () => {
    const a = (over: Partial<LorebookEntry> = {}) => e("a", { content: "the lantern glows", ...over });
    const b = (over: Partial<LorebookEntry> = {}) => e("b", { triggers: [{ keyword: "lantern", isRegex: false }], ...over });
    expect(run([a(), b()]).ids).toContain("b");
    expect(run([a({ preventRecursion: true }), b()]).ids).not.toContain("b");
    expect(run([a(), b({ delayUntilRecursion: 1 })]).ids).toContain("b"); // woken by a, on the second pass
    expect(run([b({ delayUntilRecursion: 1 })], ["the lantern"]).ids).not.toContain("b"); // never from the chat directly
  });
  test("Group: entries in one group compete, only one fires a turn", () => {
    const grouped = [e("a", { groupName: "weather", groupWeight: 100 }), e("b", { groupName: "weather", groupWeight: 100 })];
    expect(run(grouped).ids).toHaveLength(1);
    expect(run([e("a"), e("b")]).ids).toHaveLength(2);
  });
  test("Cross-Entry Boosting: a fired entry makes its target likelier", () => {
    const target = e("tgt", { probability: 30 });
    const booster = e("src", { boostIds: ["tgt"], boostAmount: 0.4 });
    const roll = () => 0.5;
    expect([run([target], ["the storm"], { rng: roll }).ids, run([booster, target], ["the storm"], { rng: roll }).ids]).toEqual([[], ["src", "tgt"]]);
  });
  test("Side Effects: a fired entry hands the engine its variable operations; a silent one hands none", () => {
    const fx = { effects: [{ type: "incvar" as const, variable: "storms", amount: 2, scope: "local" as const }], onlyOnFirstTrigger: false, clearOnDeactivate: false };
    const ops = (entry: LorebookEntry, said: string[]) => runLore([{ id: "b", name: "b", body: { ...emptyLorebookBody("b"), entries: [entry] } }], scanOf(said), { rng: () => 0.5, countTokens: countText, budgetTokens: Infinity, recentFires: [] }).sideEffects;
    expect(ops(e("x", { sideEffects: fx }), ["the storm"])).toEqual([{ op: "inc", name: "storms", value: 2, scope: "local" }]);
    expect(ops(e("x", { sideEffects: fx }), ["calm"])).toEqual([]);
  });
  test("Character Filter: a whitelist or blacklist by name or #tag", () => {
    const filtered = (characterFilter: LorebookEntry["characterFilter"]) => fires(e("x", { characterFilter }));
    expect(filtered(null)).toBe(true);
    expect(filtered({ names: ["Zed"], tags: [], isExclude: false })).toBe(false);
    expect(filtered({ names: ["Aria"], tags: [], isExclude: false })).toBe(true);
    expect(filtered({ names: [], tags: ["hero"], isExclude: false })).toBe(true);
    expect(filtered({ names: ["Aria"], tags: [], isExclude: true })).toBe(false);
  });
  test("+ Condition: the special keys offered are evaluated", () => {
    const special = (keyword: string) => e("x", { triggers: [{ keyword, isRegex: false }] });
    expect([fires(special("[messageCount:>=5]"), scanOf(["hi"], { messageCount: 1 })), fires(special("[messageCount:>=5]"), scanOf(["hi"], { messageCount: 6 }))]).toEqual([false, true]);
    expect([fires(special("[generationType:swipe]"), scanOf(["hi"])), fires(special("[generationType:swipe]"), scanOf(["hi"], { generationType: "swipe" }))]).toEqual([false, true]);
    expect([fires(special("[randomChance:0]")), fires(special("[randomChance:100]"))]).toEqual([false, true]);
  });
});

describe("a field the Standardize run reads", () => {
  test("Preserve During Standardization: the run leaves a preserved entry out, and still fires it like any other", () => {
    const plain = e("plain");
    const kept = e("kept", { metadata: { preserve_during_standardize: true } });
    expect(classicSources([plain, kept]).map((x) => x.id)).toEqual(["plain"]);
    expect(fires(kept)).toBe(true);
  });
});
