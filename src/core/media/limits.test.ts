/** The shared media limits: one set of numbers; pack import is bound by them, pack print (which streams) is not. */
import { expect, test } from "bun:test";
import { zipSync } from "fflate";
import { ADAPTER_INPUT_MAX_BYTES } from "../adapter-input";
import { isArchiveLimitError, PACK_ARCHIVE_BOUNDS } from "../archive";
import { IMAGE_MAX_BYTES } from "./image-limit";
import { ASSET_BATCH_BYTES, ASSET_BATCH_COUNT, ASSET_MAX_BYTES, PACK_ZIP_MAX_BYTES, PACK_ZIP_MAX_ENTRIES } from "./limits";
import { packImageFilesFromZipBytes } from "./zip-import";

const png = (n: number): Uint8Array => { const b = new Uint8Array(n); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); return b; };

test("the pack import bounds are built from the same numbers pack print checks", () => {
  expect(PACK_ZIP_MAX_BYTES).toBe(ADAPTER_INPUT_MAX_BYTES);
  expect(PACK_ARCHIVE_BOUNDS.maxArchiveBytes).toBe(PACK_ZIP_MAX_BYTES);
  expect(PACK_ARCHIVE_BOUNDS.maxAggregateOriginal).toBe(PACK_ZIP_MAX_BYTES);
  expect(PACK_ARCHIVE_BOUNDS.maxEntries).toBe(PACK_ZIP_MAX_ENTRIES);
  expect(PACK_ARCHIVE_BOUNDS.maxEntryOriginal).toBe(IMAGE_MAX_BYTES);
  expect(PACK_ARCHIVE_BOUNDS.maxEntryCompressed).toBe(IMAGE_MAX_BYTES);
});

test("import refuses a picture over the image limit, the same limit print holds each picture to", () => {
  const ok = zipSync({ "a.png": png(IMAGE_MAX_BYTES) }, { level: 0 });
  expect(packImageFilesFromZipBytes(ok)).toHaveLength(1);
  const tooBig = zipSync({ "a.png": png(IMAGE_MAX_BYTES + 1) }, { level: 0 });
  let thrown: unknown;
  try { packImageFilesFromZipBytes(tooBig); } catch (error) { thrown = error; }
  expect(isArchiveLimitError(thrown)).toBe(true);
});

test("asset limits keep their order: a batch holds a few assets and weighs at least a few of the largest", () => {
  expect(ASSET_MAX_BYTES).toBeGreaterThan(IMAGE_MAX_BYTES);
  expect(ASSET_BATCH_BYTES).toBeGreaterThanOrEqual(ASSET_MAX_BYTES);
  expect(ASSET_BATCH_COUNT).toBe(8);
});
