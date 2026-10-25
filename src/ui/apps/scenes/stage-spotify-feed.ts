/**
 * What Spotify is doing right now, shared by the Spotify tab and the mini player so one poll serves both (RoleCall SpotifyContext.tsx
 * polls once for the page). It asks the local server (`/api/spotify/*`, host-only; the server holds the token and talks to Spotify) every
 * 5 s while someone is watching and the page is visible, and the device list every 30 s while the tab is open. A command is sent, then
 * the playback is read again. The first user starts the poll and the last one stops it. Timers and the clock are injected for tests.
 */
import type { SpotifyPath } from "../../app-contract-spotify";
import { DEVICES_POLL_MS, PLAYBACK_POLL_MS, type Device, type Playback, type SpotifyStatus } from "./stage-spotify-core";

/** The slice of the page's fetch the feed uses; failures throw an Error with `.status` and `.code` (ApiHttpError). */
export interface SpotifyCaller { get<T>(path: SpotifyPath): Promise<T>; post(path: SpotifyPath, body: unknown): Promise<unknown> }
export interface Every { (fn: () => void, ms: number): () => void }
// interval-ok: one shared feed for every Spotify view; each tick checks visible() and the poll stops when the last watcher leaves.
const realEvery: Every = (fn, ms) => { const id = setInterval(fn, ms); return () => clearInterval(id); }; // interval-ok: see the line above

export type Control = { action: "play" | "pause" | "next" | "previous" } | { action: "seek" | "volume"; value: number } | { action: "transfer"; deviceId: string };
export interface SpotifyState {
  /** `loading` until the first answer; `off` when Spotify is not connected (the tab says how to connect). */
  phase: "loading" | "ready" | "off";
  status: SpotifyStatus | null; playback: Playback | null; devices: Device[]; message: string | null;
}

const words = (e: unknown): string => (e instanceof Error && e.message ? e.message : "Spotify did not answer.");
const codeOf = (e: unknown): string => (typeof e === "object" && e !== null ? String((e as { code?: unknown }).code ?? "") : "");

export function createSpotifyFeed(call: SpotifyCaller, every: Every = realEvery, visible: () => boolean = () => document.visibilityState !== "hidden") {
  let state: SpotifyState = { phase: "loading", status: null, playback: null, devices: [], message: null };
  const listeners = new Set<() => void>();
  let watchers = 0, deviceWatchers = 0;
  let stopPlayback = (): void => undefined, stopDevices = (): void => undefined;
  const set = (patch: Partial<SpotifyState>): void => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

  async function refreshStatus(): Promise<void> {
    try {
      const status = await call.get<SpotifyStatus>("/api/spotify/status");
      set({ status, phase: status.connected ? "ready" : "off" });
    } catch (e) { set({ phase: "off", message: words(e) }); }
  }
  async function refreshPlayback(): Promise<void> {
    if (state.phase === "off") return;
    try {
      const { playback } = await call.get<{ playback: Playback | null }>("/api/spotify/playback");
      set({ playback, message: null, phase: "ready" });
    } catch (e) {
      if (codeOf(e) === "not-connected") set({ phase: "off", playback: null, message: words(e) });
      else set({ message: words(e) });
    }
  }
  async function refreshDevices(): Promise<void> {
    if (state.phase === "off") return;
    try { set({ devices: (await call.get<{ devices: Device[] }>("/api/spotify/devices")).devices }); } catch (e) { set({ message: words(e) }); }
  }
  const tick = (): void => { if (visible()) void (state.phase === "off" ? refreshStatus().then(refreshPlayback) : refreshPlayback()); };

  return {
    get: (): SpotifyState => state,
    subscribe(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); },
    /** Start watching playback (the mini player and the tab both do); the returned release stops the poll with the last watcher. */
    watch(): () => void {
      if (watchers++ === 0) { void refreshStatus().then(refreshPlayback); stopPlayback = every(tick, PLAYBACK_POLL_MS); }
      let done = false;
      return () => { if (!done && --watchers === 0) { stopPlayback(); } done = true; };
    },
    /** The tab also keeps the device list fresh. */
    watchDevices(): () => void {
      if (deviceWatchers++ === 0) { void refreshDevices(); stopDevices = every(() => { if (visible()) void refreshDevices(); }, DEVICES_POLL_MS); }
      let done = false;
      return () => { if (!done && --deviceWatchers === 0) { stopDevices(); } done = true; };
    },
    refreshDevices,
    refresh: async (): Promise<void> => { await refreshStatus(); await refreshPlayback(); },
    async act(control: Control): Promise<void> {
      try { await call.post("/api/spotify/control", control); set({ message: null }); } catch (e) { set({ message: words(e) }); return; }
      await refreshPlayback();
      if (control.action === "transfer") await refreshDevices();
    },
    /** Pause when playing, otherwise play (RoleCall's one Play/Pause control). */
    toggle(): Promise<void> { return this.act({ action: state.playback?.playing ? "pause" : "play" }); },
  };
}

export type SpotifyFeed = ReturnType<typeof createSpotifyFeed>;
