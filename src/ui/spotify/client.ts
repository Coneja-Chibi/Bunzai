/**
 * Every byte this app sends to Spotify goes through the two fetches built here, each locked to ONE host by the
 * egress gate's guardedFetch (which also refuses a redirect to anywhere else): `accounts.spotify.com` for the
 * token exchange and `api.spotify.com` for the Web API. Nothing else in the app talks to Spotify, and the
 * page itself cannot (its CSP is `connect-src 'self'`). Tokens are arguments and return values here, never logged.
 */
import { guardedFetch } from "../../kit/providers/egress";

export const ACCOUNTS_HOST = "accounts.spotify.com";
export const API_HOST = "api.spotify.com";
type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface Fetchers { accounts: Fetch; api: Fetch }
export const spotifyFetchers = (raw: Fetch = globalThis.fetch): Fetchers => ({
  accounts: guardedFetch(ACCOUNTS_HOST, raw) as unknown as Fetch,
  api: guardedFetch(API_HOST, raw) as unknown as Fetch,
});

export interface Tokens { accessToken: string; expiresAt: number; refreshToken?: string }

/** The sign-in is no longer good (revoked, expired, wrong app): the person must connect again. */
export class SpotifyAuthError extends Error {}
/** The Web API said no. `reason` is Spotify's own short code (PREMIUM_REQUIRED, NO_ACTIVE_DEVICE); never a token. */
export class SpotifyApiError extends Error {
  constructor(readonly status: number, readonly reason: string, readonly retryAfter?: string) { super(`Spotify answered ${String(status)}`); }
}

async function tokenRequest(f: Fetchers, form: Record<string, string>, now: number): Promise<Tokens> {
  const response = await f.accounts(`https://${ACCOUNTS_HOST}/api/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString(),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || typeof body["access_token"] !== "string") {
    throw new SpotifyAuthError(body["error"] === "invalid_grant" ? "Spotify no longer accepts this sign-in" : "Spotify refused the sign-in");
  }
  const seconds = typeof body["expires_in"] === "number" ? body["expires_in"] : 3600;
  return {
    accessToken: body["access_token"], expiresAt: now + seconds * 1000,
    ...(typeof body["refresh_token"] === "string" ? { refreshToken: body["refresh_token"] } : {}),
  };
}

export const exchangeCode = (f: Fetchers, a: { clientId: string; code: string; verifier: string; redirectUri: string }, now: number): Promise<Tokens> =>
  tokenRequest(f, { grant_type: "authorization_code", code: a.code, redirect_uri: a.redirectUri, client_id: a.clientId, code_verifier: a.verifier }, now);

export const refreshTokens = (f: Fetchers, a: { clientId: string; refreshToken: string }, now: number): Promise<Tokens> =>
  tokenRequest(f, { grant_type: "refresh_token", refresh_token: a.refreshToken, client_id: a.clientId }, now);

/** One Web API call. 204 and empty bodies answer null; any non-2xx throws SpotifyApiError. */
export async function apiCall(f: Fetchers, token: string, method: string, path: string, query: Record<string, string> = {}, body?: unknown): Promise<unknown> {
  const url = new URL(`https://${API_HOST}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const response = await f.api(url, {
    method, headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const parsed: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = typeof parsed === "object" && parsed !== null ? (parsed as { error?: { reason?: unknown } }).error : undefined;
    throw new SpotifyApiError(response.status, typeof error?.reason === "string" ? error.reason : "", response.headers.get("retry-after") ?? undefined);
  }
  return parsed;
}
