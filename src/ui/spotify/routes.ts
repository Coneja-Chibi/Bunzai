/**
 * Spotify's two doors on the local server. `/api/spotify/*` is the page's own surface (token-gated like every
 * /api route, and HOST-ONLY: a tailed-in or LAN device must not drive the owner's Spotify account). The page never
 * sees a token: it sends commands and gets back plain facts. `/spotify/callback` is the loopback redirect Spotify's
 * sign-in lands on; it sits outside /api because a redirect from accounts.spotify.com is a cross-site navigation
 * that /api refuses by design, so its only gate is the single-use `state` this app issued (link.ts).
 */
import { readSpotifyLink, writeSpotifyLink } from "../../kit/providers/vault";
import { err, json, openInBrowser, readJsonObject, hostAllowed, type UiSecurityContext } from "../server-security";
import { spotifyFetchers, SpotifyApiError, SpotifyAuthError } from "./client";
import { createSpotifyLink, type Control, type SpotifyLinkService } from "./link";

export const CALLBACK_PATH = "/spotify/callback";
let service: SpotifyLinkService | null = null;

/** The one link for this process (the vault, the real network, the OS browser). Tests install their own. */
export function spotifyService(): SpotifyLinkService {
  service ??= createSpotifyLink({ store: { read: () => readSpotifyLink(), write: (l) => writeSpotifyLink(l) }, fetchers: spotifyFetchers(), open: openInBrowser });
  return service;
}
export function installSpotifyService(next: SpotifyLinkService | null): void { service = next; }

const page = (title: string, line: string, status: number): Response =>
  new Response(`<!doctype html><meta charset="utf-8"><title>${title}</title><p>${line}</p>`, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    },
  });

/** GET /spotify/callback?code&state. Loopback host only; refuses anything whose state this app did not issue. */
export async function handleSpotifyCallback(req: Request, sec: UiSecurityContext, svc: SpotifyLinkService = spotifyService()): Promise<Response> {
  if (req.method !== "GET") return err("method not allowed", 405);
  if (!sec.expectedHost || !hostAllowed(req.headers.get("host") ?? "", sec.expectedHost)) return err("forbidden", 403);
  const ok = await svc.callback(new URL(req.url).searchParams).catch(() => false);
  return ok
    ? page("Spotify connected", "Spotify is connected. You can close this tab and go back to Bunraku.", 200)
    : page("Spotify not connected", "That sign-in could not be completed. Go back to Bunraku, open Settings, and press Connect again.", 400);
}

function failure(e: unknown): Response {
  if (e instanceof SpotifyAuthError) return json({ error: "Spotify is not connected. Connect it in Settings.", code: "not-connected" }, 401);
  if (e instanceof SpotifyApiError) {
    if (e.reason === "PREMIUM_REQUIRED") return json({ error: "Spotify needs Premium to control playback.", code: "premium-required" }, 403);
    if (e.reason === "NO_ACTIVE_DEVICE" || e.status === 404) return json({ error: "No Spotify device is playing. Open Spotify on a device.", code: "no-device" }, 404);
    if (e.status === 429) {
      const slow = json({ error: "Spotify asked us to slow down.", code: "rate-limited" }, 429);
      slow.headers.set("retry-after", e.retryAfter ?? "5");
      return slow;
    }
    if (e.status === 401 || e.status === 403) return json({ error: "Spotify refused that.", code: "refused" }, 403);
  }
  return json({ error: "Spotify did not answer.", code: "unavailable" }, 502);
}

const DEVICE = /^[A-Za-z0-9]{1,128}$/;
function parseControl(b: Record<string, unknown>): Control | null {
  const action = b["action"];
  if (action === "play" || action === "pause" || action === "next" || action === "previous") return { action };
  const value = b["value"];
  if (action === "seek" && typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 86_400_000) return { action, value };
  if (action === "volume" && typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100) return { action, value };
  const deviceId = b["deviceId"];
  if (action === "transfer" && typeof deviceId === "string" && DEVICE.test(deviceId)) return { action, deviceId };
  return null;
}

/** The /api/spotify/* routes; null for any other path. The /api gate already ran. */
export async function handleSpotifyRoutes(p: string, req: Request, sec: UiSecurityContext, svc: SpotifyLinkService = spotifyService()): Promise<Response | null> {
  if (!p.startsWith("/api/spotify/")) return null;
  const get = req.method === "GET";
  try {
    if (get && p === "/api/spotify/status") return json(await svc.status(sec.expectedHost));
    if (get && p === "/api/spotify/playback") return json(await svc.playback());
    if (get && p === "/api/spotify/devices") return json(await svc.devices());
    if (req.method !== "POST") return err("not found", 404);
    if (p === "/api/spotify/disconnect") { await svc.disconnect(); return json({ ok: true }); }
    if (p === "/api/spotify/connect") {
      const url = await svc.connect(sec.expectedHost);
      return url ? json({ url }) : err("Enter your Spotify Client ID first.", 400);
    }
    const body = await readJsonObject(req, 4096);
    if (!body.ok) return body.response;
    if (p === "/api/spotify/client") {
      const id = body.value["clientId"];
      return typeof id === "string" && (await svc.setClientId(id)) ? json({ ok: true }) : err("A Spotify Client ID is 32 letters and digits.", 400);
    }
    if (p === "/api/spotify/control") {
      const control = parseControl(body.value);
      if (!control) return err("unknown control", 400);
      await svc.control(control);
      return json({ ok: true });
    }
    return err("not found", 404);
  } catch (e) {
    return failure(e);
  }
}
