/** The Music and Spotify tabs in the real Stage wing: shown only while their Prop is on, and a mini player's chevron opens the wing on its tab, once. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { useState, type JSX } from "react";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import type { AppContext } from "../../app-contract";
import type { OpenScene } from "../../../studio/scenes";
import { FakeAudio } from "./fake-audio";
import { openStageTab } from "./stage-open";
import { useStageOpen } from "./use-stage-open";
import { WingPanel } from "./scene-wings";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8334/",
    extraGlobals: ["MouseEvent", "Event", "CustomEvent", "SVGElement", "HTMLElement", "HTMLInputElement"],
    globals: {
      Audio: FakeAudio,
      fetch: async (input: RequestInfo | URL) => Response.json(String(input).endsWith("/status") ? { connected: false } : {}),
      requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0),
      IntersectionObserver: class { observe(): void { /* no layout */ } disconnect(): void { /* nothing */ } },
    },
  });
  dom = installed.dom;
});
afterAll(() => installed.teardown());
beforeEach(() => installed.reinstall());

const scene = { chat: { id: "c1" } } as unknown as OpenScene;
const ctx = { prefs: { get: () => undefined, set: () => undefined }, api: { listEntities: async () => [], getLightEditableEntity: async () => ({}) } } as unknown as AppContext;

let root: Root | null = null;
afterEach(async () => {
  const { flushSync } = await import("react-dom");
  if (root) flushSync(() => root!.unmount());
  root = null;
});
const wait = (ms = 25): Promise<void> => new Promise((r) => setTimeout(r, ms));
const tabs = (): string[] => [...dom.window.document.querySelectorAll('[role="tab"] b')].map((b) => b.textContent ?? "");
const selected = (): string => dom.window.document.querySelector('[role="tab"][aria-selected="true"]')?.textContent ?? "";

async function mount(node: JSX.Element): Promise<void> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const el = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(el);
  root = createRoot(el);
  flushSync(() => root!.render(node));
  await wait();
}
const stage = (propsOn: string[] | null, request?: { tab: "music" | "spotify"; n: number }): JSX.Element => (
  <WingPanel id="stage" stage={{ prefs: { get: () => undefined }, onSet: () => undefined, host: { ctx, scene, propsOn, onChat: () => undefined, ...(request ? { request } : {}) } }} />
);

describe("which tabs show", () => {
  test("neither Music nor Spotify without its Prop, and not before the Props switch has loaded", async () => {
    await mount(stage([]));
    expect(tabs()).toEqual(["Appearance", "Gallery", "Wardrobe"]);
    const { flushSync } = await import("react-dom");
    flushSync(() => root!.render(stage(null)));
    expect(tabs()).toEqual(["Appearance", "Gallery", "Wardrobe"]);
  });

  test("Mood Music on adds Music, Spotify on adds Spotify, in RoleCall's order", async () => {
    await mount(stage(["spotify", "mood-music"]));
    expect(tabs()).toEqual(["Appearance", "Gallery", "Music", "Spotify", "Wardrobe"]);
  });

  test("Show Music tab off (RoleCall's showMoodMusicTab) hides the Music tab while the Prop stays on", async () => {
    const hidden = { ...ctx, prefs: { get: (k: string) => (k === "scenes.stage.musicTab" ? false : undefined), set: () => undefined } } as unknown as AppContext;
    await mount(<WingPanel id="stage" stage={{ prefs: { get: () => undefined }, onSet: () => undefined, host: { ctx: hidden, scene, propsOn: ["mood-music"], onChat: () => undefined } }} />);
    expect(tabs()).toEqual(["Appearance", "Gallery", "Wardrobe"]);
  });

  test("the Music tab opens on its panel with no title of its own, and Spotify says it is not connected", async () => {
    const { flushSync } = await import("react-dom");
    await mount(stage(["spotify", "mood-music"]));
    const pick = (label: string): void => flushSync(() => [...dom.window.document.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => t.textContent?.startsWith(label))!.click());
    pick("Music");
    await wait();
    expect(dom.window.document.querySelector("[data-part='scene.stage.music']")).not.toBeNull();
    expect(dom.window.document.body.textContent).not.toContain("RoleCall Music");
    pick("Spotify");
    await wait(60);
    expect(dom.window.document.body.textContent).toContain("Spotify is not connected");
  });
});

describe("the mini player's chevron", () => {
  function Page(): JSX.Element {
    const [wing, setWing] = useState<string | null>(null);
    const request = useStageOpen(setWing);
    return <>
      <button type="button" aria-label="close the wing" onClick={() => setWing(null)} />
      <button type="button" aria-label="open the wing" onClick={() => setWing("stage")} />
      {wing === "stage" && <WingPanel id="stage" stage={{ prefs: { get: () => undefined }, onSet: () => undefined, host: { ctx, scene, propsOn: ["mood-music", "spotify"], request, onChat: () => undefined } }} />}
    </>;
  }

  test("it opens the Stage wing on the Music tab, then on the Spotify tab", async () => {
    const { flushSync } = await import("react-dom");
    await mount(<Page />);
    expect(tabs()).toEqual([]);
    flushSync(() => openStageTab("music"));
    await wait();
    expect(selected()).toStartWith("Music");
    flushSync(() => openStageTab("spotify"));
    await wait(60);
    expect(selected()).toStartWith("Spotify");
  });

  test("a request is honoured once: closing the wing and opening it again by hand starts on Appearance", async () => {
    const { flushSync } = await import("react-dom");
    const click = (label: string): void => flushSync(() => (dom.window.document.querySelector(`[aria-label="${label}"]`) as HTMLElement).click());
    await mount(<Page />);
    flushSync(() => openStageTab("music"));
    await wait();
    expect(selected()).toStartWith("Music");
    click("close the wing");
    expect(tabs()).toEqual([]);
    click("open the wing");
    await wait();
    expect(selected()).toStartWith("Appearance");
  });
});
