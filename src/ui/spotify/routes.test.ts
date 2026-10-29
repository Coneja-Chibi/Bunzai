/** Spotify's doors on the real request handler: the cross-site callback, the token gate, host-only, and that a token never leaves. */
import { afterEach, describe, expect, test } from "bun:test";
import type { SettingsStoreLike, StudioStoreLike } from "../../studio/contracts";
import type { SpotifyLink } from "../../kit/providers/vault";
import { createHandler } from "../server";
import { filledSec } from "../server-test-rig";
import { spotifyFetchers } from "./client";
import { createSpotifyLink } from "./link";
import { installSpotifyService } from "./routes";

const CLIENT = "ab".repeat(16);
const stub = {} as unknown as StudioStoreLike;
const settings = {} as unknown as SettingsStoreLike;

function setup(link: SpotifyLink = { clientId: CLIENT }) {
  const sec = filledSec();
  const hosts: string[] = [];
  let saved = { ...link };
  const opened: string[] = [];
  installSpotifyService(createSpotifyLink({
    store: { read: async () => ({ ...saved }), write: async (l) => { saved = { ...l }; } },
    fetchers: spotifyFetchers(async (input, init) => {
      const req = new Request(input, init);
      hosts.push(new URL(req.url).host);
      return new URL(req.url).pathname === "/api/token"
        ? Response.json({ access_token: "access-secret", refresh_token: "refresh-secret", expires_in: 3600 })
        : Response.json({ product: "premium", display_name: "Chi" });
    }),
    open: (u) => opened.push(u),
  }));
  const handler = createHandler(stub, settings, undefined, sec);
  const post = (path: string, body: unknown, token: string | null = sec.token): Promise<Response> => handler(new Request(`http://127.0.0.1:8321${path}`, {
    method: "POST",
    headers: { host: "127.0.0.1:8321", origin: "http://127.0.0.1:8321", "content-type": "application/json", ...(token ? { "x-bunzai-token": token } : {}) },
    body: JSON.stringify(body),
  }));
  return { handler, sec, hosts, opened, saved: () => saved, post };
}
afterEach(() => installSpotifyService(null));

describe("the Spotify routes", () => {
  test("connect opens Spotify's sign-in; the cross-site callback with that state connects, with another state it does not", async () => {
    const r = setup();
    const { url } = (await (await r.post("/api/spotify/connect", {})).json()) as { url: string };
    expect(r.opened).toEqual([url]);
    const state = new URL(url).searchParams.get("state")!;
    const callback = (s: string): Promise<Response> => r.handler(new Request(`http://127.0.0.1:8321/spotify/callback?code=c&state=${s}`, {
      headers: { host: "127.0.0.1:8321", "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" },
    }));
    expect((await callback("forged")).status).toBe(400);
    expect(r.hosts).toEqual([]);
    const ok = await callback(state);
    expect(ok.status).toBe(200);
    expect(await ok.text()).not.toContain("secret");
    expect(r.saved().refreshToken).toBe("refresh-secret");
    expect(r.hosts).toEqual(["accounts.spotify.com"]);
  });

  test("the callback answers only the loopback host", async () => {
    const r = setup();
    const res = await r.handler(new Request("http://evil.example/spotify/callback?code=c&state=s", { headers: { host: "evil.example" } }));
    expect(res.status).toBe(403);
  });

  test("a POST without the session token is refused; the status never carries a token", async () => {
    const r = setup({ clientId: CLIENT, refreshToken: "refresh-secret" });
    expect((await r.post("/api/spotify/control", { action: "pause" }, null)).status).toBe(403);
    const status = await r.handler(new Request("http://127.0.0.1:8321/api/spotify/status", { headers: { host: "127.0.0.1:8321", "sec-fetch-site": "same-origin" } }));
    const text = await status.text();
    expect(JSON.parse(text)).toMatchObject({ connected: true, premium: true, clientId: CLIENT, registerUri: "http://127.0.0.1/spotify/callback" });
    expect(text).not.toContain("secret");
    expect(r.hosts.every((h) => h === "accounts.spotify.com" || h === "api.spotify.com")).toBe(true);
  });

  test("a control is validated before anything is sent", async () => {
    const r = setup({ clientId: CLIENT, refreshToken: "refresh-secret" });
    for (const bad of [{ action: "volume", value: 101 }, { action: "seek", value: -1 }, { action: "transfer", deviceId: "../x" }, { action: "launch" }, { action: "volume", value: "9" }]) {
      expect((await r.post("/api/spotify/control", bad)).status).toBe(400);
    }
    expect(r.hosts).toEqual([]);
  });

  test("a Client ID that is not 32 hex characters is refused", async () => {
    const r = setup({});
    expect((await r.post("/api/spotify/client", { clientId: "short" })).status).toBe(400);
    expect((await r.post("/api/spotify/connect", {})).status).toBe(400);
    expect((await r.post("/api/spotify/client", { clientId: CLIENT })).status).toBe(200);
    expect(r.saved()).toEqual({ clientId: CLIENT });
  });

  test("a remote or LAN device cannot reach Spotify, the sign-in, or the callback", async () => {
    const sec = filledSec();
    const remote = createHandler(stub, settings, undefined, sec, undefined, undefined, undefined, "sidecar-secret");
    const headers = { host: "x.ts.net", "x-bunzai-sidecar-secret": "sidecar-secret" };
    expect((await remote(new Request("http://x.ts.net/api/spotify/status", { headers }))).status).toBe(403);
    expect((await remote(new Request("http://x.ts.net/spotify/callback?code=c&state=s", { headers }))).status).toBe(404);
  });
});

test("only the Spotify routes read or write the saved link, and no source outside src/ui/spotify names a Spotify host (the Settings section prints two for the person to read)", async () => {
  const { readFileSync } = await import("node:fs");
  const files = [...new Bun.Glob("**/*.{ts,tsx}").scanSync({ cwd: "src" })].map((f) => f.replaceAll("\\", "/")).filter((f) => !/\.test\.tsx?$/.test(f));
  const named = (re: RegExp): string[] => files.filter((f) => re.test(readFileSync(`src/${f}`, "utf8"))).sort();
  expect(named(/\b(?:readSpotifyLink|writeSpotifyLink)\b/)).toEqual(["kit/providers/vault.ts", "ui/spotify/routes.ts"]);
  expect(named(/spotify\.com/).filter((f) => !f.startsWith("ui/spotify/") && !["ui/_shared/platform-registry.ts", "ui/apps/settings/sections/spotify.tsx"].includes(f))).toEqual([]);
});
