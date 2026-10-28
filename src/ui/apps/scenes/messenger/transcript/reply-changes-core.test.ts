/** The change visuals' rules: chips (a bar and a colored delta for a number with a top, the new value for a choice, a row's count change), cards (new value with the old under it), the style split, the toast words, the out-of-time words. */
import { describe, expect, test } from "bun:test";
import type { TrackerChanged } from "../../../../../studio/tracker-changes";
import { cardRows, chipsOf, deltaOf, markerText, outOfTimeWords, splitByStyle, toastWords } from "./reply-changes-core";

const health: TrackerChanged = {
  trackerId: "health", name: "Health", style: "chips", icon: "lucide:gauge", fieldIcons: { hp: "lucide:activity" }, bars: { hp: { min: 0, top: 20 } },
  changes: [{ field: "hp", before: 10, after: 7 }, { field: "mood", before: "calm", after: "hurt" }, { field: "gold", before: 5, after: 9 }, { field: "lit", before: false, after: true }],
};
const satchel: TrackerChanged = {
  trackerId: "satchel", name: "Satchel", style: "card", icon: "lucide:backpack",
  changes: [{ row: "rope", before: null, after: { qty: 1 }, added: true }, { row: "lantern", before: { qty: 3 }, after: { qty: 2 } }, { row: "salt", before: { qty: 1 }, after: null, removed: true }, { row: "letter", before: { note: "a" }, after: { note: "b" } }],
};

describe("deltas", () => {
  test("signed at the values' own precision (a whole number never grows decimals), and none when nothing moved", () => {
    expect(deltaOf(10, 7)).toEqual({ text: "-3", dir: "down" });
    expect(deltaOf(1, 1.5)).toEqual({ text: "+0.5", dir: "up" });
    expect(deltaOf(0.1, 0.3)).toEqual({ text: "+0.2", dir: "up" });
    expect(deltaOf(10, 7.125)).toEqual({ text: "-2.875", dir: "down" });
    expect(deltaOf(2, 2)).toBeNull();
  });
});

describe("chips", () => {
  test("a number with a top is a bar with 7/20 and a down delta; its own icon draws, and a field without one draws none (the panel's rule; never the tracker's)", () => {
    const [hp] = chipsOf(health);
    expect(hp).toEqual({ key: "health.hp", icon: "lucide:activity", label: "hp", value: "7/20", fill: 0.35, delta: { text: "-3", dir: "down" } });
  });

  test("an open number is the number with an up delta; a choice shows its new value; yes or no shows the field or its absence", () => {
    const chips = chipsOf(health);
    expect(chips[1]).toEqual({ key: "health.mood", icon: undefined, label: "hurt" });
    expect(chips[2]).toEqual({ key: "health.gold", icon: undefined, label: "gold", value: "9", delta: { text: "+4", dir: "up" } });
    expect(chips[3]!.label).toBe("lit");
    expect(chipsOf({ ...health, changes: [{ field: "lit", before: true, after: false }] })[0]!.label).toBe("not lit");
  });

  test("a list row shows its name, the change in its first number, and a plus or minus for an added or removed one", () => {
    expect(chipsOf(satchel).map((c) => [c.label, c.delta?.text])).toEqual([["+ rope", "+1"], ["lantern", "-1"], ["- salt", "-1"], ["letter", undefined]]);
  });

  test("a bar never leaves its box: a value past the top fills it, one under the bottom is empty, a flat range is empty", () => {
    const at = (after: number, bars: TrackerChanged["bars"]) => chipsOf({ ...health, bars, changes: [{ field: "hp", before: 1, after }] })[0]!.fill;
    expect(at(30, { hp: { min: 0, top: 20 } })).toBe(1);
    expect(at(-4, { hp: { min: 0, top: 20 } })).toBe(0);
    expect(at(5, { hp: { min: 5, top: 5 } })).toBe(0);
  });
});

describe("cards", () => {
  test("a number with a top shows the new value over the top with where it was, and the old value under it", () => {
    expect(cardRows(health)[0]).toEqual({ key: "health.hp", icon: "lucide:activity", label: "hp", now: "7/20", was: "10", bar: { fill: 0.35, was: 0.5 } });
    expect(cardRows(health)[1]).toEqual({ key: "health.mood", icon: undefined, label: "mood", now: "hurt", was: "calm" });
  });

  test("a list's rows say what happened to each", () => {
    expect(cardRows(satchel).map((r) => [r.label, r.now])).toEqual([["rope", "added"], ["lantern", "changed"], ["salt", "removed"], ["letter", "changed"]]);
  });
});

describe("the style split", () => {
  test("each tracker lands in its own style; hidden and unchanged ones draw nothing", () => {
    const toast: TrackerChanged = { trackerId: "mood", name: "Mood", style: "toast", changes: [{ field: "m", before: "a", after: "b" }] };
    const hidden: TrackerChanged = { ...toast, trackerId: "secret", style: "hidden" };
    const empty: TrackerChanged = { ...toast, trackerId: "none", style: "chips", changes: [] };
    const out = splitByStyle([health, satchel, toast, hidden, empty]);
    expect(out.chips.map((t) => t.trackerId)).toEqual(["health"]);
    expect(out.cards.map((t) => t.trackerId)).toEqual(["satchel"]);
    expect(out.toasts.map((t) => t.trackerId)).toEqual(["mood"]);
  });

  test("the marker counts the toast trackers' changes; the toast says Reply N changed ...", () => {
    expect(markerText([health])).toBe("4 changes");
    expect(markerText([{ ...health, changes: [health.changes[0]!] }])).toBe("1 change");
    expect(toastWords(42, [{ ...health, changes: health.changes.slice(0, 2) }])).toBe("Reply 42 changed hp 10 → 7 and mood calm → hurt.");
    expect(toastWords(42, [])).toBeNull();
  });
});

describe("the out-of-time line", () => {
  test("names each macro with braces, and says so plainly when only a blank name is known", () => {
    expect(outOfTimeWords([{ macro: "tally" }])).toBe("1 macro ran out of time building this prompt ({{tally}}).");
    expect(outOfTimeWords([{ macro: "tally" }, { macro: "roll" }])).toBe("2 macros ran out of time building this prompt ({{tally}}, {{roll}}).");
    expect(outOfTimeWords([{ macro: "" }])).toBe("1 macro ran out of time building this prompt.");
  });
});
