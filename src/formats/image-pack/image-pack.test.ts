/** The image-pack codec: claims a ZIP of pictures only, reads one item per picture, and never claims a card or a backup. */
import { beforeAll, expect, test } from "bun:test";
import { strToU8, unzipSync, zipSync } from "fflate";
import { loadFormats } from "../../core";
import { IMAGE_MAX_BYTES } from "../../core/media/image-limit";
import { PACK_ZIP_MAX_ENTRIES } from "../../core/media/limits";
import { PACK_ARCHIVE_BOUNDS } from "../../core/archive";
import imagePack from "./index";
import { inspectBytes } from "../../ui/engine-actions";

beforeAll(async () => { await loadFormats(); });

const bytes = (n: number): Uint8Array => new Uint8Array(Array.from({ length: n }, (_, i) => (i * 7) % 251));
const zip = (files: Record<string, Uint8Array>): Uint8Array => zipSync(files);

test("a ZIP of pictures is claimed, and junk beside them does not stop it", () => {
  expect(imagePack.detect({ bytes: zip({ "a.jpg": bytes(40), "b.png": bytes(30) }) })).toBeGreaterThanOrEqual(0.5);
  expect(imagePack.detect({ bytes: zip({ "backgrounds/a.jpg": bytes(40), "__MACOSX/._a.jpg": bytes(4), ".DS_Store": bytes(4), "Thumbs.db": bytes(4) }) })).toBeGreaterThanOrEqual(0.5);
});

test("a ZIP with anything else in it, an empty one, and a file that is not a ZIP are not claimed", () => {
  expect(imagePack.detect({ bytes: zip({ "a.jpg": bytes(40), "card.json": strToU8("{}") }) })).toBe(0);
  expect(imagePack.detect({ bytes: zip({ "notes.txt": strToU8("x") }) })).toBe(0);
  expect(imagePack.detect({ bytes: zip({}) })).toBe(0);
  expect(imagePack.detect({ bytes: bytes(100) })).toBe(0);
  expect(imagePack.detect({ text: "{}" })).toBe(0);
});

test("reading names the pack for the file and makes one item per picture, labeled by its file name", () => {
  const entity = imagePack.toCanonical({ filename: "backgrounds.zip", bytes: zip({ "harbor.jpg": bytes(40), "tavern.png": bytes(30) }) });
  expect(entity.kind).toBe("pack");
  expect(entity.body.name).toBe("backgrounds");
  expect(entity.id).toBe("backgrounds");
  expect(entity.body.pack.items.map((i) => i.label).sort()).toEqual(["harbor", "tavern"]);
  expect(entity.body.pack.items.every((i) => i.ref.startsWith("data:image/") && i.id !== "")).toBe(true);
  expect(() => imagePack.toCanonical({ filename: "x.zip", bytes: zip({ "card.json": strToU8("{}") }) })).toThrow();
});

test("writing a pack back gives a ZIP that reads as the same pictures", () => {
  const entity = imagePack.toCanonical({ filename: "b.zip", bytes: zip({ "harbor.jpg": bytes(40), "tavern.png": bytes(30) }) });
  const out = imagePack.fromCanonical(entity);
  expect(out.suggestedExtension).toBe("zip");
  const again = imagePack.toCanonical({ filename: "b.zip", bytes: out.bytes! });
  expect(again.body.pack.items.map((i) => [i.label, i.ref]).sort()).toEqual(entity.body.pack.items.map((i) => [i.label, i.ref]).sort());
  const upload = { ...entity, body: { ...entity.body, pack: { items: [{ id: "x", label: "up", ref: "\u0000b:u:image/png:" + "a".repeat(64) }] } } };
  expect(() => imagePack.fromCanonical(upload)).toThrow(/inline/);
});

test("through the import door: a ZIP of pictures inspects as a pack, and a card ZIP stays unrecognised", () => {
  const ok = inspectBytes(zip({ "a.jpg": bytes(40), "b.png": bytes(30) }), "backgrounds.zip");
  expect(ok.ok).toBe(true);
  if (ok.ok) { expect(ok.kind).toBe("pack"); expect(ok.formatId).toBe("image-pack"); }
  expect(inspectBytes(zip({ "card.json": strToU8("{}") }), "x.zip").ok).toBe(false);
});

test("two pictures that share a name are both read, and both written back as separate files", () => {
  const a = bytes(40);
  const b = bytes(55);
  const entity = imagePack.toCanonical({ filename: "dupes.zip", bytes: zip({ "room.jpg": a, "room.png": b, "sub/Room.webp": bytes(20) }) });
  expect(entity.body.pack.items).toHaveLength(3);
  expect(new Set(entity.body.pack.items.map((i) => i.label.toLowerCase())).size).toBe(3);
  const out = imagePack.fromCanonical(entity);
  const files = unzipSync(out.bytes!);
  expect(Object.keys(files)).toHaveLength(3);
  expect(new Set(Object.keys(files).map((n) => n.toLowerCase())).size).toBe(3);
  expect(Object.values(files).map((f) => f.length).sort()).toEqual([20, 40, 55]);
});

