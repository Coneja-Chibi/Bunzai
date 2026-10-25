/** The Sprite pack ZIP writer: collision-free entry names, and an archive built one picture at a time. */
import { describe, expect, test } from "bun:test";
import { unzipSync } from "fflate";
import { packEntryNames, zipStored } from "./pack-zip";

const collect = async (stream: AsyncIterable<Uint8Array>): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
};

describe("packEntryNames", () => {
  test("names are label plus the extension of the picture's type", () => {
    expect(packEntryNames([{ label: "tavern day", mime: "image/jpeg" }, { label: "night", mime: "image/png" }])).toEqual(["tavern day.jpg", "night.png"]);
  });

  test("two pictures that would share a file name stay two files, compared the way Windows compares", () => {
    const names = packEntryNames([
      { label: "Room", mime: "image/png" },
      { label: "room", mime: "image/png" },
      { label: "room", mime: "image/webp" },
      { label: "room (2)", mime: "image/png" },
    ]);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(4);
    expect(names[0]).toBe("Room.png");
    expect(names[2]).toBe("room.webp");
  });

  test("a label cannot name a path or a reserved character", () => {
    const [name] = packEntryNames([{ label: "..\\evil: a/b?", mime: "image/png" }]);
    expect(name).not.toMatch(/[\\/:*?"<>|]/);
    expect(name!.endsWith(".png")).toBe(true);
  });

  test("a label that is a Windows device name still extracts: CON, NUL, COM1 in any case, with or without an extension", () => {
    const labels = ["CON", "nul", "Aux", "PRN", "com1", "LPT9", "con.backup", "Nul.txt"];
    const names = packEntryNames(labels.map((label) => ({ label, mime: "image/png" })));
    for (const name of names) {
      expect(name).not.toMatch(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i);
      expect(name.endsWith(".png")).toBe(true);
    }
    expect(names[0]).toBe("_CON.png");
  });

  test("a device-name label that collides after the fix is still kept apart", () => {
    const names = packEntryNames([{ label: "CON", mime: "image/png" }, { label: "_con", mime: "image/png" }]);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(2);
  });

  test("a very long label is capped so the extracted path stays short", () => {
    const [name] = packEntryNames([{ label: "x".repeat(400), mime: "image/png" }]);
    expect(name!.length).toBeLessThanOrEqual(84);
  });
});

describe("zipStored", () => {
  test("every picture comes back byte-exact, and each is asked for only when its turn comes", async () => {
    const pictures = [new Uint8Array([1, 2, 3]), new Uint8Array(70_000).fill(7), new Uint8Array([9])];
    const asked: number[] = [];
    const bytes = await collect(zipStored(pictures.map((p, i) => ({ name: `p${i}.png`, bytes: async () => { asked.push(i); return p; } }))));
    expect(asked).toEqual([0, 1, 2]);
    const files = unzipSync(bytes);
    expect(Object.keys(files)).toEqual(["p0.png", "p1.png", "p2.png"]);
    pictures.forEach((p, i) => expect([...files[`p${i}.png`]!]).toEqual([...p]));
  });

  test("a picture that cannot be read ends the archive with the reason, never a short archive", async () => {
    const stream = zipStored([{ name: "a.png", bytes: async () => new Uint8Array([1]) }, { name: "b.png", bytes: async () => { throw new Error("gone"); } }]);
    await expect(collect(stream)).rejects.toThrow("gone");
  });
});
