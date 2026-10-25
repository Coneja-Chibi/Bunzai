/** The Spotify link end to end against a mocked fetch: PKCE exchange, state check, vault-only token, two-host egress. */
import { describe, expect, test } from "bun:test";
import type { SpotifyLink } from "../../kit/providers/vault";
import { challengeOf } from "./pkce";
import { spotifyFetchers } from "./client";
import { createSpotifyLink, type SpotifyStore } from "./link";

const CLIENT = "ab".repeat(16);
const HOST = "127.0.0.1:8321";

interface Seen { url: URL; method: string; body: string }
function rig(answer: (seen: Seen) => Response | Promise<Response>, link: SpotifyLink = { clientId: CLIENT }) {
  const seen: Seen[] = [];
  const raw = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input, init);
    const s = { url: new URL(req.url), method: req.method, body: await req.text() };
    seen.push(s);
    return answer(s);
  };
  let saved: SpotifyLink = { ...link };
  const store: SpotifyStore = { read: async () => ({ ...saved }), write: async (next) => { saved = { ...next }; } };
  let clock = 1_000_000;
  const opened: string[] = [];
  const spotify = createSpotifyLink({ store, fetchers: spotifyFetchers(raw), now: () => clock, open: (u) => opened.push(u) });
  return { spotify, seen, opened, saved: () => saved, tick: (ms: number) => { clock += ms; } };
}
const tokenReply = (extra: Record<string, unknown> = {}): Response =>
  Response.json({ access_token: "access-1", expires_in: 3600, refresh_token: "refresh-1", ...extra });
const stateOf = (url: string): string => new URL(url).searchParams.get("state")!;

describe("sign-in", () => {
  test("the code is exchanged with the verifier behind the challenge, and the refresh token lands in the store only", async () => {
    const r = rig(() => tokenReply());
    const url = (await r.spotify.connect(HOST))!;
    expect(r.opened).toEqual([url]);
    const challenge = new URL(url).searchParams.get("code_challenge")!;
    expect(await r.spotify.callback(new URLSearchParams({ code: "the-code", state: stateOf(url) }))).toBe(true);

    const exchange = r.seen.at(-1)!;
    expect(exchange.url.href).toBe("https://accounts.spotify.com/api/token");
    const form = new URLSearchParams(exchange.body);
    expect(form.get("grant_type")).toBe("authorization_code");
    expect(form.get("code")).toBe("the-code");
    expect(form.get("client_id")).toBe(CLIENT);
    expect(form.get("redirect_uri")).toBe(`http://${HOST}/spotify/callback`);
    expect(challengeOf(form.get("code_verifier")!)).toBe(challenge);
    expect(form.has("client_secret")).toBe(false);
    expect(r.saved()).toEqual({ clientId: CLIENT, refreshToken: "refresh-1" });
  });

  test("a callback with a wrong state is refused and nothing is sent to Spotify", async () => {
    const r = rig(() => tokenReply());
    await r.spotify.connect(HOST);
    expect(await r.spotify.callback(new URLSearchParams({ code: "x", state: "not-the-state" }))).toBe(false);
    expect(await r.spotify.callback(new URLSearchParams({ code: "x" }))).toBe(false);
    expect(r.seen).toHaveLength(0);
    expect(r.saved().refreshToken).toBeUndefined();
  });

  test("a state works once, and not after ten minutes", async () => {
    const r = rig(() => tokenReply());
    const first = stateOf((await r.spotify.connect(HOST))!);
    expect(await r.spotify.callback(new URLSearchParams({ code: "x", state: first }))).toBe(true);
    expect(await r.spotify.callback(new URLSearchParams({ code: "x", state: first }))).toBe(false);
    const late = stateOf((await r.spotify.connect(HOST))!);
    r.tick(11 * 60 * 1000);
    expect(await r.spotify.callback(new URLSearchParams({ code: "x", state: late }))).toBe(false);
  });

  test("an error from Spotify, or a reply with no refresh token, connects nothing", async () => {
    const denied = rig(() => tokenReply());
    expect(await denied.spotify.callback(new URLSearchParams({ error: "access_denied", state: stateOf((await denied.spotify.connect(HOST))!) }))).toBe(false);
    const bare = rig(() => Response.json({ access_token: "a", expires_in: 60 }));
    expect(await bare.spotify.callback(new URLSearchParams({ code: "x", state: stateOf((await bare.spotify.connect(HOST))!) }))).toBe(false);
    expect(bare.saved().refreshToken).toBeUndefined();
  });

  test("no Client ID, no sign-in; a malformed Client ID is refused", async () => {
    const r = rig(() => tokenReply(), {});
    expect(await r.spotify.connect(HOST)).toBeNull();
    expect(await r.spotify.setClientId("not-hex")).toBe(false);
    expect(await r.spotify.setClientId(CLIENT)).toBe(true);
    expect(r.saved()).toEqual({ clientId: CLIENT });
  });

  test("a different Client ID forgets the old sign-in", async () => {
    const r = rig(() => tokenReply(), { clientId: CLIENT, refreshToken: "old" });
    await r.spotify.setClientId("cd".repeat(16));
    expect(r.saved()).toEqual({ clientId: "cd".repeat(16) });
  });
});

