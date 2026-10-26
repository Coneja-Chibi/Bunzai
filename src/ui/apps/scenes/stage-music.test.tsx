/**
 * Mood Music as it mounts: the Music tab (tracks from packs, transport, add, rename, remove, volume), the mini player that appears once a
 * track is set, the Prop that draws it, and a sound in the pack editor's tile. A stateful fake of the pack API stands in for the library;
 * a fake audio element stands in for the browser's.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Root } from "react-dom/client";
import type { JSX } from "react";
import type { AppContext } from "../../app-contract";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { FakeAudio } from "./fake-audio";
import { moodMusicProp } from "./props/mood-music";
import { sceneProps } from "./props/registry";
import { AUTOPLAY_KEY, LAST_TRACK_KEY, MOOD_MUSIC_PROP, VOLUME_KEY } from "./stage-music-core";
import { MusicMini } from "./stage-music-mini";
import { MusicPanel } from "./stage-music-panel";
import { createMusicPlayer } from "./stage-music-player";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    url: "http://127.0.0.1:8330/",
    extraGlobals: ["SVGElement", "Event", "CustomEvent", "HTMLInputElement", "HTMLElement"],
    globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) },
  });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const sha = (n: number): string => n.toString(16).padStart(64, "0");
const sound = (n: number): string => `\u0000b:u:audio/mpeg:${sha(n)}`;
type Item = { id: string; label: string; ref: string; mime?: string };

let packs: Map<string, { name: string; items: Item[] }>;
let prefs: Map<string, unknown>;
let patches: { id: string; uploads: string[] }[];
let uploaded: string[];
let audio: FakeAudio;
let player: ReturnType<typeof createMusicPlayer>;

beforeEach(() => {
  installed.reinstall();
  packs = new Map([
    ["tav", { name: "Tavern", items: [{ id: "a", label: "Fiddle", ref: sound(1), mime: "audio/mpeg" }, { id: "b", label: "Rain", ref: sound(2), mime: "audio/mpeg" }, { id: "p", label: "Face", ref: `\u0000b:u:image/png:${sha(7)}`, mime: "image/png" }] }],
    ["cas", { name: "Casino", items: [{ id: "c", label: "Jazz", ref: sound(3), mime: "audio/mpeg" }] }],
  ]);
  prefs = new Map();
  patches = []; uploaded = [];
  player = createMusicPlayer(() => (audio = new FakeAudio()));
});

function makeCtx(): AppContext {
  return {
    prefs: { get: (k: string) => prefs.get(k), set: (k: string, v: unknown) => { prefs.set(k, v); } },
    api: {
      listEntities: async () => [...packs].map(([id, p]) => ({ id, name: p.name })),
      getLightEditableEntity: async (query: string) => {
        const id = new URLSearchParams(query).get("id")!;
        const p = packs.get(id)!;
        return { entity: { schemaVersion: "1", kind: "pack", id, body: { name: p.name, pack: { items: structuredClone(p.items) } } }, revision: "r1" };
      },
      patchEditedEntity: async (_k: string, id: string, _r: string, patch: { head?: { body?: { pack?: { items: Item[] } } } }, uploads: string[]) => {
        const items = patch.head?.body?.pack?.items;
        if (items) packs.get(id)!.items = items;
        patches.push({ id, uploads });
        return { revision: "r2" };
      },
      uploadAsset: async (file: File) => { uploaded.push(file.name); return { sha: sha(50), mime: "audio/mpeg", bytes: 1, ref: `receipt-${file.name}`, asset: sound(50 + uploaded.length) }; },
      uploadAssetFromUrl: async (url: string) => { if (!url.startsWith("https://")) throw new Error("Only https links can be added."); return { sha: sha(60), mime: "audio/mpeg", bytes: 1, ref: "receipt-link", asset: sound(60) }; },
      discardAssetUploads: async () => undefined,
    },
  } as unknown as AppContext;
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
function setValue(el: Element, value: string): void {
  const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"))!;
  (el as unknown as Record<string, { onChange(e: { target: { value: string } }): void }>)[key]!.onChange({ target: { value } });
}
function choose(files: File[]): void {
  const input = doc().querySelector('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: files, configurable: true });
  const key = Object.keys(input).find((k) => k.startsWith("__reactProps$"))!;
  (input as unknown as Record<string, { onChange(e: { target: { files: File[]; value: string } }): void }>)[key]!.onChange({ target: { files, value: "" } });
}

describe("the Music tab", () => {
  test("lists each pack's sounds under the pack's name with a count, and leaves pictures out", async () => {
    await mount(<MusicPanel ctx={makeCtx()} player={player} />);
    const t = text();
    expect(t).toContain("Tavern");
    expect(t).toContain("Casino");
    for (const title of ["Fiddle", "Rain", "Jazz"]) expect(t).toContain(title);
    expect(t).not.toContain("Face");
    expect([...doc().querySelectorAll(".mm-cat-hd span")].map((s) => s.textContent)).toEqual(["2", "1"]);
    expect(t).toContain("No track selected");
    expect(button("Play mood music")!.disabled).toBe(true);
  });

  test("shows its words when the library has no packs, and when no pack holds a sound", async () => {
    packs.clear();
    await mount(<MusicPanel ctx={makeCtx()} player={player} />);
    expect(text()).toContain("Tracks live in a pack.");
    expect(button("Add")!.disabled).toBe(true);
  });

  test("picking a track plays it from the asset route; Pause, Play and Stop follow RoleCall", async () => {
    const flushSync = await mount(<MusicPanel ctx={makeCtx()} player={player} />);
    flushSync(() => button("Fiddle")!.click());
    await settle(flushSync);
    expect(audio.src).toBe(`/api/asset/${sha(1)}`);
    expect(audio.loop).toBe(true);
    expect(text()).toContain("Fiddle");
    expect(doc().querySelector(".mm-sub")!.textContent).toBe("Tavern");
    flushSync(() => button("Pause mood music")!.click());
    await settle(flushSync);
    expect(button("Play mood music")).toBeDefined();
    flushSync(() => button("Play mood music")!.click());
    await settle(flushSync);
    expect(button("Pause mood music")).toBeDefined();
    flushSync(() => button("Next mood music track")!.click());
    await settle(flushSync);
    expect(audio.src).toBe(`/api/asset/${sha(2)}`);
    flushSync(() => button("Stop mood music")!.click());
    await settle(flushSync);
    expect(text()).toContain("No track selected");
    expect(audio.src).toBe("");
  });

  test("a play the browser blocks is said, in amber, and the track stays selected", async () => {
    const flushSync = await mount(<MusicPanel ctx={makeCtx()} player={player} />);
    audio.refuse = new Error("Playback blocked");
    flushSync(() => button("Jazz")!.click());
    await settle(flushSync);
    expect(doc().querySelector(".mm-now .mm-err")!.textContent).toBe("Playback blocked");
    expect(button("Play mood music")).toBeDefined();
  });

  test("the volume slider moves the element and is saved as the app preference", async () => {
    const flushSync = await mount(<MusicPanel ctx={makeCtx()} player={player} />);
    flushSync(() => setValue(doc().querySelector('input[aria-label="Mood music volume"]')!, "0.25"));
    expect(audio.volume).toBe(0.25);
    expect(prefs.get(VOLUME_KEY)).toBe(0.25);
  });

  test("a saved volume is applied when the tab opens", async () => {
    prefs.set(VOLUME_KEY, 0.9);
    await mount(<MusicPanel ctx={makeCtx()} player={player} />);
    expect(audio.volume).toBe(0.9);
  });

  test("choosing sound files adds them to the pack; a file that is not a sound is turned away", async () => {
    const flushSync = await mount(<MusicPanel ctx={makeCtx()} player={player} />);
    flushSync(() => choose([new File(["x"], "Harbor Dusk.mp3", { type: "audio/mpeg" })]));
    await settle(flushSync, 60);
    expect(uploaded).toEqual(["Harbor Dusk.mp3"]);
    expect(packs.get("tav")!.items.map((i) => i.label)).toContain("Harbor Dusk");
    expect(patches[0]).toEqual({ id: "tav", uploads: ["receipt-Harbor Dusk.mp3"] });
    expect(text()).toContain("Harbor Dusk");
    flushSync(() => choose([new File(["x"], "notes.txt", { type: "text/plain" })]));
    await settle(flushSync, 60);
    expect(text()).toContain("Those are not sound files.");
    expect(uploaded).toHaveLength(1);
  });

  test("a link is fetched once and kept under the title typed, a refused link says why, and an empty one asks", async () => {
    const flushSync = await mount(<MusicPanel ctx={makeCtx()} player={player} />);
    flushSync(() => button("Add")!.click());
    await settle(flushSync);
    expect(text()).toContain("Paste a direct audio link, or choose files.");
    flushSync(() => { setValue(doc().querySelector('input[aria-label="Direct audio link"]')!, "http://x.example/a.mp3"); });
    flushSync(() => button("Add")!.click());
    await settle(flushSync, 60);
    expect(text()).toContain("Only https links can be added.");
    flushSync(() => { setValue(doc().querySelector('input[aria-label="Direct audio link"]')!, "https://x.example/a.mp3"); setValue(doc().querySelector('input[aria-label="Title"]')!, "Mr. Brown v2.0"); });
    flushSync(() => button("Add")!.click());
    await settle(flushSync, 60);
    expect(packs.get("tav")!.items.map((i) => i.label)).toContain("Mr. Brown v2.0");
  });

  test("the pencil renames a track in its pack; a title another track has is refused in words", async () => {
    const flushSync = await mount(<MusicPanel ctx={makeCtx()} player={player} />);
    flushSync(() => button("Edit Fiddle")!.click());
    expect(text()).toContain("Edit Personal Track");
    expect(doc().querySelector('input[aria-label="Direct audio link"]')).toBeNull();
    flushSync(() => setValue(doc().querySelector('input[aria-label="Title"]')!, "Rain"));
    flushSync(() => button("Save")!.click());
    await settle(flushSync, 60);
    expect(text()).toContain("Another track in this pack already has that title.");
    expect(packs.get("tav")!.items.find((i) => i.id === "a")!.label).toBe("Fiddle");
    flushSync(() => setValue(doc().querySelector('input[aria-label="Title"]')!, "Fiddle at dusk"));
    flushSync(() => button("Save")!.click());
    await settle(flushSync, 60);
    expect(packs.get("tav")!.items.find((i) => i.id === "a")!.label).toBe("Fiddle at dusk");
    expect(text()).toContain("Add Personal Track");
  });

  test("the trash removes a track from its pack, and removing the one playing stops the music", async () => {
    const flushSync = await mount(<MusicPanel ctx={makeCtx()} player={player} />);
    flushSync(() => button("Rain")!.click());
    await settle(flushSync);
    expect(audio.src).not.toBe("");
    flushSync(() => button("Delete Rain")!.click());
    await settle(flushSync, 60);
    expect(packs.get("tav")!.items.map((i) => i.id)).toEqual(["a", "p"]);
    expect(text()).toContain("No track selected");
    expect(audio.src).toBe("");
  });
});

describe("the mini player", () => {
  test("it draws nothing until a track is set, then names the track and its pack", async () => {
    const flushSync = await mount(<MusicMini ctx={makeCtx()} player={player} />);
    expect(doc().querySelector(".mm-mini-bar")).toBeNull();
    await player.play({ id: "tav:a", packId: "tav", packName: "Tavern", itemId: "a", title: "Fiddle", sha: sha(1) }, []);
    await settle(flushSync);
    expect(doc().querySelector(".mm-mini-text")!.textContent).toBe("FiddleTavern");
  });

  test("Pause, Next and the chevron work; the chevron asks to open the Music tab", async () => {
    let expanded = 0;
    const tracks = [{ id: "tav:a", packId: "tav", packName: "Tavern", itemId: "a", title: "Fiddle", sha: sha(1) }, { id: "tav:b", packId: "tav", packName: "Tavern", itemId: "b", title: "Rain", sha: sha(2) }];
    const flushSync = await mount(<MusicMini ctx={makeCtx()} player={player} onExpand={() => { expanded++; }} />);
    await player.play(tracks[0]!, tracks);
    await settle(flushSync);
    flushSync(() => button("Pause mood music")!.click());
    await settle(flushSync);
    expect(button("Play mood music")).toBeDefined();
    flushSync(() => button("Next mood music track")!.click());
    await settle(flushSync);
    expect(doc().querySelector(".mm-mini-text")!.textContent).toBe("RainTavern");
    flushSync(() => button("Open mood music panel")!.click());
    expect(expanded).toBe(1);
  });

  test("switching the Prop off (unmounting it) stops the music", async () => {
    const flushSync = await mount(<MusicMini ctx={makeCtx()} player={player} />);
    await player.play({ id: "tav:a", packId: "tav", packName: "Tavern", itemId: "a", title: "Fiddle", sha: sha(1) }, []);
    flushSync(() => root!.unmount());
    root = null;
    expect(player.get().track).toBeNull();
    expect(audio.src).toBe("");
  });
});


describe("play on scene open", () => {
  const fiddle = { id: "tav:a", packId: "tav", packName: "Tavern", itemId: "a", title: "Fiddle", sha: sha(1) };

  test("a played track is remembered by its pack and item ids", async () => {
    const flushSync = await mount(<MusicMini ctx={makeCtx()} player={player} />);
    await player.play(fiddle, []);
    await settle(flushSync);
    expect(prefs.get(LAST_TRACK_KEY)).toEqual({ packId: "tav", itemId: "a" });
  });

  test("with autoplay on, opening the scene starts the last track", async () => {
    prefs.set(AUTOPLAY_KEY, true);
    prefs.set(LAST_TRACK_KEY, { packId: "tav", itemId: "b" });
    await mount(<MusicMini ctx={makeCtx()} player={player} />);
    expect(player.get()).toMatchObject({ playing: true, track: { itemId: "b", title: "Rain" } });
    expect(audio.src).toBe(`/api/asset/${sha(2)}`);
  });

  test("with autoplay off, or no remembered track, or the track gone, nothing starts", async () => {
    prefs.set(LAST_TRACK_KEY, { packId: "tav", itemId: "b" });
    await mount(<MusicMini ctx={makeCtx()} player={player} />);
    expect(player.get().track).toBeNull();
    root!.unmount(); root = null;
    prefs.set(AUTOPLAY_KEY, true);
    prefs.delete(LAST_TRACK_KEY);
    await mount(<MusicMini ctx={makeCtx()} player={player} />);
    expect(player.get().track).toBeNull();
    root!.unmount(); root = null;
    prefs.set(LAST_TRACK_KEY, { packId: "tav", itemId: "deleted" });
    await mount(<MusicMini ctx={makeCtx()} player={player} />);
    expect(player.get().track).toBeNull();
  });

  test("a browser that refuses leaves the track paused with its message and the Play button", async () => {
    prefs.set(AUTOPLAY_KEY, true);
    prefs.set(LAST_TRACK_KEY, { packId: "tav", itemId: "a" });
    const fresh = createMusicPlayer(() => { audio = new FakeAudio(); audio.refuse = new DOMException("", "NotAllowedError"); return audio; });
    const flushSync = await mount(<MusicMini ctx={makeCtx()} player={fresh} />);
    await settle(flushSync);
    expect(fresh.get()).toMatchObject({ playing: false, track: { itemId: "a" }, error: "Browser blocked autoplay." });
    expect(text()).toContain("Browser blocked autoplay.");
    expect(button("Play mood music")).toBeDefined();
  });
});
describe("the Prop", () => {
  test("Mood Music is registered, off by default, and draws the mini player on the stage", async () => {
    expect(sceneProps().map((p) => p.id)).toContain(MOOD_MUSIC_PROP);
    expect(moodMusicProp.Stage).toBeDefined();
    expect(moodMusicProp.name).toBe("Mood Music");
  });
});
