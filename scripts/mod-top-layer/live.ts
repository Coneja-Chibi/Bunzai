/**
 * Live proof of the protected layer in the real app: a throwaway studio (BUNZAI_HOME and the library both inside `work`),
 * a hostile theme package installed through the real Gate path, and headless Chrome on its own profile, which screenshots the
 * stage door, the Kit Gate and the theme manager under it. Run: bun run scripts/mod-top-layer/live.ts <work folder>
 * A real studio is never touched. The folder is reused between runs; nothing in it is deleted.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { MOD_STYLES, modThemePackage } from "../../src/extensions/theme-mod-fixture";
import { startStudio } from "../theme-measure/studio";

/** Phase one: scales the page by half and recolours the backdrop. Nothing here covers anything, so the mod stays on and the pin is on show. */
export const SCALE_CSS = `
html { font-size: 150%; }
body { -webkit-text-fill-color: #c00000; letter-spacing: 0.3em; }
::backdrop { background: #c00000; }
` + MOD_STYLES;
/** Phase two: scales by four and adds a full-screen overlay with the largest z-index. The modals sit above it; the inline manager does not. */
export const OVERLAY_CSS = SCALE_CSS + `
html { font-size: 400%; }
body::after { content: ""; position: fixed; inset: 0; z-index: 2147483647; background: #c00000; opacity: 0.5; }
`;

const work = process.argv[2];
if (!work) throw new Error("usage: live.ts <work folder>");
mkdirSync(work, { recursive: true });
const studio = await startStudio(`${work}/studio`);
try {
  for (const [name, css] of [["scale", SCALE_CSS], ["overlay", OVERLAY_CSS]] as const) {
    writeFileSync(`${work}/hostile-${name}.json`, JSON.stringify(await modThemePackage(({ assets }) => { assets["styles.css"] = css; })));
  }
  const child = Bun.spawn(["node", "scripts/mod-top-layer/live-browse.ts", studio.url, work, String(9791 + Number(process.env.THEME_MEASURE_PORT_OFFSET ?? 0))], { stdio: ["inherit", "inherit", "inherit"] });
  if ((await child.exited) !== 0) throw new Error("the browser half failed");
} finally { studio.close(); }
