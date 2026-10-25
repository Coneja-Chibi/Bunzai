/** A card's cover still shows when this runtime cannot make thumbnails: the asset route serves the picture itself, bounded. */
import { expect, test } from "bun:test";
import { handleAssetRoute } from "./server-assets";
import type { StudioStoreLike } from "../studio/contracts";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 0x90, 0x77, 0x53, 0xde]);
const sha = "a".repeat(64);
const store = (over: Partial<StudioStoreLike>): StudioStoreLike => ({
  readThumbnail: async () => { throw new Error("undefined is not a constructor (evaluating 'new Bun.Image')"); },
  readAsset: async () => ({ status: "ok", bytes: png }),
  assetSize: async () => ({ status: "ok", bytes: png.length }),
  ...over,
}) as unknown as StudioStoreLike;

test("when the thumbnail codec is unavailable, a sized request gets the picture itself", async () => {
  const res = await handleAssetRoute(`/api/asset/${sha}`, new URL(`http://x/api/asset/${sha}?size=256`), store({}));
  expect(res?.status).toBe(200);
  expect(res?.headers.get("content-type")).toBe("image/png");
  expect(new Uint8Array(await res!.arrayBuffer())).toEqual(png);
});

test("the fallback never serves a picture too heavy to stand in for a thumbnail", async () => {
  const res = await handleAssetRoute(`/api/asset/${sha}`, new URL(`http://x/api/asset/${sha}?size=96`), store({ assetSize: async () => ({ status: "ok", bytes: 20 * 1024 * 1024 }) }));
  expect(res?.status).toBe(500);
});
