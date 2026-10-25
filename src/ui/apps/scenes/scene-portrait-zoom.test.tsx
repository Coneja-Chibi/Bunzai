/**
 * A message portrait enlarges on click (RoleCall's `cursor-zoom-in` + openScenePortrait): the click opens the Stage Gallery's lightbox on the
 * scene's frozen portrait with Download and Close but no "Use as background", it does not also reach the message's own click handler, and a
 * scene with no art keeps its plain initial with nothing to click.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import { artCache } from "../../_shared/art-cache";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { PortraitZoom, ZoomArt } from "./scene-portrait-zoom";

/** Reports every observed element as visible at once, so the art loads without layout. */
class SeeAll {
  constructor(private readonly cb: IntersectionObserverCallback) {}
  observe(target: Element): void { this.cb([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
  disconnect(): void { /* nothing held */ }
}

let dom: JSDOM;
let installed: InstalledDom;
let requested: string[];
const realFetch = globalThis.fetch;
const realCreate = URL.createObjectURL;
const realRevoke = URL.revokeObjectURL;

beforeAll(() => {
  installed = installDom('<!doctype html><html><head><meta name="vaude-session" content="tok"></head><body></body></html>', {
    url: "http://127.0.0.1:8323/",
    extraGlobals: ["SVGElement", "Event", "CustomEvent"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0), IntersectionObserver: SeeAll },
  });
  dom = installed.dom;
});
afterAll(async () => {
  // the dialog's focus work and the art cache's timers still run a tick after the last test; they must find the window
  await new Promise((r) => setTimeout(r, 60));
  await installed.teardown();
  globalThis.fetch = realFetch;
  URL.createObjectURL = realCreate;
  URL.revokeObjectURL = realRevoke;
});
beforeEach(() => {
  installed.reinstall();
  artCache.clear();
  requested = [];
  (globalThis as { fetch: unknown }).fetch = async (url: string, init?: { method?: string }) => {
    if (init?.method !== "HEAD") requested.push(url);
    return new Response(init?.method === "HEAD" ? null : new Uint8Array([1, 2, 3]), { headers: { "content-length": "3", "content-type": "image/png" } });
  };
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => "blob:x";
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
});

type FlushSync = typeof import("react-dom")["flushSync"];
let root: Root;
let host: HTMLElement;
const settle = async (flushSync: FlushSync, ms = 40): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); flushSync(() => undefined); };
const named = (text: string): HTMLButtonElement | undefined => [...dom.window.document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);

async function mount(node: React.ReactElement): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(node));
  await settle(flushSync);
  return flushSync;
}
const ctx = { pieces: { snapshot: () => undefined, isSeeded: () => false, getGeneration: () => 0 } } as unknown as AppContext;
const unmount = (flushSync: FlushSync): void => { flushSync(() => root.unmount()); host.remove(); };

describe("portrait click-to-zoom", () => {
  test("the click opens the gallery lightbox titled for the character, with Download and Close and no Use as background (whether the enlarged picture paints is not proven here: jsdom cannot decode the stub bytes)", async () => {
    const flushSync = await mount(<ZoomArt ctx={ctx} chatId="c1" characterId="k1" snapshotVersion={2} hasArt name="Vera" />);
    expect(dom.window.document.querySelector(".sgl")).toBeNull();
    await settle(flushSync, 100);
    expect(requested.some((u) => u.includes("/api/chats/portrait?id=c1&v=2"))).toBe(true);
    const zoom = host.querySelector<HTMLButtonElement>("button.pzoom")!;
    expect(zoom.getAttribute("aria-label")).toBe("View portrait of Vera");
    flushSync(() => zoom.click());
    await settle(flushSync);
    const sheet = dom.window.document.querySelector(".sgl")!;
    expect(sheet.querySelector("h2")?.textContent).toBe("Vera");
    expect(requested.some((u) => u.includes("/api/chats/portrait?id=c1&v=2"))).toBe(true);
    expect(named("Download")).toBeDefined();
    expect(named("Use as background")).toBeUndefined();
    flushSync(() => named("Close")!.click());
    await settle(flushSync);
    expect(dom.window.document.querySelector(".sgl")).toBeNull();
    unmount(flushSync);
  });

  test("the click and the buttons in the enlarged view do not reach the message's own click handler", async () => {
    let reached = 0;
    const flushSync = await mount(<div onClick={() => { reached++; }}><PortraitZoom chatId="c1" snapshotVersion={2} name="Vera"><img alt="" /></PortraitZoom></div>);
    flushSync(() => host.querySelector<HTMLButtonElement>("button.pzoom")!.click());
    await settle(flushSync);
    flushSync(() => named("Close")!.click());
    expect(reached).toBe(0);
    unmount(flushSync);
  });

  test("a scene without art keeps its initial and offers nothing to enlarge", async () => {
    const flushSync = await mount(<ZoomArt ctx={ctx} chatId="c1" characterId="k1" snapshotVersion={2} hasArt={false} name="vera" />);
    expect(host.querySelector("button.pzoom")).toBeNull();
    expect(host.querySelector(".ini")?.textContent).toBe("V");
    unmount(flushSync);
  });
});
