/** Website entrance checks: scoped assets, motion preference, playback, and every route back to the page. */
import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { runCurtainIntro } from "./curtain";
import { sitePages } from "./pages";

function fixture(reduced = false, blocked = false) {
  const html = `<body><div data-curtain-intro hidden><video><source data-src="media/curtain-opening.webm"><source data-src="media/curtain-opening.mp4"></video><button data-curtain-skip>Skip intro</button></div><main tabindex="-1">Prototype</main></body>`;
  const dom = new JSDOM(html, { url: "https://example.test/Bunzai/" });
  const win = dom.window;
  const doc = win.document;
  const root = doc.querySelector<HTMLElement>("[data-curtain-intro]")!;
  const video = root.querySelector("video")!;
  const motion = new win.EventTarget();
  Object.assign(motion, { matches: reduced });
  Object.defineProperty(win, "matchMedia", { value: () => motion });
  let deadline: (() => void) | undefined, loads = 0, plays = 0, pauses = 0;
  Object.defineProperty(win, "setTimeout", { value: (callback: () => void) => { deadline = callback; return 1; } });
  Object.defineProperty(win, "clearTimeout", { value: () => {} });
  video.load = () => { loads++; };
  video.pause = () => { pauses++; };
  video.play = () => { plays++; return blocked ? Promise.reject(new Error("Autoplay blocked")) : Promise.resolve(); };
  return { dom, win, doc, root, video, motion, expire: () => deadline?.(), counts: () => ({ loads, plays, pauses }) };
}

test("the public auditorium waits for a click instead of loading the prototype curtain film", () => {
  const home = sitePages([])[0]!.html;
  expect(home).not.toContain('data-curtain-intro');
  expect(home).toContain('data-screening-open');
});

test("reduced motion and a completed tab visit leave content accessible without loading video", () => {
  for (const reduced of [true, false]) {
    const f = fixture(reduced);
    if (!reduced) f.win.sessionStorage.setItem("bunzai:curtain-intro", "seen");
    runCurtainIntro(f.doc);
    expect(f.root.hidden).toBe(true);
    expect(f.counts().loads).toBe(0);
    expect(f.doc.querySelector("main")!.inert).not.toBe(true);
    f.dom.window.close();
  }
});

test("video progress drives zoom and reveal; completion restores page access and focus", () => {
  const f = fixture();
  const cleanup = runCurtainIntro(f.doc);
  expect(f.root.hidden).toBe(false);
  expect(f.doc.querySelector("main")!.inert).toBe(true);
  expect(f.video.muted).toBe(true);
  expect(f.counts().plays).toBe(1);
  f.video.currentTime = 3.8;
  f.video.dispatchEvent(new f.win.Event("timeupdate"));
  expect(f.root.classList.contains("zooming")).toBe(true);
  f.video.currentTime = 5.4;
  f.video.dispatchEvent(new f.win.Event("timeupdate"));
  expect(f.root.classList.contains("revealing")).toBe(true);
  f.video.dispatchEvent(new f.win.Event("ended"));
  expect(f.root.hidden).toBe(true);
  expect(f.doc.querySelector("main")!.inert).not.toBe(true);
  expect(f.doc.activeElement?.tagName).toBe("MAIN");
  expect(f.doc.querySelector("source")!.hasAttribute("src")).toBe(false);
  expect(f.win.sessionStorage.getItem("bunzai:curtain-intro")).toBe("seen");
  cleanup();
  expect(f.counts().pauses).toBe(1);
  f.dom.window.close();
});

test("skip, Escape, media error, timeout, and a changed motion preference all release the page", () => {
  for (const exit of ["skip", "escape", "error", "timeout", "motion"]) {
    const f = fixture();
    runCurtainIntro(f.doc);
    if (exit === "skip") f.root.querySelector<HTMLButtonElement>("button")!.click();
    if (exit === "escape") f.doc.dispatchEvent(new f.win.KeyboardEvent("keydown", { key: "Escape" }));
    if (exit === "error") f.video.dispatchEvent(new f.win.Event("error"));
    if (exit === "timeout") f.expire();
    if (exit === "motion") f.motion.dispatchEvent(new f.win.Event("change"));
    expect(f.root.hidden).toBe(true);
    expect(f.doc.documentElement.classList.contains("curtain-active")).toBe(false);
    expect(f.doc.querySelector("main")!.inert).not.toBe(true);
    f.dom.window.close();
  }
});

test("autoplay rejection cannot strand the visitor behind the curtains", async () => {
  const f = fixture(false, true);
  runCurtainIntro(f.doc);
  await Promise.resolve();
  expect(f.root.hidden).toBe(true);
  expect(f.doc.querySelector("main")!.inert).not.toBe(true);
  f.dom.window.close();
});
