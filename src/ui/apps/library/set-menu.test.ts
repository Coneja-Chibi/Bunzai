/**
 * The set tools in a card's menu: present for lorebooks and regex sets, absent for everything else,
 * and wired to the shelf's own actions, so the menu and the card's buttons never disagree.
 */
import { describe, expect, test } from "bun:test";
import { setMenuItems } from "./set-menu";

const calls: string[] = [];
const shelf = (enabled: boolean) => ({
  enabledOf: () => enabled,
  onToggleEnabled: (_e: unknown, on: boolean) => calls.push(`toggle:${String(on)}`),
  onSplit: () => calls.push("split"),
}) as never;

describe("setMenuItems", () => {
  test("a lorebook that is on offers to switch off and to split", () => {
    calls.length = 0;
    const items = setMenuItems({ kind: "lorebook", id: "b", name: "B" }, { lore: shelf(true) });
    expect(items.map((i) => i.label)).toEqual(["Switch off (skip on export)", "Split into two"]);
    items.forEach((i) => i.onPick());
    expect(calls).toEqual(["toggle:false", "split"]);
  });

  test("a regex set that is off offers to switch on", () => {
    calls.length = 0;
    const items = setMenuItems({ kind: "regex", id: "r", name: "R" }, { regex: shelf(false) });
    expect(items[0]?.label).toBe("Switch on");
    items[0]?.onPick();
    expect(calls).toEqual(["toggle:true"]);
  });

  test("any other kind gets nothing", () => {
    expect(setMenuItems({ kind: "character", id: "c", name: "C" }, { lore: shelf(true), regex: shelf(true) })).toEqual([]);
  });
});
