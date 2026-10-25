/** Prove bounded inert SVG materialization and immediate/stale URL cleanup. */
import { describe, expect, test } from "bun:test";
import { sha256HexBytes } from "../../core/sha256";
import type { EffectiveThemeAppearance } from "../../extensions/theme-contract";
import { deriveThemeScopes } from "../../extensions/theme-appearance";
import { createThemeAssetUrls } from "./theme-asset-urls";

const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>';
const digest = sha256HexBytes(new TextEncoder().encode(source));
const appearance: EffectiveThemeAppearance = {
  themeId: "bunraku.theme.encore", packageId: "bunraku.theme.encore", digest: "a".repeat(64),
  grantedScopes: deriveThemeScopes({ assets: 1, fonts: 0, styles: false, slots: 0 }), appearance: null, fonts: [], styles: null, slots: {},
  assets: [{ id: "mark", url: `/api/themes/assets/bunraku.theme.encore/mark?digest=${"a".repeat(64)}`, digest, mediaType: "image/svg+xml" }],
};
const response = (): Response => new Response(source, { headers: { "content-type": "image/svg+xml; charset=utf-8" } });

describe("theme asset URL materialization", () => {

  test("unchanged verified references retain URLs until replacement or release", async () => {
    const revoked: string[] = [];
    let number = 0, fetches = 0;
    const urls = createThemeAssetUrls({
      fetchAsset: async () => { fetches++; return response(); },
      createUrl: () => `blob:${String(number++)}`, revokeUrl: (url) => revoked.push(url),
    });
    const first = await urls.materialize(appearance, () => true);
    const same = await urls.materialize(JSON.parse(JSON.stringify(appearance)), () => true);
    expect(same).toEqual(first);
    expect(fetches).toBe(1);
    expect(revoked).toEqual([]);
    const changed = { ...appearance, digest: "b".repeat(64), assets: [{ ...appearance.assets[0]!, url: "/api/themes/assets/new/mark?digest=" + "b".repeat(64) }] };
    expect((await urls.materialize(changed, () => true))?.mark).toBe("blob:1");
    expect(revoked).toEqual(["blob:0"]);
    urls.release();
    expect(revoked).toEqual(["blob:0", "blob:1"]);
    expect((await urls.materialize(changed, () => true))?.mark).toBe("blob:2");
    urls.release();
  });

  test("verifies inert bytes, maps them to an object URL, and revokes on release", async () => {
    const revoked: string[] = [];
    let number = 0;
    const urls = createThemeAssetUrls({ fetchAsset: async () => response(), createUrl: () => `blob:${String(number++)}`, revokeUrl: (url) => revoked.push(url) });
    const mapped = await urls.materialize(appearance, () => true);
    expect(mapped?.mark).toBe("blob:0");
    urls.release();
    expect(revoked).toEqual(["blob:0"]);
  });

  test("revokes an in-flight generation before it can publish its URL", async () => {
    const revoked: string[] = [];
    let resolveFetch!: (value: Response) => void;
    const urls = createThemeAssetUrls({
      fetchAsset: () => new Promise((resolve) => { resolveFetch = resolve; }),
      createUrl: () => "blob:stale", revokeUrl: (url) => revoked.push(url),
    });
    const result = urls.materialize(appearance, () => true);
    urls.release();
    resolveFetch(response());
    expect(await result).toBeNull();
    expect(revoked).toEqual([]);
  });

  test("rejects byte tampering and active SVG", async () => {
    const active = new Response('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', { headers: { "content-type": "image/svg+xml" } });
    let fetches = 0;
    const twoAssets = { ...appearance, assets: [...appearance.assets, { id: "later", url: "/api/themes/assets/pkg/later?digest=x", digest, mediaType: "image/svg+xml" as const }] };
    const urls = createThemeAssetUrls({ fetchAsset: async () => { fetches++; return active; }, createUrl: () => "blob:bad", revokeUrl: () => undefined });
    const failure = await urls.materialize(twoAssets, () => true).then(() => null, (error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(fetches).toBe(1);
  });

  test("rejects an inert SVG with the wrong digest, wrong MIME, oversized bytes, or invalid UTF-8", async () => {
    const failures: (() => Promise<unknown>)[] = [];
    const wrongDigest = createThemeAssetUrls({ fetchAsset: async () => response() });
    failures.push(() => wrongDigest.materialize({ ...appearance, assets: [{ ...appearance.assets[0]!, digest: "0".repeat(64) }] }, () => true));
    const wrongMime = createThemeAssetUrls({ fetchAsset: async () => new Response(source, { headers: { "content-type": "text/plain" } }) });
    failures.push(() => wrongMime.materialize(appearance, () => true));
    const oversized = createThemeAssetUrls({ fetchAsset: async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(96_001)); controller.close(); },
    }), { headers: { "content-type": "image/svg+xml" } }) });
    failures.push(() => oversized.materialize(appearance, () => true));
    const invalidUtf8 = createThemeAssetUrls({ fetchAsset: async () => new Response(new Uint8Array([0xff]), { headers: { "content-type": "image/svg+xml" } }) });
    failures.push(() => invalidUtf8.materialize(appearance, () => true));
    for (const failure of failures) await expect(failure()).rejects.toThrow();
  });

  test("cleans an already-created URL when a later asset in the same generation fails", async () => {
    const revoked: string[] = [];
    let number = 0;
    let fetches = 0;
    const urls = createThemeAssetUrls({
      fetchAsset: async () => ++fetches === 1 ? response() : new Response("wrong", { headers: { "content-type": "text/plain" } }),
      createUrl: () => `blob:${String(number++)}`, revokeUrl: (url) => revoked.push(url),
    });
    const twoAssets = { ...appearance, assets: [...appearance.assets, { id: "later", url: "/api/themes/assets/pkg/later", digest, mediaType: "image/svg+xml" as const }] };
    await expect(urls.materialize(twoAssets, () => true)).rejects.toThrow();
    expect(revoked).toEqual(["blob:0"]);
  });
});

describe("theme asset body bound", () => {
  test("an oversized body is refused with the bound error even when the stream refuses to cancel", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    const body = new ReadableStream<Uint8Array>({ pull: (c) => c.enqueue(chunk), cancel() { throw new Error("cancel refused"); } });
    const urls = createThemeAssetUrls({
      fetchAsset: async () => new Response(body, { headers: { "content-type": "image/svg+xml" } }),
      createUrl: () => "blob:x", revokeUrl: () => undefined,
    });
    const failure = await urls.materialize(appearance, () => true).then(() => null, (error: unknown) => error);
    expect((failure as Error).message).toBe("theme asset exceeds its bound");
  });
});
