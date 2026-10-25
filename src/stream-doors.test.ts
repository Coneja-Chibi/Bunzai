/**
 * The stream-door list: raw stream readers (`.getReader(`,
 * `.fromWeb(`) and fflate's whole-buffer sync calls (zipSync, unzipSync, gzipSync, gunzipSync,
 * deflateSync, inflateSync, zlibSync, unzlibSync, decompressSync, compressSync) may appear only in the
 * files listed here, each with its exact call count and its reason. Raw stream readers belong to ONE file,
 * src/core/stream-bytes.ts (the byte pump: it always cancels the source); everything else reads a stream
 * through `pumpStream`, `readStreamCapped` or `chunksOf`. The zip doors are src/core/archive.ts,
 * src/core/archive-stream.ts and src/core/media/pack-zip.ts plus the listed exports and the browser-side
 * zips below, which the download slices remove. Same shape and rules as src/whole-buffer.test.ts and
 * src/disk-writes.test.ts. Seeded in S0, narrowed by the byte-pump slice.
 */
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { stripComments } from "../scripts/hooks/lib";

interface Entry { count: number; reason: string }

const ALLOWED: Record<string, Entry> = {
  // The one byte pump (src/core/stream-bytes.ts) and the zip codecs. Every other stream read goes through the pump.
  "src/core/stream-bytes.ts": { count: 1, reason: "the byte pump's chunksOf: the only getReader in the repo" },
  "src/core/archive.ts": { count: 1, reason: "unzipBounded's unzipSync: the whole-zip door under CARD/PACK bounds" },
  "src/formats/backyard/byaf-container.ts": { count: 1, reason: "zipSync of a byaf export" },
  "src/formats/lumiverse/index.ts": { count: 1, reason: "zipSync of a charx export" },
  "src/formats/risu/index.ts": { count: 1, reason: "zipSync of a charx export" },
  "src/formats/lumiverse-archive/characters.ts": { count: 1, reason: "zipSync of one character's export inside the backup importer" },
  "src/formats/image-pack/index.ts": { count: 1, reason: "zipSync of the picture-zip export" },
  "src/studio/signature-color.ts": { count: 1, reason: "unzlibSync of one PNG's pixel data to pick a color, output sized from the header" },
  // Browser side.
  "src/ui/_shared/picture-folder.ts": { count: 1, reason: "zipSync of dropped pictures (row 22)" },
};

const DOORS =
  /\.getReader\(|\.fromWeb\(|\b(?:zipSync|unzipSync|gzipSync|gunzipSync|deflateSync|inflateSync|zlibSync|unzlibSync|decompressSync|compressSync)\(/g;
/** Authored runtime sources: no tests, contract suites, test stand-ins or fixtures. */
const scanned = (path: string): boolean =>
  /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) && !/\.contract(-fixtures)?\.tsx?$/.test(path) &&
  !/(^|\/)(fake-[^/]*|[^/]*-rig|[^/]*-test-support|test-[^/]*)\.tsx?$/.test(path) && !/(^|\/)(node_modules|_fixtures|generated)\//.test(path);

const counts = (): Map<string, number> => {
  const found = new Map<string, number>();
  for (const file of readdirSync("src", { recursive: true }).map((p) => `src/${String(p).replace(/\\/g, "/")}`).filter(scanned)) {
    const n = stripComments(readFileSync(file, "utf8")).match(DOORS)?.length ?? 0;
    if (n > 0) found.set(file, n);
  }
  return found;
};

test("no source file opens a raw stream reader or a sync zip door unless it is on the list", () => {
  const found = counts();
  expect([...found].filter(([file]) => !(file in ALLOWED)).map(([file, n]) => `${file} (${n})`)).toEqual([]);
});

test("a listed file makes exactly the calls it is listed for", () => {
  const found = counts();
  expect(Object.entries(ALLOWED).filter(([file, entry]) => (found.get(file) ?? 0) !== entry.count).map(([file, entry]) => `${file}: listed ${entry.count}, found ${found.get(file) ?? 0}`)).toEqual([]);
});

test("every entry states a reason", () => {
  expect(Object.entries(ALLOWED).filter(([, e]) => !e.reason.trim() || e.count < 1).map(([file]) => file)).toEqual([]);
});
