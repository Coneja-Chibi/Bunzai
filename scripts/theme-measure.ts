/**
 * theme:measure - what share of the WHOLE app looks structurally different across the four bundled themes.
 *
 * For every screen in theme-measure/screens.ts it screenshots the seeded throwaway studio at 1400x900 in Theater,
 * Encore, GirliePop and Paper, drops colour (grayscale, Sobel edges, 140x90 map) and compares the maps by 1 - SSIM.
 * A screen is "distinct for a theme" when that theme is farther than the threshold from each of the other three.
 * It is measured twice: on the whole window, and on a fixed 1100x700 window of the app area (#canvas), which drops the
 * shell chrome every theme redraws and is the stricter figure the --check gate uses.
 * The threshold sits between the negative controls and a positive control, all measured in the same run. Both negative controls
 * are Theater with one kind of Paper token forced over it: "control" moves colours only, "fontcontrol" moves the four font-family
 * tokens only (the type scale stays Theater's). Each must read as the same screen, so the threshold clears the larger of the two.
 * The positive control is scene.play, whose layout, message style, composer and wings all differ per theme.
 * settings.appearance (it lists the installed themes and marks the active one) is left out of the control maximum only: a control wears another theme record there, so it differs for non-visual reasons.
 * The report also says how much of the score fonts alone could fake: the screens where the font control passes the recolour-only threshold.
 * FONT NEUTRALIZATION: edge maps of lettering are dominated by glyph edges and text reflow (a font swap alone scored up to 0.71, above the
 * scene.play positive control), so during capture only, theme-measure/neutralize.ts injects a stylesheet into every run (themes and controls)
 * that forces one font family, size and line-height on all text and makes the glyphs transparent. Boxes, borders, backgrounds, frames, images
 * and layout are untouched. It is a measurement artifact: it never ships in the app. The font control therefore tests only what is left of a font swap.
 * The gate screens (lock, recovery words, load-in) are protected host UI no theme can restyle, so they are listed under skipped and not scored.
 *
 * MANUAL GATE: it needs a real Chrome, so it is NOT part of verify:ci. Run it after theme work.
 *   bun run theme:measure                 capture, measure, write design/theme-v2-shots/measure.json and measure.html
 *   bun run theme:measure -- --check      same, and exit 1 when any theme is under 50% (equal weight, app area) or a control overlaps the positive
 *   --work <dir>      scratch folder for the throwaway studio, Chrome profile and screenshots (default: a new temp folder)
 *   --reuse           measure the screenshots already in <work>/shots instead of capturing again
 *   --only a,b        capture only these screen ids (for debugging a reach; the result is not written)
 *   --themes a,b      capture only these themes (debugging)
 * A real studio is never touched: BUNRAKU_HOME and the library both live in a fresh folder inside --work (never reused, since the fake device key is per run).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONTROLS, GROUPS, MAP_H, MAP_W, PAIRS, THEMES, calibrateControls, controlMax, distinctFor, share, ssimDistance, type Group, type PairDistances, type ThemeName } from "./theme-measure/metric.ts";
import { renderReport } from "./theme-measure/report.ts";
import { SCREENS, isProtected, PROTECTED_NOTE } from "./theme-measure/screens.ts";
import { startStudio } from "./theme-measure/studio.ts";

const FLOOR = 0.5;
/** Two shots of one app closer than this in every theme are one screen. */
const DUPLICATE = 0.05;
const OUT = "design/theme-v2-shots";
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const CHECK = args.includes("--check");
const REUSE = args.includes("--reuse");
const ONLY = flag("--only")?.split(",");
const THEME_ARG = flag("--themes")?.split(",") as ThemeName[] | undefined;
const work = flag("--work") ?? mkdtempSync(join(tmpdir(), "bunraku-theme-measure-"));
const shotPath = (theme: string, id: string) => join(work, "shots", theme, `${id}.png`);

/** Run the Node browser half against a fresh throwaway studio; it leaves maps.json and failed.json in the work folder. */
async function browse(themes: string[]): Promise<void> {
  const studio = REUSE ? undefined : await startStudio(join(work, `studio-${Date.now()}`));
  try {
    const child = Bun.spawn(["node", "scripts/theme-measure/browse.ts", studio?.url ?? "", work, themes.join(","), ONLY?.join(",") ?? "-", REUSE ? "reuse" : "capture"], { stdio: ["inherit", "inherit", "inherit"] });
    if ((await child.exited) !== 0) throw new Error("the browser half failed");
  } finally { studio?.close(); }
}