describe("playback", () => {
  const linked = { clientId: CLIENT, refreshToken: "refresh-1" };

  test("every request goes to accounts.spotify.com or api.spotify.com and carries the bearer; a redirect elsewhere is refused", async () => {
    const r = rig((s) => {
      if (s.url.pathname === "/api/token") return tokenReply();
      if (s.url.pathname === "/v1/me") return Response.json({ product: "premium", display_name: "Chi" });
      if (s.url.pathname === "/v1/me/player/devices") return Response.json({ devices: [{ id: "d1", name: "Desk", type: "Computer", is_active: true, volume_percent: 40 }] });
      if (s.url.pathname === "/v1/me/player") return new Response(null, { status: 204 });
      return new Response(null, { status: 204 });
    }, linked);
    expect(await r.spotify.status(HOST)).toMatchObject({ connected: true, premium: true, name: "Chi" });
    expect(await r.spotify.playback()).toEqual({ playback: null });
    expect(await r.spotify.devices()).toEqual({ devices: [{ id: "d1", name: "Desk", type: "Computer", active: true, volume: 40 }] });
    await r.spotify.control({ action: "volume", value: 30 });
    await r.spotify.control({ action: "seek", value: 5000 });
    await r.spotify.control({ action: "transfer", deviceId: "d1" });
    expect(new Set(r.seen.map((s) => s.url.host))).toEqual(new Set(["accounts.spotify.com", "api.spotify.com"]));
    expect(r.seen.filter((s) => s.url.host === "accounts.spotify.com")).toHaveLength(1);
    expect(r.seen.find((s) => s.url.pathname === "/v1/me/player/volume")!.url.searchParams.get("volume_percent")).toBe("30");

    const sneaky = rig((s) => s.url.host === "api.spotify.com" && s.url.pathname === "/v1/me" ? new Response(null, { status: 302, headers: { location: "https://evil.example/steal" } }) : tokenReply(), linked);
    expect((await sneaky.spotify.status(HOST)).premium).toBeNull();
    expect(sneaky.seen.some((s) => s.url.host === "evil.example")).toBe(false);
  });

  test("a revoked sign-in drops the refresh token and reads as not connected", async () => {
    const r = rig(() => Response.json({ error: "invalid_grant" }, { status: 400 }), linked);
    expect((await r.spotify.status(HOST)).connected).toBe(false);
    expect(r.saved()).toEqual({ clientId: CLIENT });
  });

  test("the access token is reused until a minute before it ends, and a new refresh token is kept", async () => {
    const r = rig((s) => s.url.pathname === "/api/token" ? tokenReply({ refresh_token: "refresh-2", expires_in: 3600 }) : new Response(null, { status: 204 }), linked);
    await r.spotify.control({ action: "pause" });
    await r.spotify.control({ action: "pause" });
    expect(r.seen.filter((s) => s.url.pathname === "/api/token")).toHaveLength(1);
    expect(r.saved().refreshToken).toBe("refresh-2");
    r.tick(3600 * 1000);
    await r.spotify.control({ action: "pause" });
    expect(r.seen.filter((s) => s.url.pathname === "/api/token")).toHaveLength(2);
  });

  test("disconnect forgets the sign-in but keeps the Client ID", async () => {
    const r = rig(() => tokenReply(), linked);
    await r.spotify.disconnect();
    expect(r.saved()).toEqual({ clientId: CLIENT });
    expect((await r.spotify.status(HOST)).connected).toBe(false);
  });

  test("no answer carries a token", async () => {
    const r = rig((s) => s.url.pathname === "/api/token" ? tokenReply() : Response.json({ product: "free", is_playing: true, item: { name: "Song", artists: [{ name: "A" }], album: { images: [{ url: "http://x/a.jpg" }, { url: "https://i.scdn.co/a.jpg" }] }, duration_ms: 1000 }, device: { id: "d" }, devices: [] }), linked);
    const out = JSON.stringify([await r.spotify.status(HOST), await r.spotify.playback(), await r.spotify.devices()]);
    expect(out).not.toContain("access-1");
    expect(out).not.toContain("refresh-1");
    expect(out).toContain("https://i.scdn.co/a.jpg");
    expect(out).not.toContain("http://x/a.jpg");
  });
});
