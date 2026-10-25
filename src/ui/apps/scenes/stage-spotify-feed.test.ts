/** The shared Spotify feed: one poll for every watcher, none while the page is hidden, commands re-read playback, and Off then On. */
import { describe, expect, test } from "bun:test";
import { createSpotifyFeed, type Every, type SpotifyCaller } from "./stage-spotify-feed";
import { DEVICES_POLL_MS, PLAYBACK_POLL_MS, type Playback, type SpotifyStatus } from "./stage-spotify-core";

const status = (connected: boolean): SpotifyStatus => ({ clientId: "a".repeat(32), connected, premium: true, name: "Chi", redirectUri: "http://127.0.0.1:8321/spotify/callback", registerUri: "http://127.0.0.1/spotify/callback" });
const playing: Playback = { playing: true, progressMs: 1000, track: { name: "Song", artists: ["A", "B"], durationMs: 200000, art: "https://i.scdn.co/a.jpg" }, device: { id: "d1", name: "Desk", type: "Computer", active: true, volume: 40 } };

function rig(over: { connected?: boolean; playback?: Playback | null; fail?: { status: number; code: string; message: string } } = {}) {
  const calls: string[] = [];
  const timers: { fn: () => void; ms: number; live: boolean }[] = [];
  const every: Every = (fn, ms) => { const t = { fn, ms, live: true }; timers.push(t); return () => { t.live = false; }; };
  let connected = over.connected ?? true;
  let playback = over.playback === undefined ? playing : over.playback;
  let hidden = false;
  const caller: SpotifyCaller = {
    async get<T>(path: string): Promise<T> {
      calls.push(`GET ${path}`);
      if (path === "/api/spotify/status") return status(connected) as T;
      if (over.fail) throw Object.assign(new Error(over.fail.message), { status: over.fail.status, code: over.fail.code });
      if (path === "/api/spotify/playback") return { playback } as T;
      return { devices: [{ id: "d1", name: "Desk", type: "Computer", active: true, volume: 40 }] } as T;
    },
    async post(path: string, body: unknown): Promise<unknown> { calls.push(`POST ${path} ${JSON.stringify(body)}`); return { ok: true }; },
  };
  const feed = createSpotifyFeed(caller, every, () => !hidden);
  const flush = async (): Promise<void> => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  const tick = async (ms: number): Promise<void> => { timers.filter((t) => t.live && t.ms === ms).forEach((t) => t.fn()); await flush(); };
  return { feed, calls, timers, flush, tick, hide: (h: boolean) => { hidden = h; }, setConnected: (c: boolean) => { connected = c; }, setPlayback: (p: Playback | null) => { playback = p; } };
}

describe("the feed", () => {
  test("two watchers share one poll, and the last one out stops it", async () => {
    const r = rig();
    const a = r.feed.watch();
    const b = r.feed.watch();
    await r.flush();
    expect(r.timers.filter((t) => t.ms === PLAYBACK_POLL_MS)).toHaveLength(1);
    expect(r.feed.get()).toMatchObject({ phase: "ready", playback: playing });
    a();
    expect(r.timers[0]!.live).toBe(true);
    b();
    b();
    expect(r.timers[0]!.live).toBe(false);
  });

  test("it re-reads playback every five seconds, but not while the page is hidden", async () => {
    const r = rig();
    r.feed.watch();
    await r.flush();
    const base = r.calls.filter((c) => c.endsWith("/playback")).length;
    await r.tick(PLAYBACK_POLL_MS);
    expect(r.calls.filter((c) => c.endsWith("/playback"))).toHaveLength(base + 1);
    r.hide(true);
    await r.tick(PLAYBACK_POLL_MS);
    expect(r.calls.filter((c) => c.endsWith("/playback"))).toHaveLength(base + 1);
  });

  test("devices are read every thirty seconds, only while the tab watches them", async () => {
    const r = rig();
    r.feed.watch();
    await r.flush();
    expect(r.calls.some((c) => c.endsWith("/devices"))).toBe(false);
    const stop = r.feed.watchDevices();
    await r.flush();
    expect(r.feed.get().devices).toHaveLength(1);
    expect(r.timers.some((t) => t.ms === DEVICES_POLL_MS && t.live)).toBe(true);
    stop();
    expect(r.timers.find((t) => t.ms === DEVICES_POLL_MS)!.live).toBe(false);
  });

  test("Play or Pause sends the opposite of what is happening, then reads playback again", async () => {
    const r = rig();
    r.feed.watch();
    await r.flush();
    r.calls.length = 0;
    await r.feed.toggle();
    expect(r.calls).toEqual(['POST /api/spotify/control {"action":"pause"}', "GET /api/spotify/playback"]);
    r.setPlayback({ ...playing, playing: false });
    await r.feed.refresh();
    r.calls.length = 0;
    await r.feed.toggle();
    expect(r.calls[0]).toBe('POST /api/spotify/control {"action":"play"}');
  });

  test("a refused command says why and does not pretend to have worked", async () => {
    const posts: string[] = [];
    const feed = createSpotifyFeed({
      get: async <T,>() => ({ connected: true, playback: null } as T),
      post: async (path) => { posts.push(path); throw new Error("Spotify needs Premium to control playback."); },
    }, () => () => undefined, () => true);
    await feed.act({ action: "next" });
    expect(posts).toEqual(["/api/spotify/control"]);
    expect(feed.get().message).toBe("Spotify needs Premium to control playback.");
  });

  test("not connected: the feed reads off, makes no playback calls, and notices when Spotify is connected later", async () => {
    const r = rig({ connected: false });
    r.feed.watch();
    await r.flush();
    expect(r.feed.get().phase).toBe("off");
    expect(r.calls.some((c) => c.endsWith("/playback"))).toBe(false);
    r.setConnected(true);
    await r.tick(PLAYBACK_POLL_MS);
    expect(r.feed.get()).toMatchObject({ phase: "ready", playback: playing });
  });

  test("a revoked sign-in turns the feed off with the server's words", async () => {
    const r = rig({ fail: { status: 401, code: "not-connected", message: "Spotify is not connected. Connect it in Settings." } });
    r.feed.watch();
    await r.flush();
    expect(r.feed.get()).toMatchObject({ phase: "off", message: "Spotify is not connected. Connect it in Settings." });
  });
});
