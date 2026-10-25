/** The /api/asset/<sha> path reader: exactly 64 lowercase hex, nothing else. */
import { expect, test } from "bun:test";
import { assetRouteSha } from "./asset-route";

const sha = "e".repeat(64);

test("a path names its digest only when it is exactly /api/asset/ plus 64 lowercase hex", () => {
  expect(assetRouteSha(`/api/asset/${sha}`)).toBe(sha);
  expect(assetRouteSha(`/api/asset/${sha}/x`)).toBeNull();
  expect(assetRouteSha(`/api/asset/${sha}?size=96`)).toBeNull();
  expect(assetRouteSha(`/api/asset/${sha.toUpperCase()}`)).toBeNull();
  expect(assetRouteSha("/api/asset/upload")).toBeNull();
  expect(assetRouteSha(`/api/other/${sha}`)).toBeNull();
});
