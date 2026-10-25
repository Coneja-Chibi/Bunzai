/**
 * Headless Chrome and the step runner. Chrome is launched with its own profile folder under `work`; each screen
 * is a list of steps (screens.ts) run from a fresh page, then one 1400x900 screenshot. A screen whose `expect`
 * text is missing is reported as unreachable instead of being measured as a blank page.
 */
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { NEUTRALIZE } from "./neutralize.ts";
import type { ControlName, ThemeName } from "./metric.ts";
import type { Screen, Step } from "./screens.ts";

const CHROME = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** No animation or caret in a capture, so two shots of one screen differ only by what the theme draws. */
const FREEZE = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}" + NEUTRALIZE;

/** The theme id the settings store takes, and how the harness gets each bundled theme installed. */
export const THEME_IDS: Record<ThemeName, string> = { theater: "theater", paper: "paper", girliepop: "stage", encore: "bunraku.theme.encore" };

export interface Browser { context: BrowserContext; page: Page; close: () => Promise<void> }

export async function launch(work: string, port = 9491 + Number(process.env.THEME_MEASURE_PORT_OFFSET ?? 0)): Promise<Browser> {
  if (!CHROME) throw new Error("theme:measure needs Chrome: install it or set CHROME_PATH");
  // Chrome is started by hand and attached over CDP: Playwright's own pipe launch hangs under Bun on Windows.
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${work}/chrome`, "--no-first-run", "--hide-scrollbars", "--window-size=1400,900", "about:blank"], { stdio: "ignore" });
  await sleep(2500);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  await context.addInitScript(`document.addEventListener("DOMContentLoaded",()=>{const s=document.createElement("style");s.textContent=${JSON.stringify(FREEZE)};document.head.append(s)})`);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 200)));
  return { context, page, close: async () => { await browser.close().catch(() => {}); chrome.kill(); } };
}

const api = (page: Page, method: string, path: string, body?: unknown) => page.evaluate(async ([method, path, body]) => {
  const token = document.querySelector('meta[name="vaude-session"]')?.getAttribute("content") ?? "";
  const res = await fetch(path as string, { method: method as string, headers: { "content-type": "application/json", "X-Bunraku-Token": token }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) as unknown };
}, [method, path, body] as const);

/** The settings as the theme left them: every screen starts from this, so prefs one screen sets (view modes, open pieces) never leak into the next. */
let baseline: unknown;

/**
 * A negative control: Theater's own picks, with Paper's tokens of one kind forced over it. Layout, shape and everything
 * else stay Theater's, so any score it gets comes from that one kind of token alone.
 * control: only colour-valued tokens move (a recolour). fontcontrol: only the four font-family tokens move (a font swap);
 * the type scale stays Theater's, so this is faces alone, which is what a font swap does to wrapping and line breaks.
 * Forced over Theater rather than built as a third-party theme so the picks stay fixed; the forced tokens are the same ones either way.
 */
export async function paintPaperTokens(page: Page, url: string, which: ControlName): Promise<void> {
  await useTheme(page, url, THEME_IDS.paper);
  const css = await page.evaluate((kind) => {
    const root = document.documentElement.style;
    const colour = /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|color-mix\()/i;
    const takes = (n: string, v: string) => kind === "control" ? colour.test(v) : /^--bk-font-(display|name|body|mono)$/.test(n);
    return [...root].filter((n) => n.startsWith("--") && takes(n, root.getPropertyValue(n).trim())).map((n) => n + ":" + root.getPropertyValue(n) + " !important").join(";");
  }, which);
  await useTheme(page, url, THEME_IDS.theater);
  await page.context().addInitScript(`document.addEventListener("DOMContentLoaded",()=>{const s=document.createElement("style");s.textContent=":root{"+${JSON.stringify(css)}+"}";document.head.append(s)})`);
}

/** Install (when not bundled) and select a theme; the page is left freshly loaded on it. */
export async function useTheme(page: Page, url: string, id: string): Promise<void> {
  await page.unrouteAll();
  await page.goto(url);
  await sleep(1200);
  let offer: { json: { challenge?: string; preview?: { digest: string } } | null } | undefined;
  if (id.includes("encore")) offer = await api(page, "POST", `/api/themes/examples/${id}/inspect`, {}) as typeof offer;
  if (offer?.json?.challenge) {
    const done = await api(page, "POST", "/api/themes/install", { challenge: offer.json.challenge, digest: offer.json.preview!.digest, decision: "approve" });
    if (done.status !== 200) throw new Error(`theme ${id} did not install: ${done.status}`);
  } else if (offer) throw new Error(`theme ${id} was not offered for install: ${JSON.stringify(offer.json).slice(0, 300)}`);
  const set = await api(page, "PATCH", "/api/settings", { setupComplete: true, theme: id });
  if (set.status !== 200) throw new Error(`theme ${id} was not selected: ${set.status}`);
  await page.goto(url);
  await sleep(2500);
  baseline = (await api(page, "GET", "/api/settings")).json;
}

async function skipTour(page: Page): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const skip = page.getByText(/^skip$/i);
    if (!(await skip.count())) return;
    await skip.first().click({ timeout: 2000 }).catch(() => {});
    await sleep(350);
  }
}

async function run(page: Page, url: string, step: Step): Promise<void> {
  if ("go" in step) {
    await page.goto(step.go.startsWith("#") ? `${url}${step.go}` : `${url.replace(/\/$/, "")}${step.go}`);
    await page.reload();
    await sleep(step.settle ?? 2800);
    await skipTour(page);
  } else if ("click" in step) {
    // optional: a theme whose editor frame has no such tab (long-form shows every section) just stays as it is
    const clicked = await page.locator(step.click).first().click({ timeout: step.optional ? 1500 : 6000 }).then(() => true, (e) => { if (step.optional) return false; throw e; });
    if (clicked) await sleep(step.settle ?? 700);
  }
  else if ("fill" in step) await page.locator(step.fill[0]).first().fill(step.fill[1], { timeout: 6000 });
  else if ("key" in step) { await page.keyboard.press(step.key); await sleep(600); }
  else if ("wait" in step) await sleep(step.wait);
  else if ("upload" in step) {
    const [sel, name, text] = step.upload;
    const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 6000 }), page.locator(sel).first().click()]);
    await chooser.setFiles({ name, mimeType: "application/json", buffer: Buffer.from(text) });
    await sleep(2500);
  }
  else if ("eval" in step) await page.evaluate(step.eval);
  else if ("api" in step) await api(page, step.api[0], step.api[1], step.api[2]);
  else if ("mock" in step) { const [path, body] = step.mock; await page.route(`**${path}`, (route) => route.fulfill({ json: body })); }
  else if ("clearSession" in step) await page.evaluate(() => sessionStorage.clear());
  else if ("park" in step) { await page.mouse.move(700, 880); await sleep(600); }
  else if ("tour" in step) await skipTour(page);
}

/** `png` is the whole window; `content` is a fixed 1100x700 window at the top left of #canvas (the app area), so the shell chrome that every theme redraws drops out. */
export interface Capture { ok: boolean; why?: string; png?: Buffer; content?: Buffer }

/** A screen is on screen when its expect regex is in the page text, or, written as css:<selector>, that selector matches. */
async function arrived(page: Page, expect: string): Promise<boolean> {
  if (expect.startsWith("css:")) return (await page.locator(expect.slice(4)).count()) > 0;
  return new RegExp(expect, "i").test((await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " "));
}

/** Run one screen's steps and screenshot it; never throws, so one broken reach cannot stop the run. A failed reach still returns its shot for debugging. */
export async function capture(page: Page, url: string, screen: Screen): Promise<Capture> {
  let why: string | undefined;
  try {
    await page.unrouteAll();
    await page.goto("about:blank");
    await page.goto(url);
    await sleep(500);
    await api(page, "POST", "/api/settings", baseline);
    await page.evaluate(() => sessionStorage.clear());
    for (const step of screen.steps) await run(page, url, step);
    await sleep(500);
    if (!(await arrived(page, screen.expect))) why = `missing ${screen.expect}`;
  } catch (e) {
    why = String(e).split("\n")[0]!.slice(0, 160);
  }
  const png = await page.screenshot({ type: "png" }).catch(() => undefined);
  const box = await page.locator("#canvas").boundingBox().catch(() => null);
  const content = box && box.width >= 1100 && box.height >= 700 ? await page.screenshot({ type: "png", clip: { x: box.x, y: box.y, width: 1100, height: 700 } }).catch(() => undefined) : undefined;
  return { ok: why === undefined, ...(why ? { why } : {}), ...(png ? { png } : {}), ...(content ? { content } : {}) };
}

/** Decode PNGs in a blank page and return each one's edge map, so no image library is needed. */
export async function edgeMaps(page: Page, pngs: Buffer[], fn: string, ow: number, oh: number): Promise<number[][]> {
  await page.unrouteAll();
  await page.goto("about:blank");
  const out: number[][] = [];
  for (const png of pngs) {
    out.push(await page.evaluate(async ([b64, src, ow, oh]) => {
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("png decode")); img.src = `data:image/png;base64,${b64}`; });
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const g = canvas.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, img.width, img.height).data;
      return (new Function(`return ${src}`)() as (d: ArrayLike<number>, w: number, h: number, ow: number, oh: number) => number[])(data, img.width, img.height, ow as number, oh as number);
    }, [png.toString("base64"), fn, ow, oh] as const));
  }
  return out;
}

