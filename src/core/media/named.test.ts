/** Regression coverage for the named.test behavior owned beside this file. */
import { describe, expect, test } from "bun:test";
import { extFromNameOrRef, kindFromExt, normalizeNamed } from "./named";

describe("named", () => {
  test("kindFromExt maps common types", () => {
    expect(kindFromExt("mp3")).toBe("audio");
    expect(kindFromExt("png")).toBe("image");
    expect(kindFromExt("avif")).toBe("image");
    expect(kindFromExt("bmp")).toBe("image");
    expect(kindFromExt("mp4")).toBe("video");
    expect(kindFromExt("ttf")).toBe("font");
    expect(kindFromExt("css")).toBe("css");
    expect(kindFromExt("bin")).toBe("other");
  });

  test("normalizeNamed unique names last wins", () => {
    const n = normalizeNamed({
      items: [
        { id: "1", name: "theme", ref: "a.mp3", ext: "mp3" },
        { id: "2", name: "theme", ref: "b.mp3", ext: "mp3" },
        { id: "3", name: "", ref: "x" },
      ],
    });
    expect(n.items).toHaveLength(1);
    expect(n.items[0]!.ref).toBe("b.mp3");
    expect(n.items[0]!.kind).toBe("audio");
  });

  test("dotless data-URI names infer canonical extensions from the full MIME type", () => {
    expect(extFromNameOrRef("face", "data:image/png;base64,AAAA")).toBe("png");
    expect(extFromNameOrRef("face", "data:image/jpeg;base64,AAAA")).toBe("jpg");
    const n = normalizeNamed({ items: [{ name: "face", ref: "data:image/png;base64,AAAA" }] });
    expect(n.items[0]).toMatchObject({ ext: "png", kind: "image" });
  });
});