async function main(): Promise<void> {
  const themes: string[] = THEME_ARG ?? [...THEMES, ...CONTROLS];
  await browse(themes);
  if (ONLY || THEME_ARG) { console.log(`partial run: shots in ${join(work, "shots")}, nothing written`); process.exit(0); }
  const maps = JSON.parse(readFileSync(join(work, "maps.json"), "utf8")) as Record<string, number[]>;
  const failed = new Map(Object.entries(JSON.parse(readFileSync(join(work, "failed.json"), "utf8")) as Record<string, string>));
  // protected host UI (the gates) cannot be themed by design, so it is not scored; it is listed under skipped
  const screens = SCREENS.filter((s) => !isProtected(s));

  // a screen is measured only when every theme and the control reached it
  const arrived = screens.filter((s) => [...THEMES, ...CONTROLS].every((t) => existsSync(shotPath(t, s.id)) && !failed.has(`${t}/${s.id}`)));
  const skipped = screens.filter((s) => !arrived.includes(s)).map((s) => ({ id: s.id, app: s.app, why: [...THEMES, ...CONTROLS].filter((t) => failed.has(`${t}/${s.id}`)).map((t) => `${t}: ${failed.get(`${t}/${s.id}`)}`).join("; ") || "no screenshot" }));

  // a reach that changed nothing on screen is not another screen: it matches an earlier one of its app in every theme
  skipped.push(...SCREENS.filter(isProtected).map((s) => ({ id: s.id, app: s.app, why: PROTECTED_NOTE })));
  const same = (a: string, b: string) => THEMES.every((t) => ssimDistance(maps[`${t}/${a}#content`]!, maps[`${t}/${b}#content`]!) < DUPLICATE);
  const reached: typeof arrived = [];
  for (const s of arrived) {
    const twin = reached.find((r) => r.app === s.app && same(r.id, s.id));
    if (twin) skipped.push({ id: s.id, app: s.app, why: `looks the same as ${twin.id} in all four themes (the state did not change)` });
    else reached.push(s);
  }
  const analyse = (suffix: string) => {
    const rows = reached.map((s) => {
      const key = (theme: string) => maps[`${theme}/${s.id}${suffix}`]!;
      const distances = Object.fromEntries(PAIRS.map((p) => { const [x, y] = p.split("|") as [string, string]; return [p, ssimDistance(key(x), key(y))]; })) as PairDistances;
      return { id: s.id, app: s.app, group: s.group, distances, control: ssimDistance(key("theater"), key("control")), fontControl: ssimDistance(key("theater"), key("fontcontrol")) };
    });
    // the threshold must clear BOTH negative controls: a recolour and a font swap each look "the same screen" to a person
    const negatives = rows.flatMap((r) => [r.control, r.fontControl]).sort((x, y) => x - y);
    const play = rows.find((r) => r.id === "scene.play");
    const positive = Math.min(...(play ? Object.values(play.distances) : []), 1);
    const cal = calibrateControls(controlMax(rows.map((r) => ({ id: r.id, value: r.control }))), controlMax(rows.map((r) => ({ id: r.id, value: r.fontControl }))), positive);
    // how much of the score is fonts: screens a font swap alone would have counted as different under the recolour-only threshold
    const fontReflow = rows.filter((r) => r.fontControl > cal.colourOnlyThreshold).map((r) => r.id);
    const themeRows = THEMES.map((t) => ({ theme: t, ...share(rows.map((r) => ({ group: r.group, distinct: distinctFor(t, r.distances, cal.threshold) }))) }));
    const notDistinct = rows.filter((r) => THEMES.some((t) => !distinctFor(t, r.distances, cal.threshold))).map((r) => ({ id: r.id, app: r.app, group: r.group, themes: THEMES.filter((t) => !distinctFor(t, r.distances, cal.threshold)) }));
    return { calibration: { ...cal, fontReflow, negativeMedian: negatives[Math.floor(negatives.length / 2)] ?? 0, positiveScreen: "scene.play", positivePairs: play?.distances ?? null }, themes: themeRows, screens: rows, notDistinct };
  };
  const views = { window: analyse(""), content: analyse("#content") };
  const result = { generated: new Date().toISOString(), viewport: "1400x900", content: "1100x700 at the top left of #canvas (the app area, shell chrome dropped)", map: `${MAP_W}x${MAP_H}`, metric: "1 - SSIM of Sobel edge maps", groups: GROUPS.map((g: Group) => ({ group: g, screens: reached.filter((r) => r.group === g).length })), views, skipped };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/measure.json`, JSON.stringify(result, null, 2) + "\n");
  writeFileSync(`${OUT}/measure.html`, renderReport(result));
  for (const [name, v] of Object.entries(views)) {
    for (const t of v.themes) console.log(`${name.padEnd(8)} ${t.theme.padEnd(10)} equal ${(t.equal * 100).toFixed(0)}%  time-weighted ${(t.timeWeighted * 100).toFixed(0)}%  (${t.count} screens)`);
    const c = v.calibration;
    console.log(`${name}: recolour control max ${c.colourMax.toFixed(4)}, font control max ${c.fontMax.toFixed(4)} (${c.fontReflow.length} screens over the recolour-only threshold ${c.colourOnlyThreshold.toFixed(4)}), scene.play min ${c.positive.toFixed(4)}, threshold ${c.threshold.toFixed(4)}${c.separated ? "" : "  OVERLAP"}`);
  }
  console.log(`${skipped.length} screens skipped; wrote ${OUT}/measure.json and measure.html; work folder ${work}`);
  if (CHECK) {
    // the gate is the stricter content view: the shell chrome differs in every theme and would pass any screen
    const v = views.content;
    const under = v.themes.filter((t) => t.equal < FLOOR);
    if (!v.calibration.separated) console.error("check failed: the controls overlap, so the threshold cannot be trusted");
    for (const t of under) console.error(`check failed: ${t.theme} is ${(t.equal * 100).toFixed(0)}% distinct on the app area, under ${FLOOR * 100}%`);
    if (!v.calibration.separated || under.length) process.exit(1);
  }
}

await main();
