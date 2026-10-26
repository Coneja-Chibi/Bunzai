/**
 * A scene id that no longer exists must never strand the person on a bare error page: a 404 from
 * openScene hands them back to the Scenes list with a toast and forgets the remembered id, while a
 * transient failure keeps "Try again" - drawn with the shared Stamp button, not browser defaults.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { installDom, teardownAllDoms, type InstalledDom, flushTasks } from "../../_shared/test-dom";
import type { Root } from "react-dom/client";
import type { JSX } from "react";
import type { AppContext } from "../../app-contract";
import { ApiHttpError } from "../../_shared/api-fetch";
import { handedScene, handOffScene } from "../../_shared/scene-handoff";
import { PieceStore } from "../../_shared/piece-store";
import { CHAT_LAYOUT_KEY } from "./chat-layout";

afterAll(teardownAllDoms);

let dom: JSDOM;
let installed: InstalledDom;
let root: Root;
let host: HTMLElement;
let status: string[] = [];
let opens = 0;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8324/", extraGlobals: ["HTMLTextAreaElement", "SVGElement", "Event", "CustomEvent", "sessionStorage"] });
  dom = installed.dom;
});
beforeEach(() => {
  installed.reinstall();
  status = [];
  opens = 0;
  handOffScene(null);
});

const makeCtx = (openScene: () => Promise<never>): AppContext => ({
  api: {
    openScene: () => { opens++; return openScene(); },
    listScenes: async () => [], listSceneTrash: async () => [], listSceneFolders: async () => [],
    getSceneProps: async () => ({ on: [] }),
  },
  pieces: new PieceStore(), setStatus: (t: string) => status.push(t),
  prefs: { get: (key: string) => (key === CHAT_LAYOUT_KEY ? "stage" : null), set: () => undefined }, menus: { register: () => () => undefined, open: () => undefined }, openApp: () => undefined,
} as unknown as AppContext);

async function mount(ui: JSX.Element): Promise<void> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(ui));
  for (let i = 0; i < 3; i++) { await flushTasks(); flushSync(() => undefined); }
}
const unmount = async (): Promise<void> => { const { flushSync } = await import("react-dom"); flushSync(() => root.unmount()); host.remove(); };
const buttons = (): string[] => [...host.querySelectorAll("button")].map((b) => b.textContent ?? "");

describe("a scene that is not in this library", () => {
  test("Scenes app: a remembered id that 404s returns to the list with a toast and forgets the id", async () => {
    handOffScene("stale-id");
    const app = (await import("./index")).default;
    const Scenes = app.Component;
    await mount(<Scenes ctx={makeCtx(() => Promise.reject(new ApiHttpError(404, "that scene is gone")))} />);
    expect(status).toEqual(["That scene is not in this library."]);
    expect(handedScene()).toBeNull();
    expect(host.querySelector('[data-part="scenes.root"]')).not.toBeNull();
    expect(host.textContent).not.toContain("that scene is gone");
    await unmount();
  });

  test("ScenePage: a busy or network failure keeps Try again and Back, drawn with the button family, with no toast", async () => {
    const { ScenePage } = await import("./scene-page");
    let backs = 0;
    await mount(<ScenePage ctx={makeCtx(() => Promise.reject(new Error("network down")))} chatId="c1" onBack={() => { backs++; }} />);
    expect(buttons()).toEqual(["Try again", "Back to Scenes"]);
    expect([...host.querySelectorAll("button")].map((b) => b.dataset.control)).toEqual(["button", "button"]);
    expect(status).toEqual([]);
    expect(backs).toBe(0);
    expect(opens).toBe(1);
    (host.querySelector("button") as HTMLButtonElement).click();
    await flushTasks();
    expect(opens).toBe(2);
    await unmount();
  });
});

describe("a scene whose character was deleted (410 cast_missing)", () => {
  const gone = (): Promise<never> => Promise.reject(new ApiHttpError(410, "This scene's character was deleted, so it cannot open.", "cast_missing"));
  const withDelete = (ctx: AppContext, deleted: string[]): AppContext => {
    (ctx.api as unknown as Record<string, unknown>)["deleteScene"] = async (id: string) => { deleted.push(id); return { deleted: true }; };
    return ctx;
  };

  test("says why, offers Move to Trash and Back, never Try again, and does not refetch on a re-render", async () => {
    const { ScenePage } = await import("./scene-page");
    const deleted: string[] = [];
    let backs = 0;
    const ctx = withDelete(makeCtx(gone), deleted);
    const ui = (c: AppContext): JSX.Element => <ScenePage ctx={c} chatId="c1" onBack={() => { backs++; }} />;
    await mount(ui(ctx));
    expect(host.textContent).toContain("This scene's character was deleted, so it cannot open.");
    expect(buttons()).toEqual(["Move to Trash", "Back to Scenes"]);
    expect(status).toEqual([]);
    const { flushSync } = await import("react-dom");
    flushSync(() => root.render(ui({ ...ctx } as AppContext))); // the shell rebuilds ctx on every store change
    await flushTasks();
    expect(opens).toBe(1);
    (host.querySelector("button") as HTMLButtonElement).click();
    await flushTasks();
    expect(deleted).toEqual(["c1"]);
    expect(backs).toBe(1);
    expect(status).toEqual(["Moved to the Trash."]);
    await unmount();
  });

  test("the Scenes list preview does not ask for the tail of a scene marked unreadable, and a ctx rebuild never re-asks", async () => {
    const { SceneHero } = await import("./scenes-hero");
    let tails = 0;
    const base = makeCtx(gone);
    (base.api as unknown as Record<string, unknown>)["getSceneTail"] = async () => { tails++; throw new ApiHttpError(410, "x", "cast_missing"); };
    const summary = (castMissing: boolean) => ({ id: "c1", title: "Vera", characterName: "Vera", cast: { character: { id: "vera", version: 1 } }, snapshotVersion: 0, hasPortrait: false, takeCount: 1, activeTake: { name: "main", original: true }, messageCount: 1, updatedAt: 1, ...(castMissing ? { castMissing: true } : {}) });
    const ui = (c: AppContext, m: boolean): JSX.Element => <SceneHero ctx={c} scene={summary(m) as never} onOpen={() => undefined} />;
    await mount(ui(base, true));
    expect(tails).toBe(0);
    await unmount();
    await mount(ui(base, false));
    expect(tails).toBe(1);
    const { flushSync } = await import("react-dom");
    flushSync(() => root.render(ui({ ...base } as AppContext, false)));
    await flushTasks();
    expect(tails).toBe(1);
    await unmount();
  });
});
