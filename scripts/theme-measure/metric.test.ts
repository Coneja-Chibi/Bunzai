/** The structure metric: edge maps ignore palette, SSIM tells layouts apart, and the shares weight screens equally or by time spent. */
import { describe, expect, test } from "bun:test";
import { PAIRS, calibrate, calibrateControls, controlMax, distinctFor, edgeMap, share, ssimDistance, type PairDistances } from "./metric";

const W = 140;
const H = 90;
/** An RGBA image of w x h painted by `paint(x, y)` as a gray level. */
const image = (paint: (x: number, y: number) => number, w = W, h = H): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = paint(x, y); out.set([v, v, v, 255], (y * w + x) * 4); }
  return out;
};
const map = (paint: (x: number, y: number) => number) => edgeMap(image(paint), W, H, 14, 9);
const mapFull = (paint: (x: number, y: number) => number) => edgeMap(image(paint, 280, 180), 280, 180, W, H);
const columns = (x: number) => x % 20 < 10 ? 40 : 220;
const rows = (_x: number, y: number) => y % 20 < 10 ? 40 : 220;

describe("edgeMap", () => {
  test("a flat image has no edges", () => {
    expect(Math.max(...map(() => 128))).toBe(0);
  });

  test("a single vertical edge lights only the blocks it crosses", () => {
    const m = map((x) => x < 70 ? 30 : 230);
    expect(m[0]).toBe(0);
    expect(m[6]).toBeGreaterThan(0);
    expect(m[13]).toBe(0);
  });

  test("inverting the palette leaves the edge map alone, so a recolour is not a layout change", () => {
    const dark = mapFull((x) => columns(x));
    const light = mapFull((x) => 255 - columns(x));
    expect(ssimDistance(dark, light)).toBeLessThan(0.02);
  });

  test("a weaker contrast version of the same layout reads as the same layout", () => {
    expect(ssimDistance(mapFull((x) => columns(x)), mapFull((x) => 100 + columns(x) * 0.3))).toBeLessThan(0.05);
  });
});

describe("ssimDistance", () => {
  test("identical maps are 0 apart", () => {
    const m = mapFull(columns);
    expect(ssimDistance(m, m)).toBe(0);
  });

  test("a different layout is far apart", () => {
    expect(ssimDistance(mapFull(columns), mapFull(rows))).toBeGreaterThan(0.5);
  });
});

describe("distinctFor", () => {
  const dist = (over: Partial<PairDistances>): PairDistances => ({ ...Object.fromEntries(PAIRS.map((p) => [p, 0.4])), ...over }) as PairDistances;

  test("a theme is distinct only when all three of its pairs clear the threshold", () => {
    expect(distinctFor("theater", dist({}), 0.2)).toBe(true);
    expect(distinctFor("theater", dist({ "theater|paper": 0.1 }), 0.2)).toBe(false);
  });

  test("a pair that does not involve the theme does not count against it", () => {
    expect(distinctFor("theater", dist({ "encore|paper": 0.01 }), 0.2)).toBe(true);
    expect(distinctFor("paper", dist({ "encore|paper": 0.01 }), 0.2)).toBe(false);
  });
});

describe("calibrate", () => {
  test("the threshold sits between the controls", () => {
    const c = calibrate(0.01, 0.4);
    expect(c.separated).toBe(true);
    expect(c.threshold).toBeGreaterThan(0.01);
    expect(c.threshold).toBeLessThan(0.4);
  });

  test("overlapping controls are reported, not trusted", () => {
    expect(calibrate(0.5, 0.3).separated).toBe(false);
  });
});

describe("share", () => {
  test("equal weight counts every screen the same", () => {
    expect(share([{ group: "scene", distinct: true }, { group: "other", distinct: false }, { group: "other", distinct: false }, { group: "other", distinct: false }]).equal).toBe(0.25);
  });

  test("time weight follows how long people spend: scene play is 30%, the rest of the groups their own share", () => {
    const all = (distinct: boolean) => (["scene", "library", "editor", "scenes-list", "settings", "other"] as const).map((group) => ({ group, distinct }));
    expect(share(all(true)).timeWeighted).toBeCloseTo(1);
    expect(share(all(false)).timeWeighted).toBe(0);
    const onlyScene = all(false).map((s) => s.group === "scene" ? { ...s, distinct: true } : s);
    expect(share(onlyScene).timeWeighted).toBeCloseTo(0.3);
  });

  test("a group with no reachable screen drops out and the others renormalise", () => {
    expect(share([{ group: "scene", distinct: true }, { group: "library", distinct: false }]).timeWeighted).toBeCloseTo(0.3 / 0.45);
  });
});

describe("calibrateControls", () => {
  test("the threshold sits strictly above the larger control, so a font swap alone cannot pass", () => {
    const c = calibrateControls(0.05, 0.3, 0.6);
    expect(c.separated).toBe(true);
    expect(c.threshold).toBeGreaterThan(0.3);
    expect(c.colourOnlyThreshold).toBeLessThan(c.threshold);
  });

  test("a font control that reaches the positive control is reported as overlapping", () => {
    expect(calibrateControls(0.05, 0.7, 0.6).separated).toBe(false);
    expect(calibrateControls(0.65, 0.05, 0.6).separated).toBe(false);
  });
});

describe("controlMax", () => {
  const rows = [{ id: "a", value: 0.1 }, { id: "settings.appearance", value: 0.9 }, { id: "b", value: 0.2 }];
  test("leaves out screens that show the active-theme record", () => {
    expect(controlMax(rows)).toBe(0.2);
  });
  test("counts every screen when nothing is excluded, so a real overlap still fails", () => {
    expect(controlMax(rows, new Set())).toBe(0.9);
    expect(calibrateControls(controlMax(rows, new Set()), 0, 0.5).separated).toBe(false);
  });
});
