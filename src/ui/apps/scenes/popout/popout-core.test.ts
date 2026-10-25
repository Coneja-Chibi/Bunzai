/** Where a pop-out panel sits (clamp, default place), how its saved state reads back, and which kinds a scene may float. */
import { describe, expect, test } from "bun:test";
import type { SceneProp } from "../props/prop-contract";
import { clampPopout, defaultPopout, parsePopout, popoutKindsFor, popoutValue } from "./popout-core";
import type { PopoutKind } from "./popout-kind";

const kind = (id: string): PopoutKind => ({ id, title: id, noun: id, icon: "lucide:zap", render: () => null as never });
const prop = (id: string, popouts?: PopoutKind[]): SceneProp => ({ id, name: id, blurb: "", tier: "", reach: "none", icon: "lucide:puzzle", tone: "x", ...(popouts ? { popouts } : {}) });

describe("clampPopout", () => {
  const view = { width: 1000, height: 800 };
  test("keeps the whole panel inside the view, using its real height", () => {
    expect(clampPopout({ x: 5000, y: 5000 }, { width: 380, height: 560 }, view)).toEqual({ x: 620, y: 240 });
    expect(clampPopout({ x: -50, y: -9 }, { width: 380, height: 560 }, view)).toEqual({ x: 0, y: 0 });
    expect(clampPopout({ x: 300, y: 100 }, { width: 380, height: 560 }, view)).toEqual({ x: 300, y: 100 });
  });
  test("a panel bigger than the view sticks to the top left instead of going negative", () => {
    expect(clampPopout({ x: 40, y: 40 }, { width: 380, height: 900 }, { width: 300, height: 800 })).toEqual({ x: 0, y: 0 });
  });
});

describe("defaultPopout", () => {
  test("opens at the right edge, 100px down, as RoleCall does", () => {
    expect(defaultPopout({}, { width: 1000, height: 800 })).toEqual({ x: 600, y: 100 });
    expect(defaultPopout({ width: 440, top: 180 }, { width: 1000, height: 800 })).toEqual({ x: 540, y: 180 });
  });
});

describe("parsePopout", () => {
  test("reads a saved state and fails closed on anything else", () => {
    expect(parsePopout({ open: true, x: 10, y: 20 })).toEqual({ open: true, pos: { x: 10, y: 20 } });
    expect(parsePopout({ open: false, x: 10, y: 20 })).toEqual({ open: false, pos: { x: 10, y: 20 } });
    for (const bad of [undefined, null, "open", 3, [], { open: "yes" }]) expect(parsePopout(bad)).toEqual({ open: false, pos: null });
    expect(parsePopout({ open: true, x: Number.NaN, y: 4 })).toEqual({ open: true, pos: null });
    expect(parsePopout({ open: true, x: 4 })).toEqual({ open: true, pos: null });
  });
  test("what is saved reads back the same", () => {
    const s = { open: true, pos: { x: 3, y: 4 } };
    expect(parsePopout(popoutValue(s))).toEqual(s);
    expect(popoutValue({ open: false, pos: null })).toEqual({ open: false });
  });
});

describe("popoutKindsFor", () => {
  test("a prop's kinds are offered only while the prop is on", () => {
    const hare = kind("hare.trace");
    const props = [prop("hare", [hare]), prop("quiet")];
    expect(popoutKindsFor([kind("wing")], props, []).map((k) => k.id)).toEqual(["wing"]);
    expect(popoutKindsFor([kind("wing")], props, ["hare"]).map((k) => k.id)).toEqual(["wing", "hare.trace"]);
    expect(popoutKindsFor([], props, ["quiet"])).toEqual([]);
  });

  test("a prop's own panel is a kind too, offered only while the prop is on, before its other kinds", () => {
    const withPanel: SceneProp = { ...prop("stats", [kind("stats.extra")]), panel: kind("tracker.resources") };
    expect(popoutKindsFor([], [withPanel], []).map((k) => k.id)).toEqual([]);
    expect(popoutKindsFor([], [withPanel], ["stats"]).map((k) => k.id)).toEqual(["tracker.resources", "stats.extra"]);
  });
});
