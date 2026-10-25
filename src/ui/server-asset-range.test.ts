/** The asset route's Range support: 206 with exactly the asked bytes, 416 for a range past the end, and what each answer reads. */
import { describe, expect, test } from "bun:test";
import type { StudioStoreLike } from "../studio/contracts";
import { handleAssetRoute } from "./server-assets";
import { parseRange } from "./_shared/asset-range";

const sha = "a".repeat(64);
const SIZE = 10_000;
const song = Uint8Array.from({ length: SIZE }, (_, i) => (i === 0 ? 0x49 : i === 1 ? 0x44 : i === 2 ? 0x33 : i % 251));
function rig() {
  const reads: number[] = [];
  const store = {
    assetSize: async () => ({ status: "ok" as const, bytes: SIZE }),
    readAsset: async (_sha: string, max: number) => { reads.push(max); return { status: "ok" as const, bytes: song }; },
  } as unknown as StudioStoreLike;
  const get = (range?: string | null, method = "GET"): Promise<Response | null> => handleAssetRoute(`/api/asset/${sha}`, new URL(`http://x/api/asset/${sha}`), store, method, range);
  return { reads, get };
}

describe("parseRange", () => {
  test("one byte range in its three spellings; anything else is ignored; past the end is unsatisfiable", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ kind: "partial", start: 0, end: 99 });
    expect(parseRange("bytes=900-", 1000)).toEqual({ kind: "partial", start: 900, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ kind: "partial", start: 900, end: 999 });
    expect(parseRange("bytes=990-5000", 1000)).toEqual({ kind: "partial", start: 990, end: 999 });
    expect(parseRange("bytes=1000-1001", 1000)).toEqual({ kind: "unsatisfiable" });
    expect(parseRange("bytes=-0", 1000)).toEqual({ kind: "unsatisfiable" });
    expect(parseRange("bytes=5-2", 1000)).toEqual({ kind: "none" });
    for (const odd of ["items=0-5", "bytes=0-5,10-20", "bytes=a-b", "bytes=", "", null]) expect(parseRange(odd, 1000)).toEqual({ kind: "none" });
  });
});

describe("GET /api/asset/<sha> with Range", () => {
  test("a full answer says it accepts ranges", async () => {
    const r = rig();
    const res = (await r.get())!;
    expect(res.status).toBe(200);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect((await res.arrayBuffer()).byteLength).toBe(SIZE);
  });

  test("a range returns exactly those bytes, 206, with Content-Range and the right length", async () => {
    const r = rig();
    const res = (await r.get("bytes=1000-1999"))!;
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes 1000-1999/${String(SIZE)}`);
    expect(res.headers.get("content-length")).toBe("1000");
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([...song.subarray(1000, 2000)]);
  });

  test("open-ended and suffix ranges seek to the tail", async () => {
    const r = rig();
    const tail = (await r.get("bytes=9990-"))!;
    expect(tail.headers.get("content-range")).toBe(`bytes 9990-9999/${String(SIZE)}`);
    expect([...new Uint8Array(await tail.arrayBuffer())]).toEqual([...song.subarray(9990)]);
    const last = (await r.get("bytes=-5"))!;
    expect([...new Uint8Array(await last.arrayBuffer())]).toEqual([...song.subarray(SIZE - 5)]);
  });

  test("a range past the end gets 416 with the size, and nothing is read", async () => {
    const r = rig();
    const res = (await r.get(`bytes=${String(SIZE)}-${String(SIZE + 5)}`))!;
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe(`bytes */${String(SIZE)}`);
    expect(r.reads).toEqual([]);
  });

  test("a range we do not understand is answered in full, never with a wrong slice", async () => {
    const r = rig();
    expect((await r.get("bytes=0-5,10-20"))!.status).toBe(200);
    expect((await r.get("items=0-5"))!.status).toBe(200);
  });

  test("HEAD with a range does not read the file", async () => {
    const r = rig();
    const res = (await r.get("bytes=0-9", "HEAD"))!;
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(r.reads).toEqual([]);
  });

  test("a single read is bounded by the media cap, never unbounded", async () => {
    const r = rig();
    await r.get("bytes=0-9");
    expect(r.reads).toEqual([32 * 1024 * 1024]);
  });
});
