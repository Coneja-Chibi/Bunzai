/** A sound in a pack's tile is a note glyph, never a broken picture. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { SpritePreview } from "./presentation";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8331/", extraGlobals: ["SVGElement", "Event", "HTMLElement"], globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0), IntersectionObserver: class { observe(): void { /* no layout in jsdom */ } disconnect(): void { /* nothing */ } } } });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

async function draw(refValue: string): Promise<HTMLElement> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  flushSync(() => createRoot(host).render(<SpritePreview refValue={refValue} alt="Tavern" />));
  return host;
}

test("a stored sound and an inline sound draw a labelled glyph and no <img>", async () => {
  for (const ref of [`\u0000b:u:audio/mpeg:${"a".repeat(64)}`, "data:audio/mpeg;base64,AAAA"]) {
    const host = await draw(ref);
    expect(host.querySelector("img")).toBeNull();
    expect(host.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("Tavern");
  }
});

test("a picture still draws an <img>", async () => {
  expect((await draw(`\u0000b:u:image/png:${"b".repeat(64)}`)).querySelector("img")).not.toBeNull();
});
