/**
 * The Spotify link: the person's own Client ID, the PKCE sign-in, and playback control, all local. The refresh
 * token lives ONLY in the key vault (`SpotifyStore`); the access token lives in memory and is refreshed on demand;
 * neither is ever returned to the page, logged, or written to prefs. A pending sign-in is single-use and expires,
 * so a callback with a state this app did not issue (a forged link) is refused before any code is exchanged.
 */
import type { SpotifyLink } from "../../kit/providers/vault";
import { authorizeUrl, challengeOf, newState, newVerifier, redirectUriFor } from "./pkce";
import { apiCall, exchangeCode, refreshTokens, SpotifyAuthError, type Fetchers, type Tokens } from "./client";

export interface SpotifyStore { read(): Promise<SpotifyLink>; write(link: SpotifyLink): Promise<void> }

const PENDING_TTL_MS = 10 * 60 * 1000;
const PENDING_MAX = 4;
const ME_TTL_MS = 5 * 60 * 1000;
const CLIENT_ID = /^[0-9a-f]{32}$/i;

export interface Status { clientId: string | null; connected: boolean; premium: boolean | null; name: string | null; redirectUri: string; registerUri: string }
export type Control =
  | { action: "play" | "pause" | "next" | "previous" }
  | { action: "seek" | "volume"; value: number }
  | { action: "transfer"; deviceId: string };

interface Pending { verifier: string; redirectUri: string; clientId: string; expires: number }
const record = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {});
const text = (v: unknown): string => (typeof v === "string" ? v : "");

export interface Deps { store: SpotifyStore; fetchers: Fetchers; now?: () => number; open?: (url: string) => void }

