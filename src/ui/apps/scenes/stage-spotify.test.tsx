/**
 * The Spotify tab and mini player as they mount, over a feed with a scripted caller (no network): not connected, now playing, the
 * controls each sending what RoleCall's do, the device list, the Premium note, and Off then On through the Props wing's own switch.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { JSX } from "react";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import type { AppContext } from "../../app-contract";
import { PropsWing } from "./props/props-wing";
import { useSceneProps } from "./props/use-scene-props";
import { sceneStageProps } from "./props/prop-contract";
import { sceneProps } from "./props/registry";
import { SPOTIFY_PROP, type Device, type Playback, type SpotifyStatus } from "./stage-spotify-core";
import { createSpotifyFeed, type SpotifyCaller } from "./stage-spotify-feed";
import { SpotifyMini } from "./stage-spotify-mini";
import { SpotifyPanel } from "./stage-spotify-panel";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8332/",
    extraGlobals: ["SVGElement", "Event", "CustomEvent", "HTMLInputElement", "HTMLElement"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) },
  });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const base: SpotifyStatus = { clientId: "a".repeat(32), connected: true, premium: true, name: "Chi", redirectUri: "http://127.0.0.1:8332/spotify/callback", registerUri: "http://127.0.0.1/spotify/callback" };
const desk: Device = { id: "d1", name: "Desk", type: "Computer", active: true, volume: 40 };
const phone: Device = { id: "d2", name: "Pixel", type: "Smartphone", active: false, volume: 20 };
const song: Playback = { playing: true, progressMs: 61_000, track: { name: "Nightcall", artists: ["Kavinsky", "Lovefoxxx"], durationMs: 240_000, art: "https://i.scdn.co/art.jpg" }, device: desk };

let status: SpotifyStatus;
let playback: Playback | null;
let devices: Device[];
let posts: string[];

beforeEach(() => { installed.reinstall(); status = base; playback = song; devices = [desk, phone]; posts = []; });

function feedOf() {
  const caller: SpotifyCaller = {
    async get<T>(path: string): Promise<T> {
      if (path === "/api/spotify/status") return status as T;
      if (path === "/api/spotify/playback") return { playback } as T;
      return { devices } as T;
    },
    async post(path: string, body: unknown): Promise<unknown> { posts.push(`${path} ${JSON.stringify(body)}`); return { ok: true }; },
  };
  return createSpotifyFeed(caller, () => () => undefined, () => true);
}

let root: Root | null = null;
type FlushSync = typeof import("react-dom")["flushSync"];
const settle = async (flushSync: FlushSync, ms = 25): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); flushSync(() => undefined); };
const doc = (): Document => dom.window.document;
const button = (label: string): HTMLButtonElement | undefined => [...doc().querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label || b.textContent?.trim() === label);
const text = (): string => doc().body.textContent ?? "";

afterEach(async () => {
  const { flushSync } = await import("react-dom");
  if (root) flushSync(() => root!.unmount());
  root = null;
  doc().body.replaceChildren();
});
async function mount(node: JSX.Element): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const host = doc().createElement("div");
  doc().body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(node));
  await settle(flushSync);
  return flushSync;
}

describe("the Spotify tab", () => {
  test("not connected: it says so and points at Settings", async () => {
    status = { ...base, connected: false };
    await mount(<SpotifyPanel feed={feedOf()} />);
    expect(text()).toContain("Spotify is not connected");
    expect(text()).toContain("Connect it in Settings, under Spotify.");
    expect(doc().querySelector('[aria-label="Play"], [aria-label="Pause"]')).toBeNull();
  });

  test("now playing: art, track, artists, clock, and the Premium pill", async () => {
    await mount(<SpotifyPanel feed={feedOf()} />);
    expect(doc().querySelector("img.sp-art")!.getAttribute("src")).toBe("https://i.scdn.co/art.jpg");
    expect(doc().querySelector(".sp-track")!.textContent).toBe("Nightcall");
    expect(doc().querySelector(".sp-artists")!.textContent).toBe("Kavinsky, Lovefoxxx");
    expect(doc().querySelector(".sp-clock")!.textContent).toBe("1:014:00");
    expect(doc().querySelector(".sp-pill")!.textContent).toBe("Premium");
    expect(doc().querySelector(".sp-dot.live")).not.toBeNull();
  });

  test("Previous, Pause, Next, a click on the bar, and the volume send RoleCall's commands", async () => {
    const flushSync = await mount(<SpotifyPanel feed={feedOf()} />);
    flushSync(() => button("Previous")!.click());
    flushSync(() => button("Pause")!.click());
    flushSync(() => button("Next")!.click());
    const bar = doc().querySelector(".sp-bar") as HTMLElement;
    bar.getBoundingClientRect = () => ({ left: 100, width: 200, top: 0, right: 300, bottom: 4, height: 4, x: 100, y: 0, toJSON: () => ({}) });
    flushSync(() => { bar.dispatchEvent(new dom.window.MouseEvent("click", { clientX: 200, bubbles: true })); });
    const slider = doc().querySelector('input[aria-label="Volume"]')!;
    const key = Object.keys(slider).find((k) => k.startsWith("__reactProps$"))!;
    flushSync(() => (slider as unknown as Record<string, { onChange(e: { target: { value: string } }): void }>)[key]!.onChange({ target: { value: "70" } }));
    await settle(flushSync);
    expect(posts).toEqual([
      '/api/spotify/control {"action":"previous"}',
      '/api/spotify/control {"action":"pause"}',
      '/api/spotify/control {"action":"next"}',
      '/api/spotify/control {"action":"seek","value":120000}',
      '/api/spotify/control {"action":"volume","value":70}',
    ]);
  });

  test("nothing playing: the empty words, and no controls", async () => {
    playback = null;
    await mount(<SpotifyPanel feed={feedOf()} />);
    expect(text()).toContain("No active playback");
    expect(text()).toContain("Play something to see controls here");
    expect(button("Pause")).toBeUndefined();
  });

  test("a device with no volume gets no volume slider; art over http is not drawn", async () => {
    playback = { ...song, track: { ...song.track!, art: "http://i.scdn.co/art.jpg" }, device: { ...desk, volume: null } };
    await mount(<SpotifyPanel feed={feedOf()} />);
    expect(doc().querySelector('input[aria-label="Volume"]')).toBeNull();
    expect(doc().querySelector("img.sp-art")).toBeNull();
  });

  test("without Premium the tab says so honestly", async () => {
    status = { ...base, premium: false };
    await mount(<SpotifyPanel feed={feedOf()} />);
    expect(text()).toContain("Spotify needs Premium to control playback.");
    expect(doc().querySelector(".sp-pill")).toBeNull();
  });

  test("Devices (n) opens to the list; picking one moves playback; the empty list says what to do", async () => {
    const flushSync = await mount(<SpotifyPanel feed={feedOf()} />);
    expect(doc().querySelector(".sp-devices")).toBeNull();
    flushSync(() => button("Devices (2)")!.click());
    expect([...doc().querySelectorAll(".sp-devices [data-control='row'] [data-slot='label']")].map((b) => b.textContent)).toEqual(["Desk", "Pixel"]);
    expect(doc().querySelector(".sp-devices [data-control='row'][data-selected] [data-slot='label']")!.textContent).toBe("Desk");
    flushSync(() => doc().querySelectorAll<HTMLButtonElement>(".sp-devices [data-control='row']")[1]!.click());
    await settle(flushSync);
    expect(posts).toEqual(['/api/spotify/control {"action":"transfer","deviceId":"d2"}']);
  });

  test("with no devices it says to open Spotify", async () => {
    devices = [];
    const flushSync = await mount(<SpotifyPanel feed={feedOf()} />);
    flushSync(() => button("Devices")!.click());
    expect(text()).toContain("No devices found. Open Spotify on any device.");
  });
});

describe("the mini player", () => {
  test("it shows nothing until Spotify is connected, and 'No track playing' when nothing is", async () => {
    status = { ...base, connected: false };
    await mount(<SpotifyMini feed={feedOf()} />);
    expect(doc().querySelector(".sp-mini")).toBeNull();
    doc().body.replaceChildren();
    status = base; playback = null;
    await mount(<SpotifyMini feed={feedOf()} />);
    expect(text()).toContain("No track playing");
    expect(button("Play")!.disabled).toBe(true);
  });

  test("it names the track and artists; Pause, Skip and the chevron work", async () => {
    let expanded = 0;
    const flushSync = await mount(<SpotifyMini feed={feedOf()} onExpand={() => { expanded++; }} />);
    expect(doc().querySelector(".mm-mini-text")!.textContent).toBe("NightcallKavinsky, Lovefoxxx");
    flushSync(() => button("Pause")!.click());
    flushSync(() => button("Skip to next")!.click());
    flushSync(() => button("Open Spotify panel")!.click());
    await settle(flushSync);
    expect(posts).toEqual(['/api/spotify/control {"action":"pause"}', '/api/spotify/control {"action":"next"}']);
    expect(expanded).toBe(1);
  });
});

describe("Off, and back On (RoleCall's one-way door)", () => {
  test("the Props wing's own row turns Spotify off and on again, and the mini player follows it", async () => {
    let saved: string[] = [];
    const ctx = { api: { getSceneProps: async () => ({ on: saved }), setSceneProps: async (_id: string, on: string[]) => { saved = on; return { on }; } } } as unknown as AppContext;
    function Harness(): JSX.Element {
      const props = useSceneProps(ctx, "chat1");
      return <PropsWing list={sceneProps()} load={props.load} onToggle={props.toggle} onRetry={props.reload} />;
    }
    const flushSync = await mount(<Harness />);
    const stage = (): string[] => sceneStageProps(sceneProps(), saved).map((x) => x.id);
    expect(stage()).not.toContain(SPOTIFY_PROP);
    flushSync(() => button("Turn on Spotify")!.click());
    await settle(flushSync);
    expect(stage()).toContain(SPOTIFY_PROP);
    flushSync(() => button("Turn off Spotify")!.click());
    await settle(flushSync);
    expect(saved).not.toContain(SPOTIFY_PROP);
    expect(stage()).not.toContain(SPOTIFY_PROP);
    expect(button("Turn on Spotify")).toBeDefined();
    flushSync(() => button("Turn on Spotify")!.click());
    await settle(flushSync);
    expect(stage()).toContain(SPOTIFY_PROP);
  });
});
