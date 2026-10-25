/**
 * The browser half of theme:measure, run under Node (Playwright cannot attach to Chrome from Bun on Windows).
 * theme-measure.ts starts the studio under Bun, then runs this against it: capture every screen in every theme
 * (unless --reuse), then turn each screenshot into an edge map and write maps.json and failed.json into the work folder.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { THEME_IDS, capture, edgeMaps, launch, paintPaperTokens, useTheme } from "./driver.ts";
import { CONTROLS, MAP_H, MAP_W, edgeMap, type ControlName, type ThemeName } from "./metric.ts";
import { SCREENS, isProtected } from "./screens.ts";

const [url, work, themeList, onlyList, mode] = process.argv.slice(2) as [string, string, string, string, string];
const themes = themeList.split(",");
const only = onlyList === "-" ? null : onlyList.split(",");
const screens = (only ? SCREENS.filter((s) => only.includes(s.id)) : SCREENS).filter((s) => !isProtected(s));
const shot = (theme: string, id: string) => `${work}/shots/${theme}/${id}.png`;

/** One theme or control: set it up on a fresh page, then capture every screen. */
async function captureTheme(page: Awaited<ReturnType<typeof launch>>["page"], theme: string): Promise<void> {
  const control = (CONTROLS as readonly string[]).includes(theme);
  if (control) await paintPaperTokens(page, url, theme as ControlName);
  else await useTheme(page, url, THEME_IDS[theme as ThemeName]);
  mkdirSync(`${work}/shots/${theme}`, { recursive: true });
  for (const screen of screens) {
    const got = await capture(page, url, screen);
    if (got.ok && got.png) {
      writeFileSync(shot(theme, screen.id), got.png);
      writeFileSync(shot(theme, screen.id + ".content"), got.content ?? got.png);
    }
    else {
      failed[`${theme}/${screen.id}`] = got.why ?? "unknown";
      if (got.png) { mkdirSync(`${work}/failed/${theme}`, { recursive: true }); writeFileSync(`${work}/failed/${theme}/${screen.id}.png`, got.png); }
    }
    console.log(`${theme.padEnd(10)} ${screen.id.padEnd(26)} ${got.ok ? "ok" : "FAILED " + got.why}`);
  }
}

const failed: Record<string, string> = {};
if (mode !== "reuse") {
  // the bundled themes share one browser; each control gets its own, because a control's forced tokens live in the browser context
  const real = themes.filter((t) => !(CONTROLS as readonly string[]).includes(t));
  for (const group of [real, ...themes.filter((t) => (CONTROLS as readonly string[]).includes(t)).map((t) => [t])]) {
    if (!group.length) continue;
    const browser = await launch(work);
    try { for (const theme of group) await captureTheme(browser.page, theme); } finally { await browser.close(); }
  }
}

const maps: Record<string, number[]> = {};
const browser = await launch(work);
try {
  const present = themes.flatMap((t) => screens.filter((s) => existsSync(shot(t, s.id))).flatMap((s) => [[`${t}/${s.id}`, shot(t, s.id)], [`${t}/${s.id}#content`, shot(t, s.id + ".content")]] as const));
  const out = await edgeMaps(browser.page, present.map(([, file]) => readFileSync(file)), edgeMap.toString(), MAP_W, MAP_H);
  present.forEach(([k], i) => { maps[k] = out[i]!; });
} finally { await browser.close(); }
writeFileSync(`${work}/maps.json`, JSON.stringify(maps));
writeFileSync(`${work}/failed.json`, JSON.stringify(failed));