test("writing never lets two pictures take one file name, even when the pack was not normalized", () => {
  const png = (n: number): string => `data:image/png;base64,${Buffer.from(bytes(n)).toString("base64")}`;
  const entity = imagePack.toCanonical({ filename: "p.zip", bytes: zip({ "a.png": bytes(10) }) });
  const raw = { ...entity, body: { ...entity.body, pack: { items: [{ id: "1", label: "a", ref: png(11) }, { id: "2", label: "A", ref: png(12) }, { id: "3", label: "a/b", ref: png(13) }] } } };
  const files = unzipSync(imagePack.fromCanonical(raw).bytes!);
  expect(Object.values(files).map((f) => f.length).sort()).toEqual([11, 12, 13]);
  expect(Object.keys(files).some((n) => n.includes("/"))).toBe(false);
});

// Print and import share one set of limits (core/media/limits.ts): the zip is capped at the import door's whole-file
// ceiling, one picture at the image limit, and the entry count. A zip past any of them is still recognised, and the
// refusal says which and what the limit is.
test("a ZIP with a picture over the image limit is still recognised, and the refusal says it is too large and what the limit is", () => {
  const big = zipSync({ "a.jpg": new Uint8Array(IMAGE_MAX_BYTES + 1).fill(7) }, { level: 0 });
  expect(big.length).toBeLessThan(PACK_ARCHIVE_BOUNDS.maxArchiveBytes);
  expect(imagePack.detect({ bytes: big })).toBeGreaterThanOrEqual(0.5);
  const result = inspectBytes(big, "huge.zip");
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toMatch(/too large/i);
    expect(result.error).toContain("10 MB");
    expect(result.error).not.toMatch(/format we know|damaged/i);
  }
});

test("a ZIP with more pictures than a pack holds is still recognised, and the refusal gives the count limit", () => {
  const many = zipSync(Object.fromEntries(Array.from({ length: PACK_ZIP_MAX_ENTRIES + 1 }, (_, i) => [`p${i}.png`, bytes(8)])), { level: 0 });
  expect(imagePack.detect({ bytes: many })).toBeGreaterThanOrEqual(0.5);
  const result = inspectBytes(many, "many.zip");
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain(String(PACK_ZIP_MAX_ENTRIES));
});

test("a zip of pictures that is not too large is unaffected by the limit check", () => {
  expect(inspectBytes(zip({ "a.jpg": bytes(40) }), "ok.zip").ok).toBe(true);
});

// Print then import: the zip the Press writes (core/media/pack-zip.ts) must read back with every sound byte for byte.
const printed = async (items: { label: string; mime: string; data: Uint8Array }[]): Promise<Uint8Array> => {
  const { packEntryNames, zipStored } = await import("../../core/media/pack-zip");
  const names = packEntryNames(items);
  const chunks: Uint8Array[] = [];
  for await (const c of zipStored(items.map((it, i) => ({ name: names[i]!, bytes: async () => it.data })))) chunks.push(c);
  return Uint8Array.from(chunks.flatMap((c) => [...c]));
};
const sound = (n: number, seed: number): Uint8Array => Uint8Array.from({ length: n }, (_, i) => (i * seed + 13) % 256);

test("a printed pack of pictures and sounds is claimed and every sound comes back byte for byte", async () => {
  const mp3 = sound(5000, 3), ogg = sound(3000, 5), png = bytes(40);
  const archive = await printed([{ label: "Tavern", mime: "audio/mpeg", data: mp3 }, { label: "Rain", mime: "audio/ogg", data: ogg }, { label: "Face", mime: "image/png", data: png }]);
  expect(imagePack.detect({ bytes: archive })).toBeGreaterThanOrEqual(0.5);
  const entity = imagePack.toCanonical({ filename: "Mood.zip", bytes: archive });
  const items = entity.body.pack.items;
  expect(items.map((i) => [i.label, i.mime]).sort()).toEqual([["Face", "image/png"], ["Rain", "audio/ogg"], ["Tavern", "audio/mpeg"]]);
  const back = (label: string): number[] => {
    const ref = items.find((i) => i.label === label)!.ref;
    return [...Buffer.from(ref.slice(ref.indexOf(",") + 1), "base64")];
  };
  expect(back("Tavern")).toEqual([...mp3]);
  expect(back("Rain")).toEqual([...ogg]);
  expect(back("Face")).toEqual([...png]);
});

test("a zip of sounds alone is a pack; a sound over the media cap or a picture over the picture limit is refused", async () => {
  expect(imagePack.detect({ bytes: zip({ "a.mp3": sound(100, 3), "b.flac": sound(100, 5) }) })).toBeGreaterThanOrEqual(0.5);
  const big = zipSync({ "long.mp3": new Uint8Array(33 * 1024 * 1024) }, { level: 0 });
  expect(() => imagePack.toCanonical({ filename: "x.zip", bytes: big })).toThrow();
  const longSound = zipSync({ "long.mp3": new Uint8Array(20 * 1024 * 1024) }, { level: 6 });
  expect(imagePack.toCanonical({ filename: "x.zip", bytes: longSound }).body.pack.items).toHaveLength(1);
  const bigPicture = zipSync({ "p.png": new Uint8Array(IMAGE_MAX_BYTES + 1) }, { level: 6 });
  expect(() => imagePack.toCanonical({ filename: "x.zip", bytes: bigPicture })).toThrow();
});

test("a sound writes back out as a sound", () => {
  const entity = imagePack.toCanonical({ filename: "m.zip", bytes: zip({ "a.mp3": sound(100, 3), "p.png": bytes(30) }) });
  const out = unzipSync(imagePack.fromCanonical(entity).bytes!);
  expect(Object.keys(out).sort()).toEqual(["a.mp3", "p.png"]);
  expect([...out["a.mp3"]!]).toEqual([...sound(100, 3)]);
});
