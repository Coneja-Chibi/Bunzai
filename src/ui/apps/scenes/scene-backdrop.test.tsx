/**
 * The scene backdrop as it mounts (ChatStore rule 36, wireframe design/wireframes/backdrops/index.html): the Stage wing's
 * Backdrop row says plainly what the scene has (none, a picture, gone), and the picker lists the pack's pictures with
 * None first and saves a pick through setSceneBackdrop at once.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import type { Chat, ChatBackdrop } from "../../../stage/contracts/chat-store";
import { ApiHttpError } from "../../_shared/api-fetch";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { BackdropLayer } from "./scene-backdrop-layer";
import { BackdropRow } from "./scene-backdrop-wing";

let dom: JSDOM;
let installed: InstalledDom;

class NoObserver { observe(): void { /* no layout in jsdom */ } disconnect(): void { /* nothing */ } }

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8323/",
    extraGlobals: ["SVGElement", "Event", "CustomEvent"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0), IntersectionObserver: NoObserver }
  });
  dom = installed.dom;
});
afterAll(() => installed.teardown());
beforeEach(() => { installed.reinstall(); saved = []; });

const sentinel = (n: number): string => `\u0000b:u:image/jpeg:${n.toString(16).padStart(64, "0")}`;
const packEntity = { schemaVersion: "1", kind: "pack", id: "st", body: { name: "Backdrops", pack: { items: [{ id: "a", label: "Harbor", ref: sentinel(1) }, { id: "b", label: "Tavern", ref: sentinel(2) }] } } };
const chatOf = (backdrop?: ChatBackdrop): Chat => ({ id: "c1", ...(backdrop ? { backdrop } : {}) } as unknown as Chat);

let saved: (ChatBackdrop | null)[] = [];

function makeCtx(opts: { packs?: { id: string; name: string }[]; entity?: () => Promise<unknown> } = {}): AppContext {
  return {
    api: {
      listEntities: async () => opts.packs ?? [{ id: "st", name: "Backdrops" }],
      getLightEditableEntity: opts.entity ?? (async () => ({ entity: packEntity, revision: "r1" })),
      setSceneBackdrop: async (_id: string, backdrop: ChatBackdrop | null) => { saved.push(backdrop); return chatOf(backdrop ?? undefined); },
    },
  } as unknown as AppContext;
}

let root: Root;
let host: HTMLElement;
type FlushSync = typeof import("react-dom")["flushSync"];
const settle = async (flushSync: FlushSync, ms = 30): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); flushSync(() => undefined); };
const all = (): HTMLButtonElement[] => [...dom.window.document.querySelectorAll("button")];
const named = (text: string): HTMLButtonElement | undefined => all().find((b) => b.textContent?.trim() === text);

async function mount(ctx: AppContext, chat: Chat): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(<BackdropRow ctx={ctx} chat={chat} onChat={() => undefined} />));
  await settle(flushSync);
  return flushSync;
}
const unmount = (flushSync: FlushSync): void => { flushSync(() => root.unmount()); host.remove(); };

describe("the Stage wing's Backdrop row", () => {
  test("a scene with none says so, and offers Pick", async () => {
    const flushSync = await mount(makeCtx(), chatOf());
    expect(host.textContent).toContain("None keeps the theme's own look.");
    expect(named("Pick")).toBeDefined();
    unmount(flushSync);
  });

  test("a scene whose pack is gone says the theme's own look shows, and offers Change", async () => {
    const gone = makeCtx({ entity: async () => { throw new ApiHttpError(404, "not found"); } });
    const flushSync = await mount(gone, chatOf({ pack: "st", item: "a" }));
    expect(host.textContent).toContain("no longer in your collection");
    expect(named("Change")).toBeDefined();
    unmount(flushSync);
  });

  test("a scene whose item is gone from a pack that is there says the same", async () => {
    const flushSync = await mount(makeCtx(), chatOf({ pack: "st", item: "zzz" }));
    expect(host.textContent).toContain("no longer in your collection");
    unmount(flushSync);
  });

  test("a scene with a picture names it", async () => {
    const flushSync = await mount(makeCtx(), chatOf({ pack: "st", item: "b" }));
    expect(host.textContent).toContain("Tavern");
    unmount(flushSync);
  });
});

