/**
 * runLore's explain output (2e): every entry gets one LoreVerdict,
 * fired or skipped with why. Scenarios chosen to cover every LoreSkip kind reachable from a single
 * runLore call, plus the chance:"always"/"never" override the Workbench previews use.
 */
import { describe, expect, test } from "bun:test";
import { runLore } from "./engine";
import { book, countChars, entry, fakeRng, msg, scan } from "./_test-helpers";
import type { LoreFire, LoreVerdict } from "./types";

const baseOptions = (patch: Partial<Parameters<typeof runLore>[2]> = {}) => ({
  rng: fakeRng(),
  countTokens: countChars,
  budgetTokens: Infinity,
  recentFires: [] as LoreFire[],
  explain: true,
  ...patch,
});

function verdictFor(verdicts: LoreVerdict[] | undefined, entryId: string): LoreVerdict | undefined {
  return verdicts?.find((v) => v.entryId === entryId);
}

describe("runLore explain: one verdict per entry", () => {
  test("a disabled entry is skipped with reason disabled", () => {
    const e = entry("e1", { enabled: false });
    const run = runLore([book("b1", [e])], scan(), baseOptions());
    expect(verdictFor(run.verdicts, "e1")).toMatchObject({ fired: false, reason: "disabled" });
  });

  test("verdicts cover every entry, including a disabled one, in book order", () => {
    const e1 = entry("e1", { enabled: false });
    const e2 = entry("e2", { constant: true });
    const run = runLore([book("b1", [e1, e2])], scan(), baseOptions());
    expect(run.verdicts).toHaveLength(2);
    expect(run.verdicts?.map((v) => v.entryId)).toEqual(["e1", "e2"]);
  });

  test("a character filter blocks with reason character-filter", () => {
    const e = entry("e1", { constant: true, characterFilter: { names: ["Bram"], tags: [], isExclude: false } });
    const run = runLore(
      [book("b1", [e])],
      scan({ character: { name: "Aria", tags: [], description: "", personality: "", scenario: "" } }),
      baseOptions(),
    );
    expect(verdictFor(run.verdicts, "e1")).toMatchObject({ fired: false, reason: "character-filter" });
  });

  test("no keyword match gives reason no-key-match", () => {
    const e = entry("e1", { triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore([book("b1", [e])], scan({ messages: [msg("a quiet day")] }), baseOptions());
    expect(verdictFor(run.verdicts, "e1")).toMatchObject({ fired: false, reason: "no-key-match" });
  });

  test("a matched primary with a failed secondary gives reason secondary-logic", () => {
    const e = entry("e1", {
      triggers: [{ keyword: "dragon", isRegex: false }],
      secondaryTriggers: [{ keyword: "treasure", isRegex: false }],
      selectiveLogic: "and_any",
    });
    const run = runLore([book("b1", [e])], scan({ messages: [msg("a dragon appeared")] }), baseOptions());
    expect(verdictFor(run.verdicts, "e1")).toMatchObject({ fired: false, reason: "secondary-logic" });
  });

  test("every primary blocked by its own frequency gives reason frequency", () => {
    const e = entry("e1", { triggers: [{ keyword: "dragon", isRegex: false, frequency: 3 }] });
    const run = runLore(
      [book("b1", [e])],
      scan({ messages: [msg("a dragon appeared")] }),
      baseOptions({ recentFires: [{ entryKey: "b1:e1", messagesAgo: 1, fresh: true, keywords: ["dragon"] }] }),
    );
    expect(verdictFor(run.verdicts, "e1")).toMatchObject({ fired: false, reason: "frequency" });
  });

  test("chance: never skips a matched entry with reason chance", () => {
    const e = entry("e1", { probability: 50, triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [e])],
      scan({ messages: [msg("a dragon appeared")] }),
      baseOptions({ chance: "never" }),
    );
    expect(verdictFor(run.verdicts, "e1")).toMatchObject({ fired: false, reason: "chance" });
    expect(run.injected).toHaveLength(0);
  });

  // th-t4-gaps 1: the failed branch above already records rolled/needed; a passed real roll (mode
  // "roll", 0 < probability < 1) needs the same numbers, additively, since it fired for the same
  // reason (key/secondary/etc.), not "chance" - only the miss reason is literally "chance".
  test("a passed 50% roll carries rolled and needed in its fired verdict's detail", () => {
    const e = entry("e1", { probability: 50, triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [e])],
      scan({ messages: [msg("a dragon appeared")] }),
      baseOptions({ rng: fakeRng([0]) }),
    );
    expect(run.injected).toHaveLength(1);
    expect(verdictFor(run.verdicts, "e1")).toMatchObject({ fired: true, reason: "key", detail: { rolled: 0, needed: 50 } });
  });

  test("a guaranteed (100%) fired entry carries no roll detail: it was never actually a chance", () => {
    const e = entry("e1", { probability: 100, triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore([book("b1", [e])], scan({ messages: [msg("a dragon appeared")] }), baseOptions());
    expect(verdictFor(run.verdicts, "e1")).toMatchObject({ fired: true, detail: undefined });
  });

  test("chance: always fires a 1% entry without ever calling rng", () => {
    const e = entry("e1", { probability: 1, triggers: [{ keyword: "dragon", isRegex: false }] });
    const throwingRng = (): number => {
      throw new Error("rng must not be called under chance: always");
    };
    const run = runLore(
      [book("b1", [e])],
      scan({ messages: [msg("a dragon appeared")] }),
      baseOptions({ rng: throwingRng, chance: "always" }),
    );
    expect(run.injected).toHaveLength(1);
    expect(verdictFor(run.verdicts, "e1")).toMatchObject({ fired: true });
  });

  test("cooldown via recentFires blocks a real key match with reason cooldown", () => {
    const e = entry("e1", { sticky: 1, cooldown: 5, triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [e])],
      scan({ messages: [msg("a dragon appeared")] }),
      baseOptions({ recentFires: [{ entryKey: "b1:e1", messagesAgo: 2, fresh: true, keywords: ["dragon"] }] }),
    );
    expect(verdictFor(run.verdicts, "e1")).toMatchObject({ fired: false, reason: "cooldown" });
  });

  test("a scene that hasn't reached the delay yet gives reason delay", () => {
    const e = entry("e1", { delay: 5, triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [e])],
      scan({ messages: [msg("a dragon appeared")], messageCount: 1 }),
      baseOptions(),
    );
    expect(verdictFor(run.verdicts, "e1")).toMatchObject({ fired: false, reason: "delay", detail: { remaining: 4 } });
  });

  test("delayUntilRecursion with no recursion pass gives reason delay-until-recursion", () => {
    const e = entry("e1", { delayUntilRecursion: 1, triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore([book("b1", [e])], scan(), baseOptions());
    expect(verdictFor(run.verdicts, "e1")).toMatchObject({
      fired: false,
      reason: "delay-until-recursion",
      detail: { remaining: 1 },
    });
  });

  test("no triggers and not constant gives reason empty-keys", () => {
    const e = entry("e1");
    const run = runLore([book("b1", [e])], scan(), baseOptions());
    expect(verdictFor(run.verdicts, "e1")).toMatchObject({ fired: false, reason: "empty-keys" });
  });

  test("a budget cut gives reason budget-cut", () => {
    const e1 = entry("e1", { constant: true, sortOrder: 1, priority: 10, content: "aaaaa" });
    const e2 = entry("e2", { constant: true, sortOrder: 2, priority: 1, content: "bbbbb" });
    const run = runLore([book("b1", [e1, e2])], scan(), baseOptions({ budgetTokens: 5 }));
    expect(verdictFor(run.verdicts, "e2")).toMatchObject({ fired: false, reason: "budget-cut" });
  });

  test("excludeRecursion with a book that wants recursion gives reason exclude-recursion", () => {
    const gate = entry("gate", { content: "dragon", triggers: [{ keyword: "map", isRegex: false }] });
    const hidden = entry("hidden", { excludeRecursion: true, triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [gate, hidden], { globalRecursion: true })],
      scan({ messages: [msg("show me the map")] }),
      baseOptions(),
    );
    expect(verdictFor(run.verdicts, "hidden")).toMatchObject({ fired: false, reason: "exclude-recursion" });
  });

  test("the losing side of an inclusion group gives reason group-lost", () => {
    const a = entry("a", { constant: true, groupName: "g", groupWeight: 100 });
    const b = entry("b", { constant: true, groupName: "g", groupWeight: 0 });
    const run = runLore([book("b1", [a, b])], scan(), baseOptions({ rng: fakeRng([0]) }));
    expect(verdictFor(run.verdicts, "b")).toMatchObject({ fired: false, reason: "group-lost" });
  });

  test("a recursion-woken entry reports loop >= 1, never 0 (0 means direct match)", () => {
    const gate = entry("gate", { content: "leads to a dragon", triggers: [{ keyword: "map", isRegex: false }] });
    const woken = entry("woken", { triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [gate, woken], { globalRecursion: true })],
      scan({ messages: [msg("show me the map")] }),
      baseOptions(),
    );
    const v = verdictFor(run.verdicts, "woken");
    expect(v?.fired).toBe(true);
    expect(v?.loop).toBeGreaterThanOrEqual(1);
  });

  test("cooldown remaining counts down to 1 on the last blocked message, not 0", () => {
    const e = entry("e1", { cooldown: 3, triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [e])],
      scan({ messages: [msg("a dragon appeared")] }),
      baseOptions({ recentFires: [{ entryKey: "b1:e1", messagesAgo: 3, fresh: true, keywords: ["dragon"] }] }),
    );
    expect(verdictFor(run.verdicts, "e1")).toMatchObject({ reason: "cooldown", detail: { remaining: 1 } });
  });

  test("a sticky reinjection carries its own countdown in detail.remaining", () => {
    const e = entry("e1", { sticky: 3, triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [e])],
      scan({ messages: [msg("nothing relevant")] }),
      baseOptions({ recentFires: [{ entryKey: "b1:e1", messagesAgo: 1, fresh: true, keywords: ["dragon"] }] }),
    );
    expect(verdictFor(run.verdicts, "e1")).toMatchObject({ fired: true, reason: "sticky", detail: { remaining: 3 } });
  });

  test("a budget cut reports detail.left, not just cost", () => {
    const e1 = entry("e1", { constant: true, sortOrder: 1, priority: 10, content: "aaaaa" });
    const e2 = entry("e2", { constant: true, sortOrder: 2, priority: 1, content: "bbbbb" });
    const run = runLore([book("b1", [e1, e2])], scan(), baseOptions({ budgetTokens: 5 }));
    expect(verdictFor(run.verdicts, "e2")).toMatchObject({ reason: "budget-cut", detail: { cost: 5, left: 0 } });
  });

  test("chance: always fires even a 0% entry", () => {
    const e = entry("e1", { probability: 0, triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [e])],
      scan({ messages: [msg("a dragon appeared")] }),
      baseOptions({ chance: "always" }),
    );
    expect(run.injected).toHaveLength(1);
  });

  test("chance: never still fires a guaranteed (100%) entry", () => {
    const e = entry("e1", { probability: 100, triggers: [{ keyword: "dragon", isRegex: false }] });
    const run = runLore(
      [book("b1", [e])],
      scan({ messages: [msg("a dragon appeared")] }),
      baseOptions({ chance: "never" }),
    );
    expect(run.injected).toHaveLength(1);
  });

  test("explain is off by default: no verdicts field", () => {
    const e = entry("e1", { constant: true });
    const run = runLore([book("b1", [e])], scan(), { ...baseOptions(), explain: undefined });
    expect(run.verdicts).toBeUndefined();
  });
});
