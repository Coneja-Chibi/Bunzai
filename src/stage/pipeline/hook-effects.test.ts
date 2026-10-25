/**
 * A hook's effect is checked against its powers before anything is applied
 * (Decision 3).
 */
import { describe, expect, test } from "bun:test";
import type { MatchedEntry, Placement } from "../contracts/pipeline";
import { checkHookEffect } from "./hook-effects";

const place = (extra: Partial<Placement> = {}): Placement => ({
  id: "p1",
  content: "Mira remembers the lighthouse.",
  position: "character",
  role: "system",
  priority: 100,
  source: { kind: "hook", hookId: "minds", label: "Character Minds" },
  ...extra,
});

const matched: MatchedEntry[] = [
  {
    placement: {
      ...place({ id: "e1" }),
      source: { kind: "lorebook", lorebookId: "lb1", entryId: "e1", title: "Lighthouse" },
    },
    matchedTriggers: ["lighthouse"],
  },
];

const problems = (check: ReturnType<typeof checkHookEffect>) => (check.ok ? [] : check.problems);

describe("before-assembly", () => {
  const ctx = { promptStates: { main: true, timestamp: true }, lorebookIds: ["lb1"] };

  test("switching a known prompt off and excluding a known lorebook is allowed", () => {
    expect(checkHookEffect("frame", "before-assembly", ctx, { promptStates: { timestamp: false }, excludeLorebookIds: ["lb1"] })).toEqual({
      ok: true,
    });
  });

  test("an unknown prompt or lorebook is rejected, naming the hook and point", () => {
    expect(problems(checkHookEffect("frame", "before-assembly", ctx, { promptStates: { nope: false }, excludeLorebookIds: ["lb9"] }))).toEqual([
      'hook frame at before-assembly: preset prompt "nope" does not exist',
      'hook frame at before-assembly: lorebook "lb9" does not exist',
    ]);
  });
});

describe("after-lorebook", () => {
  const ctx = { matched };

  test("a placement carrying this hook as its source is allowed, as is dropping a matched entry", () => {
    expect(checkHookEffect("minds", "after-lorebook", ctx, { placements: [place()], dropEntryIds: ["e1"] }).ok).toBe(true);
  });

  test("a placement cannot pose as lore or as another hook", () => {
    const asLore = place({ source: { kind: "lorebook", lorebookId: "x", entryId: "y", title: "fake" } });
    const asOther = place({ id: "p2", source: { kind: "hook", hookId: "someone-else", label: "x" } });
    expect(problems(checkHookEffect("minds", "after-lorebook", ctx, { placements: [asLore, asOther] }))).toHaveLength(2);
  });

  test("depth is required at depth positions, and only there", () => {
    expect(checkHookEffect("minds", "after-lorebook", ctx, { placements: [place({ position: "depth", depth: 0 })] }).ok).toBe(true);
    const out = problems(
      checkHookEffect("minds", "after-lorebook", ctx, {
        placements: [
          place({ id: "a", position: "depth" }),
          place({ id: "b", position: "append", depth: 1.5 }),
          place({ id: "c", position: "depth", depth: -1 }),
          place({ id: "d", position: "world", depth: 2 }),
        ],
      }),
    );
    expect(out).toHaveLength(4);
  });

  test("duplicate ids, missing ids, bad priorities, and unknown entries are rejected", () => {
    const out = problems(
      checkHookEffect("minds", "after-lorebook", ctx, {
        placements: [place(), place(), place({ id: "" }), place({ id: "q", priority: Number.NaN })],
        dropEntryIds: ["e9"],
      }),
    );
    expect(out).toEqual([
      'hook minds at after-lorebook: placement "p1" is listed twice',
      "hook minds at after-lorebook: a placement has no id",
      'hook minds at after-lorebook: placement "q" needs a finite priority',
      'hook minds at after-lorebook: matched entry "e9" does not exist',
    ]);
  });
});

describe("shape-history", () => {
  const history = [
    { id: "m1", role: "user" as const, content: "a" },
    { id: "m2", role: "assistant" as const, content: "b" },
    { id: "m3", role: "user" as const, content: "c" },
  ];

  test("dropping and replacing older messages is allowed", () => {
    expect(checkHookEffect("tv", "shape-history", { history }, { dropIds: ["m1"], replace: [{ id: "m2", content: "summary" }] }).ok).toBe(true);
  });

  test("the newest message is untouchable", () => {
    expect(problems(checkHookEffect("tv", "shape-history", { history }, { dropIds: ["m3"] }))).toEqual([
      "hook tv at shape-history: the newest message cannot be dropped or replaced",
    ]);
    expect(checkHookEffect("tv", "shape-history", { history }, { replace: [{ id: "m3", content: "x" }] }).ok).toBe(false);
  });

  test("replacing a message that is not in the history is rejected", () => {
    expect(problems(checkHookEffect("tv", "shape-history", { history }, { replace: [{ id: "ghost", content: "x" }] }))).toEqual([
      'hook tv at shape-history: history message "ghost" does not exist',
    ]);
  });

  test("unknown ids, and a message both dropped and replaced, are rejected", () => {
    const out = problems(checkHookEffect("tv", "shape-history", { history }, { dropIds: ["m1", "zz"], replace: [{ id: "m1", content: "x" }] }));
    expect(out).toEqual([
      'hook tv at shape-history: history message "zz" does not exist',
      'hook tv at shape-history: history message "m1" is both dropped and replaced',
    ]);
  });
});

describe("before-send", () => {
  const ctx = { messages: [{ role: "user" as const, content: "hi" }] };

  test("an annotation or a veto with a reason is allowed", () => {
    expect(checkHookEffect("guard", "before-send", ctx, { annotations: [{ label: "l", detail: "d" }], veto: { reason: "Out of credits." } }).ok).toBe(true);
  });

  test("a veto without a readable reason is rejected", () => {
    expect(checkHookEffect("guard", "before-send", ctx, { veto: { reason: "  " } }).ok).toBe(false);
  });
});
