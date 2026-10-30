/**
 * The Stage Gallery as it mounts: it lists the scene's art with the right count, asks for 256 thumbnails and never the full picture,
 * mounts only the rows in view, never lists a link, and Use as background sets the scene backdrop (or says why it could not).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import type { Chat, ChatBackdrop } from "../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../studio/scenes";
import { artCache } from "../../_shared/art-cache";
import { installDom, waitFor, type InstalledDom } from "../../_shared/test-dom";
import { StageGallery } from "./stage-gallery";

let dom: JSDOM;
let installed: InstalledDom;

/** Reports every observed element as visible at once, so thumbnails load without layout. */
class SeeAll {
  constructor(private readonly cb: IntersectionObserverCallback) {}
  observe(target: Element): void { this.cb([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
  disconnect(): void { /* nothing held */ }
}

class NoResize { observe(): void { /* no layout in jsdom */ } unobserve(): void { /* nothing */ } disconnect(): void { /* nothing */ } }

let requested: string[];
/** The process-wide originals this file stubs, put back after it so later files (the worker lane's blob workers) get the real ones. */
const realFetch = globalThis.fetch;
const realCreate = URL.createObjectURL;
const realRevoke = URL.revokeObjectURL;

beforeAll(() => {
  installed = installDom('<!doctype html><html><head><meta name="vaude-session" content="tok"></head><body></body></html>', {
    url: "http://127.0.0.1:8323/",
    extraGlobals: ["SVGElement", "Event", "CustomEvent"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0), IntersectionObserver: SeeAll, ResizeObserver: NoResize },
  });
  dom = installed.dom;
  // jsdom has no layout: give the scroller a real viewport and each row a height, as every virtualized-list test here does.
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetWidth", { configurable: true, get(this: HTMLElement) { return this.className.includes("sg-scroll") ? 400 : 200; } });
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetHeight", { configurable: true, get(this: HTMLElement) { return this.className.includes("sg-scroll") ? 600 : 200; } });
});
afterAll(async () => {
  await installed.teardown();
  globalThis.fetch = realFetch;
  URL.createObjectURL = realCreate;
  URL.revokeObjectURL = realRevoke;
});
beforeEach(() => {
  installed.reinstall();
  artCache.clear();
  requested = []; backdrops = []; chats = []; patches = 0;
  (globalThis as { fetch: unknown }).fetch = async (url: string, init?: { method?: string }) => {
    if (init?.method !== "HEAD") requested.push(url);
    return new Response(init?.method === "HEAD" ? null : new Uint8Array([1, 2, 3]), { headers: { "content-length": "3", "content-type": "image/png" } });
  };
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => "blob:x";
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
});

const sha = (n: number): string => n.toString(16).padStart(64, "0");
const ref = (n: number): string => `\u0000b:u:image/png:${sha(n)}`;
const pack = (count: number): unknown => ({ schemaVersion: "1", kind: "pack", id: "st", body: { name: "Backdrops", pack: { items: Array.from({ length: count }, (_, i) => ({ id: `i${String(i)}`, label: `Pic ${String(i)}`, ref: ref(100 + i) })) } } });
const card = (assets: { role: string; label?: string; ref: string }[]): unknown => ({ schemaVersion: "1", kind: "character", id: "k1", body: { media: { assets } } });
const persona = { schemaVersion: "1", kind: "persona", id: "p1", body: { name: "Rhea", media: { portrait: { role: "portrait", ref: ref(7) } } } };

let backdrops: (ChatBackdrop | null)[];
let chats: Chat[];
let patches: number;

function makeCtx(opts: { pack?: unknown; card?: unknown; persona?: unknown; packs?: { id: string; name: string }[]; patchFails?: boolean } = {}): AppContext {
  const entities: Record<string, unknown> = { pack: opts.pack ?? pack(2), character: opts.card ?? card([]), persona: "persona" in opts ? opts.persona : persona };
  return {
    api: {
      listEntities: async () => opts.packs ?? [{ id: "st", name: "Backdrops" }],
      getLightEditableEntity: async (query: string) => ({ entity: entities[/kind=(\w+)/.exec(query)![1]!], revision: "r1" }),
      uploadAsset: async () => ({ sha: sha(9), mime: "image/png", bytes: 3, ref: "g-up", asset: ref(9) }),
      discardAssetUploads: async () => undefined,
      patchEditedEntity: async () => { patches++; if (opts.patchFails) throw new Error("disk full"); return { summary: {}, revision: "r2" }; },
      setSceneBackdrop: async (_id: string, b: ChatBackdrop | null) => { backdrops.push(b); return { id: "c1", ...(b ? { backdrop: b } : {}) } as unknown as Chat; },
    },
  } as unknown as AppContext;
}

const chat = { id: "c1", snapshotVersion: 2, cast: { character: { id: "k1", version: 1 }, persona: { id: "p1", version: 1 } } } as unknown as Chat;
const sceneOf = (hasPortrait: boolean): OpenScene => ({ hasPortrait, snapshot: { character: { body: { identity: { name: "Vera" } } } } }) as unknown as OpenScene;

let root: Root | null = null;
let host: HTMLElement;
type FlushSync = typeof import("react-dom")["flushSync"];
const settle = async (flushSync: FlushSync, ms = 40): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); flushSync(() => undefined); };
const tiles = (): HTMLElement[] => [...dom.window.document.querySelectorAll<HTMLElement>("[data-control='tile']")];
const named = (text: string): HTMLButtonElement | undefined => [...dom.window.document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);

