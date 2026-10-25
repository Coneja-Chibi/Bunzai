/**
 * The structure metric behind theme:measure. Pure math, no browser: edgeMap turns one screenshot's pixels
 * into a small edge map (grayscale, Sobel, per-image scaling, block average) so colour drops out and
 * layout stays; ssimDistance compares two maps; the rest turns distances into the distinct share.
 * edgeMap must stay self-contained: the runner serialises it into a headless page to read PNG pixels.
 */

export const MAP_W = 140;
export const MAP_H = 90;
export const THEMES = ["theater", "encore", "girliepop", "paper"] as const;
export type ThemeName = (typeof THEMES)[number];
/** The negative controls, each Theater with one kind of Paper token forced over it: control = colours only, fontcontrol = font faces only. */
export const CONTROLS = ["control", "fontcontrol"] as const;
export type ControlName = (typeof CONTROLS)[number];
export type Pair = `${ThemeName}|${ThemeName}`;
export const PAIRS: Pair[] = THEMES.flatMap((a, i) => THEMES.slice(i + 1).map((b): Pair => `${a}|${b}`));

/** Grayscale, Sobel magnitude scaled to the image's own 99th percentile, then block-averaged to ow x oh. */
export function edgeMap(rgba: ArrayLike<number>, w: number, h: number, ow: number, oh: number): number[] {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = 0.2126 * rgba[i * 4]! + 0.7152 * rgba[i * 4 + 1]! + 0.0722 * rgba[i * 4 + 2]!;
  const mag = new Float32Array(w * h);
  const hist = new Uint32Array(1024);
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -gray[i - w - 1]! + gray[i - w + 1]! - 2 * gray[i - 1]! + 2 * gray[i + 1]! - gray[i + w - 1]! + gray[i + w + 1]!;
      const gy = -gray[i - w - 1]! - 2 * gray[i - w]! - gray[i - w + 1]! + gray[i + w - 1]! + 2 * gray[i + w]! + gray[i + w + 1]!;
      const m = Math.sqrt(gx * gx + gy * gy);
      mag[i] = m;
      if (m > 8) { hist[Math.min(1023, Math.floor(m))]!++; count++; }
    }
  }
  let scale = 64;
  if (count > 0) {
    let seen = 0;
    for (let b = 0; b < 1024; b++) { seen += hist[b]!; if (seen >= count * 0.99) { scale = Math.max(64, b); break; } }
  }
  const out = new Array<number>(ow * oh).fill(0);
  const bw = w / ow;
  const bh = h / oh;
  for (let oy = 0; oy < oh; oy++) {
    for (let ox = 0; ox < ow; ox++) {
      let sum = 0;
      let n = 0;
      for (let y = Math.floor(oy * bh); y < Math.floor((oy + 1) * bh); y++) {
        for (let x = Math.floor(ox * bw); x < Math.floor((ox + 1) * bw); x++) { sum += Math.min(1, mag[y * w + x]! / scale); n++; }
      }
      out[oy * ow + ox] = n ? sum / n : 0;
    }
  }
  return out;
}

/** 1 minus mean SSIM over 8x8 windows (stride 4) of two equally sized maps; 0 identical, near 1 unrelated. */
export function ssimDistance(a: readonly number[], b: readonly number[], w = MAP_W, h = MAP_H): number {
  const C1 = 0.0001;
  const C2 = 0.0009;
  const win = 8;
  let total = 0;
  let windows = 0;
  for (let y = 0; y + win <= h; y += 4) {
    for (let x = 0; x + win <= w; x += 4) {
      let ma = 0, mb = 0;
      for (let j = 0; j < win; j++) for (let i = 0; i < win; i++) { ma += a[(y + j) * w + x + i]!; mb += b[(y + j) * w + x + i]!; }
      const n = win * win;
      ma /= n; mb /= n;
      let va = 0, vb = 0, cov = 0;
      for (let j = 0; j < win; j++) {
        for (let i = 0; i < win; i++) {
          const da = a[(y + j) * w + x + i]! - ma;
          const db = b[(y + j) * w + x + i]! - mb;
          va += da * da; vb += db * db; cov += da * db;
        }
      }
      va /= n - 1; vb /= n - 1; cov /= n - 1;
      total += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      windows++;
    }
  }
  return Math.max(0, 1 - total / windows);
}

export type PairDistances = Record<Pair, number>;

/** A screen is distinct for a theme when that theme's distance to each of the other three is above the threshold. */
export function distinctFor(theme: ThemeName, distances: PairDistances, threshold: number): boolean {
  return PAIRS.filter((p) => p.split("|").includes(theme)).every((p) => distances[p] > threshold);
}

export interface Calibration { negative: number; positive: number; threshold: number; separated: boolean }

/** The threshold sits between the controls (geometric mean); separated is false when they overlap. */
export function calibrate(negative: number, positive: number): Calibration {
  const separated = negative < positive;
  return { negative, positive, separated, threshold: separated ? Math.sqrt(Math.max(negative, 1e-6) * positive) : (negative + positive) / 2 };
}

export interface ControlCalibration extends Calibration { colourMax: number; fontMax: number; colourOnlyThreshold: number }

/**
 * The honest threshold: it must clear BOTH negative controls, because a recolour and a font swap each leave the same screen.
 * colourOnlyThreshold is what the recolour control alone would have set, so the gap between it and threshold is the part of the score fonts could fake.
 */
export function calibrateControls(colourMax: number, fontMax: number, positive: number): ControlCalibration {
  return { ...calibrate(Math.max(colourMax, fontMax), positive), colourMax, fontMax, colourOnlyThreshold: calibrate(colourMax, positive).threshold };
}

export const GROUPS = ["scene", "library", "editor", "scenes-list", "settings", "other"] as const;
export type Group = (typeof GROUPS)[number];
/** Share of a person's time in each group; "other" is spread over its screens equally. */
export const GROUP_WEIGHTS: Record<Group, number> = { scene: 0.3, library: 0.15, editor: 0.2, "scenes-list": 0.1, settings: 0.05, other: 0.2 };

export interface Judged { group: Group; distinct: boolean }
export interface Share { equal: number; timeWeighted: number; count: number }

/** Equal weight: distinct / screens. Time weight: each group's distinct share times its weight (groups with no screen drop out and the rest renormalise). */
export function share(screens: readonly Judged[]): Share {
  if (!screens.length) return { equal: 0, timeWeighted: 0, count: 0 };
  const equal = screens.filter((s) => s.distinct).length / screens.length;
  let weighted = 0;
  let used = 0;
  for (const g of GROUPS) {
    const inGroup = screens.filter((s) => s.group === g);
    if (!inGroup.length) continue;
    weighted += GROUP_WEIGHTS[g] * (inGroup.filter((s) => s.distinct).length / inGroup.length);
    used += GROUP_WEIGHTS[g];
  }
  return { equal, timeWeighted: weighted / used, count: screens.length };
}

/**
 * Screens whose own content is the active-theme record (the Appearance page lists the installed themes and marks the active one).
 * A control that borrows another theme's tokens is a different record there, so that page differs for reasons that are not looks;
 * it is left out of the negative-control maximum (it is still scored for the themes).
 */
export const THEME_STATE_SCREENS: ReadonlySet<string> = new Set(["settings.appearance"]);

/** The largest control distance over the screens a control can honestly be compared on. */
export function controlMax(rows: readonly { id: string; value: number }[], excluded: ReadonlySet<string> = THEME_STATE_SCREENS): number {
  return Math.max(0, ...rows.filter((r) => !excluded.has(r.id)).map((r) => r.value));
}
