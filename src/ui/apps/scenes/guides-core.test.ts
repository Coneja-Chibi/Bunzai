/**
 * The Guides and Scene Note rules (guides-core.ts): the list as RoleCall's rail shows it, the active
 * count, the editor's mode change, and the helper lines that say what the request does.
 */
import { describe, expect, test } from "bun:test";
import type { GuideRecord } from "../../../core/guide-record";
import { activeCount, depthHint, draftOf, frequencyHint, groupGuides, withGuide, withMode } from "./guides-core";

const guide = (id: string, over: Partial<GuideRecord> = {}): GuideRecord => ({
  id, title: id, content: "c", type: "guide", category: "situational", role: "user", mode: "standard", depth: null, target: null, side: null, visible: true, createdAt: 1, updatedAt: 1, ...over,
});

describe("the list", () => {
  const all = [guide("Slow burn"), guide("Think first", { category: "thinking" }), guide("No gore", { category: "rules" }), guide("Hidden", { visible: false }), guide("Mine", { category: "custom" })];

  test("groups by RoleCall's category order, leaves empty groups and hidden guides out, and counts each group", () => {
    expect(groupGuides(all, "").map((g) => [g.category, g.rows.map((r) => r.title)])).toEqual([
      ["situational", ["Slow burn"]],
      ["thinking", ["Think first"]],
      ["rules", ["No gore"]],
      ["custom", ["Mine"]],
    ]);
  });

  test("searches by title, ignoring case and the space around it", () => {
    expect(groupGuides(all, "  THINK ").map((g) => g.rows.map((r) => r.title))).toEqual([["Think first"]]);
    expect(groupGuides(all, "zzz")).toEqual([]);
    expect(groupGuides(all, "Hidden")).toEqual([]);
  });

  test("the active count is the scene's guides that are in the library and visible", () => {
    expect(activeCount(all, ["Slow burn", "Hidden", "gone", "Mine"])).toBe(2);
    expect(activeCount(all, [])).toBe(0);
  });
});

describe("switching guides", () => {
  test("a guide switched on goes last, one switched off leaves, and none is listed twice", () => {
    expect(withGuide(["a", "b"], "c", true)).toEqual(["a", "b", "c"]);
    expect(withGuide(["a", "b", "c"], "a", true)).toEqual(["b", "c", "a"]);
    expect(withGuide(["a", "b"], "a", false)).toEqual(["b"]);
    expect(withGuide(["a"], "z", false)).toEqual(["a"]);
  });
});

describe("the editor", () => {
  test("a new guide starts as RoleCall's New Guide: user, situational, standard", () => {
    expect(draftOf()).toMatchObject({ title: "", content: "", category: "situational", role: "user", mode: "standard", depth: null, target: null, side: null, visible: true });
  });

  test("choosing a mode sets what it needs and clears what it does not", () => {
    const base = draftOf();
    expect(withMode(base, "depth")).toMatchObject({ mode: "depth", depth: 0, target: null });
    expect(withMode({ ...base, mode: "depth", depth: 7 }, "append")).toMatchObject({ mode: "append", depth: 7 });
    expect(withMode(base, "macro")).toMatchObject({ mode: "macro", depth: null, target: "persona", side: "append" });
    expect(withMode({ ...base, mode: "macro", target: "scenario", side: "prepend" }, "chat_start")).toMatchObject({ mode: "chat_start", depth: null, target: null, side: null });
    expect(withMode({ ...base, mode: "depth", depth: 7 }, "standard")).toMatchObject({ mode: "standard", depth: null });
  });
});

describe("the note's helper lines", () => {
  test("depth says how many messages the note goes before: one more than the number, as the request does", () => {
    expect(depthHint(0)).toBe("Injected right before your latest message");
    expect(depthHint(4)).toBe("Injected before the last 5 chat messages");
  });

  test("frequency says how often", () => {
    expect([0, 1, 3].map(frequencyHint)).toEqual(["Scene Note is disabled", "Included with every message", "Included every 3 messages"]);
  });
});
