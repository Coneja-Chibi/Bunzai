/** The pack editor's zip door reads a printed pack's sounds too, staging each under a real extension. */
import { expect, test } from "bun:test";
import { zipSync } from "fflate";
import { importSpriteZip } from "./zip-import";

test("a zip with a sound and a picture stages both, the sound as .mp3 with its audio type", async () => {
  const staged: { name: string; type: string; size: number }[] = [];
  const batch = async (files: File[]) => files.map((f, i) => { staged.push({ name: f.name, type: f.type, size: f.size }); return { receipt: `r${String(i)}`, ref: `ref${String(i)}` }; });
  const zip = zipSync({ "Tavern.mp3": new Uint8Array(500).fill(7), "Face.png": new Uint8Array(40).fill(3) });
  const result = await importSpriteZip(new File([zip.buffer as ArrayBuffer], "pack.zip"), { items: [] }, (async () => ({})) as never, batch as never, new AbortController().signal);
  expect(staged.map((s) => [s.name, s.type, s.size]).sort()).toEqual([["Face.png", "image/png", 40], ["Tavern.mp3", "audio/mpeg", 500]]);
  expect(result.pack?.items.map((i) => [i.label, i.mime]).sort()).toEqual([["Face", "image/png"], ["Tavern", "audio/mpeg"]]);
});
