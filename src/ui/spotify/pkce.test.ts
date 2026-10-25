/** PKCE pieces for the Spotify sign-in: verifier shape, S256 challenge (RFC 7636 appendix B vector), the authorize URL. */
import { describe, expect, test } from "bun:test";
import { authorizeUrl, challengeOf, newState, newVerifier, REDIRECT_PATH, redirectUriFor, SCOPES } from "./pkce";

describe("pkce", () => {
  test("a verifier is 43 to 128 unreserved characters and never repeats", () => {
    const a = newVerifier();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(newVerifier()).not.toBe(a);
  });

  test("the challenge is the S256 of the verifier (RFC 7636 appendix B)", () => {
    expect(challengeOf("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  test("a state is unguessable", () => {
    expect(newState()).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(newState()).not.toBe(newState());
  });

  test("the redirect uri is the loopback literal, never localhost", () => {
    expect(redirectUriFor("127.0.0.1:8321")).toBe(`http://127.0.0.1:8321${REDIRECT_PATH}`);
    expect(() => redirectUriFor("localhost:8321")).toThrow();
  });

  test("the authorize url carries S256, the state, and only playback scopes", () => {
    const url = new URL(authorizeUrl({ clientId: "a".repeat(32), redirectUri: "http://127.0.0.1:8321/spotify/callback", challenge: "ch", state: "st" }));
    expect(url.origin).toBe("https://accounts.spotify.com");
    expect(url.pathname).toBe("/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("client_id")).toBe("a".repeat(32));
    expect(url.searchParams.get("scope")).toBe(SCOPES.join(" "));
    expect(SCOPES).not.toContain("streaming");
    expect(url.searchParams.has("client_secret")).toBe(false);
  });
});
