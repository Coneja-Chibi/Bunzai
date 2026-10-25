/** Shared update API request settings stay consistent across release routes. */
import { expect, test } from "bun:test";
import { fetchUpdateApi } from "./update-fetch";

test("applies the bounded request settings and allows the cached ETag", async () => {
  const original = globalThis.fetch;
  let observed: RequestInit | undefined;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    observed = init;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  try {
    await fetchUpdateApi("https://api.github.com/releases", { "if-none-match": "etag-1" });
  } finally {
    globalThis.fetch = original;
  }
  expect(observed?.signal).toBeInstanceOf(AbortSignal);
  expect(observed?.headers).toEqual({
    accept: "application/vnd.github+json",
    "user-agent": "bunraku-update-check",
    "if-none-match": "etag-1",
  });
});