async function mount(ctx: AppContext, scene = sceneOf(false)): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(<StageGallery ctx={ctx} chat={chat} scene={scene} onChat={(c) => chats.push(c)} />));
  await settle(flushSync);
  return flushSync;
}
const unmount = (flushSync: FlushSync): void => {
  const mounted = root;
  root = null;
  if (mounted) flushSync(() => mounted.unmount());
  host?.remove();
};
afterEach(async () => { unmount((await import("react-dom")).flushSync); });

describe("the Gallery lists the scene's art", () => {
  test("the portrait, the card's extra art, the persona and the pack, counted as images", async () => {
    const flushSync = await mount(makeCtx({ card: card([{ role: "outfit", label: "Gala", ref: ref(1) }, { role: "pose", label: "Bow", ref: ref(2) }]) }), sceneOf(true));
    expect(tiles()).toHaveLength(1 + 2 + 1 + 2);
    expect(host.textContent).toContain("6 images in this scene");
    unmount(flushSync);
  });

  test("the Cast and Pack tabs split the cast's art from the pack's", async () => {
    const flushSync = await mount(makeCtx());
    flushSync(() => named("Pack")!.click());
    expect(tiles().map((t) => t.getAttribute("title"))).toEqual(["Pack: Pic 0", "Pack: Pic 1"]);
    flushSync(() => named("Cast")!.click());
    expect(tiles().map((t) => t.getAttribute("title"))).toEqual(["Persona: Rhea"]);
    unmount(flushSync);
  });

  test("a link is never listed", async () => {
    const flushSync = await mount(makeCtx({ card: card([{ role: "pose", label: "Hot", ref: "https://example.com/a.png" }]) }));
    expect(tiles().map((t) => t.getAttribute("title"))).not.toContain("Card: Hot");
    unmount(flushSync);
  });

  test("a scene with no art says so instead of drawing an empty grid", async () => {
    const flushSync = await mount(makeCtx({ pack: pack(0), persona: null }));
    expect(host.textContent).toContain("No images in this scene yet");
    expect(tiles()).toHaveLength(0);
    unmount(flushSync);
  });
});

describe("thumbnails and windowing", () => {
  test("every tile asks for a 256 thumbnail and none asks for the full picture", async () => {
    const flushSync = await mount(makeCtx());
    await settle(flushSync, 80);
    const assets = requested.filter((u) => u.startsWith("/api/asset/"));
    expect(assets.length).toBeGreaterThan(0);
    expect(assets.every((u) => u.endsWith("?size=256"))).toBe(true);
    unmount(flushSync);
  });

  test("a big pack mounts only the rows in view", async () => {
    const ctx = makeCtx({ pack: pack(600) });
    const read = ctx.api.getLightEditableEntity;
    let release!: () => void;
    const loading = new Promise<void>((resolve) => { release = resolve; });
    ctx.api.getLightEditableEntity = async (query) => {
      if (query.includes("kind=pack")) await loading;
      return read(query);
    };
    const flushSync = await mount(ctx);
    release();
    await waitFor(flushSync, () => host.textContent?.includes("601 images in this scene"), "the loaded 600-picture gallery pack");
    expect(host.textContent).toContain("601 images in this scene");
    expect(tiles().length).toBeGreaterThan(0);
    expect(tiles().length).toBeLessThan(60);
    unmount(flushSync);
  });
});

describe("Use as background", () => {
  test("a pack picture opens, and Use as background sets the scene backdrop once and closes", async () => {
    const flushSync = await mount(makeCtx());
    flushSync(() => named("Pack")!.click());
    flushSync(() => tiles()[1]!.click());
    await settle(flushSync);
    flushSync(() => named("Use as background")!.click());
    await settle(flushSync);
    expect(backdrops).toEqual([{ pack: "st", item: "i1" }]);
    expect(chats).toHaveLength(1);
    expect(dom.window.document.querySelector(".sgl")).toBeNull();
    unmount(flushSync);
  });

  test("a cast picture that cannot be copied into the pack leaves the backdrop alone and says so", async () => {
    const inline = { role: "outfit", label: "Gala", ref: "data:image/png;base64,AAEC" };
    const flushSync = await mount(makeCtx({ card: card([inline]), patchFails: true }));
    flushSync(() => tiles().find((t) => t.getAttribute("title") === "Card: Gala")!.click());
    await settle(flushSync);
    flushSync(() => named("Use as background")!.click());
    await settle(flushSync, 80);
    expect(patches).toBe(1);
    expect(backdrops).toEqual([]);
    expect(host.textContent).toContain("Could not add");
    unmount(flushSync);
  });
});
