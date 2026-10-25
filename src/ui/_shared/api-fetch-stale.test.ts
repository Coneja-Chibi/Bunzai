/** A refused stale-session request must request recovery without navigating away from unsaved work. */
import { expect, test } from "bun:test";
import { apiFetchJson, apiStatusIs } from "./api-fetch";
import { installDom } from "./test-dom";

test("stale-session responses announce recovery and remain refused; ordinary refusals do not request reload", async () => {
  const installed = installDom('<!doctype html><meta name="vaude-session" content="fixture-token">', { extraGlobals: ["Event", "location"] });
  const originalFetch = globalThis.fetch; let offers = 0;
  installed.dom.window.addEventListener("bunraku:session-stale", () => { offers++; });
  try {
    for (const error of ["stale session", "permission denied"]) {
      globalThis.fetch = Object.assign(async () => new Response(JSON.stringify({ error }), { status: 403 }), { preconnect: originalFetch.preconnect });
      const failure = await apiFetchJson("/api/fixture").then(() => null, (error: unknown) => error);
      expect(apiStatusIs(failure, 403)).toBe(true); expect(offers).toBe(1);
    }
  } finally { globalThis.fetch = originalFetch; await installed.teardown(); }
});