describe("the picker", () => {
  test("lists None first and the pack's pictures, and a pick is saved at once with its pack and item", async () => {
    const flushSync = await mount(makeCtx(), chatOf());
    flushSync(() => named("Pick")!.click());
    await settle(flushSync);
    const tiles = [...dom.window.document.querySelectorAll('[role="option"]')];
    expect(tiles.map((t) => t.textContent?.trim())).toEqual(["None", "Harbor", "Tavern"]);
    flushSync(() => (tiles[2] as HTMLElement).click());
    await settle(flushSync);
    expect(saved).toEqual([{ pack: "st", item: "b" }]);
    unmount(flushSync);
  });

  test("None forgets the pick", async () => {
    const flushSync = await mount(makeCtx(), chatOf({ pack: "st", item: "a" }));
    flushSync(() => named("Change")!.click());
    await settle(flushSync);
    flushSync(() => (dom.window.document.querySelector('[role="option"]') as HTMLElement).click());
    await settle(flushSync);
    expect(saved).toEqual([null]);
    unmount(flushSync);
  });

  test("with no pack in the library it says so instead of showing an empty grid", async () => {
    const flushSync = await mount(makeCtx({ packs: [] }), chatOf());
    flushSync(() => named("Pick")!.click());
    await settle(flushSync);
    expect(dom.window.document.body.textContent).toContain("Nothing in your collection to pick from.");
    expect(dom.window.document.querySelector('[role="option"]')).toBeNull();
    unmount(flushSync);
  });
});

describe("the picture behind the messages", () => {
  async function layer(ctx: AppContext, backdrop: ChatBackdrop | undefined): Promise<{ flushSync: FlushSync; html: string }> {
    const { flushSync } = await import("react-dom");
    const { createRoot } = await import("react-dom/client");
    host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    root = createRoot(host);
    flushSync(() => root.render(<BackdropLayer ctx={ctx} backdrop={backdrop} />));
    await settle(flushSync);
    return { flushSync, html: host.innerHTML };
  }

  test("a picked picture is drawn under an overlay of the theme's own well color at the default dim, or the scene's own", async () => {
    const a = await layer(makeCtx(), { pack: "st", item: "a" });
    expect(host.querySelector(".bdp img")).not.toBeNull();
    expect((host.querySelector(".veil") as HTMLElement).style.background).toContain("var(--stage-well) 60%");
    unmount(a.flushSync);
    const b = await layer(makeCtx(), { pack: "st", item: "a", dim: 0.25 });
    expect((host.querySelector(".veil") as HTMLElement).style.background).toContain("var(--stage-well) 25%");
    unmount(b.flushSync);
  });

  test("none, a gone pack and a gone item draw nothing, so the theme's own backdrop shows through", async () => {
    for (const [ctx, backdrop] of [
      [makeCtx(), undefined],
      [makeCtx({ entity: async () => { throw new ApiHttpError(404, "not found"); } }), { pack: "st", item: "a" }],
      [makeCtx(), { pack: "st", item: "zzz" }],
    ] as const) {
      const { flushSync, html } = await layer(ctx, backdrop);
      expect(html).toBe("");
      unmount(flushSync);
    }
  });
});

describe("a character's pinned background and a video backdrop", () => {
  const NUL = String.fromCharCode(0);
  const sha = "c".repeat(64);
  const videoPack = { ...packEntity, body: { name: "Clips", pack: { items: [{ id: "v", label: "Rain", ref: `${NUL}b:u:video/mp4:${sha}`, mime: "video/mp4" }] } } };

  async function layer(ctx: AppContext, backdrop: ChatBackdrop | undefined, character?: { ref: string; dim: number; rate?: number; video?: boolean }): Promise<FlushSync> {
    const { flushSync } = await import("react-dom");
    const { createRoot } = await import("react-dom/client");
    host = dom.window.document.createElement("div");
    dom.window.document.body.appendChild(host);
    root = createRoot(host);
    flushSync(() => root.render(<BackdropLayer ctx={ctx} backdrop={backdrop} character={character ?? null} />));
    await settle(flushSync);
    return flushSync;
  }

  test("a scene with no pick of its own shows the card's pinned background at the card's overlay; its own pick wins", async () => {
    const a = await layer(makeCtx(), undefined, { ref: sentinel(7), dim: 0.25 });
    expect((host.querySelector(".veil") as HTMLElement).style.background).toContain("var(--stage-well) 25%");
    unmount(a);
    const b = await layer(makeCtx(), { pack: "st", item: "a", dim: 0.8 }, { ref: sentinel(7), dim: 0.25 });
    expect((host.querySelector(".veil") as HTMLElement).style.background).toContain("var(--stage-well) 80%");
    unmount(b);
  });

  test("a video item plays from the asset route on the page's own origin, muted and looping, at the scene's rate", async () => {
    const ctx = makeCtx({ entity: async () => ({ entity: videoPack, revision: "r1" }) });
    const f = await layer(ctx, { pack: "st", item: "v", rate: 1.5 });
    const video = host.querySelector("video") as HTMLVideoElement;
    expect(video.getAttribute("src")).toBe(`/api/asset/${sha}`);
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.playbackRate).toBe(1.5);
    expect(host.querySelector("img")).toBeNull();
    unmount(f);
  });
});