export function createSpotifyLink(deps: Deps) {
  const now = deps.now ?? Date.now;
  const pending = new Map<string, Pending>();
  let tokens: Tokens | null = null;
  let refreshing: Promise<string> | null = null;
  let me: { at: number; premium: boolean | null; name: string | null } | null = null;

  async function accessToken(): Promise<string> {
    if (tokens && tokens.expiresAt - 60_000 > now()) return tokens.accessToken;
    refreshing ??= (async () => {
      const link = await deps.store.read();
      if (!link.clientId || !link.refreshToken) throw new SpotifyAuthError("Spotify is not connected");
      try {
        const fresh = await refreshTokens(deps.fetchers, { clientId: link.clientId, refreshToken: link.refreshToken }, now());
        tokens = fresh;
        if (fresh.refreshToken && fresh.refreshToken !== link.refreshToken) await deps.store.write({ ...link, refreshToken: fresh.refreshToken });
        return fresh.accessToken;
      } catch (e) {
        tokens = null;
        if (e instanceof SpotifyAuthError) await deps.store.write({ clientId: link.clientId });
        throw e;
      }
    })().finally(() => { refreshing = null; });
    return refreshing;
  }

  const call = async (method: string, path: string, query?: Record<string, string>, body?: unknown): Promise<unknown> =>
    apiCall(deps.fetchers, await accessToken(), method, path, query, body);

  async function profile(): Promise<{ premium: boolean | null; name: string | null }> {
    if (me && now() - me.at < ME_TTL_MS) return me;
    try {
      const body = record(await call("GET", "/v1/me"));
      me = { at: now(), premium: text(body["product"]) === "premium", name: text(body["display_name"]) || null };
    } catch (e) {
      if (e instanceof SpotifyAuthError) throw e;
      me = { at: now(), premium: null, name: null };
    }
    return me;
  }

  return {
    async status(host: string): Promise<Status> {
      const link = await deps.store.read();
      const redirectUri = redirectUriFor(host);
      const base = { clientId: link.clientId ?? null, redirectUri, registerUri: redirectUri.replace(/:\d+/, "") };
      if (!link.clientId || !link.refreshToken) return { ...base, connected: false, premium: null, name: null };
      try {
        return { ...base, connected: true, ...(await profile()) };
      } catch {
        return { ...base, connected: false, premium: null, name: null };
      }
    },

    /** Saving a different Client ID drops the old sign-in: a token belongs to the app that issued it. */
    async setClientId(id: string): Promise<boolean> {
      const clientId = id.trim();
      if (clientId && !CLIENT_ID.test(clientId)) return false;
      const link = await deps.store.read();
      if (link.clientId === (clientId || undefined)) return true;
      tokens = null; me = null; pending.clear();
      await deps.store.write(clientId ? { clientId } : {});
      return true;
    },

    /** Begins a sign-in: returns Spotify's authorize URL (also handed to the OS browser). */
    async connect(host: string): Promise<string | null> {
      const { clientId } = await deps.store.read();
      if (!clientId) return null;
      const redirectUri = redirectUriFor(host);
      const verifier = newVerifier();
      const state = newState();
      for (const [key, p] of pending) if (p.expires <= now()) pending.delete(key);
      while (pending.size >= PENDING_MAX) pending.delete(pending.keys().next().value as string);
      pending.set(state, { verifier, redirectUri, clientId, expires: now() + PENDING_TTL_MS });
      const url = authorizeUrl({ clientId, redirectUri, challenge: challengeOf(verifier), state });
      deps.open?.(url);
      return url;
    },

    /** The loopback callback. A state this app did not issue (or already used, or expired) is refused before anything is exchanged. */
    async callback(params: URLSearchParams): Promise<boolean> {
      const state = params.get("state") ?? "";
      const flight = pending.get(state);
      pending.delete(state);
      if (!flight || flight.expires <= now()) return false;
      const code = params.get("code");
      if (params.has("error") || !code) return false;
      const link = await deps.store.read();
      if (link.clientId !== flight.clientId) return false;
      try {
        const got = await exchangeCode(deps.fetchers, { clientId: flight.clientId, code, verifier: flight.verifier, redirectUri: flight.redirectUri }, now());
        if (!got.refreshToken) return false;
        tokens = got; me = null;
        await deps.store.write({ clientId: flight.clientId, refreshToken: got.refreshToken });
        return true;
      } catch { return false; }
    },

    /** Forgets the sign-in here. Spotify has no revoke call for a refresh token; the person can remove the app at spotify.com/account/apps. */
    async disconnect(): Promise<void> {
      const link = await deps.store.read();
      tokens = null; me = null;
      await deps.store.write(link.clientId ? { clientId: link.clientId } : {});
    },

    /** What is playing now (null when nothing is). */
    async playback(): Promise<{ playback: ReturnType<typeof shapePlayback> | null }> {
      const raw = await call("GET", "/v1/me/player");
      return { playback: raw === null ? null : shapePlayback(raw) };
    },

    async devices(): Promise<{ devices: ReturnType<typeof shapeDevice>[] }> {
      const list = record(await call("GET", "/v1/me/player/devices"))["devices"];
      return { devices: Array.isArray(list) ? list.map(shapeDevice) : [] };
    },

    async control(c: Control): Promise<void> {
      switch (c.action) {
        case "play": await call("PUT", "/v1/me/player/play"); return;
        case "pause": await call("PUT", "/v1/me/player/pause"); return;
        case "next": await call("POST", "/v1/me/player/next"); return;
        case "previous": await call("POST", "/v1/me/player/previous"); return;
        case "seek": await call("PUT", "/v1/me/player/seek", { position_ms: String(c.value) }); return;
        case "volume": await call("PUT", "/v1/me/player/volume", { volume_percent: String(c.value) }); return;
        case "transfer": await call("PUT", "/v1/me/player", undefined, { device_ids: [c.deviceId], play: true }); return;
      }
    },
  };
}

export type SpotifyLinkService = ReturnType<typeof createSpotifyLink>;

function shapeDevice(d: unknown): { id: string; name: string; type: string; active: boolean; volume: number | null } {
  const r = record(d);
  return { id: text(r["id"]), name: text(r["name"]), type: text(r["type"]), active: r["is_active"] === true, volume: typeof r["volume_percent"] === "number" ? r["volume_percent"] : null };
}

/** Only what the panel draws: the track, its https art, the clock and the device. */
function shapePlayback(raw: unknown) {
  const r = record(raw);
  const item = record(r["item"]);
  const images = record(item["album"])["images"];
  const art = Array.isArray(images) ? (images as unknown[]).map((i) => text(record(i)["url"])).find((u) => u.startsWith("https://")) : undefined;
  const artists = Array.isArray(item["artists"]) ? (item["artists"] as unknown[]).map((a) => text(record(a)["name"])).filter(Boolean) : [];
  const device = record(r["device"]);
  return {
    playing: r["is_playing"] === true, progressMs: typeof r["progress_ms"] === "number" ? r["progress_ms"] : 0,
    track: text(item["name"]) ? { name: text(item["name"]), artists, durationMs: typeof item["duration_ms"] === "number" ? item["duration_ms"] : 0, art: art ?? null } : null,
    device: text(device["id"]) ? shapeDevice(device) : null,
  };
}
