/**
 * The PKCE half of the Spotify sign-in (RFC 7636): verifier, S256 challenge, state, the loopback redirect and the
 * authorize URL. Spotify's rule: a redirect URI is https unless it is a loopback IP literal (`http://127.0.0.1:<port>`);
 * `localhost` is refused. There is no client secret anywhere: the person's own Spotify app id is the only identity.
 */
import { createHash, randomBytes } from "node:crypto";

export const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
export const REDIRECT_PATH = "/spotify/callback";
/** Read and control playback; nothing else. No `streaming`: the Web Playback SDK is never loaded. */
export const SCOPES = ["user-read-playback-state", "user-modify-playback-state", "user-read-currently-playing"] as const;

export const newVerifier = (): string => randomBytes(64).toString("base64url");
export const newState = (): string => randomBytes(32).toString("base64url");
export const challengeOf = (verifier: string): string => createHash("sha256").update(verifier).digest("base64url");

/** The redirect for the host this server listens on (`127.0.0.1:<port>`); anything but the IPv4 loopback literal is refused. */
export function redirectUriFor(host: string): string {
  if (!/^127\.0\.0\.1:\d{1,5}$/.test(host)) throw new Error("Spotify sign-in needs the app to listen on 127.0.0.1");
  return `http://${host}${REDIRECT_PATH}`;
}

export function authorizeUrl(a: { clientId: string; redirectUri: string; challenge: string; state: string }): string {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: a.clientId, response_type: "code", redirect_uri: a.redirectUri, scope: SCOPES.join(" "),
    code_challenge_method: "S256", code_challenge: a.challenge, state: a.state,
  }).toString();
  return url.toString();
}
